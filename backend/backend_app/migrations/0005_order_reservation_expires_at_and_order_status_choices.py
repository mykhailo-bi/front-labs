from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("backend_app", "0004_order_uniq_order_user_idempotency_key_not_null_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="order",
            name="reservation_expires_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name="order",
            name="status",
            field=models.CharField(
                choices=[
                    ("placed", "Placed"),
                    ("paid", "Paid"),
                    ("cancelled", "Cancelled"),
                    ("shipped", "Shipped"),
                    ("delivered", "Delivered"),
                ],
                default="placed",
                max_length=16,
            ),
        ),
    ]
