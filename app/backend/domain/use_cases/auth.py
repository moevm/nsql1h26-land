from __future__ import annotations

from datetime import datetime, timezone

from domain.entities import User
from domain.exceptions import ConflictError, NotAuthorizedError
from domain.repository_interfaces import UserRepositoryInterface


class RegisterUseCase:
    def __init__(
        self,
        user_repo: UserRepositoryInterface,
        hash_password: callable,
        create_token: callable,
    ):
        self._user_repo = user_repo
        self._hash_password = hash_password
        self._create_token = create_token

    async def execute(self, username: str, password: str) -> tuple[User, str]:
        existing = await self._user_repo.find_by_username(username)
        if existing:
            raise ConflictError("Username already exists")
        pw_hash = self._hash_password(password)
        user = User(
            username=username,
            role="user",
            password_hash=pw_hash,
            created_at=datetime.now(timezone.utc),
        )
        user_id = await self._user_repo.insert_one(user)
        user.id = user_id
        token = self._create_token(user_id, user.role)
        return user, token


class LoginUseCase:
    def __init__(
        self,
        user_repo: UserRepositoryInterface,
        verify_password: callable,
        create_token: callable,
    ):
        self._user_repo = user_repo
        self._verify_password = verify_password
        self._create_token = create_token

    async def execute(self, username: str, password: str) -> tuple[User, str]:
        user = await self._user_repo.find_by_username(username)
        if not user or not self._verify_password(password, user.password_hash):
            raise NotAuthorizedError("Invalid credentials")
        token = self._create_token(user.id, user.role)
        return user, token


class GetCurrentUserUseCase:
    def __init__(
        self,
        user_repo: UserRepositoryInterface,
        decode_token: callable,
    ):
        self._user_repo = user_repo
        self._decode_token = decode_token

    async def execute(self, token: str) -> User:
        payload = self._decode_token(token)
        user = await self._user_repo.find_by_id(payload["sub"])
        if not user:
            raise NotAuthorizedError("User not found")
        return user
