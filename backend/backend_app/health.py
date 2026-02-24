from __future__ import annotations

import time

from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from drf_spectacular.utils import OpenApiResponse, extend_schema

from backend_app.serializers import (
    HealthzResponseSerializer,
    ReadyzNotReadyResponseSerializer,
    ReadyzOkResponseSerializer,
)


# Readiness can be polled frequently by orchestrators. Migration planning can be
# expensive, so cache successful checks briefly (per-process).
_READYZ_LAST_OK_AT: float | None = None
_READYZ_CACHE_SECONDS: float = 5.0


@extend_schema(
    tags=["health"],
    summary="Liveness probe",
    description="Liveness: process is up.",
    responses={200: HealthzResponseSerializer},
)
@api_view(["GET"])
@permission_classes([])
def healthz(request):
    """Liveness: process is up."""

    return Response({"status": "ok"}, status=status.HTTP_200_OK)


@extend_schema(
    tags=["health"],
    summary="Readiness probe",
    description="Readiness: DB connectivity + migrations applied.",
    responses={
        200: ReadyzOkResponseSerializer,
        503: OpenApiResponse(response=ReadyzNotReadyResponseSerializer, description="Pending migrations"),
    },
)
@api_view(["GET"])
@permission_classes([])
def readyz(request):
    """Readiness: DB connectivity + migrations applied."""

    global _READYZ_LAST_OK_AT

    now_mono = time.monotonic()
    if _READYZ_LAST_OK_AT is not None and (now_mono - _READYZ_LAST_OK_AT) < _READYZ_CACHE_SECONDS:
        # Still confirm DB connectivity quickly.
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
        return Response({"status": "ready"}, status=status.HTTP_200_OK)

    # DB connectivity
    with connection.cursor() as cursor:
        cursor.execute("SELECT 1")
        cursor.fetchone()

    # Migrations applied
    executor = MigrationExecutor(connection)
    plan = executor.migration_plan(executor.loader.graph.leaf_nodes())
    pending = [f"{mig.app_label}.{mig.name}" for mig, _ in plan]

    if pending:
        return Response(
            {"status": "not_ready", "pending_migrations": pending},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    _READYZ_LAST_OK_AT = now_mono
    return Response({"status": "ready"}, status=status.HTTP_200_OK)
