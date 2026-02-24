from __future__ import annotations

from typing import Any

from django.http import Http404
from rest_framework import exceptions, status
from rest_framework.response import Response
from rest_framework.views import exception_handler


def _request_id_from_context(context: dict[str, Any]) -> str | None:
    request = context.get("request")
    return getattr(request, "request_id", None) if request is not None else None


def drf_exception_handler(exc: Exception, context: dict[str, Any]) -> Response | None:
    """Standardize error responses.

    Envelope:
      {
        "code": "...",
        "message": "...",
        "details": <optional>,
        "request_id": "..." | null
      }

    Notes:
    - Validation errors preserve field mapping under `details`.
    - For non-DRF exceptions returning None, Django will render a 500.
    """

    response = exception_handler(exc, context)
    if response is None:
        return None

    request_id = _request_id_from_context(context)
    payload: dict[str, Any] = {
        "code": "error",
        "message": "Request failed.",
        "request_id": request_id,
    }

    # DRF uses APIException (incl. ValidationError, AuthenticationFailed, etc.)
    if isinstance(exc, exceptions.ValidationError):
        payload["code"] = "validation_error"
        payload["message"] = "Validation failed."
        payload["details"] = response.data
        response.status_code = status.HTTP_400_BAD_REQUEST
    elif isinstance(exc, (exceptions.NotAuthenticated, exceptions.AuthenticationFailed)):
        payload["code"] = "not_authenticated"
        payload["message"] = "Authentication required."
        payload["details"] = response.data
        response.status_code = status.HTTP_401_UNAUTHORIZED
    elif isinstance(exc, exceptions.PermissionDenied):
        payload["code"] = "permission_denied"
        payload["message"] = "Permission denied."
        payload["details"] = response.data
        response.status_code = status.HTTP_403_FORBIDDEN
    elif isinstance(exc, (exceptions.NotFound, Http404)):
        payload["code"] = "not_found"
        payload["message"] = "Not found."
        payload["details"] = response.data
        response.status_code = status.HTTP_404_NOT_FOUND
    elif isinstance(exc, exceptions.Throttled):
        payload["code"] = "throttled"
        payload["message"] = "Request was throttled."
        payload["details"] = response.data
        response.status_code = status.HTTP_429_TOO_MANY_REQUESTS
    else:
        # Generic APIException and other mapped exceptions.
        payload["code"] = getattr(exc, "default_code", "error")
        # `response.data` typically has {'detail': '...'}
        if isinstance(response.data, dict) and "detail" in response.data and isinstance(response.data["detail"], str):
            payload["message"] = response.data["detail"]
        payload["details"] = response.data

    response.data = payload
    return response

