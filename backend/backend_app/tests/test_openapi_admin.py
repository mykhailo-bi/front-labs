import pytest
from backend_app import openapi as openapi_module
from backend_app import admin as admin_module
from backend_app import api as api_module

pytestmark = pytest.mark.django_db


class OpenApiAndAdminTests:
    def test_simplejwt_authentication_scheme_definition(self):
        ext = openapi_module.SimpleJWTAuthenticationScheme(target=None)
        schema = ext.get_security_definition(auto_schema=None)
        assert schema["type"] == "http"
        assert schema["scheme"] == "bearer"
        assert schema["bearerFormat"] == "JWT"

    def test_admin_site_permission_allows_admin_and_django_flags(self):
        site = admin_module.admin_site

        admin_user = type(
            "U",
            (),
            {
                "is_admin": True,
                "is_staff": False,
                "is_superuser": False,
                "is_active": True,
            },
        )()
        assert site.has_permission(request=type("R", (), {"user": admin_user})())

        staff_user = type(
            "U",
            (),
            {
                "is_admin": False,
                "is_staff": True,
                "is_superuser": False,
                "is_active": True,
            },
        )()
        assert site.has_permission(request=type("R", (), {"user": staff_user})())

        superuser = type(
            "U",
            (),
            {
                "is_admin": False,
                "is_staff": False,
                "is_superuser": True,
                "is_active": True,
            },
        )()
        assert site.has_permission(request=type("R", (), {"user": superuser})())

        inactive = type(
            "U",
            (),
            {
                "is_admin": False,
                "is_staff": True,
                "is_superuser": False,
                "is_active": False,
            },
        )()
        assert not site.has_permission(request=type("R", (), {"user": inactive})())

        none_user_req = type("R", (), {"user": None})()
        assert not site.has_permission(request=none_user_req)

    def test_permission_classes_branches(self):
        request = type("R", (), {"method": "GET", "user": None})()
        assert api_module.IsAdminOrReadOnly().has_permission(request, None)

        request_post = type(
            "R", (), {"method": "POST", "user": type("U", (), {"is_admin": False})()}
        )()
        assert not api_module.IsAdminOrReadOnly().has_permission(request_post, None)

        request_admin = type(
            "R", (), {"method": "POST", "user": type("U", (), {"is_admin": True})()}
        )()
        assert api_module.IsAdminOrReadOnly().has_permission(request_admin, None)

        assert not api_module.IsAuthenticated().has_permission(
            type("R", (), {"user": None})(), None
        )
        assert api_module.IsAuthenticated().has_permission(
            type("R", (), {"user": object()})(), None
        )
        assert api_module.IsAdmin().has_permission(
            type("R", (), {"user": type("U", (), {"is_admin": True})()})(), None
        )

        obj = type("Obj", (), {"user_id": 1})()
        req_owner = type("R", (), {"user": type("U", (), {"id": 1, "is_admin": False})()})()
        req_other = type("R", (), {"user": type("U", (), {"id": 2, "is_admin": False})()})()
        assert api_module.IsOwnerOrAdmin().has_object_permission(req_owner, None, obj)
        assert not api_module.IsOwnerOrAdmin().has_object_permission(req_other, None, obj)
