import pytest
from rest_framework.test import APIClient

pytestmark = pytest.mark.django_db

class ApiEnvelopeAndOpsTests:
    @pytest.fixture(autouse=True)
    def _setup(self):
        self.client = APIClient()

    def test_healthz(self):
        res = self.client.get("/healthz")
        assert res.status_code == 200
        assert res.data["status"] == "ok"

    def test_error_envelope_has_request_id(self):
        # Trigger a validation error.
        res = self.client.post(
            "/api/v1/auth/register/",
            {"username": "u", "email": "bad", "password": "x"},
            format="json",
            HTTP_X_REQUEST_ID="test-req-1",
        )
        assert res.status_code == 400
        assert "code" in res.data
        assert "message" in res.data
        assert "request_id" in res.data
        assert res.data["request_id"] == "test-req-1"
