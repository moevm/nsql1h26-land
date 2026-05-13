from __future__ import annotations

import hashlib
from datetime import datetime, timedelta, timezone

import jwt


def hash_password(password: str, salt: str) -> str:
    return hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt.encode("utf-8"), 100_000
    ).hex()


def verify_password(password: str, pw_hash: str, salt: str) -> bool:
    return (
        hashlib.pbkdf2_hmac(
            "sha256", password.encode("utf-8"), salt.encode("utf-8"), 100_000
        ).hex()
        == pw_hash
    )


def create_token(
    user_id: str,
    role: str,
    secret: str,
    algorithm: str = "HS256",
    expire_hours: int = 72,
) -> str:
    payload = {
        "sub": user_id,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=expire_hours),
    }
    return jwt.encode(payload, secret, algorithm=algorithm)


class TokenError(Exception):
    pass


class TokenExpiredError(TokenError):
    pass


class InvalidTokenError(TokenError):
    pass


def decode_token(token: str, secret: str, algorithm: str = "HS256") -> dict:
    try:
        return jwt.decode(token, secret, algorithms=[algorithm])
    except jwt.ExpiredSignatureError as e:
        raise TokenExpiredError("Token expired") from e
    except jwt.InvalidTokenError as e:
        raise InvalidTokenError("Invalid token") from e
