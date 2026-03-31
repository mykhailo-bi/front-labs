"""Seed demo data into the database.

Creates:
- 1 admin user
- several regular users
- several products
- several reviews
- several images (some attached as user avatars, product images, and review images)

Run (from repo root):
  python -m backend.demo_scripts.seed_demo_data --reset

or (from backend dir):
  python -m demo_scripts.seed_demo_data --reset
"""

from __future__ import annotations

import argparse
import os
import random
from decimal import Decimal
from typing import Iterable

from django.utils import timezone


def _django_setup() -> None:
    """Initialize Django so ORM can be used from a plain script."""

    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend_project.settings")
    import django  # noqa: WPS433 (runtime import is required for setup)

    django.setup()


def _picsum_url(*, seed: str, w: int = 900, h: int = 700) -> str:
    # Stable image URLs without needing to store actual media.
    return f"https://picsum.photos/seed/{seed}/{w}/{h}"


def _chunks(items: list, n: int) -> Iterable[list]:
    for i in range(0, len(items), n):
        yield items[i : i + n]


def _parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Seed demo data into the database")
    p.add_argument("--prefix", default="demo", help="Prefix namespace for seeded rows")
    p.add_argument("--seed", type=int, default=42, help="PRNG seed for deterministic data")
    p.add_argument("--reset", action="store_true", help="Delete existing prefixed demo data first")

    p.add_argument("--admin-username", default="demo_admin")
    p.add_argument("--admin-email", default="demo_admin@example.com")
    p.add_argument("--admin-password", default="admin12345")

    p.add_argument("--users", type=int, default=8, help="Number of regular users")
    p.add_argument("--products", type=int, default=10, help="Number of products")
    p.add_argument("--reviews-per-product", type=int, default=3, help="Reviews per product")
    p.add_argument("--images", type=int, default=30, help="Number of images total")
    return p.parse_args()


def main() -> None:
    args = _parse_args()
    rng = random.Random(args.seed)

    _django_setup()

    from django.db import transaction

    from backend_app import models
    from backend_app.security import hash_password

    prefix = str(args.prefix).strip()
    if not prefix:
        raise SystemExit("--prefix must be non-empty")

    # Safety: avoid accidental mass deletes.
    if args.reset and len(prefix) < 3:
        raise SystemExit("Refusing to --reset with a too-short prefix (< 3 chars)")

    admin_username = args.admin_username
    if not admin_username.startswith(f"{prefix}_"):
        admin_username = f"{prefix}_admin"

    with transaction.atomic():
        if args.reset:
            # Delete in dependency order.
            models.ReviewImage.objects.filter(image__url__contains=f"/seed/{prefix}-").delete()
            models.ProductImage.objects.filter(image__url__contains=f"/seed/{prefix}-").delete()
            models.OrderContent.objects.filter(
                order__user__username__startswith=f"{prefix}_user_"
            ).delete()
            models.OrderEvent.objects.filter(
                order__user__username__startswith=f"{prefix}_user_"
            ).delete()
            models.Order.objects.filter(user__username__startswith=f"{prefix}_user_").delete()
            models.Review.objects.filter(
                product__name__startswith=f"{prefix}_product_",
            ).delete()
            models.Product.objects.filter(name__startswith=f"{prefix}_product_").delete()
            models.Category.objects.filter(slug__startswith=f"{prefix}-category-").delete()
            models.User.objects.filter(username__startswith=f"{prefix}_user_").delete()
            models.User.objects.filter(username=admin_username).delete()
            # Images last (referenced by User.avatar; and by through tables already deleted).
            models.Image.objects.filter(url__contains=f"/seed/{prefix}-").delete()

        # Images
        images: list[models.Image] = []
        for i in range(int(args.images)):
            images.append(
                models.Image.objects.create(
                    url=_picsum_url(seed=f"{prefix}-{args.seed}-img-{i}"),
                )
            )

        # Admin
        admin_avatar = images.pop() if images else None
        models.User.objects.create(
            username=admin_username,
            email=args.admin_email,
            password_hash=hash_password(args.admin_password),
            firstname="Admin",
            lastname="User",
            description=f"Seeded admin user ({prefix})",
            phone=f"+1000000{rng.randint(1000, 9999)}",
            role="admin",
            avatar=admin_avatar,
        )

        # Regular users
        users: list[models.User] = []
        for i in range(int(args.users)):
            avatar = images.pop() if images else None
            users.append(
                models.User.objects.create(
                    username=f"{prefix}_user_{i}",
                    email=f"{prefix}_user_{i}@example.com",
                    password_hash=hash_password("user12345"),
                    firstname=f"User{i}",
                    lastname="Demo",
                    description=f"Seeded regular user #{i} ({prefix})",
                    phone=f"+2000000{rng.randint(1000, 9999)}",
                    avatar=avatar,
                )
            )

        # Categories (fixed 4 categories)
        categories: list[models.Category] = []
        for i in range(4):
            categories.append(
                models.Category.objects.create(
                    name=f"{prefix}_category_{i}",
                    slug=f"{prefix}-category-{i}",
                )
            )

        # Products
        products: list[models.Product] = []
        availabilities = ("in_stock", "preorder", "discontinued")
        for i in range(int(args.products)):
            stock_qty = rng.randint(1, 50)
            reserved_qty = rng.randint(0, stock_qty)
            products.append(
                models.Product.objects.create(
                    sku=f"{prefix}-sku-{args.seed}-{i:03d}",
                    name=f"{prefix}_product_{i}",
                    description=f"Seeded product #{i} ({prefix}).",
                    price=Decimal(str(rng.randint(5, 250))) + Decimal("0.99"),
                    status="active",
                    stock_qty=stock_qty,
                    reserved_qty=reserved_qty,
                    category=rng.choice(categories),
                    is_featured=(i % 3 == 0),
                    is_published=True,
                    availability=availabilities[i % len(availabilities)],
                )
            )

        # Attach images to products (via through table)
        # 1..3 images per product, if available.
        for product in products:
            if not images:
                break
            k = min(len(images), rng.randint(1, 3))
            chosen = [images.pop() for _ in range(k)]
            for j, img in enumerate(chosen):
                models.ProductImage.objects.create(
                    product=product,
                    image=img,
                    alt_text=f"{product.name} image {j + 1}",
                )

        # Reviews + (optional) review images
        reviews_per_product = int(args.reviews_per_product)
        for product in products:
            # Unique constraint: (user, product)
            reviewers = users[:]
            rng.shuffle(reviewers)
            reviewers = reviewers[: min(len(reviewers), reviews_per_product)]
            for reviewer in reviewers:
                review = models.Review.objects.create(
                    user=reviewer,
                    product=product,
                    rating=rng.randint(1, 5),
                    text=f"Review for {product.name} by {reviewer.username}",
                )

                # 0..2 images per review, if any left
                if images:
                    k = min(len(images), rng.randint(0, 2))
                    for _ in range(k):
                        img = images.pop()
                        models.ReviewImage.objects.create(review=review, image=img)

        # Any remaining images stay unattached intentionally.

        # Orders (1..3 per regular customer, excluding admins)
        now = timezone.now()
        created_orders = 0
        for user in users:
            order_count = rng.randint(1, 3)
            for order_idx in range(order_count):
                selected_products = rng.sample(products, k=min(len(products), rng.randint(1, 4)))
                subtotal = Decimal("0.00")
                order = models.Order.objects.create(
                    user=user,
                    status="placed",
                    currency="USD",
                    base_currency="USD",
                    fx_rate=Decimal("1"),
                    shipping_full_name=f"{user.firstname} {user.lastname}".strip(),
                    shipping_phone=user.phone,
                    shipping_address_line1=f"{100 + order_idx} Demo Street",
                    shipping_address_line2="Apt 1",
                    shipping_city="Demo City",
                    shipping_state="Demo State",
                    shipping_postal_code=f"10{rng.randint(100, 999)}",
                    shipping_country="US",
                    delivery_method="standard",
                    payment_method="card",
                    contact_phone=user.phone,
                    idempotency_key=f"{prefix}-{user.username}-order-{order_idx}",
                    placed_at=now,
                )

                for product in selected_products:
                    count = rng.randint(1, 3)
                    models.OrderContent.objects.create(
                        order=order,
                        product=product,
                        count=count,
                    )
                    subtotal += product.price * count

                shipping = Decimal("4.99")
                tax = (subtotal * Decimal("0.08")).quantize(Decimal("0.01"))
                discount = Decimal("0.00")
                total = subtotal + shipping + tax - discount
                order.subtotal = subtotal
                order.shipping = shipping
                order.tax = tax
                order.discount = discount
                order.total = total
                order.save(update_fields=["subtotal", "shipping", "tax", "discount", "total"])

                models.OrderEvent.objects.create(
                    order=order,
                    event_type="placed",
                    note=f"Seeded order for {user.username}",
                )
                created_orders += 1

    print(
        "Seed complete. Created: "
        f"admin=1, users={args.users}, categories=4, products={args.products}, "
        f"reviews≈{args.products * min(args.users, args.reviews_per_product)}, "
        f"orders={created_orders}, "
        f"images={args.images}. Prefix='{prefix}'."
    )


if __name__ == "__main__":
    main()
