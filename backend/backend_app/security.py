from __future__ import annotations

import base64
import hashlib
import hmac
import secrets
from dataclasses import dataclass


@dataclass(frozen=True)
class PasswordHash:
    algorithm: str
    iterations: int
    salt_b64: str
    digest_b64: str

    def encode(self) -> str:
        return f"{self.algorithm}${self.iterations}${self.salt_b64}${self.digest_b64}"


def _b64(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def _b64d(data: str) -> bytes:
    pad = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode((data + pad).encode("ascii"))


def hash_password(password: str, *, iterations: int = 260_000) -> str:
    """Hash a password using PBKDF2-HMAC-SHA256.

    Stored format:
      pbkdf2_sha256$<iterations>$<salt_b64>$<digest_b64>
    """

    if not isinstance(password, str) or not password:
        raise ValueError("Password must be a non-empty string")

    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        iterations,
    )
    return PasswordHash(
        algorithm="pbkdf2_sha256",
        iterations=iterations,
        salt_b64=_b64(salt),
        digest_b64=_b64(digest),
    ).encode()


def verify_password(password: str, encoded: str) -> bool:
    # Treat malformed hashes as verification failure, not server error.
    try:
        algorithm, iterations_s, salt_b64, digest_b64 = encoded.split("$", 3)
        if algorithm != "pbkdf2_sha256":
            return False
        iterations = int(iterations_s)
        salt = _b64d(salt_b64)
        expected = _b64d(digest_b64)
    except Exception:
        return False

    actual = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)
    return hmac.compare_digest(expected, actual)
