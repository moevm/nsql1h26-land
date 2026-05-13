from __future__ import annotations

import asyncio
import logging
from typing import Any

from domain.entities import InfraObject, User
from domain.exceptions import NotFoundError, NotAuthorizedError
from domain.repository_interfaces import InfraRepositoryInterface

logger = logging.getLogger(__name__)

_BACKGROUND_TASKS: set[asyncio.Task[Any]] = set()


class ListInfraTypesUseCase:
    def __init__(self, infra_slugs: list[str]):
        self._infra_slugs = infra_slugs

    def execute(self) -> list[str]:
        return self._infra_slugs


class ListInfraObjectsUseCase:
    def __init__(self, infra_repo: InfraRepositoryInterface):
        self._infra_repo = infra_repo

    async def execute(self, infra_type: str) -> list[InfraObject]:
        return await self._infra_repo.find_all(infra_type)


class GetInfraCountUseCase:
    def __init__(self, infra_repo: InfraRepositoryInterface):
        self._infra_repo = infra_repo

    async def execute(self, infra_type: str) -> int:
        return await self._infra_repo.count(infra_type)


class CreateInfraObjectUseCase:
    def __init__(
        self,
        infra_repo: InfraRepositoryInterface,
        recalculate_fn: callable,
    ):
        self._infra_repo = infra_repo
        self._recalculate_fn = recalculate_fn

    async def execute(self, infra_type: str, data: dict, current_user: User) -> InfraObject:
        if current_user.role != "admin":
            raise NotAuthorizedError("Admin access required")

        obj = InfraObject(
            name=data.get("name", ""),
            lat=data.get("lat", 0),
            lon=data.get("lon", 0),
            type=infra_type,
            subtype=data.get("subtype"),
        )
        obj_id = await self._infra_repo.insert_one(infra_type, obj)
        obj.id = obj_id

        self._schedule_recalculate()
        return obj

    def _schedule_recalculate(self):
        async def _run():
            try:
                count = await self._recalculate_fn()
                logger.info("Recalculated scores for %d plots after infra change", count)
            except Exception as exc:
                logger.warning("Failed to recalculate scores: %s", exc)

        task = asyncio.create_task(_run())
        _BACKGROUND_TASKS.add(task)
        task.add_done_callback(_BACKGROUND_TASKS.discard)


class DeleteInfraObjectUseCase:
    def __init__(
        self,
        infra_repo: InfraRepositoryInterface,
        recalculate_fn: callable,
    ):
        self._infra_repo = infra_repo
        self._recalculate_fn = recalculate_fn

    async def execute(self, infra_type: str, object_id: str, current_user: User) -> None:
        if current_user.role != "admin":
            raise NotAuthorizedError("Admin access required")
        deleted = await self._infra_repo.delete_one(infra_type, object_id)
        if not deleted:
            raise NotFoundError("InfraObject", object_id)

        async def _run():
            try:
                count = await self._recalculate_fn()
                logger.info("Recalculated scores for %d plots after infra deletion", count)
            except Exception as exc:
                logger.warning("Failed to recalculate scores: %s", exc)

        task = asyncio.create_task(_run())
        _BACKGROUND_TASKS.add(task)
        task.add_done_callback(_BACKGROUND_TASKS.discard)


class ReplaceInfraCollectionUseCase:
    def __init__(
        self,
        infra_repo: InfraRepositoryInterface,
        uow_factory: callable,
        recalculate_fn: callable,
    ):
        self._infra_repo = infra_repo
        self._uow_factory = uow_factory
        self._recalculate_fn = recalculate_fn

    async def execute(self, infra_type: str, objects_data: list[dict], current_user: User) -> int:
        if current_user.role != "admin":
            raise NotAuthorizedError("Admin access required")

        objects = [
            InfraObject(
                name=d.get("name", ""),
                lat=d.get("lat", 0),
                lon=d.get("lon", 0),
                subtype=d.get("subtype"),
            )
            for d in objects_data
        ]

        uow = self._uow_factory()
        async with uow:
            count = await self._infra_repo.replace_all(infra_type, objects, session=uow.session)

        async def _run():
            try:
                n = await self._recalculate_fn()
                logger.info("Recalculated scores for %d plots after infra replace", n)
            except Exception as exc:
                logger.warning("Failed to recalculate scores: %s", exc)

        task = asyncio.create_task(_run())
        _BACKGROUND_TASKS.add(task)
        task.add_done_callback(_BACKGROUND_TASKS.discard)

        return count
