import pytest
from rest_framework import exceptions as drf_exc
from backend_app import exceptions as exc_module

pytestmark = pytest.mark.django_db


class ExceptionsAdditionalTests:
    def _ctx(self, rid):
        return {"request": type("R", (), {"request_id": rid})()}

    def test_not_authenticated_envelope(self):
        exc = drf_exc.NotAuthenticated()
        wrapped = exc_module.drf_exception_handler(exc, self._ctx("rid-na"))
        assert wrapped.status_code == 401
        assert wrapped.data["code"] == "not_authenticated"
        assert wrapped.data["message"] == "Authentication required."

    def test_not_found_http404_envelope(self):
        from django.http import Http404

        wrapped = exc_module.drf_exception_handler(Http404(), self._ctx(None))
        assert wrapped.status_code == 404
        assert wrapped.data["code"] == "not_found"
        assert wrapped.data["message"] == "Not found."

    def test_throttled_envelope(self):
        exc = drf_exc.Throttled(detail="slow", wait=1)
        wrapped = exc_module.drf_exception_handler(exc, self._ctx("rid-th"))
        assert wrapped.status_code == 429
        assert wrapped.data["code"] == "throttled"
        assert wrapped.data["message"] == "Request was throttled."

    def test_request_id_from_context_no_request(self):
        assert exc_module._request_id_from_context({}) is None

    def test_exception_handler_uses_generic_message_when_detail_missing(self):
        exc = drf_exc.APIException()
        exc.default_code = "custom"

        response = exc_module.drf_exception_handler(exc, self._ctx("rid-generic"))
        assert response.data["code"] == "custom"
        assert response.data["message"] == "A server error occurred."
