from rest_framework import serializers

from drf_spectacular.utils import extend_schema_field

from django.db import transaction
from django.db.utils import IntegrityError

from backend_app import models
from backend_app.security import hash_password, verify_password


class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, allow_blank=False)
    avatar_id = serializers.PrimaryKeyRelatedField(
        source="avatar",
        queryset=models.Image.objects.all(),
        allow_null=True,
        required=False,
    )

    class Meta:
        model = models.User
        fields = [
            "id",
            "username",
            "email",
            "password",
            "firstname",
            "lastname",
            "description",
            "phone",
            "is_admin",
            "role",
            "status",
            "is_email_verified",
            "email_verified_at",
            "avatar_id",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "is_admin",
            "created_at",
            "updated_at",
        ]

    def create(self, validated_data):
        password = validated_data.pop("password", None)
        if not password:
            raise serializers.ValidationError({"password": "Password is required."})
        if len(password) < 8:
            raise serializers.ValidationError(
                {"password": "Password must be at least 8 characters."}
            )
        validated_data["password_hash"] = hash_password(password)
        # Never allow creating admins via public flows.
        return super().create(validated_data)

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        if password:
            if len(password) < 8:
                raise serializers.ValidationError(
                    {"password": "Password must be at least 8 characters."}
                )
            instance.password_hash = hash_password(password)
        return super().update(instance, validated_data)

    def validate(self, attrs):
        """Prevent DB IntegrityError on unique fields during partial updates.

        The User model enforces uniqueness on username/email/phone at the DB level.
        For /me/ PATCH we want to surface a clean 400 with field errors.
        """

        attrs = super().validate(attrs)

        # Only enforce here for updates (e.g. /me/ PATCH). Registration uses RegisterSerializer.
        if self.instance is None:
            return attrs

        def _conflict(field: str, value, message: str):
            if value is None:
                return
            qs = models.User.objects.filter(**{field: value}).exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError({field: message})

        if "username" in attrs:
            _conflict("username", attrs.get("username"), "Username is already taken.")

        if "email" in attrs:
            _conflict("email", attrs.get("email"), "Email is already taken.")

        if "phone" in attrs:
            phone = attrs.get("phone")
            # Treat blank as clearing the optional phone field.
            if phone == "":
                phone = None
                attrs["phone"] = None
            _conflict("phone", phone, "Phone is already taken.")

        return attrs


class MeSerializer(UserSerializer):
    class Meta(UserSerializer.Meta):
        read_only_fields = UserSerializer.Meta.read_only_fields + [
            "role",
            "status",
            "is_email_verified",
            "email_verified_at",
        ]


class RegisterSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=32)
    email = serializers.EmailField(max_length=64)
    password = serializers.CharField(write_only=True, min_length=8)
    firstname = serializers.CharField(max_length=32, required=False, allow_blank=True)
    lastname = serializers.CharField(max_length=32, required=False, allow_blank=True)

    def validate_username(self, value: str) -> str:
        if models.User.objects.filter(username=value).exists():
            raise serializers.ValidationError("Username is already taken.")
        return value

    def validate_email(self, value: str) -> str:
        if models.User.objects.filter(email=value).exists():
            raise serializers.ValidationError("Email is already taken.")
        return value

    def create(self, validated_data):
        password = validated_data.pop("password")
        user = models.User.objects.create(
            **validated_data,
            is_admin=False,
            password_hash=hash_password(password),
            is_email_verified=False,
        )
        return user


class EmailVerificationRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()


class EmailVerificationConfirmSerializer(serializers.Serializer):
    token = serializers.CharField()


class LoginSerializer(serializers.Serializer):
    username_or_email = serializers.CharField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        ident = attrs.get("username_or_email")
        password = attrs.get("password")

        try:
            user = models.User.objects.get(username=ident)
        except models.User.DoesNotExist:
            try:
                user = models.User.objects.get(email=ident)
            except models.User.DoesNotExist as exc:
                raise serializers.ValidationError("Invalid credentials") from exc

        if not verify_password(password, user.password_hash):
            raise serializers.ValidationError("Invalid credentials")

        if getattr(user, "status", "active") != "active":
            raise serializers.ValidationError("Account is not active")

        attrs["user"] = user
        return attrs


class TokenRefreshSerializer(serializers.Serializer):
    refresh = serializers.CharField()


class ProductSerializer(serializers.ModelSerializer):
    image_ids = serializers.PrimaryKeyRelatedField(source="images", many=True, read_only=True)
    category_id = serializers.PrimaryKeyRelatedField(
        source="category",
        queryset=models.Category.objects.all(),
        allow_null=True,
        required=False,
    )

    class Meta:
        model = models.Product
        fields = [
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
            "image_ids",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "reserved_qty",
            "image_ids",
            "created_at",
            "updated_at",
        ]

    def validate_sku(self, value):
        if value is None or value == "":
            return None
        if (
            models.Product.objects.filter(sku=value)
            .exclude(pk=getattr(self.instance, "pk", None))
            .exists()
        ):
            raise serializers.ValidationError("SKU is already taken.")
        return value


class OrderItemSerializer(serializers.Serializer):
    product_id = serializers.IntegerField(min_value=1)
    count = serializers.IntegerField(min_value=1)


class OrderSerializer(serializers.ModelSerializer):
    user_id = serializers.PrimaryKeyRelatedField(source="user", queryset=models.User.objects.all())
    product_ids = serializers.PrimaryKeyRelatedField(source="products", many=True, read_only=True)
    items = serializers.SerializerMethodField()
    shipping_address = serializers.SerializerMethodField()

    class Meta:
        model = models.Order
        fields = [
            "id",
            "user_id",
            "status",
            "currency",
            "base_currency",
            "fx_rate",
            "subtotal",
            "shipping",
            "tax",
            "discount",
            "total",
            "product_ids",
            "items",
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
            "tracking_number",
            "tracking_url",
            "shipping_address",
            "placed_at",
            "paid_at",
            "cancelled_at",
            "shipped_at",
            "delivered_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "status",
            "currency",
            "base_currency",
            "fx_rate",
            "subtotal",
            "shipping",
            "tax",
            "discount",
            "total",
            "product_ids",
            "placed_at",
            "paid_at",
            "cancelled_at",
            "shipped_at",
            "delivered_at",
            "created_at",
            "updated_at",
        ]

    @extend_schema_field(OrderItemSerializer(many=True))
    def get_items(self, obj: models.Order):
        qs = models.OrderContent.objects.filter(order=obj).select_related("product")
        return [
            {
                "product_id": row.product_id,
                "count": row.count,
            }
            for row in qs
        ]

    @extend_schema_field(serializers.DictField(child=serializers.CharField(), allow_null=True))
    def get_shipping_address(self, obj: models.Order):
        if not obj.shipping_full_name:
            return None
        return {
            "full_name": obj.shipping_full_name,
            "phone": obj.shipping_phone,
            "line1": obj.shipping_address_line1,
            "line2": obj.shipping_address_line2,
            "city": obj.shipping_city,
            "state": obj.shipping_state,
            "postal_code": obj.shipping_postal_code,
            "country": obj.shipping_country,
        }

    def validate(self, attrs):
        request = self.context.get("request")
        if not request or not request.user:
            return attrs
        if getattr(request.user, "is_admin", False):
            return attrs

        # Non-admins cannot create/update orders for other users.
        if "user" in attrs and attrs["user"] != request.user:
            raise serializers.ValidationError({"user_id": "Cannot set user_id for this order."})
        return attrs


class ReviewSerializer(serializers.ModelSerializer):
    user_id = serializers.PrimaryKeyRelatedField(source="user", read_only=True)
    product_id = serializers.PrimaryKeyRelatedField(
        source="product", queryset=models.Product.objects.all()
    )
    image_ids = serializers.PrimaryKeyRelatedField(source="images", many=True, read_only=True)

    class Meta:
        model = models.Review
        fields = ["id", "user_id", "product_id", "rating", "text", "image_ids"]
        read_only_fields = ["id", "image_ids"]

    def validate_rating(self, value: int) -> int:
        """Enforce rating constraints at the API layer.

        NOTE: model.clean() is not automatically called by DRF on writes.
        """
        if not 1 <= value <= 5:
            raise serializers.ValidationError("Rating must be between 1 and 5.")
        return value

    def validate(self, attrs):
        request = self.context.get("request")
        user = getattr(request, "user", None) if request else None
        product = attrs.get("product")

        # Only enforce eligibility on create.
        if self.instance is None and user and product:
            if models.Review.objects.filter(user=user, product=product).exists():
                raise serializers.ValidationError(
                    {"product_id": "You already reviewed this product."}
                )

            eligible = models.OrderContent.objects.filter(
                order__user=user,
                order__status="paid",
                product=product,
            ).exists()
            if not eligible:
                raise serializers.ValidationError({"product_id": "Review requires a paid order."})

        return attrs


class CategorySerializer(serializers.ModelSerializer):
    parent_id = serializers.PrimaryKeyRelatedField(
        source="parent",
        queryset=models.Category.objects.all(),
        allow_null=True,
        required=False,
    )

    class Meta:
        model = models.Category
        fields = ["id", "name", "slug", "parent_id", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]


class AddressSerializer(serializers.ModelSerializer):
    user_id = serializers.PrimaryKeyRelatedField(
        source="user", queryset=models.User.objects.all(), required=False
    )

    class Meta:
        model = models.Address
        fields = [
            "id",
            "user_id",
            "label",
            "full_name",
            "phone",
            "line1",
            "line2",
            "city",
            "state",
            "postal_code",
            "country",
            "is_default",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate(self, attrs):
        request = self.context.get("request")
        if request and not getattr(request.user, "is_admin", False):
            attrs["user"] = request.user
        if attrs.get("is_default"):
            # Ensure only one default per user
            user = attrs.get("user") or getattr(self.instance, "user", None)
            if user:
                qs = models.Address.objects.filter(user=user, is_default=True)
                if self.instance:
                    qs = qs.exclude(pk=self.instance.pk)
                if qs.exists():
                    raise serializers.ValidationError(
                        {"is_default": "Default address already set."}
                    )
        return attrs


class WishlistItemSerializer(serializers.ModelSerializer):
    user_id = serializers.PrimaryKeyRelatedField(
        source="user",
        queryset=models.User.objects.all(),
        required=False,
        default=serializers.CurrentUserDefault(),
    )
    product_id = serializers.PrimaryKeyRelatedField(
        source="product", queryset=models.Product.objects.all()
    )

    class Meta:
        model = models.WishlistItem
        fields = ["id", "user_id", "product_id", "created_at"]
        read_only_fields = ["id", "created_at"]
        validators = []  # handle uniqueness manually to attach errors to product_id

    def validate(self, attrs):
        request = self.context.get("request")
        user = attrs.get("user")
        if request and not getattr(request.user, "is_admin", False):
            user = request.user
            attrs["user"] = user
        product = attrs.get("product")
        if (
            user
            and product
            and models.WishlistItem.objects.filter(user=user, product=product).exists()
        ):
            raise serializers.ValidationError({"product_id": "Product is already in wishlist."})
        return attrs

    def create(self, validated_data):
        # Ensure user is present even if not provided explicitly
        if "user" not in validated_data:
            request = self.context.get("request")
            if request and getattr(request, "user", None):
                validated_data["user"] = request.user

        # Pre-check uniqueness to surface field-specific error instead of non_field_errors
        user = validated_data.get("user")
        product = validated_data.get("product")
        if (
            user
            and product
            and models.WishlistItem.objects.filter(user=user, product=product).exists()
        ):
            raise serializers.ValidationError({"product_id": "Product is already in wishlist."})
        try:
            return super().create(validated_data)
        except IntegrityError as exc:
            raise serializers.ValidationError(
                {"product_id": "Product is already in wishlist."}
            ) from exc


class SavedItemSerializer(serializers.ModelSerializer):
    user_id = serializers.PrimaryKeyRelatedField(
        source="user",
        queryset=models.User.objects.all(),
        required=False,
        default=serializers.CurrentUserDefault(),
    )
    product_id = serializers.PrimaryKeyRelatedField(
        source="product", queryset=models.Product.objects.all()
    )

    class Meta:
        model = models.SavedItem
        fields = ["id", "user_id", "product_id", "created_at"]
        read_only_fields = ["id", "created_at"]
        validators = []

    def validate(self, attrs):
        request = self.context.get("request")
        user = attrs.get("user")
        if request and not getattr(request.user, "is_admin", False):
            user = request.user
            attrs["user"] = user
        product = attrs.get("product")
        if (
            user
            and product
            and models.SavedItem.objects.filter(user=user, product=product).exists()
        ):
            raise serializers.ValidationError({"product_id": "Product is already saved."})
        return attrs

    def create(self, validated_data):
        if "user" not in validated_data:
            request = self.context.get("request")
            if request and getattr(request, "user", None):
                validated_data["user"] = request.user

        user = validated_data.get("user")
        product = validated_data.get("product")
        if (
            user
            and product
            and models.SavedItem.objects.filter(user=user, product=product).exists()
        ):
            raise serializers.ValidationError({"product_id": "Product is already saved."})
        try:
            return super().create(validated_data)
        except IntegrityError as exc:
            raise serializers.ValidationError({"product_id": "Product is already saved."}) from exc


class ImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.Image
        fields = ["id", "url", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]


class ImageUploadSerializer(serializers.Serializer):
    """Multipart upload payload."""

    file = serializers.FileField(help_text="Image file (png/jpg/webp/gif).")


class CartItemSerializer(serializers.ModelSerializer):
    product_id = serializers.PrimaryKeyRelatedField(
        source="product", queryset=models.Product.objects.all()
    )

    class Meta:
        model = models.Cart
        fields = ["id", "product_id", "count", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate_count(self, value: int) -> int:
        if value < 1:
            raise serializers.ValidationError("count must be >= 1")
        return value

    def validate(self, attrs):
        """Validate product availability at the API layer."""

        product = attrs.get("product") or getattr(self.instance, "product", None)
        count = attrs.get("count")
        if product is None or count is None:
            return attrs

        if getattr(product, "status", "active") != "active":
            raise serializers.ValidationError({"product_id": "Product is not available."})

        available = int(getattr(product, "stock_qty", 0)) - int(getattr(product, "reserved_qty", 0))
        if int(count) > available:
            raise serializers.ValidationError({"count": "Insufficient stock."})

        return attrs

    def create(self, validated_data):
        # Upsert: (user, product) is unique.
        user = validated_data["user"]
        product = validated_data["product"]
        count = validated_data["count"]

        # Concurrency-safe-ish upsert:
        # - `get_or_create()` can still race and raise IntegrityError.
        # - We retry as a plain get + update in that case.
        with transaction.atomic():
            try:
                obj, created = models.Cart.objects.get_or_create(
                    user=user,
                    product=product,
                    defaults={"count": count},
                )
            except IntegrityError:
                obj = models.Cart.objects.select_for_update().get(user=user, product=product)
                created = False

            if not created:
                obj.count = count
                obj.save(update_fields=["count", "updated_at"])

            return obj


# ----
# Documentation-only serializers (drf-spectacular)
# ----


class TokenPairSerializer(serializers.Serializer):
    """Access/refresh JWT pair."""

    access = serializers.CharField()
    refresh = serializers.CharField()


class AccessTokenSerializer(serializers.Serializer):
    """Access-only JWT payload (used by refresh endpoint)."""

    access = serializers.CharField()


class RegisterResponseSerializer(serializers.Serializer):
    user = UserSerializer()
    access = serializers.CharField()
    refresh = serializers.CharField()


class SetProductImagesSerializer(serializers.Serializer):
    image_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        allow_empty=True,
        help_text="Replace product images with this ordered list of image IDs.",
    )


class ProductImageAltTextSerializer(serializers.Serializer):
    image_id = serializers.IntegerField(min_value=1)
    alt_text = serializers.CharField(required=False, allow_blank=True, allow_null=True)


class MarkPaidRequestSerializer(serializers.Serializer):
    order_id = serializers.IntegerField(min_value=1)
    reference_id = serializers.CharField(required=False, allow_blank=True)
    idempotency_key = serializers.CharField(required=False, allow_blank=True)


class RefundRequestSerializer(serializers.ModelSerializer):
    order_id = serializers.PrimaryKeyRelatedField(
        source="order",
        queryset=models.Order.objects.all(),
        required=False,
    )
    user_id = serializers.PrimaryKeyRelatedField(source="user", read_only=True)

    class Meta:
        model = models.RefundRequest
        fields = [
            "id",
            "order_id",
            "user_id",
            "reason",
            "status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "status", "created_at", "updated_at", "user_id"]


class OrderEventSerializer(serializers.ModelSerializer):
    order_id = serializers.PrimaryKeyRelatedField(
        source="order", queryset=models.Order.objects.all()
    )

    class Meta:
        model = models.OrderEvent
        fields = ["id", "order_id", "event_type", "note", "created_at"]
        read_only_fields = ["id", "created_at"]


class CustomerMarkPaidSerializer(serializers.Serializer):
    order_id = serializers.IntegerField(min_value=1)
    reference_id = serializers.CharField(required=False, allow_blank=True)
    idempotency_key = serializers.CharField(required=False, allow_blank=True)


class UserInviteSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.UserInvite
        fields = [
            "id",
            "email",
            "role",
            "token",
            "expires_at",
            "accepted_at",
            "created_at",
        ]
        read_only_fields = ["id", "token", "accepted_at", "created_at"]


class MarkPaidResponseSerializer(serializers.Serializer):
    order = OrderSerializer()
    payment_attempt_id = serializers.IntegerField(required=False)


class AggregateReportSerializer(serializers.Serializer):
    users = serializers.IntegerField(min_value=0)
    products = serializers.IntegerField(min_value=0)
    orders = serializers.IntegerField(min_value=0)
    paid_orders = serializers.IntegerField(min_value=0)
    revenue = serializers.CharField(help_text="Decimal as string.")
    currency = serializers.CharField()


class CartSummarySerializer(serializers.Serializer):
    currency = serializers.CharField()
    subtotal = serializers.CharField(help_text="Decimal as string.")
    shipping = serializers.CharField(help_text="Decimal as string.")
    tax = serializers.CharField(help_text="Decimal as string.")
    discount = serializers.CharField(help_text="Decimal as string.")
    total = serializers.CharField(help_text="Decimal as string.")
    items = CartItemSerializer(many=True)


class HealthzResponseSerializer(serializers.Serializer):
    status = serializers.CharField()


class ReadyzOkResponseSerializer(serializers.Serializer):
    status = serializers.CharField()


class ReadyzNotReadyResponseSerializer(serializers.Serializer):
    status = serializers.CharField()
    pending_migrations = serializers.ListField(child=serializers.CharField())


class CheckoutRequestSerializer(serializers.Serializer):
    shipping_full_name = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    shipping_phone = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    shipping_address_line1 = serializers.CharField(
        required=False, allow_blank=True, allow_null=True
    )
    shipping_address_line2 = serializers.CharField(
        required=False, allow_blank=True, allow_null=True
    )
    shipping_city = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    shipping_state = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    shipping_postal_code = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    shipping_country = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    delivery_method = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    payment_method = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    contact_phone = serializers.CharField(required=False, allow_blank=True, allow_null=True)


class LogoutSerializer(serializers.Serializer):
    refresh = serializers.CharField()


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()


class PasswordResetConfirmSerializer(serializers.Serializer):
    token = serializers.CharField()
    password = serializers.CharField(min_length=8)


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField()
    new_password = serializers.CharField(min_length=8)
