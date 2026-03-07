"""
MongoDB: подключение, создание индексов, инициализация данных.
"""

import logging
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from pymongo import GEOSPHERE
from config import (
    MONGODB_URI, MONGODB_DB,
    COL_PLOTS, INFRA_COLLECTIONS, COL_NEGATIVE,
    EMBEDDING_DIM, COL_USERS,
)

logger = logging.getLogger(__name__)

client: AsyncIOMotorClient | None = None
db: AsyncIOMotorDatabase | None = None


async def connect():
    """Создаёт подключение к MongoDB."""
    global client, db
    client = AsyncIOMotorClient(MONGODB_URI)
    db = client[MONGODB_DB]
    logger.info("Connected to MongoDB: %s / %s", MONGODB_URI, MONGODB_DB)


async def disconnect():
    """Закрывает подключение."""
    global client
    if client:
        client.close()
        logger.info("Disconnected from MongoDB")


def get_db() -> AsyncIOMotorDatabase:
    """Возвращает объект базы данных."""
    assert db is not None, "Database not connected"
    return db


async def ensure_indexes():
    """
    Создаёт необходимые индексы:
      - 2dsphere на geo_location в plots
      - 2dsphere на location во всех инфра/негативных коллекциях
      - уникальный индекс на avito_id в plots
    Для HNSW vector search — индекс создаётся через MongoDB Atlas Search UI/API.
    """
    assert db is not None

    # plots
    plots = db[COL_PLOTS]
    await plots.create_index([("geo_location", GEOSPHERE)])
    await plots.create_index("avito_id", unique=True, sparse=True)
    await plots.create_index("price")
    await plots.create_index("area_sotki")
    await plots.create_index("total_score")
    logger.info("Indexes on '%s' ensured", COL_PLOTS)

    # users
    users = db[COL_USERS]
    await users.create_index("username", unique=True)
    logger.info("Indexes on '%s' ensured", COL_USERS)

    # infrastructure collections
    for col_name in INFRA_COLLECTIONS + [COL_NEGATIVE]:
        col = db[col_name]
        await col.create_index([("location", GEOSPHERE)])
        await col.create_index("name")
        logger.info("Indexes on '%s' ensured", col_name)


async def seed_mock_data():
    """
    Если инфра-коллекции пусты — заполняет моковыми данными.
    НЕ перезаписывает существующие данные.
    """
    from mock_data import MOCK_DATA
    assert db is not None

    for col_name, records in MOCK_DATA.items():
        col = db[col_name]
        count = await col.count_documents({})
        if count == 0:
            await col.insert_many(records)
            logger.info("Seeded %d docs into '%s'", len(records), col_name)
        else:
            logger.info("'%s' already has %d docs, skipping seed", col_name, count)


async def seed_admin():
    """
    Создаёт администратора по умолчанию если нет ни одного пользователя.
    Login: admin / admin
    """
    assert db is not None
    from auth import hash_password
    from datetime import datetime, timezone

    users = db[COL_USERS]
    count = await users.count_documents({})
    if count == 0:
        pw_hash, salt = hash_password("admin")
        await users.insert_one({
            "username": "admin",
            "password_hash": pw_hash,
            "salt": salt,
            "role": "admin",
            "created_at": datetime.now(timezone.utc),
        })
        logger.info("Seeded default admin user (admin/admin)")
    else:
        logger.info("Users collection has %d docs, skipping admin seed", count)
