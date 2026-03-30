from datetime import timedelta
from decimal import Decimal
from uuid import uuid4
import csv
from io import StringIO

from django.conf import settings
from django.core.files.storage import default_storage
from django.http import HttpResponse
from django.db import transaction
from django.db.models import F, Sum
from django.db.utils import IntegrityError
from django.utils import timezone

from rest_framework import routers, status, viewsets
from rest_framework.decorators import (
    action,
    api_view,
    permission_classes,
    throttle_classes,
)
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import SAFE_METHODS, BasePermission
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle

from drf_spectacular.utils import (
    OpenApiParameter,
    OpenApiResponse,
    extend_schema,
    extend_schema_view,
)

from backend_app import models
from backend_app.auth import TokenPair, issue_token_pair, refresh_access_token
from backend_app.security import hash_password, verify_password
from backend_app.domain.order_status import OrderStatus, can_transition
from backend_app.serializers import (
    AccessTokenSerializer,
    AggregateReportSerializer,
    AddressSerializer,
    CartItemSerializer,
    CartSummarySerializer,
    CategorySerializer,
    CheckoutRequestSerializer,
    ImageSerializer,
    ImageUploadSerializer,
    LogoutSerializer,
    LoginSerializer,
    MarkPaidRequestSerializer,
    MarkPaidResponseSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    OrderSerializer,
    ProductSerializer,
    RefundRequestSerializer,
    OrderEventSerializer,
    CustomerMarkPaidSerializer,
    UserInviteSerializer,
    RegisterSerializer,
    RegisterResponseSerializer,
    ReviewSerializer,
    SetProductImagesSerializer,
    ProductImageAltTextSerializer,
    TokenRefreshSerializer,
    TokenPairSerializer,
    UserSerializer,
    WishlistItemSerializer,
    SavedItemSerializer,
    ChangePasswordSerializer,
    EmailVerificationRequestSerializer,
    EmailVerificationConfirmSerializer,
    MeSerializer,
)


class IsAdminOrReadOnly(BasePermission):
    """Public reads; only users with role=admin can write."""

    def has_permission(self, request, view) -> bool:
        if request.method in SAFE_METHODS:
            return True
        return bool(request.user and getattr(request.user, "role", None) == "admin")


class IsAuthenticated(BasePermission):
    def has_permission(self, request, view) -> bool:
        return bool(request.user)


class IsAdmin(BasePermission):
    def has_permission(self, request, view) -> bool:
        return bool(request.user and getattr(request.user, "role", None) == "admin")


class IsOwnerOrAdmin(BasePermission):
    """Object-level: allow admins; otherwise allow owners (obj.user == request.user)."""

    def has_object_permission(self, request, view, obj) -> bool:
        if request.user and getattr(request.user, "role", None) == "admin":
            return True
        return bool(request.user and getattr(obj, "user_id", None) == request.user.id)


def _create_order_from_cart(
    *, user: models.User, idempotency_key: str | None = None
) -> models.Order:
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
            subtotal += product.price * requested

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

        def _get_order_currency() -> str:
            return str(getattr(settings, "ORDER_CURRENCY", "USD") or "USD")

        def _get_base_currency() -> str:
            return str(getattr(settings, "ORDER_BASE_CURRENCY", "USD") or "USD")

        def _get_fx_rate() -> Decimal:
            raw = getattr(settings, "ORDER_FX_RATE", "1")
            try:
                return Decimal(str(raw))
            except Exception:
                return Decimal("1")

        def _dec_from_setting(name: str, default: str = "0") -> Decimal:
            raw = getattr(settings, name, default)
            try:
                return Decimal(str(raw))
            except Exception:
                return Decimal(default)

        def _calc_shipping(subtotal_amount: Decimal) -> Decimal:
            flat = _dec_from_setting("ORDER_SHIPPING_FLAT", "0")
            return flat if subtotal_amount > 0 else Decimal("0")

        def _calc_tax(subtotal_amount: Decimal) -> Decimal:
            rate = _dec_from_setting("ORDER_TAX_RATE", "0")
            return (subtotal_amount * rate).quantize(Decimal("0.01"))

        def _calc_discount(subtotal_amount: Decimal) -> Decimal:
            rate = _dec_from_setting("ORDER_DISCOUNT_RATE", "0")
            return (subtotal_amount * rate).quantize(Decimal("0.01"))

        shipping = _calc_shipping(subtotal)
        tax = _calc_tax(subtotal)
        discount = _calc_discount(subtotal)
        total = subtotal + shipping + tax - discount
        base_currency = _get_base_currency()
        fx_rate = _get_fx_rate()

        try:
            order = models.Order.objects.create(
                user=user,
                status=OrderStatus.PLACED,
                currency=_get_order_currency(),
                base_currency=base_currency,
                fx_rate=fx_rate,
                subtotal=subtotal,
                shipping=shipping,
                tax=tax,
                discount=discount,
                total=total,
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
    ordering_fields = ["created_at", "updated_at", "id", "username", "email"]
    ordering = ["-created_at"]

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
    @action(
        detail=True,
        methods=["get"],
        url_path="orders",
        permission_classes=[IsAuthenticated],
    )
    def orders(self, request, pk=None):
        """List orders for a specific user.

        - Self: allowed for any authenticated user.
        - Other users: admin-only.
        """

        try:
            user_id = int(pk)
        except (TypeError, ValueError):
            return Response({"detail": "Invalid user id"}, status=status.HTTP_400_BAD_REQUEST)

        is_role_admin = bool(request.user and getattr(request.user, "role", None) == "admin")
        if not is_role_admin and request.user.id != user_id:
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

    @extend_schema(
        tags=["users"],
        summary="Invite user (admin)",
        request=UserInviteSerializer,
        responses={201: UserInviteSerializer},
    )
    @action(detail=False, methods=["post"], url_path="invites", permission_classes=[IsAdmin])
    def invite(self, request):
        serializer = UserInviteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        token = uuid4().hex
        expiry = timezone.now() + timedelta(days=7)
        try:
            invite = models.UserInvite.objects.create(
                email=serializer.validated_data["email"],
                role=serializer.validated_data.get("role", "customer"),
                token=token,
                expires_at=expiry,
            )
        except IntegrityError:
            return Response({"email": "Invite already exists."}, status=status.HTTP_400_BAD_REQUEST)
        return Response(UserInviteSerializer(invite).data, status=status.HTTP_201_CREATED)

    @extend_schema(
        tags=["users"],
        summary="Export users (CSV, admin)",
        responses={200: OpenApiResponse(description="CSV export")},
    )
    @action(detail=False, methods=["get"], url_path="export", permission_classes=[IsAdmin])
    def export_users(self, request):
        output = StringIO()
        writer = csv.writer(output)
        writer.writerow(
            [
                "id",
                "username",
                "email",
                "firstname",
                "lastname",
                "phone",
                "role",
                "status",
                "is_email_verified",
            ]
        )
        for user in models.User.objects.all().order_by("id"):
            writer.writerow(
                [
                    user.id,
                    user.username,
                    user.email,
                    user.firstname or "",
                    user.lastname or "",
                    user.phone or "",
                    user.role,
                    user.status,
                    int(user.is_email_verified),
                ]
            )
        resp = HttpResponse(output.getvalue(), content_type="text/csv")
        resp["Content-Disposition"] = "attachment; filename=users.csv"
        return resp

    @extend_schema(
        tags=["users"],
        summary="Import users (CSV, admin)",
        request=None,
        responses={200: OpenApiResponse(description="Import result")},
    )
    @action(
        detail=False,
        methods=["post"],
        url_path="import",
        permission_classes=[IsAdmin],
        parser_classes=[FormParser, MultiPartParser],
    )
    def import_users(self, request):
        upload = request.FILES.get("file")
        if upload is None:
            return Response({"file": "This field is required."}, status=status.HTTP_400_BAD_REQUEST)

        max_bytes = int(getattr(settings, "CSV_IMPORT_MAX_BYTES", 2 * 1024 * 1024))
        max_rows = int(getattr(settings, "CSV_IMPORT_MAX_ROWS", 1000))

        raw = upload.read()
        if max_bytes >= 0 and len(raw) > max_bytes:
            return Response(
                {"detail": "CSV file is too large."}, status=status.HTTP_400_BAD_REQUEST
            )

        data = raw.decode("utf-8")
        reader = csv.DictReader(StringIO(data))
        created = 0
        updated = 0
        password_default = getattr(settings, "USER_INVITE_DEFAULT_PASSWORD", None)
        errors: list[dict[str, object]] = []
        for idx, row in enumerate(reader, start=1):
            if max_rows >= 0 and idx > max_rows:
                return Response(
                    {"detail": "CSV row limit exceeded."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            email = (row.get("email") or "").strip()
            if not email:
                continue
            raw_password = (row.get("password") or "").strip()
            if not raw_password:
                raw_password = password_default or uuid4().hex
            password_hash = hash_password(raw_password)
            defaults = {
                "username": row.get("username") or email.split("@")[0],
                "firstname": row.get("firstname") or None,
                "lastname": row.get("lastname") or None,
                "phone": row.get("phone") or None,
                "role": row.get("role") or "customer",
                "status": row.get("status") or "active",
                "is_email_verified": bool(int(row.get("is_email_verified") or 0)),
                "password_hash": password_hash,
            }
            try:
                obj, created_flag = models.User.objects.update_or_create(
                    email=email, defaults=defaults
                )
                created += int(created_flag)
                updated += int(not created_flag)
            except IntegrityError:
                errors.append(
                    {
                        "row": idx,
                        "email": email,
                        "detail": "Unique constraint violation.",
                    }
                )

        if errors:
            return Response(
                {
                    "created": created,
                    "updated": updated,
                    "errors": errors,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response({"created": created, "updated": updated})


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
    search_fields = ["name", "description", "sku"]
    ordering_fields = ["name", "price", "created_at", "updated_at", "id", "sku"]
    ordering = ["-created_at"]

    def get_queryset(self):
        qs = super().get_queryset()
        # Public catalog only shows active products.
        user = getattr(self.request, "user", None)
        if not user or getattr(user, "role", None) != "admin":
            qs = qs.filter(status="active", is_published=True)

        category = self.request.query_params.get("category")
        if category:
            qs = qs.filter(category__slug=category)

        min_price = self.request.query_params.get("min_price")
        max_price = self.request.query_params.get("max_price")
        if min_price:
            try:
                qs = qs.filter(price__gte=Decimal(min_price))
            except Exception:
                pass
        if max_price:
            try:
                qs = qs.filter(price__lte=Decimal(max_price))
            except Exception:
                pass
        return qs

    @extend_schema(
        tags=["products"],
        summary="Archive product (admin)",
        responses={200: ProductSerializer},
    )
    @action(detail=True, methods=["post"], url_path="archive", permission_classes=[IsAdmin])
    def archive(self, request, pk=None):
        product = self.get_object()
        product.status = "archived"
        product.save(update_fields=["status", "updated_at"])
        return Response(ProductSerializer(product, context={"request": request}).data)

    @extend_schema(
        tags=["products"],
        summary="Export products (CSV, admin)",
        responses={200: OpenApiResponse(description="CSV export")},
    )
    @action(detail=False, methods=["get"], url_path="export", permission_classes=[IsAdmin])
    def export_csv(self, request):
        output = StringIO()
        writer = csv.writer(output)
        writer.writerow(
            [
                "id",
                "sku",
                "name",
                "description",
                "price",
                "status",
                "stock_qty",
                "reserved_qty",
                "category_id",
                "is_featured",
                "is_published",
                "availability",
            ]
        )
        for product in models.Product.objects.all().order_by("id"):
            writer.writerow(
                [
                    product.id,
                    product.sku or "",
                    product.name,
                    product.description or "",
                    product.price,
                    product.status,
                    product.stock_qty,
                    product.reserved_qty,
                    product.category_id or "",
                    int(product.is_featured),
                    int(product.is_published),
                    product.availability,
                ]
            )
        resp = HttpResponse(output.getvalue(), content_type="text/csv")
        resp["Content-Disposition"] = "attachment; filename=products.csv"
        return resp

    @extend_schema(
        tags=["products"],
        summary="Import products (CSV, admin)",
        request=None,
        responses={200: OpenApiResponse(description="Import result")},
    )
    @action(
        detail=False,
        methods=["post"],
        url_path="import",
        permission_classes=[IsAdmin],
        parser_classes=[FormParser, MultiPartParser],
    )
    def import_csv(self, request):
        upload = request.FILES.get("file")
        if upload is None:
            return Response({"file": "This field is required."}, status=status.HTTP_400_BAD_REQUEST)

        max_bytes = int(getattr(settings, "CSV_IMPORT_MAX_BYTES", 2 * 1024 * 1024))
        max_rows = int(getattr(settings, "CSV_IMPORT_MAX_ROWS", 1000))

        raw = upload.read()
        if max_bytes >= 0 and len(raw) > max_bytes:
            return Response(
                {"detail": "CSV file is too large."}, status=status.HTTP_400_BAD_REQUEST
            )

        data = raw.decode("utf-8")
        reader = csv.DictReader(StringIO(data))
        created = 0
        updated = 0
        for idx, row in enumerate(reader, start=1):
            if max_rows >= 0 and idx > max_rows:
                return Response(
                    {"detail": "CSV row limit exceeded."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            sku = (row.get("sku") or "").strip() or None
            defaults = {
                "name": row.get("name") or "",
                "description": row.get("description") or None,
                "price": row.get("price") or "0",
                "status": row.get("status") or "active",
                "stock_qty": int(row.get("stock_qty") or 0),
                "reserved_qty": int(row.get("reserved_qty") or 0),
                "category_id": int(row.get("category_id") or 0) or None,
                "is_featured": bool(int(row.get("is_featured") or 0)),
                "is_published": bool(int(row.get("is_published") or 1)),
                "availability": row.get("availability") or "in_stock",
            }
            if sku:
                _, created_flag = models.Product.objects.update_or_create(
                    sku=sku, defaults=defaults
                )
            else:
                models.Product.objects.create(**defaults)
                created_flag = True
            created += int(created_flag)
            updated += int(not created_flag)
        return Response({"created": created, "updated": updated})

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
    @action(
        detail=True,
        methods=["post"],
        url_path="images/set",
        permission_classes=[IsAdmin],
    )
    def set_images(self, request, pk=None):
        """Replace all product image associations.

        Payload:
          {"image_ids": [1,2,3]}
        """

        product = self.get_object()
        image_ids = request.data.get("image_ids")
        if not isinstance(image_ids, list):
            return Response(
                {"image_ids": "Must be a list of IDs."},
                status=status.HTTP_400_BAD_REQUEST,
            )

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
            return Response(
                {"image_ids": "One or more images not found."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            models.ProductImage.objects.filter(product=product).delete()
            models.ProductImage.objects.bulk_create(
                [models.ProductImage(product=product, image=img) for img in images]
            )

        return Response(ProductSerializer(product, context={"request": request}).data)

    @extend_schema(
        tags=["products"],
        summary="Set product image alt text",
        request=ProductImageAltTextSerializer,
        responses={200: ProductSerializer},
    )
    @action(
        detail=True,
        methods=["post"],
        url_path="images/alt-text",
        permission_classes=[IsAdmin],
    )
    def set_image_alt_text(self, request, pk=None):
        product = self.get_object()
        serializer = ProductImageAltTextSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        image_id = serializer.validated_data["image_id"]
        alt_text = serializer.validated_data.get("alt_text")

        try:
            product_image = models.ProductImage.objects.get(product=product, image_id=image_id)
        except models.ProductImage.DoesNotExist:
            return Response(
                {"detail": "Image not associated with product."},
                status=status.HTTP_404_NOT_FOUND,
            )

        product_image.alt_text = alt_text
        product_image.save(update_fields=["alt_text", "updated_at"])
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
        if getattr(user, "role", None) == "admin":
            return qs
        return qs.filter(user=user)

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        return ctx

    @extend_schema(
        tags=["orders"],
        summary="Ship order (admin)",
        request=None,
        responses={200: OrderSerializer},
    )
    @action(detail=True, methods=["post"], url_path="ship", permission_classes=[IsAdmin])
    def ship(self, request, pk=None):
        order = self.get_object()
        if not can_transition(from_status=order.status, to_status=OrderStatus.SHIPPED):
            return Response(
                {"detail": "Invalid status transition"}, status=status.HTTP_409_CONFLICT
            )
        order.status = OrderStatus.SHIPPED
        order.shipped_at = timezone.now()
        order.save(update_fields=["status", "shipped_at", "updated_at"])
        models.OrderEvent.objects.create(order=order, event_type="shipped")
        return Response(OrderSerializer(order, context={"request": request}).data)

    @extend_schema(
        tags=["orders"],
        summary="Deliver order (admin)",
        request=None,
        responses={200: OrderSerializer},
    )
    @action(detail=True, methods=["post"], url_path="deliver", permission_classes=[IsAdmin])
    def deliver(self, request, pk=None):
        order = self.get_object()
        if not can_transition(from_status=order.status, to_status=OrderStatus.DELIVERED):
            return Response(
                {"detail": "Invalid status transition"}, status=status.HTTP_409_CONFLICT
            )
        order.status = OrderStatus.DELIVERED
        order.delivered_at = timezone.now()
        order.save(update_fields=["status", "delivered_at", "updated_at"])
        models.OrderEvent.objects.create(order=order, event_type="delivered")
        return Response(OrderSerializer(order, context={"request": request}).data)

    @extend_schema(
        tags=["orders"],
        summary="Approve refund (admin)",
        request=None,
        responses={200: OrderSerializer},
    )
    @action(
        detail=True,
        methods=["post"],
        url_path="refund-approve",
        permission_classes=[IsAdmin],
    )
    def admin_refund(self, request, pk=None):
        order = self.get_object()
        models.OrderEvent.objects.create(order=order, event_type="refund_approved")
        return Response(OrderSerializer(order, context={"request": request}).data)

    def get_permissions(self):
        # Customers use POST /checkout/.
        if self.action in {"create", "update", "partial_update", "destroy"}:
            return [IsAdmin()]
        return [IsAuthenticated()]

    @extend_schema(
        tags=["orders"],
        summary="Cancel order (customer)",
        description="Allow a customer to cancel their own placed order before it is paid/shipped.",
        responses={
            200: OrderSerializer,
            400: OpenApiResponse(description="Invalid state"),
        },
    )
    @action(
        detail=True,
        methods=["post"],
        url_path="cancel",
        permission_classes=[IsAuthenticated],
    )
    def cancel(self, request, pk=None):
        try:
            order = models.Order.objects.get(pk=pk)
        except models.Order.DoesNotExist:
            return Response({"detail": "Order not found"}, status=status.HTTP_404_NOT_FOUND)

        if not (getattr(request.user, "role", None) == "admin" or order.user_id == request.user.id):
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

        if not can_transition(from_status=order.status, to_status=OrderStatus.CANCELLED):
            return Response(
                {"detail": "Cannot cancel in current status"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if order.status == OrderStatus.CANCELLED:
            return Response(OrderSerializer(order, context={"request": request}).data)

        # Release reserved stock.
        with transaction.atomic():
            order = models.Order.objects.select_for_update().get(pk=pk)
            if not can_transition(from_status=order.status, to_status=OrderStatus.CANCELLED):
                return Response(
                    {"detail": "Cannot cancel in current status"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            order.status = OrderStatus.CANCELLED
            order.cancelled_at = timezone.now()
            order.save(update_fields=["status", "cancelled_at", "updated_at"])

            # Release reserved quantities
            contents = list(models.OrderContent.objects.filter(order=order))
            now = timezone.now()
            for line in contents:
                models.Product.objects.filter(id=line.product_id).update(
                    reserved_qty=F("reserved_qty") - int(line.count),
                    updated_at=now,
                )

            models.OrderEvent.objects.create(order=order, event_type="cancelled")

        return Response(OrderSerializer(order, context={"request": request}).data)

    @extend_schema(
        tags=["orders", "payments"],
        summary="Mark order as paid (customer stub)",
        description=(
            "Customer-facing stub payment that marks an order as paid. "
            "Uses the same idempotent stub flow as admin mark_paid."
        ),
        request=CustomerMarkPaidSerializer,
        responses={
            200: MarkPaidResponseSerializer,
            404: OpenApiResponse(description="Order not found"),
        },
    )
    @action(
        detail=True,
        methods=["post"],
        url_path="pay",
        permission_classes=[IsAuthenticated],
    )
    def pay(self, request, pk=None):
        serializer = CustomerMarkPaidSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        order_id = int(pk)
        idempotency_key = request.headers.get("Idempotency-Key") or serializer.validated_data.get(
            "idempotency_key"
        )
        reference_id = serializer.validated_data.get("reference_id")
        if idempotency_key is not None and not str(idempotency_key).strip():
            idempotency_key = None

        try:
            order = models.Order.objects.get(id=order_id)
        except models.Order.DoesNotExist:
            return Response({"detail": "Order not found"}, status=status.HTTP_404_NOT_FOUND)

        if order.user_id != request.user.id:
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

        # Reuse the admin stub logic by calling mark_paid implementation directly
        with transaction.atomic():
            if idempotency_key:
                existing = models.PaymentAttempt.objects.filter(
                    order=order, idempotency_key=idempotency_key
                ).first()
                if existing:
                    if order.status != OrderStatus.PAID:
                        if not can_transition(from_status=order.status, to_status=OrderStatus.PAID):
                            return Response(
                                {
                                    "detail": f"Invalid status transition: {order.status} -> {OrderStatus.PAID}."
                                },
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
                return Response(
                    {"order": OrderSerializer(order, context={"request": request}).data}
                )

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
                attempt = models.PaymentAttempt.objects.get(
                    order=order, idempotency_key=idempotency_key
                )

            if not can_transition(from_status=order.status, to_status=OrderStatus.PAID):
                return Response(
                    {"detail": f"Invalid status transition: {order.status} -> {OrderStatus.PAID}."},
                    status=status.HTTP_409_CONFLICT,
                )
            order.status = OrderStatus.PAID
            order.paid_at = timezone.now()
            order.save(update_fields=["status", "paid_at", "updated_at"])

            models.OrderEvent.objects.create(
                order=order, event_type="paid", note=reference_id or None
            )

            return Response(
                {
                    "order": OrderSerializer(order, context={"request": request}).data,
                    "payment_attempt_id": attempt.id,
                },
                status=status.HTTP_200_OK,
            )

    @extend_schema(
        tags=["orders"],
        summary="Download invoice (stub)",
        description="Return a minimal text invoice for the order.",
        responses={200: OpenApiResponse(description="Invoice text")},
    )
    @action(
        detail=True,
        methods=["get"],
        url_path="invoice",
        permission_classes=[IsAuthenticated],
    )
    def invoice(self, request, pk=None):
        order = self.get_object()
        if order.user_id != request.user.id and getattr(request.user, "role", None) != "admin":
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

        content = (
            f"Invoice for Order #{order.id}\n"
            f"Status: {order.status}\n"
            f"Subtotal: {order.subtotal}\n"
            f"Shipping: {order.shipping}\n"
            f"Tax: {order.tax}\n"
            f"Discount: {order.discount}\n"
            f"Total: {order.total}\n"
        )
        return Response({"invoice": content})

    @extend_schema(
        tags=["orders"],
        summary="Request refund",
        request=RefundRequestSerializer,
        responses={201: RefundRequestSerializer},
    )
    @action(
        detail=True,
        methods=["post"],
        url_path="refund",
        permission_classes=[IsAuthenticated],
    )
    def refund(self, request, pk=None):
        order = self.get_object()
        if order.user_id != request.user.id:
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

        serializer = RefundRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        obj = models.RefundRequest.objects.create(
            order=order,
            user=request.user,
            reason=serializer.validated_data.get("reason"),
        )
        models.OrderEvent.objects.create(
            order=order, event_type="refund_requested", note=obj.reason or None
        )
        return Response(RefundRequestSerializer(obj).data, status=status.HTTP_201_CREATED)

    @extend_schema(
        tags=["orders"],
        summary="List order timeline",
        responses={200: OrderEventSerializer(many=True)},
    )
    @action(
        detail=True,
        methods=["get"],
        url_path="timeline",
        permission_classes=[IsAuthenticated],
    )
    def timeline(self, request, pk=None):
        order = self.get_object()
        if order.user_id != request.user.id and getattr(request.user, "role", None) != "admin":
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)
        events = models.OrderEvent.objects.filter(order=order).order_by("created_at")
        return Response(OrderEventSerializer(events, many=True).data)


@extend_schema_view(
    list=extend_schema(tags=["addresses"], summary="List addresses"),
    retrieve=extend_schema(tags=["addresses"], summary="Get address"),
    create=extend_schema(tags=["addresses"], summary="Create address"),
    update=extend_schema(tags=["addresses"], summary="Update address"),
    partial_update=extend_schema(tags=["addresses"], summary="Patch address"),
    destroy=extend_schema(tags=["addresses"], summary="Delete address"),
)
class AddressViewSet(viewsets.ModelViewSet):
    serializer_class = AddressSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = models.Address.objects.all()
        if not user or getattr(user, "role", None) != "admin":
            qs = qs.filter(user=user)
        return qs.order_by("-is_default", "-updated_at")

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


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
    request=MeSerializer,
    responses={200: MeSerializer},
)
@api_view(["GET", "PATCH"])
@permission_classes([IsAuthenticated])
def me(request):
    if request.method == "GET":
        return Response(MeSerializer(request.user).data)

    serializer = MeSerializer(request.user, data=request.data, partial=True)
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
    tags=["auth"],
    summary="Change password",
    description="Change password for the authenticated user. Requires current password and invalidates prior tokens.",
    request=ChangePasswordSerializer,
    responses={200: OpenApiResponse(description="Password changed")},
)
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def change_password(request):
    serializer = ChangePasswordSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    current_password = serializer.validated_data["current_password"]
    new_password = serializer.validated_data["new_password"]

    # Verify current password
    if not verify_password(current_password, request.user.password_hash):
        return Response(
            {"detail": "Current password is incorrect"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if len(new_password) < 8:
        return Response(
            {"detail": "Password must be at least 8 characters."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    request.user.password_hash = hash_password(new_password)
    request.user.tokens_invalidated_at = timezone.now()
    request.user.save(update_fields=["password_hash", "tokens_invalidated_at", "updated_at"])

    return Response(status=status.HTTP_200_OK)


@extend_schema(
    tags=["checkout"],
    summary="Checkout",
    description=(
        "Create an order from the authenticated user's cart, reserve stock, and clear the cart. "
        "Supports optional idempotency via the Idempotency-Key header and accepts shipping/contact/payment fields."
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
    request=CheckoutRequestSerializer,
    responses={
        201: OrderSerializer,
        400: OpenApiResponse(description="Cart is empty / insufficient stock"),
    },
)
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def checkout(request):
    """Customer checkout.

    Creates an order from the authenticated user's cart and clears the cart.
    """

    idempotency_key = request.headers.get("Idempotency-Key")
    payload = CheckoutRequestSerializer(data=request.data)
    payload.is_valid(raise_exception=True)
    try:
        order = _create_order_from_cart(user=request.user, idempotency_key=idempotency_key)
    except ValueError as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    updates = payload.validated_data

    # Totals must be server-derived. Ignore client-supplied shipping/tax/discount to
    # avoid undercharge/fraud.
    def _dec_from_setting(name: str, default: str = "0") -> Decimal:
        raw = getattr(settings, name, default)
        try:
            return Decimal(str(raw))
        except Exception:
            return Decimal(default)

    def _calc_shipping(subtotal_amount: Decimal) -> Decimal:
        flat = _dec_from_setting("ORDER_SHIPPING_FLAT", "0")
        return flat if subtotal_amount > 0 else Decimal("0")

    def _calc_tax(subtotal_amount: Decimal) -> Decimal:
        rate = _dec_from_setting("ORDER_TAX_RATE", "0")
        return (subtotal_amount * rate).quantize(Decimal("0.01"))

    def _calc_discount(subtotal_amount: Decimal) -> Decimal:
        rate = _dec_from_setting("ORDER_DISCOUNT_RATE", "0")
        return (subtotal_amount * rate).quantize(Decimal("0.01"))

    shipping = _calc_shipping(order.subtotal)
    tax = _calc_tax(order.subtotal)
    discount = _calc_discount(order.subtotal)

    subtotal = order.subtotal
    total_base = subtotal + shipping + tax - discount

    order.shipping = shipping
    order.tax = tax
    order.discount = discount
    order.total = total_base

    for attr in [
        "shipping_full_name",
        "shipping_phone",
        "shipping_address_line1",
        "shipping_address_line2",
        "shipping_city",
        "shipping_state",
        "shipping_postal_code",
        "shipping_country",
        "delivery_method",
        "payment_method",
        "contact_phone",
    ]:
        if updates.get(attr) is not None:
            setattr(order, attr, updates[attr])

    order.save(
        update_fields=[
            "shipping",
            "tax",
            "discount",
            "total",
            "shipping_full_name",
            "shipping_phone",
            "shipping_address_line1",
            "shipping_address_line2",
            "shipping_city",
            "shipping_state",
            "shipping_postal_code",
            "shipping_country",
            "delivery_method",
            "payment_method",
            "contact_phone",
            "updated_at",
        ]
    )
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
    responses={
        200: MarkPaidResponseSerializer,
        404: OpenApiResponse(description="Order not found"),
    },
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
                            {
                                "detail": f"Invalid status transition: {order.status} -> {OrderStatus.PAID}."
                            },
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
            attempt = models.PaymentAttempt.objects.get(
                order=order, idempotency_key=idempotency_key
            )

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

    refunds = models.RefundRequest.objects.count()
    at_risk_products = models.Product.objects.filter(stock_qty__lte=1).count()
    month_start = timezone.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    mtd_orders = models.Order.objects.filter(created_at__gte=month_start).count()

    return Response(
        {
            "users": models.User.objects.count(),
            "products": models.Product.objects.count(),
            "orders": models.Order.objects.count(),
            "paid_orders": paid.count(),
            "revenue": f"{revenue:.2f}",
            "currency": "USD",
            "refunds": refunds,
            "inventory_risk": at_risk_products,
            "mtd_orders": mtd_orders,
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
            subtotal += row.product.price * int(row.count)

        return Response(
            {
                "currency": "USD",
                "subtotal": f"{subtotal:.2f}",
                "shipping": "0",
                "tax": "0",
                "discount": "0",
                "total": f"{subtotal:.2f}",
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


@extend_schema_view(
    list=extend_schema(tags=["wishlist"], summary="List wishlist items"),
    create=extend_schema(tags=["wishlist"], summary="Add to wishlist"),
    destroy=extend_schema(tags=["wishlist"], summary="Remove from wishlist"),
)
class WishlistViewSet(viewsets.ModelViewSet):
    serializer_class = WishlistItemSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return models.WishlistItem.objects.filter(user=self.request.user).select_related("product")

    def perform_create(self, serializer):
        try:
            obj = serializer.save(user=self.request.user)
        except IntegrityError:
            raise ValidationError({"product_id": "Product is already in wishlist."})
        return obj


@extend_schema_view(
    list=extend_schema(tags=["saved"], summary="List saved items"),
    create=extend_schema(tags=["saved"], summary="Save item for later"),
    destroy=extend_schema(tags=["saved"], summary="Remove saved item"),
)
class SavedItemViewSet(viewsets.ModelViewSet):
    serializer_class = SavedItemSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return models.SavedItem.objects.filter(user=self.request.user).select_related("product")

    def perform_create(self, serializer):
        try:
            obj = serializer.save(user=self.request.user)
        except IntegrityError:
            raise ValidationError({"product_id": "Product is already saved."})
        return obj


@extend_schema_view(
    list=extend_schema(tags=["categories"], summary="List categories"),
    create=extend_schema(tags=["categories"], summary="Create category (admin)"),
    update=extend_schema(tags=["categories"], summary="Update category (admin)"),
    partial_update=extend_schema(tags=["categories"], summary="Patch category (admin)"),
    destroy=extend_schema(tags=["categories"], summary="Delete category (admin)"),
)
class CategoryViewSet(viewsets.ModelViewSet):
    queryset = models.Category.objects.all()
    serializer_class = CategorySerializer

    def get_permissions(self):
        if self.request.method in SAFE_METHODS:
            return []
        return [IsAdmin()]


@extend_schema(
    tags=["auth"],
    summary="Logout (blacklist refresh token)",
    request=LogoutSerializer,
    responses={204: OpenApiResponse(description="Logged out")},
)
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def logout(request):
    serializer = LogoutSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    refresh_token = serializer.validated_data["refresh"]
    try:
        refresh_access_token(
            refresh_token=refresh_token
        )  # Validate token structure and blacklist state
    except Exception:
        return Response({"detail": "Invalid refresh token"}, status=status.HTTP_400_BAD_REQUEST)

    from rest_framework_simplejwt.tokens import RefreshToken

    try:
        rt = RefreshToken(refresh_token)
        jti = rt["jti"]
        exp = rt["exp"]
    except Exception:
        return Response({"detail": "Invalid refresh token"}, status=status.HTTP_400_BAD_REQUEST)

    models.BlacklistedToken.objects.get_or_create(
        jti=jti,
        defaults={
            "user": request.user,
            "token_type": "refresh",
            "expires_at": timezone.datetime.fromtimestamp(exp, tz=timezone.utc),
        },
    )
    return Response(status=status.HTTP_204_NO_CONTENT)


@extend_schema(
    tags=["auth"],
    summary="Request password reset",
    request=PasswordResetRequestSerializer,
    responses={204: OpenApiResponse(description="Email sent")},
)
@api_view(["POST"])
@permission_classes([])
@throttle_classes([ScopedRateThrottle])
def password_reset_request(request):
    setattr(password_reset_request, "throttle_scope", "password_reset")
    serializer = PasswordResetRequestSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    email = serializer.validated_data["email"]
    user = models.User.objects.filter(email=email).first()
    if user:
        now = timezone.now()

        # Cleanup expired tokens globally to avoid unbounded growth.
        models.PasswordResetToken.objects.filter(expires_at__lte=now).delete()

        # Enforce per-user cap on active tokens.
        max_tokens = int(getattr(settings, "PASSWORD_RESET_MAX_ACTIVE_TOKENS_PER_USER", 1))
        # If we are going to create a new token, keep at most (max_tokens - 1)
        # existing tokens so the total stays within limit.
        keep_existing = max(0, max_tokens - 1) if max_tokens >= 0 else None
        active_qs = models.PasswordResetToken.objects.filter(
            user=user, used_at__isnull=True, expires_at__gt=now
        ).order_by("-created_at")
        if keep_existing is not None:
            excess_ids = list(active_qs.values_list("pk", flat=True)[keep_existing:])
            if excess_ids:
                models.PasswordResetToken.objects.filter(pk__in=excess_ids).delete()

        token = uuid4().hex
        expiry = now + timedelta(hours=1)
        models.PasswordResetToken.objects.create(user=user, token=token, expires_at=expiry)
        # NOTE: In a real system we'd send email here.
    return Response(status=status.HTTP_204_NO_CONTENT)


@extend_schema(
    tags=["auth"],
    summary="Confirm password reset",
    request=PasswordResetConfirmSerializer,
    responses={200: OpenApiResponse(description="Password updated")},
)
@api_view(["POST"])
@permission_classes([])
@throttle_classes([ScopedRateThrottle])
def password_reset_confirm(request):
    setattr(password_reset_confirm, "throttle_scope", "password_reset")
    serializer = PasswordResetConfirmSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    token = serializer.validated_data["token"]
    password = serializer.validated_data["password"]
    with transaction.atomic():
        prt = (
            models.PasswordResetToken.objects.select_for_update()
            .filter(token=token, used_at__isnull=True, expires_at__gt=timezone.now())
            .first()
        )
        if not prt:
            return Response(
                {"detail": "Invalid or expired token"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = prt.user

        user.password_hash = hash_password(password)
        user.tokens_invalidated_at = timezone.now()
        user.save(update_fields=["password_hash", "tokens_invalidated_at", "updated_at"])
        prt.used_at = timezone.now()
        prt.save(update_fields=["used_at"])

        # Invalidate any other active reset tokens for this user
        models.PasswordResetToken.objects.filter(
            user=user,
            used_at__isnull=True,
        ).exclude(
            pk=prt.pk
        ).update(used_at=timezone.now())

    return Response(status=status.HTTP_200_OK)


@extend_schema(
    tags=["auth"],
    summary="Request email verification",
    request=EmailVerificationRequestSerializer,
    responses={204: OpenApiResponse(description="Verification email sent")},
)
@api_view(["POST"])
@permission_classes([])
@throttle_classes([ScopedRateThrottle])
def email_verification_request(request):
    setattr(email_verification_request, "throttle_scope", "email_verification")
    serializer = EmailVerificationRequestSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    email = serializer.validated_data["email"]
    user = models.User.objects.filter(email=email).first()
    if user and not user.is_email_verified:
        now = timezone.now()

        # Cleanup expired tokens globally to avoid unbounded growth.
        models.EmailVerificationToken.objects.filter(expires_at__lte=now).delete()

        # Enforce per-user cap on active tokens.
        max_tokens = int(getattr(settings, "EMAIL_VERIFICATION_MAX_ACTIVE_TOKENS_PER_USER", 1))
        active_qs = models.EmailVerificationToken.objects.filter(
            user=user, used_at__isnull=True, expires_at__gt=now
        ).order_by("-created_at")
        if max_tokens >= 0:
            excess_ids = list(active_qs.values_list("pk", flat=True)[max_tokens:])
            if excess_ids:
                models.EmailVerificationToken.objects.filter(pk__in=excess_ids).delete()

        token = uuid4().hex
        expiry = now + timedelta(hours=24)
        models.EmailVerificationToken.objects.create(user=user, token=token, expires_at=expiry)
        # NOTE: In a real system we'd send email here.
    return Response(status=status.HTTP_204_NO_CONTENT)


@extend_schema(
    tags=["auth"],
    summary="Confirm email verification",
    request=EmailVerificationConfirmSerializer,
    responses={200: OpenApiResponse(description="Email verified")},
)
@api_view(["POST"])
@permission_classes([])
@throttle_classes([ScopedRateThrottle])
def email_verification_confirm(request):
    setattr(email_verification_confirm, "throttle_scope", "email_verification")
    serializer = EmailVerificationConfirmSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    token = serializer.validated_data["token"]
    with transaction.atomic():
        evt = (
            models.EmailVerificationToken.objects.select_for_update()
            .filter(token=token, used_at__isnull=True, expires_at__gt=timezone.now())
            .first()
        )
        if not evt:
            return Response(
                {"detail": "Invalid or expired token"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = evt.user
        if not user.is_email_verified:
            user.is_email_verified = True
            user.email_verified_at = timezone.now()
            user.save(update_fields=["is_email_verified", "email_verified_at", "updated_at"])

        evt.used_at = timezone.now()
        evt.save(update_fields=["used_at"])

    return Response(status=status.HTTP_200_OK)


router.register(r"wishlist", WishlistViewSet, basename="wishlist")
router.register(r"saved", SavedItemViewSet, basename="saved")
router.register(r"categories", CategoryViewSet, basename="category")
router.register(r"addresses", AddressViewSet, basename="address")
