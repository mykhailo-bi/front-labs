import pytest
from decimal import Decimal
from unittest import mock
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db.utils import IntegrityError
from backend_app import models
from backend_app.security import hash_password, verify_password

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
        ser2 = UserSerializer(
            data={"username": "u4", "email": "e4@example.com", "password": "short"}
        )
        ser2.is_valid(raise_exception=True)
        with pytest.raises(Exception):
            ser2.save()

    def test_user_serializer_create_success_and_update_password(self):
        from backend_app.serializers import UserSerializer

        ser = UserSerializer(
            data={
                "username": "ser_create",
                "email": "ser_create@example.com",
                "password": "longpass123",
            }
        )
        assert ser.is_valid(), ser.errors
        user = ser.save()
        assert verify_password("longpass123", user.password_hash)

        ser_update = UserSerializer(
            instance=user,
            data={"password": "newlongpass123"},
            partial=True,
        )
        assert ser_update.is_valid(), ser_update.errors
        updated = ser_update.save()
        assert verify_password("newlongpass123", updated.password_hash)

    def test_user_serializer_update_unique_conflicts(self):
        from backend_app.serializers import UserSerializer

        ser = UserSerializer(
            instance=self.user,
            data={"username": self.user2.username},
            partial=True,
            context=self._ctx(self.user),
        )
        assert not ser.is_valid()
        assert "username" in ser.errors

    def test_user_serializer_update_conflicts_email_and_phone(self):
        from backend_app.serializers import UserSerializer

        self.user2.phone = "123456"
        self.user2.save(update_fields=["phone"])

        ser_email = UserSerializer(
            instance=self.user,
            data={"email": self.user2.email},
            partial=True,
            context=self._ctx(self.user),
        )
        assert not ser_email.is_valid()
        assert "email" in ser_email.errors

        ser_phone = UserSerializer(
            instance=self.user,
            data={"phone": self.user2.phone},
            partial=True,
            context=self._ctx(self.user),
        )
        assert not ser_phone.is_valid()
        assert "phone" in ser_phone.errors

        ser_blank_phone = UserSerializer(
            instance=self.user,
            data={"phone": ""},
            partial=True,
            context=self._ctx(self.user),
        )
        assert ser_blank_phone.is_valid(), ser_blank_phone.errors
        assert ser_blank_phone.validated_data["phone"] is None

    def test_login_serializer_username_or_email_paths(self):
        from backend_app.serializers import LoginSerializer

        ser = LoginSerializer(
            data={"username_or_email": self.user.username, "password": "secret1234"}
        )
        assert ser.is_valid(), ser.errors

        ser_email = LoginSerializer(
            data={"username_or_email": self.user.email, "password": "secret1234"}
        )
        assert ser_email.is_valid(), ser_email.errors

        ser_bad = LoginSerializer(
            data={"username_or_email": "missing", "password": "secret1234"}
        )
        assert not ser_bad.is_valid()

        ser_bad_pw = LoginSerializer(
            data={"username_or_email": self.user.username, "password": "wrong"}
        )
        assert not ser_bad_pw.is_valid()

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

        ser = ReviewSerializer(
            data={"product_id": self.product.id, "rating": 0, "text": "bad"},
            context=self._ctx(self.user),
        )
        assert not ser.is_valid()
        assert "rating" in ser.errors

        ser2 = ReviewSerializer(
            data={"product_id": self.product.id, "rating": 5, "text": "ok"},
            context=self._ctx(self.user),
        )
        assert not ser2.is_valid()
        assert "product_id" in ser2.errors

    def test_review_serializer_eligibility_and_duplicate(self):
        from backend_app.serializers import ReviewSerializer
        from backend_app.domain.order_status import OrderStatus

        paid_order = models.Order.objects.create(
            user=self.user,
            status=OrderStatus.PAID,
            total=Decimal("10.00"),
            subtotal=Decimal("10.00"),
        )
        models.OrderContent.objects.create(
            order=paid_order, product=self.product, count=1
        )

        ser = ReviewSerializer(
            data={"product_id": self.product.id, "rating": 5, "text": "great"},
            context=self._ctx(self.user),
        )
        assert ser.is_valid(), ser.errors
        ser.save(user=self.user)

        ser_dup = ReviewSerializer(
            data={"product_id": self.product.id, "rating": 5, "text": "again"},
            context=self._ctx(self.user),
        )
        assert not ser_dup.is_valid()
        assert "product_id" in ser_dup.errors

    def test_order_serializer_non_admin_cannot_set_user(self):
        from backend_app.serializers import OrderSerializer

        ser = OrderSerializer(
            data={"user_id": self.user2.id}, context=self._ctx(self.user)
        )
        assert not ser.is_valid()
        assert "user_id" in ser.errors

    def test_order_serializer_admin_and_missing_request(self):
        from backend_app.serializers import OrderSerializer

        admin = models.User.objects.create(
            username="ser_admin",
            email="ser_admin@example.com",
            password_hash=hash_password("secret1234"),
            is_admin=True,
        )

        ser_admin = OrderSerializer(
            data={"user_id": self.user2.id},
            context=self._ctx(admin),
        )
        assert ser_admin.is_valid(), ser_admin.errors

        ser_no_request = OrderSerializer(data={"user_id": self.user2.id}, context={})
        assert ser_no_request.is_valid(), ser_no_request.errors

    def test_order_serializer_shipping_address_none(self):
        from backend_app.serializers import OrderSerializer
        from backend_app.domain.order_status import OrderStatus

        order = models.Order.objects.create(
            user=self.user,
            status=OrderStatus.PLACED,
            total=Decimal("1.00"),
            subtotal=Decimal("1.00"),
        )
        ser = OrderSerializer()
        assert ser.get_shipping_address(order) is None

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

        product_with_sku = models.Product.objects.create(
            name="SkuProd",
            description="",
            price=Decimal("1.00"),
            status="active",
            stock_qty=1,
            reserved_qty=0,
            is_published=True,
            sku="DUPSKU",
        )
        ser_dup = ProductSerializer(
            data={
                "name": "P2",
                "description": "",
                "price": "1.00",
                "status": "active",
                "stock_qty": 1,
                "reserved_qty": 0,
                "is_published": True,
                "sku": product_with_sku.sku,
            }
        )
        assert not ser_dup.is_valid()
        assert "sku" in ser_dup.errors

        ser_blank = ProductSerializer(
            data={
                "name": "P3",
                "description": "",
                "price": "1.00",
                "status": "active",
                "stock_qty": 1,
                "reserved_qty": 0,
                "is_published": True,
                "sku": "",
            }
        )
        assert ser_blank.is_valid(), ser_blank.errors
        obj_blank = ser_blank.save()
        assert obj_blank.sku is None

    def test_user_invite_serializer_email_required(self):
        from backend_app.serializers import UserInviteSerializer

        ser = UserInviteSerializer(data={"role": "customer"})
        assert not ser.is_valid()
        assert "email" in ser.errors

    def test_address_serializer_default_and_user_assignment(self):
        from backend_app.serializers import AddressSerializer

        models.Address.objects.create(
            user=self.user,
            label="Home",
            full_name="Name",
            phone="123",
            line1="Street",
            city="City",
            state="State",
            postal_code="12345",
            country="US",
            is_default=True,
        )
        ser = AddressSerializer(
            data={
                "label": "Work",
                "full_name": "Name",
                "phone": "123",
                "line1": "Street2",
                "city": "City",
                "state": "State",
                "postal_code": "12345",
                "country": "US",
                "is_default": True,
            },
            context=self._ctx(self.user),
        )
        assert not ser.is_valid()
        assert "is_default" in ser.errors

    def test_wishlist_and_saved_item_serializers_user_and_integrity(self):
        from backend_app.serializers import WishlistItemSerializer, SavedItemSerializer

        wish_ser = WishlistItemSerializer(
            data={"product_id": self.product.id},
            context=self._ctx(self.user),
        )
        assert wish_ser.is_valid(), wish_ser.errors
        wish_item = wish_ser.save()
        assert wish_item.user_id == self.user.id

        wish_dup = WishlistItemSerializer(
            data={"product_id": self.product.id},
            context=self._ctx(self.user),
        )
        assert not wish_dup.is_valid()
        assert "product_id" in wish_dup.errors

        other = models.User.objects.create(
            username="ser_other",
            email="ser_other@example.com",
            password_hash=hash_password("secret1234"),
            is_admin=False,
        )
        with mock.patch(
            "backend_app.serializers.models.WishlistItem.objects.create",
            side_effect=IntegrityError,
        ):
            wish_err = WishlistItemSerializer(
                data={"product_id": self.product.id, "user_id": other.id},
                context=self._ctx(other),
            )
            assert wish_err.is_valid(), wish_err.errors
            with pytest.raises(Exception):
                wish_err.save()

        saved_ser = SavedItemSerializer(
            data={"product_id": self.product.id},
            context=self._ctx(self.user),
        )
        assert saved_ser.is_valid(), saved_ser.errors
        saved_item = saved_ser.save()
        assert saved_item.user_id == self.user.id

        saved_dup = SavedItemSerializer(
            data={"product_id": self.product.id},
            context=self._ctx(self.user),
        )
        assert not saved_dup.is_valid()
        assert "product_id" in saved_dup.errors

        with mock.patch(
            "backend_app.serializers.models.SavedItem.objects.create",
            side_effect=IntegrityError,
        ):
            saved_err = SavedItemSerializer(
                data={"product_id": self.product.id, "user_id": other.id},
                context=self._ctx(other),
            )
            assert saved_err.is_valid(), saved_err.errors
            with pytest.raises(Exception):
                saved_err.save()

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

    def test_cart_item_serializer_missing_fields_and_integrity_retry(self):
        from backend_app.serializers import CartItemSerializer

        ser = CartItemSerializer()
        assert ser.validate({"count": 1}) == {"count": 1}

        self.product.stock_qty = 5
        self.product.save(update_fields=["stock_qty"])
        cart = models.Cart.objects.create(user=self.user, product=self.product, count=1)

        with (
            mock.patch(
                "backend_app.serializers.models.Cart.objects.get_or_create",
                side_effect=IntegrityError,
            ),
            mock.patch(
                "backend_app.serializers.models.Cart.objects.select_for_update"
            ) as select_for_update,
        ):
            select_for_update.return_value.get.return_value = cart

            ser_create = CartItemSerializer(
                data={"product_id": self.product.id, "count": 2},
                context=self._ctx(self.user),
            )
            assert ser_create.is_valid(), ser_create.errors
            obj = ser_create.save(user=self.user, product=self.product)
            assert obj.id == cart.id

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
        ser = ReviewSerializer(
            data={"product_id": product.id, "rating": 6, "text": "x"},
            context=self._ctx(self.user),
        )
        assert not ser.is_valid()
        assert "rating" in ser.errors
