from django.db import transaction
from django.db.utils import IntegrityError
from django.utils import timezone
from datetime import timedelta
from decimal import Decimal
from django.db.models import F, Sum
from django.conf import settings
from django.core.files.storage import default_storage
from uuid import uuid4

from rest_framework import routers, status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import SAFE_METHODS, BasePermission
from rest_framework.response import Response

from drf_spectacular.utils import (
    OpenApiParameter,
    OpenApiResponse,
    extend_schema,
    extend_schema_view,
)

from backend_app import models
from backend_app.auth import TokenPair, issue_token_pair, refresh_access_token
from backend_app.domain.order_status import OrderStatus, can_transition
from backend_app.serializers import (
    AccessTokenSerializer,
    AggregateReportSerializer,
    CartItemSerializer,
    CartSummarySerializer,
    ImageSerializer,
    ImageUploadSerializer,
    LoginSerializer,
    MarkPaidRequestSerializer,
    MarkPaidResponseSerializer,
    OrderSerializer,
    ProductSerializer,
    RegisterSerializer,
    RegisterResponseSerializer,
    ReviewSerializer,
    SetProductImagesSerializer,
    TokenRefreshSerializer,
    TokenPairSerializer,
    UserSerializer,
)


class IsAdminOrReadOnly(BasePermission):
    """Public reads; only admin users (backend_app.User.is_admin) can write."""

    def has_permission(self, request, view) -> bool:
        if request.method in SAFE_METHODS:
            return True
        return bool(request.user and getattr(request.user, "is_admin", False))


class IsAuthenticated(BasePermission):
    def has_permission(self, request, view) -> bool:
        return bool(request.user)


class IsAdmin(BasePermission):
    def has_permission(self, request, view) -> bool:
        return bool(request.user and getattr(request.user, "is_admin", False))


class IsOwnerOrAdmin(BasePermission):
    """Object-level: allow admins; otherwise allow owners (obj.user == request.user)."""

    def has_object_permission(self, request, view, obj) -> bool:
        if request.user and getattr(request.user, "is_admin", False):
            return True
        return bool(request.user and getattr(obj, "user_id", None) == request.user.id)


def _create_order_from_cart(*, user: models.User, idempotency_key: str | None = None) -> models.Order:
    """Create an order from the user's cart contents and clear the cart.

    NOTE: totals snapshot and order status are added in later phases.
    """

    # Checkout must be atomic (no partial order/lines/stock reservations) and
    # concurrency-safe (no oversell due to read-modify-write races).
    with transaction.atomic():
        # Preserve current idempotency behavior: if an order already exists for
        # (user, idempotency_key), return it and do not alter cart/stock.
        if idempotency_key:
            existing = (
                models.Order.objects.select_for_update()
                .filter(user=user, idempotency_key=idempotency_key)
                .first()
            )
            if existing:
                return existing

        # Lock cart rows for this user so concurrent checkouts cannot double-spend
        # the same cart contents.
        cart_items = list(
            models.Cart.objects.select_for_update().filter(user=user).select_related("product")
        )
        if not cart_items:
            raise ValueError("Cart is empty")

        # Lock all involved products in a stable order to avoid oversell.
        product_ids = sorted({row.product_id for row in cart_items})
        products = list(
            models.Product.objects.select_for_update().filter(id__in=product_ids).order_by("id")
        )
        products_by_id = {p.id: p for p in products}

        # Validate product availability and compute totals (under lock).
        subtotal = Decimal("0")
        reserve_by_product_id: dict[int, int] = {}
        for item in cart_items:
            product = products_by_id.get(item.product_id)
            if not product or product.status != "active":
                raise ValueError("Product is not available")

            requested = int(item.count)
            available = int(product.stock_qty) - int(product.reserved_qty)
            if requested > available:
                raise ValueError("Insufficient stock")

            reserve_by_product_id[item.product_id] = requested
            subtotal += (product.price * requested)

        # Idempotency race safety:
        # - We already do a best-effort "existing" check above.
        # - Under concurrency, two requests can still reach this create and one will
        #   lose on the DB unique constraint. Convert that into a clean idempotent
        #   return (instead of a 500).
        # Simple env-based TTL; used to set reservation_expires_at.
        # (Imported lazily to avoid settings import at module import time.)
        from django.conf import settings

        reservation_ttl_seconds = int(getattr(settings, "ORDER_RESERVATION_TTL_SECONDS", 30 * 60))
        reservation_expires_at = timezone.now() + timedelta(seconds=reservation_ttl_seconds)

        try:
            order = models.Order.objects.create(
                user=user,
                status=OrderStatus.PLACED,
                currency="USD",
                subtotal=subtotal,
                shipping=0,
                tax=0,
                discount=0,
                total=subtotal,
                idempotency_key=idempotency_key or None,
                placed_at=timezone.now(),
                reservation_expires_at=reservation_expires_at,
            )
        except IntegrityError:
            if not idempotency_key:
                raise
            # The conflicting order must already exist (and be committed) because
            # the unique violation is detected against the unique index.
            return models.Order.objects.get(user=user, idempotency_key=idempotency_key)

        # Create line items and reserve stock. Use DB-atomic increments.
        models.OrderContent.objects.bulk_create(
            [
                models.OrderContent(order=order, product_id=item.product_id, count=item.count)
                for item in cart_items
            ]
        )

        now = timezone.now()
        for product_id, delta in reserve_by_product_id.items():
            models.Product.objects.filter(id=product_id).update(
                reserved_qty=F("reserved_qty") + int(delta),
                updated_at=now,
            )

        models.Cart.objects.filter(user=user).delete()
        return order


@extend_schema_view(
    list=extend_schema(tags=["users"], summary="List users (admin)"),
    retrieve=extend_schema(tags=["users"], summary="Get user (admin)"),
    create=extend_schema(tags=["users"], summary="Create user (admin)"),
    update=extend_schema(tags=["users"], summary="Update user (admin)"),
    partial_update=extend_schema(tags=["users"], summary="Partially update user (admin)"),
    destroy=extend_schema(tags=["users"], summary="Delete user (admin)"),
)
class UserViewSet(viewsets.ModelViewSet):
    queryset = models.User.objects.all()
    serializer_class = UserSerializer
    # User admin endpoints. Customer registration/login is done via /auth/*.
    permission_classes = [IsAdmin]

    @extend_schema(
        tags=["orders", "users"],
        summary="List orders for a user",
        description=(
            "Return orders for the user identified by {id}. "
            "Authorization: authenticated users can access their own orders; "
            "accessing other users' orders requires admin privileges."
        ),
        responses={
            200: OrderSerializer(many=True),
            403: OpenApiResponse(description="Forbidden"),
            404: OpenApiResponse(description="User not found"),
        },
    )
    @action(detail=True, methods=["get"], url_path="orders", permission_classes=[IsAuthenticated])
    def orders(self, request, pk=None):
        """List orders for a specific user.

        - Self: allowed for any authenticated user.
        - Other users: admin-only.
        """

        try:
            user_id = int(pk)
        except (TypeError, ValueError):
            return Response({"detail": "Invalid user id"}, status=status.HTTP_400_BAD_REQUEST)

        is_admin = bool(request.user and getattr(request.user, "is_admin", False))
        if not is_admin and request.user.id != user_id:
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

        target = models.User.objects.filter(id=user_id).first()
        if not target:
            return Response({"detail": "User not found"}, status=status.HTTP_404_NOT_FOUND)

        qs = models.Order.objects.filter(user=target).order_by("-created_at")
        page = self.paginate_queryset(qs)
        if page is not None:
            return self.get_paginated_response(
                OrderSerializer(page, many=True, context={"request": request}).data
            )
        return Response(OrderSerializer(qs, many=True, context={"request": request}).data)


@extend_schema_view(
    list=extend_schema(tags=["products"], summary="List products"),
    retrieve=extend_schema(tags=["products"], summary="Get product"),
    create=extend_schema(tags=["products"], summary="Create product"),
    update=extend_schema(tags=["products"], summary="Update product"),
    partial_update=extend_schema(tags=["products"], summary="Partially update product"),
    destroy=extend_schema(tags=["products"], summary="Delete product"),
)
class ProductViewSet(viewsets.ModelViewSet):
    queryset = models.Product.objects.all()
    serializer_class = ProductSerializer
    permission_classes = [IsAdminOrReadOnly]

    # Used by DRF SearchFilter/OrderingFilter (configured in settings).
    search_fields = ["name", "description"]
    ordering_fields = ["name", "price", "created_at", "updated_at", "id"]
    ordering = ["-created_at"]

    def get_queryset(self):
        qs = super().get_queryset()
        # Public catalog only shows active products.
        user = getattr(self.request, "user", None)
        if not user or not getattr(user, "is_admin", False):
            return qs.filter(status="active")
        return qs

    @extend_schema(
        tags=["reviews", "products"],
        summary="List reviews for a product",
        description="Return reviews for the product identified by {id}. Public endpoint.",
        responses={200: ReviewSerializer(many=True)},
    )
    @action(detail=True, methods=["get"], url_path="reviews", permission_classes=[])
    def reviews(self, request, pk=None):
        """List reviews for this product."""

        product = self.get_object()
        qs = models.Review.objects.filter(product=product).order_by("-id")
        page = self.paginate_queryset(qs)
        if page is not None:
            return self.get_paginated_response(
                ReviewSerializer(page, many=True, context={"request": request}).data
            )
        return Response(ReviewSerializer(qs, many=True, context={"request": request}).data)

    @extend_schema(
        tags=["products"],
        summary="Replace product images",
        description="Replace all product image associations with the provided list of image IDs.",
        request=SetProductImagesSerializer,
        responses={200: ProductSerializer},
    )
    @action(detail=True, methods=["post"], url_path="images/set", permission_classes=[IsAdmin])
    def set_images(self, request, pk=None):
        """Replace all product image associations.

        Payload:
          {"image_ids": [1,2,3]}
        """

        product = self.get_object()
        image_ids = request.data.get("image_ids")
        if not isinstance(image_ids, list):
            return Response({"image_ids": "Must be a list of IDs."}, status=status.HTTP_400_BAD_REQUEST)

        # Normalize to ints and reject duplicates up-front to avoid DB unique violations.
        try:
            image_ids_int = [int(x) for x in image_ids]
        except (TypeError, ValueError):
            return Response(
                {"image_ids": "All items must be integer IDs."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if len(image_ids_int) != len(set(image_ids_int)):
            return Response(
                {"image_ids": "Must not contain duplicates."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        images = list(models.Image.objects.filter(id__in=image_ids_int))
        if len(images) != len(set(image_ids_int)):
            return Response({"image_ids": "One or more images not found."}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            models.ProductImage.objects.filter(product=product).delete()
            models.ProductImage.objects.bulk_create(
                [models.ProductImage(product=product, image=img) for img in images]
            )

        return Response(ProductSerializer(product, context={"request": request}).data)


@extend_schema_view(
    list=extend_schema(tags=["orders"], summary="List orders"),
    retrieve=extend_schema(tags=["orders"], summary="Get order"),
    create=extend_schema(tags=["orders"], summary="Create order (admin)"),
    update=extend_schema(tags=["orders"], summary="Update order (admin)"),
    partial_update=extend_schema(tags=["orders"], summary="Partially update order (admin)"),
    destroy=extend_schema(tags=["orders"], summary="Delete order (admin)"),
)
class OrderViewSet(viewsets.ModelViewSet):
    queryset = models.Order.objects.all()
    serializer_class = OrderSerializer

    ordering_fields = ["created_at", "updated_at", "id"]
    ordering = ["-created_at"]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if not user:
            return qs.none()
        if getattr(user, "is_admin", False):
            return qs
        return qs.filter(user=user)

    def get_permissions(self):
        # Customers use POST /checkout/.
        if self.action in {"create", "update", "partial_update", "destroy"}:
            return [IsAdmin()]
        return [IsAuthenticated()]

@extend_schema_view(
    list=extend_schema(tags=["reviews"], summary="List reviews"),
    retrieve=extend_schema(tags=["reviews"], summary="Get review"),
    create=extend_schema(tags=["reviews"], summary="Create review"),
    update=extend_schema(tags=["reviews"], summary="Update review"),
    partial_update=extend_schema(tags=["reviews"], summary="Partially update review"),
    destroy=extend_schema(tags=["reviews"], summary="Delete review"),
)
class ReviewViewSet(viewsets.ModelViewSet):
    queryset = models.Review.objects.all()
    serializer_class = ReviewSerializer

    search_fields = ["text"]
    ordering_fields = ["id", "rating"]
    ordering = ["-id"]

    def perform_create(self, serializer):
        # Customer creates reviews as themselves.
        serializer.save(user=self.request.user)

    def get_permissions(self):
        if self.request.method in SAFE_METHODS:
            return []
        if self.request.method == "POST":
            return [IsAuthenticated()]
        # PATCH/PUT/DELETE
        return [IsOwnerOrAdmin()]


@extend_schema_view(
    list=extend_schema(tags=["images"], summary="List images (admin)"),
    retrieve=extend_schema(tags=["images"], summary="Get image (admin)"),
    create=extend_schema(tags=["images"], summary="Create image (admin)"),
    update=extend_schema(tags=["images"], summary="Update image (admin)"),
    partial_update=extend_schema(tags=["images"], summary="Partially update image (admin)"),
    destroy=extend_schema(tags=["images"], summary="Delete image (admin)"),
)
class ImageViewSet(viewsets.ModelViewSet):
    queryset = models.Image.objects.all()
    serializer_class = ImageSerializer
    permission_classes = [IsAdmin]

    @extend_schema(
        tags=["images"],
        summary="Upload image (admin)",
        description=(
            "Upload an image file and create an Image record. "
            "Stores the file under MEDIA_ROOT and returns the created Image with a URL."
        ),
        request=ImageUploadSerializer,
        responses={201: ImageSerializer},
    )
    @action(
        detail=False,
        methods=["post"],
        url_path="upload",
        permission_classes=[IsAdmin],
        parser_classes=[MultiPartParser, FormParser],
    )
    def upload(self, request):
        upload = request.FILES.get("file")
        if upload is None:
            return Response({"file": "This field is required."}, status=status.HTTP_400_BAD_REQUEST)

        max_bytes = int(getattr(settings, "IMAGE_UPLOAD_MAX_BYTES", 5 * 1024 * 1024))
        if getattr(upload, "size", 0) > max_bytes:
            return Response(
                {"file": f"File is too large. Max is {max_bytes} bytes."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validate by sniffing file signatures.
        # Do NOT trust `upload.content_type` (client-controlled and spoofable).
        def _sniff_ext(f) -> str | None:
            try:
                head = f.read(32) or b""
            finally:
                # Ensure we didn't consume the stream before saving.
                try:
                    f.seek(0)
                except Exception:
                    pass

            if head.startswith(b"\x89PNG\r\n\x1a\n"):
                return ".png"
            if len(head) >= 3 and head[0:3] == b"\xff\xd8\xff":
                return ".jpg"
            if head.startswith(b"GIF87a") or head.startswith(b"GIF89a"):
                return ".gif"
            if len(head) >= 12 and head[0:4] == b"RIFF" and head[8:12] == b"WEBP":
                return ".webp"
            return None

        ext = _sniff_ext(upload)
        if ext is None:
            return Response(
                {"file": "Unsupported or invalid image file. Allowed: jpeg, png, webp, gif."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        name = f"uploads/images/{uuid4().hex}{ext}"
        saved_name = default_storage.save(name, upload)

        media_url = str(getattr(settings, "MEDIA_URL", "/media/") or "/media/")
        relative_url = f"{media_url.rstrip('/')}/{saved_name.lstrip('/')}"

        # Store relative URL; frontend can prefix with API host if needed.
        img = models.Image.objects.create(url=relative_url)
        return Response(ImageSerializer(img, context={"request": request}).data, status=201)


@extend_schema(
    tags=["auth"],
    summary="Register",
    description="Create a new customer user and return a JWT token pair.",
    request=RegisterSerializer,
    responses={201: RegisterResponseSerializer},
)
@api_view(["POST"])
@permission_classes([])
def register(request):
    serializer = RegisterSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    user = serializer.save()
    pair: TokenPair = issue_token_pair(user=user)
    return Response(
        {
            "user": UserSerializer(user).data,
            "access": pair.access,
            "refresh": pair.refresh,
        },
        status=status.HTTP_201_CREATED,
    )


@extend_schema(
    tags=["auth"],
    summary="Login",
    description="Authenticate with username or email + password and return a JWT token pair.",
    request=LoginSerializer,
    responses={200: TokenPairSerializer},
)
@api_view(["POST"])
@permission_classes([])
def login(request):
    serializer = LoginSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    user = serializer.validated_data["user"]
    pair: TokenPair = issue_token_pair(user=user)
    return Response({"access": pair.access, "refresh": pair.refresh})


@extend_schema(
    tags=["auth"],
    summary="Refresh access token",
    description="Exchange a refresh token for a new access token.",
    request=TokenRefreshSerializer,
    responses={200: AccessTokenSerializer},
)
@api_view(["POST"])
@permission_classes([])
def token_refresh(request):
    serializer = TokenRefreshSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    access = refresh_access_token(refresh_token=serializer.validated_data["refresh"])
    return Response({"access": access})


@extend_schema(
    methods=["GET"],
    tags=["users"],
    summary="Get current user",
    description="Return the authenticated user.",
    responses={200: UserSerializer},
)
@extend_schema(
    methods=["PATCH"],
    tags=["users"],
    summary="Update current user",
    description="Partially update editable profile fields for the authenticated user.",
    request=UserSerializer,
    responses={200: UserSerializer},
)
@api_view(["GET", "PATCH"])
@permission_classes([IsAuthenticated])
def me(request):
    if request.method == "GET":
        return Response(UserSerializer(request.user).data)

    serializer = UserSerializer(request.user, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    try:
        serializer.save()
    except IntegrityError:
        # Defensive: serializer-level uniqueness checks can still lose a race.
        return Response(
            {"detail": "Unique constraint violation."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    return Response(serializer.data)


@extend_schema(
    tags=["checkout"],
    summary="Checkout",
    description=(
        "Create an order from the authenticated user's cart, reserve stock, and clear the cart. "
        "Supports optional idempotency via the Idempotency-Key header."
    ),
    parameters=[
        OpenApiParameter(
            name="Idempotency-Key",
            type=str,
            location=OpenApiParameter.HEADER,
            required=False,
            description="Optional idempotency key. If an order already exists for (user, key), it is returned.",
        )
    ],
    request=None,
    responses={201: OrderSerializer, 400: OpenApiResponse(description="Cart is empty / insufficient stock")},
)
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def checkout(request):
    """Customer checkout.

    Creates an order from the authenticated user's cart and clears the cart.
    """

    idempotency_key = request.headers.get("Idempotency-Key")

    try:
        order = _create_order_from_cart(user=request.user, idempotency_key=idempotency_key)
    except ValueError as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    serializer = OrderSerializer(order, context={"request": request})
    return Response(serializer.data, status=status.HTTP_201_CREATED)


@extend_schema(
    tags=["payments"],
    summary="Mark order as paid (stub)",
    description="Admin/system-only payment stub that marks an order as paid. Idempotent via Idempotency-Key.",
    parameters=[
        OpenApiParameter(
            name="Idempotency-Key",
            type=str,
            location=OpenApiParameter.HEADER,
            required=False,
            description="Optional idempotency key for the payment attempt.",
        )
    ],
    request=MarkPaidRequestSerializer,
    responses={200: MarkPaidResponseSerializer, 404: OpenApiResponse(description="Order not found")},
)
@api_view(["POST"])
@permission_classes([IsAdmin])
def mark_paid(request):
    """Payment stub: mark an order as paid (admin/system only)."""

    serializer = MarkPaidRequestSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    order_id: int = serializer.validated_data["order_id"]
    reference_id: str | None = serializer.validated_data.get("reference_id")
    idempotency_key: str | None = (
        request.headers.get("Idempotency-Key")
        or serializer.validated_data.get("idempotency_key")
        or None
    )
    if idempotency_key is not None and not str(idempotency_key).strip():
        idempotency_key = None

    # Payment marking should be atomic and idempotent under concurrency.
    with transaction.atomic():
        try:
            order = models.Order.objects.select_for_update().get(id=order_id)
        except models.Order.DoesNotExist:
            return Response({"detail": "Order not found"}, status=status.HTTP_404_NOT_FOUND)

        if idempotency_key:
            existing = models.PaymentAttempt.objects.filter(
                order=order, idempotency_key=idempotency_key
            ).first()
            if existing:
                # Idempotency: ensure order is paid if a succeeded attempt exists.
                if order.status != OrderStatus.PAID:
                    if not can_transition(from_status=order.status, to_status=OrderStatus.PAID):
                        return Response(
                            {"detail": f"Invalid status transition: {order.status} -> {OrderStatus.PAID}."},
                            status=status.HTTP_409_CONFLICT,
                        )
                    order.status = OrderStatus.PAID
                    order.paid_at = timezone.now()
                    order.save(update_fields=["status", "paid_at", "updated_at"])

                return Response(
                    {
                        "order": OrderSerializer(order, context={"request": request}).data,
                        "payment_attempt_id": existing.id,
                    }
                )

        if order.status == OrderStatus.PAID:
            return Response({"order": OrderSerializer(order, context={"request": request}).data})

        try:
            attempt = models.PaymentAttempt.objects.create(
                order=order,
                provider="stub",
                status="succeeded",
                reference_id=reference_id,
                idempotency_key=idempotency_key or None,
            )
        except IntegrityError:
            if not idempotency_key:
                raise
            attempt = models.PaymentAttempt.objects.get(order=order, idempotency_key=idempotency_key)

        if not can_transition(from_status=order.status, to_status=OrderStatus.PAID):
            return Response(
                {"detail": f"Invalid status transition: {order.status} -> {OrderStatus.PAID}."},
                status=status.HTTP_409_CONFLICT,
            )
        order.status = OrderStatus.PAID
        order.paid_at = timezone.now()
        order.save(update_fields=["status", "paid_at", "updated_at"])

        return Response(
            {
                "order": OrderSerializer(order, context={"request": request}).data,
                "payment_attempt_id": attempt.id,
            },
            status=status.HTTP_200_OK,
        )


@extend_schema(
    tags=["reports"],
    summary="Aggregate report",
    description="Admin-only aggregate metrics based on paid orders.",
    responses={200: AggregateReportSerializer},
)
@api_view(["GET"])
@permission_classes([IsAdmin])
def report_aggregate(request):
    """Simple admin-only aggregate report based on paid orders."""

    paid = models.Order.objects.filter(status=OrderStatus.PAID)
    revenue = paid.aggregate(total=Sum("total"))["total"] or Decimal("0")

    return Response(
        {
            "users": models.User.objects.count(),
            "products": models.Product.objects.count(),
            "orders": models.Order.objects.count(),
            "paid_orders": paid.count(),
            "revenue": str(revenue),
            "currency": "USD",
        }
    )


@extend_schema_view(
    list=extend_schema(tags=["cart"], summary="List cart items"),
    retrieve=extend_schema(tags=["cart"], summary="Get cart item"),
    create=extend_schema(tags=["cart"], summary="Upsert cart item"),
    update=extend_schema(tags=["cart"], summary="Update cart item"),
    partial_update=extend_schema(tags=["cart"], summary="Partially update cart item"),
    destroy=extend_schema(tags=["cart"], summary="Delete cart item"),
)
class CartItemViewSet(viewsets.ModelViewSet):
    serializer_class = CartItemSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return models.Cart.objects.filter(user=self.request.user).select_related("product")

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @extend_schema(
        tags=["cart"],
        summary="Cart summary",
        description="Return the authenticated user's cart items with computed totals.",
        responses={200: CartSummarySerializer},
    )
    @action(detail=False, methods=["get"], url_path="summary")
    def summary(self, request):
        """Return cart items with computed totals."""

        items = list(self.get_queryset())
        subtotal = Decimal("0")
        for row in items:
            subtotal += (row.product.price * int(row.count))

        return Response(
            {
                "currency": "USD",
                "subtotal": str(subtotal),
                "shipping": "0",
                "tax": "0",
                "discount": "0",
                "total": str(subtotal),
                "items": CartItemSerializer(items, many=True, context={"request": request}).data,
            }
        )


router = routers.DefaultRouter()
router.register(r"users", UserViewSet, basename="user")
router.register(r"products", ProductViewSet, basename="product")
router.register(r"images", ImageViewSet, basename="image")
router.register(r"orders", OrderViewSet, basename="order")
router.register(r"reviews", ReviewViewSet, basename="review")
router.register(r"cart/items", CartItemViewSet, basename="cart-item")
