"""
URL configuration for backend_project project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/4.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""

from django.urls import include, path
from backend_app.admin import admin_site
from django.conf import settings
from django.conf.urls.static import static

from backend_app.health import healthz, readyz
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView


def _docs_enabled() -> bool:
    # Explicit toggle; default enabled only in DEBUG.
    # This avoids accidentally exposing docs in production.
    from django.conf import settings

    return getattr(settings, "DEBUG", False) or (
        str(getattr(settings, "SPECTACULAR_ENABLE_DOCS", "")).lower() in {"1", "true", "yes", "on"}
    )


urlpatterns = [
    path("healthz", healthz),
    path("readyz", readyz),
    # Versioned API (primary)
    path("api/v1/", include("backend_app.urls")),
    # Django admin — restricted to is_admin users via custom admin site.
    path("admin/", admin_site.urls),
]

# Serve uploaded media in development only.
if getattr(settings, "DEBUG", False):
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

if _docs_enabled():
    urlpatterns = [
        # OpenAPI schema + Swagger UI
        path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
        path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
        *urlpatterns,
    ]
