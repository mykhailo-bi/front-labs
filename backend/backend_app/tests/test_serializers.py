import pytest
from decimal import Decimal
from rest_framework.test import APIRequestFactory
from django.core.files.uploadedfile import SimpleUploadedFile
from backend_app import models
from backend_app.security import hash_password

pytestmark = pytest.mark.django_db

class SerializerValidationTests:
    @pytest.fixture(autouse=True)
    def _setup(self):
        self.user = models.User.objects.create(
            username="ser_user1",
            email="ser1@example.com",
            password_hash=hash_password("secret1234"),
            is_admin=False,
        )
        self.user2 = models.User.objects.create(
            username="ser_user2",
            email="ser2@example.com",
            password_hash=hash_password("secret1234"),
            is_admin=False,
        )
        self.product = models.Product.objects.create(
            name="SerProd",
            description="",
            price=Decimal("10.00"),
            status="active",
            stock_qty=1,
            reserved_qty=0,
            is_published=True,
        )

        self.category = models.Category.objects.create(name="SCat", slug="s-cat")

    def _ctx(self, user):
        req = type("R", (), {"user": user})()
        return {"request": req}

    def test_user_serializer_create_password_required_and_length(self):
        from backend_app.serializers import UserSerializer

        # Missing password: validation passes (field optional) but save raises
        ser = UserSerializer(data={"username": "u3", "email": "e3@example.com"})
        ser.is_valid(raise_exception=True)
        with pytest.raises(Exception):
            ser.save()

        # Short password: validation passes, save raises
        ser2 = UserSerializer(data={"username": "u4", "email": "e4@example.com", "password": "short"})
        ser2.is_valid(raise_exception=True)
        with pytest.raises(Exception):
            ser2.save()

    def test_user_serializer_update_unique_conflicts(self):
        from backend_app.serializers import UserSerializer

        ser = UserSerializer(instance=self.user, data={"username": self.user2.username}, partial=True, context=self._ctx(self.user))
        assert not ser.is_valid()
        assert "username" in ser.errors

    def test_cart_item_serializer_validation_paths(self):
        from backend_app.serializers import CartItemSerializer

        ser = CartItemSerializer(data={"product_id": self.product.id, "count": 0})
        assert not ser.is_valid()
        assert "count" in ser.errors

        draft = models.Product.objects.create(
            name="DraftSer",
            description="",
            price=Decimal("1.00"),
            status="draft",
            stock_qty=1,
            reserved_qty=0,
            is_published=True,
        )
        ser2 = CartItemSerializer(data={"product_id": draft.id, "count": 1})
        assert not ser2.is_valid()
        assert "product_id" in ser2.errors

        low = models.Product.objects.create(
            name="LowSer",
            description="",
            price=Decimal("2.00"),
            status="active",
            stock_qty=1,
            reserved_qty=0,
            is_published=True,
        )
        ser3 = CartItemSerializer(data={"product_id": low.id, "count": 5})
        assert not ser3.is_valid()
        assert "count" in ser3.errors

    def test_review_serializer_rating_and_eligibility(self):
        from backend_app.serializers import ReviewSerializer

        ser = ReviewSerializer(data={"product_id": self.product.id, "rating": 0, "text": "bad"}, context=self._ctx(self.user))
        assert not ser.is_valid()
        assert "rating" in ser.errors

        ser2 = ReviewSerializer(data={"product_id": self.product.id, "rating": 5, "text": "ok"}, context=self._ctx(self.user))
        assert not ser2.is_valid()
        assert "product_id" in ser2.errors

    def test_order_serializer_non_admin_cannot_set_user(self):
        from backend_app.serializers import OrderSerializer

        ser = OrderSerializer(data={"user_id": self.user2.id}, context=self._ctx(self.user))
        assert not ser.is_valid()
        assert "user_id" in ser.errors

    def test_product_serializer_validates_category_and_sku(self):
        from backend_app.serializers import ProductSerializer

        ser = ProductSerializer(
            data={
                "name": "P",
                "description": "",
                "price": "1.00",
                "status": "active",
                "stock_qty": 1,
                "reserved_qty": 0,
                "is_published": True,
                "category_id": self.category.id,
                "sku": "SKU123",
            }
        )
        assert ser.is_valid(), ser.errors
        obj = ser.save()
        assert obj.category_id == self.category.id
        assert obj.sku == "SKU123"

    def test_user_invite_serializer_email_required(self):
        from backend_app.serializers import UserInviteSerializer

        ser = UserInviteSerializer(data={"role": "customer"})
        assert not ser.is_valid()
        assert "email" in ser.errors

    def test_image_upload_serializer_validation_and_sniff(self):
        from backend_app.serializers import ImageUploadSerializer

        ser = ImageUploadSerializer(data={})
        assert not ser.is_valid()
        assert "file" in ser.errors

        upload = SimpleUploadedFile(
            name="bad.bin",
            content=b"notanimage",
            content_type="application/octet-stream",
        )
        ser2 = ImageUploadSerializer(data={"file": upload})
        assert ser2.is_valid(), ser2.errors

    def test_review_serializer_requires_order_and_rating_range(self):
        from backend_app.serializers import ReviewSerializer

        product = models.Product.objects.create(
            name="SerProd2",
            description="",
            price=Decimal("2.00"),
            status="active",
            stock_qty=1,
            reserved_qty=0,
            is_published=True,
        )
        ser = ReviewSerializer(data={"product_id": product.id, "rating": 6, "text": "x"}, context=self._ctx(self.user))
        assert not ser.is_valid()
        assert "rating" in ser.errors
