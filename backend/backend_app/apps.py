from django.apps import AppConfig


class BackendAppConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "backend_app"

    def ready(self) -> None:
        self._patch_django_template_context_copy_for_py314()
        # Ensure drf-spectacular extensions are registered.
        from . import openapi  # noqa: F401

    @staticmethod
    def _patch_django_template_context_copy_for_py314() -> None:
        """Patch Django 4.2 template context copying on Python 3.14.

        Django 4.2's BaseContext.__copy__ uses copy(super()), which breaks on
        Python 3.14 and raises AttributeError when admin templates render.
        """
        import sys

        if sys.version_info < (3, 14):
            return

        from django.template.context import BaseContext

        if getattr(BaseContext.__copy__, "__name__", "") == "_py314_basecontext_copy":
            return

        def _py314_basecontext_copy(self: BaseContext):
            duplicate = self.__class__.__new__(self.__class__)
            duplicate.__dict__ = self.__dict__.copy()
            duplicate.dicts = self.dicts[:]
            return duplicate

        BaseContext.__copy__ = _py314_basecontext_copy
