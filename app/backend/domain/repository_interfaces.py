from __future__ import annotations

from abc import ABC, abstractmethod

from domain.entities import InfraObject, Plot, User


class PlotRepositoryInterface(ABC):
    @abstractmethod
    async def find_by_id(self, plot_id: str, projection: dict | None = None) -> Plot | None: ...

    @abstractmethod
    async def find_page(
        self,
        query_filter: dict | None,
        sort_fields: list[tuple[str, int]],
        skip: int,
        limit: int,
        projection: dict | None = None,
    ) -> list[Plot]: ...

    @abstractmethod
    async def find_all(
        self,
        query_filter: dict | None = None,
        projection: dict | None = None,
    ) -> list[Plot]: ...

    @abstractmethod
    async def count(self, query_filter: dict | None = None) -> int: ...

    @abstractmethod
    async def insert_one(self, plot: Plot, session=None) -> str: ...

    @abstractmethod
    async def update_one(self, plot_id: str, updates: dict, session=None) -> bool: ...

    @abstractmethod
    async def upsert_by_avito_id(self, avito_id: int, updates: dict, session=None) -> None: ...

    @abstractmethod
    async def delete_one(self, plot_id: str) -> bool: ...

    @abstractmethod
    async def delete_all(self) -> int: ...

    @abstractmethod
    async def suggest_locations(self, query: str, limit: int = 20) -> list[str]: ...

    @abstractmethod
    async def aggregate(self, pipeline: list[dict]) -> list[dict]: ...

    @abstractmethod
    async def find_all_prices(self) -> list[float]: ...


class InfraRepositoryInterface(ABC):
    @abstractmethod
    async def find_all(self, infra_type: str) -> list[InfraObject]: ...

    @abstractmethod
    async def find_all_any(self) -> list[InfraObject]: ...

    @abstractmethod
    async def count(self, infra_type: str) -> int: ...

    @abstractmethod
    async def count_all(self) -> int: ...

    @abstractmethod
    async def find_nearest_per_type(self, lon: float, lat: float) -> dict[str, dict]: ...

    @abstractmethod
    async def insert_one(self, infra_type: str, obj: InfraObject, session=None) -> str: ...

    @abstractmethod
    async def insert_many(self, infra_type: str, objects: list[InfraObject], session=None) -> int: ...

    @abstractmethod
    async def delete_one(self, infra_type: str, object_id: str) -> bool: ...

    @abstractmethod
    async def delete_all(self, infra_type: str, session=None) -> int: ...

    @abstractmethod
    async def replace_all(self, infra_type: str, objects: list[InfraObject], session=None) -> int: ...


class UserRepositoryInterface(ABC):
    @abstractmethod
    async def find_by_id(self, user_id: str) -> User | None: ...

    @abstractmethod
    async def find_by_username(self, username: str) -> User | None: ...

    @abstractmethod
    async def count(self) -> int: ...

    @abstractmethod
    async def insert_one(self, user: User) -> str: ...

    @abstractmethod
    async def update_password(self, user_id: str, pw_hash: str) -> None: ...
