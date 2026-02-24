import uuid
import re


class RequestIdMiddleware:
    """Attach a request id to each request/response.

    - Reads `X-Request-ID` header if provided (useful behind proxies).
    - Otherwise generates a UUID4.
    - Exposes it as `request.request_id`.
    - Echoes it back as `X-Request-ID` response header.
    """

    header_name = "HTTP_X_REQUEST_ID"
    response_header = "X-Request-ID"

    # Allow a conservative subset (compatible with common tracing ids).
    _allowed_re = re.compile(r"^[A-Za-z0-9._-]{1,64}$")

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        incoming = request.META.get(self.header_name)

        if isinstance(incoming, str):
            candidate = incoming.strip()
        else:
            candidate = ""

        if candidate and self._allowed_re.match(candidate):
            request_id = candidate
        else:
            request_id = str(uuid.uuid4())

        request.request_id = request_id
        response = self.get_response(request)
        try:
            response[self.response_header] = request_id
        except Exception:
            # Some responses may not be dict-like (should be rare); ignore.
            pass
        return response
