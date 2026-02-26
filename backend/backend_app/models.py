# This is an auto-generated Django model module.
# You'll have to do the following manually to clean this up:
#   * Rearrange models' order
#   * Make sure each model has one field with primary_key=True
#   * Make sure each ForeignKey and OneToOneField has `on_delete` set to the desired behavior
#   * Remove `` lines if you wish to allow Django to create, modify, and delete the table
# Feel free to rename the models, but don't rename db_table values or field names.
import datetime

from django.db import models
from django.core.exceptions import ValidationError
from django.db.models import Q
from django.db.models import CheckConstraint

from backend_app.domain.order_status import OrderStatus


class Cart(models.Model):
    user = models.ForeignKey('User', models.CASCADE)
    product = models.ForeignKey('Product', models.CASCADE)
    count = models.IntegerField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        
        db_table = 'cart'
        unique_together = (('user', 'product'),)
        indexes = [models.Index(fields=["user"], name="cart_user_idx")]


class Image(models.Model):
    url = models.CharField(max_length=1024)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        
        db_table = 'image'


class Category(models.Model):
    name = models.CharField(max_length=64)
    slug = models.CharField(max_length=64, unique=True)
    parent = models.ForeignKey('self', models.SET_NULL, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'category'
        indexes = [models.Index(fields=["slug"], name="category_slug_idx")]


class Order(models.Model):
    user = models.ForeignKey('User', models.PROTECT)
    products = models.ManyToManyField('Product', through='OrderContent')

    status = models.CharField(max_length=16, default=OrderStatus.PLACED, choices=OrderStatus.CHOICES)

    # Reservation expiry for stock held during checkout.
    reservation_expires_at = models.DateTimeField(blank=True, null=True)

    currency = models.CharField(max_length=3, default="USD")
    subtotal = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    shipping = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    tax = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    discount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    # Shipping/contact/payment snapshot for confirmation page.
    shipping_full_name = models.CharField(max_length=128, blank=True, null=True)
    shipping_phone = models.CharField(max_length=32, blank=True, null=True)
    shipping_address_line1 = models.CharField(max_length=255, blank=True, null=True)
    shipping_address_line2 = models.CharField(max_length=255, blank=True, null=True)
    shipping_city = models.CharField(max_length=64, blank=True, null=True)
    shipping_state = models.CharField(max_length=64, blank=True, null=True)
    shipping_postal_code = models.CharField(max_length=32, blank=True, null=True)
    shipping_country = models.CharField(max_length=64, blank=True, null=True)
    delivery_method = models.CharField(max_length=32, blank=True, null=True)
    payment_method = models.CharField(max_length=32, blank=True, null=True)
    contact_phone = models.CharField(max_length=32, blank=True, null=True)

    idempotency_key = models.CharField(max_length=64, blank=True, null=True)

    placed_at = models.DateTimeField(blank=True, null=True)
    paid_at = models.DateTimeField(blank=True, null=True)
    cancelled_at = models.DateTimeField(blank=True, null=True)
    shipped_at = models.DateTimeField(blank=True, null=True)
    delivered_at = models.DateTimeField(blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        
        db_table = 'order'
        constraints = [
            models.UniqueConstraint(
                fields=["user", "idempotency_key"],
                condition=Q(idempotency_key__isnull=False),
                name="uniq_order_user_idempotency_key_not_null",
            ),
        ]
        indexes = [models.Index(fields=["user", "created_at"], name="order_user_created_idx")]


class OrderContent(models.Model):
    order = models.ForeignKey(Order, models.CASCADE)
    product = models.ForeignKey('Product', models.PROTECT)
    count = models.IntegerField()

    class Meta:
        
        db_table = 'order_content'
        unique_together = (('order', 'product'),)
        indexes = [
            models.Index(fields=["order"], name="ordercontent_order_idx"),
            models.Index(fields=["product"], name="ordercontent_product_idx"),
        ]


class Product(models.Model):
    sku = models.CharField(max_length=32, unique=True, blank=True, null=True)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    price = models.DecimalField(max_digits=10, decimal_places=2)

    status = models.CharField(max_length=16, default="active")
    stock_qty = models.IntegerField(default=0)
    reserved_qty = models.IntegerField(default=0)

    category = models.ForeignKey(Category, models.SET_NULL, blank=True, null=True)
    is_featured = models.BooleanField(default=False)
    is_published = models.BooleanField(default=True)
    availability = models.CharField(
        max_length=16,
        default="in_stock",
        choices=(
            ("in_stock", "In stock"),
            ("preorder", "Preorder"),
            ("discontinued", "Discontinued"),
        ),
    )

    images = models.ManyToManyField(Image, through='ProductImage')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        
        db_table = 'product'
        constraints = [
            CheckConstraint(check=Q(stock_qty__gte=0), name="product_stock_qty_gte_0"),
            CheckConstraint(check=Q(reserved_qty__gte=0), name="product_reserved_qty_gte_0"),
            CheckConstraint(check=Q(reserved_qty__lte=models.F("stock_qty")), name="product_reserved_le_stock"),
        ]
        indexes = [
            models.Index(fields=["status"], name="product_status_idx"),
            models.Index(fields=["is_published"], name="product_is_published_idx"),
            models.Index(fields=["category"], name="product_category_idx"),
        ]


class ProductImage(models.Model):
    product = models.ForeignKey(Product, models.CASCADE)
    image = models.ForeignKey(Image, models.PROTECT)
    alt_text = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        
        db_table = 'product_image'
        unique_together = (('product', 'image'),)


class Review(models.Model):
    user = models.ForeignKey('User', models.CASCADE)
    product = models.ForeignKey(Product, models.CASCADE)
    rating = models.IntegerField()
    text = models.TextField(blank=True, null=True)
    images = models.ManyToManyField(Image, through='ReviewImage')

    class Meta:
        
        db_table = 'review'
        unique_together = (('user', 'product'),)
        constraints = [
            CheckConstraint(check=Q(rating__gte=1) & Q(rating__lte=5), name="review_rating_1_5"),
        ]

    def clean(self):
        super().clean()
        if self.rating < 1 or self.rating > 5:
            raise ValidationError(
                {'rating': 'Rating must be between 1 and 5.'}
            )


class ReviewImage(models.Model):
    review = models.ForeignKey(Review, models.CASCADE)
    image = models.ForeignKey(Image, models.PROTECT)

    class Meta:
        
        db_table = 'review_image'
        unique_together = (('review', 'image'),)


class User(models.Model):
    username = models.CharField(unique=True, max_length=32)
    email = models.CharField(unique=True, max_length=64)
    # Stores a PBKDF2 hash string (see backend_app.security).
    password_hash = models.CharField(max_length=255)
    firstname = models.CharField(max_length=32, blank=True, null=True)
    lastname = models.CharField(max_length=32, blank=True, null=True)
    description = models.TextField(blank=True, null=True)
    phone = models.CharField(unique=True, max_length=16, blank=True, null=True)
    is_admin = models.BooleanField(default=False)
    tokens_invalidated_at = models.DateTimeField(
        default=datetime.datetime(1970, 1, 1, tzinfo=datetime.timezone.utc)
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    avatar = models.ForeignKey(Image, models.SET_NULL, blank=True, null=True)
    products_in_cart = models.ManyToManyField('Product', through='Cart')

    class Meta:
        
        db_table = 'user'

    # Compatibility with DRF/Django expectations.
    @property
    def is_authenticated(self) -> bool:  # noqa: D401
        """Always True for real users."""

        return True

    @property
    def is_anonymous(self) -> bool:
        return False


class Address(models.Model):
    user = models.ForeignKey(User, models.CASCADE)
    label = models.CharField(max_length=64, blank=True, null=True)
    full_name = models.CharField(max_length=128)
    phone = models.CharField(max_length=32)
    line1 = models.CharField(max_length=255)
    line2 = models.CharField(max_length=255, blank=True, null=True)
    city = models.CharField(max_length=64)
    state = models.CharField(max_length=64, blank=True, null=True)
    postal_code = models.CharField(max_length=32)
    country = models.CharField(max_length=64)
    is_default = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "address"
        indexes = [models.Index(fields=["user"], name="address_user_idx")]


class WishlistItem(models.Model):
    user = models.ForeignKey(User, models.CASCADE)
    product = models.ForeignKey(Product, models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "wishlist_item"
        unique_together = (('user', 'product'),)


class SavedItem(models.Model):
    user = models.ForeignKey(User, models.CASCADE)
    product = models.ForeignKey(Product, models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "saved_item"
        unique_together = (('user', 'product'),)


class PaymentAttempt(models.Model):
    """A minimal payment record for the payment stub flow."""

    order = models.ForeignKey(Order, models.PROTECT)
    provider = models.CharField(max_length=32, default="stub")
    status = models.CharField(max_length=16, default="succeeded")
    reference_id = models.CharField(max_length=64, blank=True, null=True)
    idempotency_key = models.CharField(max_length=64, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "payment_attempt"
        constraints = [
            models.UniqueConstraint(
                fields=["order", "idempotency_key"],
                condition=Q(idempotency_key__isnull=False),
                name="uniq_payment_attempt_order_idempotency_key_not_null",
            ),
        ]


class BlacklistedToken(models.Model):
    user = models.ForeignKey(User, models.CASCADE, blank=True, null=True)
    jti = models.CharField(max_length=255, unique=True)
    token_type = models.CharField(max_length=16)
    expires_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "blacklisted_token"
        indexes = [models.Index(fields=["expires_at"], name="blacklisted_token_exp_idx")]


class PasswordResetToken(models.Model):
    user = models.ForeignKey(User, models.CASCADE)
    token = models.CharField(max_length=64, unique=True)
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "password_reset_token"
        indexes = [models.Index(fields=["expires_at"], name="password_reset_exp_idx")]
