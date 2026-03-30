from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("backend_app", "0012_backfill_admin_role_from_is_admin"),
    ]

    operations = [
        migrations.AddField(
            model_name="image",
            name="alt_text",
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
        migrations.AddField(
            model_name="image",
            name="title",
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
        migrations.AddField(
            model_name="image",
            name="caption",
            field=models.CharField(blank=True, max_length=512, null=True),
        ),
        migrations.AddField(
            model_name="image",
            name="filename",
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
        migrations.AddField(
            model_name="image",
            name="description",
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="image",
            name="aria_label",
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
    ]
