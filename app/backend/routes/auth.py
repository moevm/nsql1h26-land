"""
Маршруты аутентификации: регистрация, вход, профиль.
"""

from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from auth import hash_password, verify_password, create_token, get_current_user
from database import get_user_repo

router = APIRouter(prefix="/api/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=20)
    password: str = Field(..., min_length=4, max_length=128)


class LoginRequest(BaseModel):
    username: str
    password: str


class AuthUser(BaseModel):
    id: str = Field(alias="_id")
    username: str
    role: str


class AuthResponse(BaseModel):
    token: str
    user: AuthUser


@router.post(
    "/register",
    response_model=AuthResponse,
    responses={409: {"description": "Username already exists"}},
)
async def register(data: RegisterRequest):
    """Регистрация нового пользователя (роль user)."""
    repo = get_user_repo()
    existing = await repo.find_by_username(data.username)
    if existing:
        raise HTTPException(409, "Username already exists")

    pw_hash = hash_password(data.password)
    doc = {
        "username": data.username,
        "password_hash": pw_hash,
        "role": "user",
        "created_at": datetime.now(timezone.utc),
    }
    user_id = str(await repo.insert_one(doc))
    token = create_token(user_id, "user")
    return AuthResponse(
        token=token,
        user={"_id": user_id, "username": data.username, "role": "user"},
    )


@router.post(
    "/login",
    response_model=AuthResponse,
    responses={401: {"description": "Invalid credentials"}},
)
async def login(data: LoginRequest):
    """Вход в систему."""
    repo = get_user_repo()
    user = await repo.find_by_username(data.username)
    if not user:
        raise HTTPException(401, "Invalid credentials")

    if not verify_password(data.password, user["password_hash"]):
        raise HTTPException(401, "Invalid credentials")

    user_id = str(user["_id"])
    token = create_token(user_id, user["role"])
    return AuthResponse(
        token=token,
        user={"_id": user_id, "username": user["username"], "role": user["role"]},
    )


@router.get("/me", response_model=AuthUser)
async def get_me(user: Annotated[dict, Depends(get_current_user)]):
    """Получить текущего пользователя по токену."""
    return AuthUser(**user)
