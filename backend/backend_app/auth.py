from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone as dt_timezone
from typing import Optional, Tuple

from rest_framework import authentication
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.settings import api_settings
from rest_framework_simplejwt.tokens import AccessToken, RefreshToken

from backend_app import models


@dataclass(frozen=True)
class TokenPair:
    access: str
    refresh: str


def issue_token_pair(*, user: models.User) -> TokenPair:
    refresh = RefreshToken.for_user(user)
    return TokenPair(access=str(refresh.access_token), refresh=str(refresh))


def refresh_access_token(*, refresh_token: str) -> str:
    try:
        refresh = RefreshToken(refresh_token)
    except TokenError as exc:
        raise AuthenticationFailed("Invalid refresh token") from exc

    user_id = refresh.get(api_settings.USER_ID_CLAIM)
    if user_id is None:
        raise AuthenticationFailed("Invalid refresh token")

    try:
        user_id_int = int(user_id)
    except (TypeError, ValueError) as exc:
        raise AuthenticationFailed("Invalid refresh token") from exc

    try:
        user = models.User.objects.get(**{api_settings.USER_ID_FIELD: user_id_int})
    except models.User.DoesNotExist as exc:
        raise AuthenticationFailed("User not found") from exc

    if getattr(user, "status", "active") != "active":
        raise AuthenticationFailed("Account is not active")

    # Enforce blacklist on the refresh token JTI before issuing a new access token.
    jti = refresh.get("jti")
    exp = refresh.get("exp")

    if jti and models.BlacklistedToken.objects.filter(jti=jti).exists():
        raise AuthenticationFailed("Token has been revoked")

    issued_at = refresh.get("iat")
    if issued_at is None:
        raise AuthenticationFailed("Invalid refresh token")

    issued_dt = datetime.fromtimestamp(int(issued_at), tz=dt_timezone.utc)
    if issued_dt < user.tokens_invalidated_at:
        raise AuthenticationFailed("Token has been revoked")

    # Optionally ensure refresh has not expired in DB terms if we stored exp; SimpleJWT
    # already enforces signature/exp, so we just issue access after blacklist check.
    return str(refresh.access_token)


class SimpleJWTAuthentication(authentication.BaseAuthentication):
    """HTTP Bearer auth using SimpleJWT tokens.

    This project does NOT use Django's built-in auth user model. We still use
    SimpleJWT for token minting/verification, but look up users via
    [`backend_app.models.User`](backend/backend_app/models.py#L144).
    """

    def authenticate(self, request) -> Optional[Tuple[models.User, AccessToken]]:
        header = self.get_header(request)
        if header is None:
            return None

        raw_token = self.get_raw_token(header)
        if raw_token is None:
            return None

        validated_token = self.get_validated_token(raw_token)
        user = self.get_user(validated_token)
        return user, validated_token

    def get_header(self, request) -> Optional[bytes]:
        header = request.META.get(api_settings.AUTH_HEADER_NAME)
        if header is None:
            return None
        if isinstance(header, str):
            return header.encode("iso-8859-1")
        return header

    def get_raw_token(self, header: bytes) -> Optional[str]:
        parts = header.split()

        if len(parts) == 0:
            return None

        if len(parts) != 2:
            raise AuthenticationFailed("Invalid Authorization header")

        header_type = parts[0].decode("iso-8859-1")
        if header_type not in api_settings.AUTH_HEADER_TYPES:
            return None

        return parts[1].decode("iso-8859-1")

    def get_validated_token(self, raw_token: str) -> AccessToken:
        try:
            # AccessToken enforces token_type == 'access' and validates signature/expiry.
            token = AccessToken(raw_token)
        except TokenError as exc:
            raise AuthenticationFailed("Invalid token") from exc

        jti = token.get("jti")
        if jti and models.BlacklistedToken.objects.filter(jti=jti).exists():
            raise AuthenticationFailed("Token has been revoked")

        return token

    def get_user(self, validated_token: AccessToken) -> models.User:
        user_id = validated_token.get(api_settings.USER_ID_CLAIM)
        if user_id is None:
            raise AuthenticationFailed("Token contained no recognizable user identification")

        try:
            user_id_int = int(user_id)
        except (TypeError, ValueError) as exc:
            raise AuthenticationFailed("Invalid token user identification") from exc

    try:
        user = models.User.objects.get(**{api_settings.USER_ID_FIELD: user_id_int})
    except models.User.DoesNotExist as exc:
        raise AuthenticationFailed("User not found") from exc

    if getattr(user, "status", "active") != "active":
        raise AuthenticationFailed("Account is not active")

        issued_at = validated_token.get("iat")
        if issued_at is None:
            raise AuthenticationFailed("Invalid token")

        issued_dt = datetime.fromtimestamp(int(issued_at), tz=dt_timezone.utc)
        if issued_dt < user.tokens_invalidated_at:
            raise AuthenticationFailed("Token has been revoked")

        return user
