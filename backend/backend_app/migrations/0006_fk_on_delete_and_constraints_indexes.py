from django.db import migrations, models
import django.db.models.deletion
from django.db.models import Q, F


class Migration(migrations.Migration):

    dependencies = [
        ("backend_app", "0005_order_reservation_expires_at_and_order_status_choices"),
    ]

    operations = [
        # on_delete changes
        migrations.AlterField(
            model_name="cart",
            name="user",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE, to="backend_app.user"
            ),
        ),
        migrations.AlterField(
            model_name="cart",
            name="product",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE, to="backend_app.product"
            ),
        ),
        migrations.AlterField(
            model_name="order",
            name="user",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.PROTECT, to="backend_app.user"
            ),
        ),
        migrations.AlterField(
            model_name="ordercontent",
            name="order",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE, to="backend_app.order"
            ),
        ),
        migrations.AlterField(
            model_name="ordercontent",
            name="product",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.PROTECT, to="backend_app.product"
            ),
        ),
        migrations.AlterField(
            model_name="productimage",
            name="product",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE, to="backend_app.product"
            ),
        ),
        migrations.AlterField(
            model_name="productimage",
            name="image",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.PROTECT, to="backend_app.image"
            ),
        ),
        migrations.AlterField(
            model_name="review",
            name="user",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE, to="backend_app.user"
            ),
        ),
        migrations.AlterField(
            model_name="review",
            name="product",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE, to="backend_app.product"
            ),
        ),
        migrations.AlterField(
            model_name="reviewimage",
            name="review",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE, to="backend_app.review"
            ),
        ),
        migrations.AlterField(
            model_name="reviewimage",
            name="image",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.PROTECT, to="backend_app.image"
            ),
        ),
        migrations.AlterField(
            model_name="user",
            name="avatar",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                to="backend_app.image",
            ),
        ),
        migrations.AlterField(
            model_name="paymentattempt",
            name="order",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.PROTECT, to="backend_app.order"
            ),
        ),
        # Constraints
        migrations.AddConstraint(
            model_name="product",
            constraint=models.CheckConstraint(
                check=Q(stock_qty__gte=0), name="product_stock_qty_gte_0"
            ),
        ),
        migrations.AddConstraint(
            model_name="product",
            constraint=models.CheckConstraint(
                check=Q(reserved_qty__gte=0), name="product_reserved_qty_gte_0"
            ),
        ),
        migrations.AddConstraint(
            model_name="product",
            constraint=models.CheckConstraint(
                check=Q(reserved_qty__lte=F("stock_qty")),
                name="product_reserved_le_stock",
            ),
        ),
        migrations.AddConstraint(
            model_name="review",
            constraint=models.CheckConstraint(
                check=Q(rating__gte=1) & Q(rating__lte=5), name="review_rating_1_5"
            ),
        ),
        # Indexes
        migrations.AddIndex(
            model_name="product",
            index=models.Index(fields=["status"], name="product_status_idx"),
        ),
        migrations.AddIndex(
            model_name="cart",
            index=models.Index(fields=["user"], name="cart_user_idx"),
        ),
        migrations.AddIndex(
            model_name="order",
            index=models.Index(fields=["user", "created_at"], name="order_user_created_idx"),
        ),
        migrations.AddIndex(
            model_name="ordercontent",
            index=models.Index(fields=["order"], name="ordercontent_order_idx"),
        ),
        migrations.AddIndex(
            model_name="ordercontent",
            index=models.Index(fields=["product"], name="ordercontent_product_idx"),
        ),
    ]
