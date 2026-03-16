import pytest
import json
import logging
import sys
import uuid
from types import SimpleNamespace
from django.http import HttpResponse
from backend_app import logging as logging_module
from backend_app import middleware as middleware_module

pytestmark = pytest.mark.django_db


class LoggingAndMiddlewareUnitTests:
    def test_json_formatter_outputs_expected_keys_and_exc_info(self):
        formatter = logging_module.JsonFormatter()
        try:
            raise RuntimeError("boom")
        except RuntimeError:
            record = logging.LogRecord(
                name="test",
                level=logging.ERROR,
                pathname=__file__,
                lineno=10,
                msg="hello %s",
                args=("world",),
                exc_info=sys.exc_info(),
            )
        payload = json.loads(formatter.format(record))
        assert payload["level"] == "ERROR"
        assert payload["logger"] == "test"
        assert payload["msg"] == "hello world"
        assert "ts" in payload
        assert "exc_info" in payload

    def test_request_id_middleware_uses_header_and_sets_response(self):
        rid = "abc-123"

        def get_response(req):
            return HttpResponse("ok")

        mw = middleware_module.RequestIdMiddleware(get_response)
        request = SimpleNamespace(META={middleware_module.RequestIdMiddleware.header_name: rid})
        response = mw(request)
        assert request.request_id == rid
        assert response[middleware_module.RequestIdMiddleware.response_header] == rid

    def test_request_id_middleware_generates_uuid_when_missing_or_invalid(self):
        def get_response(req):
            return HttpResponse("ok")

        mw = middleware_module.RequestIdMiddleware(get_response)

        # Missing header
        request_missing = SimpleNamespace(META={})
        response_missing = mw(request_missing)
        assert uuid.UUID(request_missing.request_id)
        assert (
            response_missing[middleware_module.RequestIdMiddleware.response_header]
            == request_missing.request_id
        )

        # Invalid header (fails regex)
        bad = "!bad"
        request_bad = SimpleNamespace(META={middleware_module.RequestIdMiddleware.header_name: bad})
        response_bad = mw(request_bad)
        assert request_bad.request_id != bad
        assert uuid.UUID(request_bad.request_id)
        assert (
            response_bad[middleware_module.RequestIdMiddleware.response_header]
            == request_bad.request_id
        )

    def test_request_id_middleware_non_string_and_response_without_header_support(self):
        def get_response(_req):
            class DummyResponse:
                pass

            return DummyResponse()

        mw = middleware_module.RequestIdMiddleware(get_response)
        request = SimpleNamespace(META={middleware_module.RequestIdMiddleware.header_name: 123})
        response = mw(request)
        assert uuid.UUID(request.request_id)
        assert response is not None
