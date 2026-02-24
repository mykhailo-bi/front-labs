from django.apps import AppConfig


class BackendAppConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "backend_app"

    def ready(self) -> None:
        # Ensure drf-spectacular extensions are registered.
        from . import openapi  # noqa: F401
