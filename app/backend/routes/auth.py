"""
Маршруты аутентификации: регистрация, вход, профиль.
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from auth import hash_password, verify_password, create_token, get_current_user
from config import COL_USERS
from database import get_db

router = APIRouter(prefix="/api/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=4, max_length=100)


class LoginRequest(BaseModel):
    username: str
    password: str


class AuthResponse(BaseModel):
    token: str
    user: dict


@router.post("/register", response_model=AuthResponse)
async def register(data: RegisterRequest):
    """Регистрация нового пользователя (роль user)."""
    db = get_db()
    existing = await db[COL_USERS].find_one({"username": data.username})
    if existing:
        raise HTTPException(409, "Username already exists")

    pw_hash, salt = hash_password(data.password)
    doc = {
        "username": data.username,
        "password_hash": pw_hash,
        "salt": salt,
        "role": "user",
        "created_at": datetime.now(timezone.utc),
    }
    result = await db[COL_USERS].insert_one(doc)
    user_id = str(result.inserted_id)
    token = create_token(user_id, "user")
    return AuthResponse(
        token=token,
        user={"_id": user_id, "username": data.username, "role": "user"},
    )


@router.post("/login", response_model=AuthResponse)
async def login(data: LoginRequest):
    """Вход в систему."""
    db = get_db()
    user = await db[COL_USERS].find_one({"username": data.username})
    if not user:
        raise HTTPException(401, "Invalid credentials")

    if not verify_password(data.password, user["password_hash"], user["salt"]):
        raise HTTPException(401, "Invalid credentials")

    user_id = str(user["_id"])
    token = create_token(user_id, user["role"])
    return AuthResponse(
        token=token,
        user={"_id": user_id, "username": user["username"], "role": user["role"]},
    )


@router.get("/me")
async def get_me(user: dict = Depends(get_current_user)):
    """Получить текущего пользователя по токену."""
    return user
