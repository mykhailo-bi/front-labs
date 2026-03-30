from django.db import migrations


def backfill_admin_role(apps, schema_editor):
    User = apps.get_model("backend_app", "User")
    User.objects.filter(is_admin=True).exclude(role="admin").update(role="admin")


class Migration(migrations.Migration):
    dependencies = [
        ("backend_app", "0011_multi_currency_and_imports"),
    ]

    operations = [
        migrations.RunPython(backfill_admin_role, migrations.RunPython.noop),
        migrations.RemoveField(
            model_name="user",
            name="is_admin",
        ),
    ]
