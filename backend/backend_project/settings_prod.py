"""Production settings.

This module imports the base settings and applies production hardening.

Usage:
  export DJANGO_SETTINGS_MODULE=backend_project.settings_prod
"""

import os

from .settings import *  # noqa


# Production MUST disable debug.
DEBUG = False


# Security headers / HTTPS handling

# If running behind a reverse proxy (nginx/traefik), enable and ensure it sets X-Forwarded-Proto.
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

SECURE_SSL_REDIRECT = True

SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True

SECURE_HSTS_SECONDS = int(os.getenv("DJANGO_HSTS_SECONDS", "31536000"))
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True

SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "same-origin"
X_FRAME_OPTIONS = "DENY"


# Docs should be disabled in production by default.
SPECTACULAR_ENABLE_DOCS = os.getenv("SPECTACULAR_ENABLE_DOCS", "")
