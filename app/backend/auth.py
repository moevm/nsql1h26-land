"""
Аутентификация и авторизация: JWT + PBKDF2-SHA256.
"""

import hashlib
import logging
import os
from datetime import datetime, timedelta, timezone

import jwt
from bson import ObjectId
from fastapi import Depends, HTTPException, Request

from config import JWT_SECRET, JWT_ALGORITHM, JWT_EXPIRE_HOURS, COL_USERS
from database import get_db, get_user_repo

logger = logging.getLogger(__name__)


# --------------- Password hashing ---------------

def hash_password(password: str) -> tuple[str, str]:
    """Хеширует пароль через PBKDF2-SHA256 с рандомной солью."""
    salt = os.urandom(32).hex()
    pw_hash = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt.encode("utf-8"), 100_000
    ).hex()
    return pw_hash, salt


def verify_password(password: str, pw_hash: str, salt: str) -> bool:
    """Проверяет пароль по хешу и соли."""
    return (
        hashlib.pbkdf2_hmac(
            "sha256", password.encode("utf-8"), salt.encode("utf-8"), 100_000
        ).hex()
        == pw_hash
    )


# --------------- JWT ---------------

def create_token(user_id: str, role: str) -> str:
    """Создаёт JWT-токен."""
    payload = {
        "sub": user_id,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRE_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def _decode_token(token: str) -> dict:
    """Декодирует и валидирует JWT-токен."""
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token")


def _extract_bearer(request: Request) -> str | None:
    """Извлекает Bearer токен из заголовка Authorization."""
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        return auth[7:]
    return None


# --------------- FastAPI Dependencies ---------------

async def get_current_user(request: Request) -> dict:
    """Dependency: требует аутентификацию, возвращает текущего пользователя."""
    token = _extract_bearer(request)
    if not token:
        raise HTTPException(401, "Not authenticated")

    payload = _decode_token(token)

    repo = get_user_repo()
    try:
        user = await repo.find_by_id(ObjectId(payload["sub"]))
    except Exception:
        raise HTTPException(401, "Invalid user ID")

    if not user:
        raise HTTPException(401, "User not found")

    return {
        "_id": str(user["_id"]),
        "username": user["username"],
        "role": user["role"],
    }


async def get_optional_user(request: Request) -> dict | None:
    """Dependency: аутентификация опциональна, возвращает None если нет токена."""
    token = _extract_bearer(request)
    if not token:
        return None
    try:
        payload = _decode_token(token)
        repo = get_user_repo()
        user = await repo.find_by_id(ObjectId(payload["sub"]))
        if user:
            return {
                "_id": str(user["_id"]),
                "username": user["username"],
                "role": user["role"],
            }
    except Exception:
        pass
    return None


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    """Dependency: требует роль admin."""
    if user["role"] != "admin":
        raise HTTPException(403, "Admin access required")
    return user
