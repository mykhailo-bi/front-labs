from __future__ import annotations

import base64
from typing import Optional

from django.http import HttpResponse
from django.conf import settings


class BasicAuthMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response
        user = getattr(settings, 'BASIC_AUTH_USERNAME', None)
        password = getattr(settings, 'BASIC_AUTH_PASSWORD', None)

        self.enabled = bool(user and password)
        self.username = user
        self.password = password
        self.realm = getattr(settings, 'BASIC_AUTH_REALM', 'Restricted')

    def __call__(self, request):
        if self.enabled:
            if not self._authenticate(request):
                return self._unauthorized_response()
        response = self.get_response(request)
        return response

    def _authenticate(self, request) -> bool:
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        if not auth_header.startswith('Basic '):
            return False
        try:
            b64 = auth_header.split(' ', 1)[1].strip()
            decoded = base64.b64decode(b64).decode('utf-8')
        except Exception:
            return False
        if ':' not in decoded:
            return False
        username, password = decoded.split(':', 1)
        return username == self.username and password == self.password

    def _unauthorized_response(self) -> HttpResponse:
        resp = HttpResponse('Unauthorized', status=401)
        resp['WWW-Authenticate'] = f'Basic realm="{self.realm}"'
        return resp