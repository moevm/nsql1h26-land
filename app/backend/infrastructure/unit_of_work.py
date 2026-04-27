from __future__ import annotations

import logging

from motor.motor_asyncio import AsyncIOMotorClientSession

logger = logging.getLogger(__name__)


class MongoUnitOfWork:
    """Unit of Work for MongoDB.

    When the deployment supports transactions (replica set / mongos),
    wraps operations in a real transaction with commit/rollback.
    On standalone mongod, operations run without transaction guarantees.
    """

    def __init__(self, session: AsyncIOMotorClientSession | None = None):
        self._session = session
        self._in_transaction = False

    async def __aenter__(self) -> MongoUnitOfWork:
        if self._session is not None:
            try:
                self._session.start_transaction()
                self._in_transaction = True
            except Exception:
                logger.debug("start_transaction failed, running without transaction")
                self._in_transaction = False
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb) -> None:
        try:
            if exc_type is not None and self._in_transaction:
                await self._session.abort_transaction()
            elif self._in_transaction:
                await self._session.commit_transaction()
        finally:
            if self._session is not None:
                await self._session.end_session()
            self._in_transaction = False
        if exc_val is not None:
            raise exc_val

    @property
    def session(self) -> AsyncIOMotorClientSession | None:
        return self._session
