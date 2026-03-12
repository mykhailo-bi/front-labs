"""Pytest bootstrap for the Django app.

Sets minimal environment defaults so tests can run without external DB config,
and initializes Django before tests import Django/DRF modules.
"""

import os

import pytest

# Default to in-memory SQLite for tests unless caller overrides.
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend_project.settings")
os.environ.setdefault("DJANGO_SECRET_KEY", "test-secret-key")
# Allow testserver host used by Django test client.
os.environ.setdefault("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1,testserver")
# Use SQLite in-memory for tests to avoid external DB.
os.environ.setdefault("DB_ENGINE", "django.db.backends.sqlite3")
os.environ.setdefault("DB_NAME", ":memory:")
os.environ.setdefault("DB_USER", "sqlite")
os.environ.setdefault("DB_PASSWORD", "sqlite")
os.environ.setdefault("DB_HOST", "localhost")
os.environ.setdefault("DB_PORT", "0")


import django  # noqa: E402  (import after env setup)
from django.core.management import call_command  # noqa: E402

django.setup()

# Ensure database schema is ready for tests (in-memory sqlite).
call_command("migrate", run_syncdb=True, verbosity=0)


@pytest.fixture(autouse=True)
def _flush_db():
    call_command("flush", verbosity=0, interactive=False)
