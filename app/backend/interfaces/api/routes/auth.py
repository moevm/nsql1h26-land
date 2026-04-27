from typing import Annotated

from fastapi import APIRouter, Depends

from domain.entities import User
from domain.use_cases.auth import RegisterUseCase, LoginUseCase
from interfaces.api.deps import (
    get_current_user,
    get_register_use_case,
    get_login_use_case,
)
from interfaces.api.schemas import (
    AuthResponse,
    AuthUser,
    LoginRequest,
    RegisterRequest,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=AuthResponse)
async def register(
    data: RegisterRequest,
    use_case: RegisterUseCase = Depends(get_register_use_case),
):
    user, token = await use_case.execute(data.username, data.password)
    return AuthResponse(
        token=token,
        user=AuthUser(_id=user.id, username=user.username, role=user.role),
    )


@router.post("/login", response_model=AuthResponse)
async def login(
    data: LoginRequest,
    use_case: LoginUseCase = Depends(get_login_use_case),
):
    user, token = await use_case.execute(data.username, data.password)
    return AuthResponse(
        token=token,
        user=AuthUser(_id=user.id, username=user.username, role=user.role),
    )


@router.get("/me", response_model=AuthUser)
async def get_me(user: User = Depends(get_current_user)):
    return AuthUser(_id=user.id, username=user.username, role=user.role)
