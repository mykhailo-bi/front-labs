"""drf-spectacular extensions.

This module registers OpenAPI extensions for project-specific DRF components.
"""

from drf_spectacular.extensions import OpenApiAuthenticationExtension


class SimpleJWTAuthenticationScheme(OpenApiAuthenticationExtension):
    """Expose [`backend_app.auth.SimpleJWTAuthentication`](backend/backend_app/auth.py#L35) as Bearer auth."""

    target_class = "backend_app.auth.SimpleJWTAuthentication"
    name = "bearerAuth"

    def get_security_definition(self, auto_schema):
        return {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT",
        }
