"""
MongoDB: подключение, создание индексов, инициализация данных.
"""

import logging
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from pymongo import ASCENDING, GEOSPHERE
from config import (
    MONGODB_URI, MONGODB_DB,
    COL_PLOTS, COL_INFRA, COL_USERS,
)

logger = logging.getLogger(__name__)

_INDEX_LOG_TEMPLATE = "Indexes on '%s' ensured"

client: AsyncIOMotorClient | None = None
db: AsyncIOMotorDatabase | None = None


async def connect():
    """Создаёт подключение к MongoDB."""
    global client, db
    client = AsyncIOMotorClient(MONGODB_URI)
    db = client[MONGODB_DB]
    # Проверяем доступность соединения при старте.
    await db.command("ping")
    logger.info("Connected to MongoDB: %s / %s", MONGODB_URI, MONGODB_DB)


async def disconnect():
    """Закрывает подключение."""
    global client, db
    if db is not None:
        await db.command("ping")
    if client:
        client.close()
        logger.info("Disconnected from MongoDB")


def get_db() -> AsyncIOMotorDatabase:
    """Возвращает объект базы данных."""
    assert db is not None, "Database not connected"
    return db


# ---------- Фабрики репозиториев ----------

def get_plot_repo():
    """Возвращает экземпляр PlotRepository."""
    from repositories.plot_repository import PlotRepository
    return PlotRepository(get_db())


def get_infra_repo():
    """Возвращает экземпляр InfraRepository."""
    from repositories.infra_repository import InfraRepository
    return InfraRepository(get_db())


def get_user_repo():
    """Возвращает экземпляр UserRepository."""
    from repositories.user_repository import UserRepository
    return UserRepository(get_db())


async def ensure_indexes():
    """
    Создаёт необходимые индексы (см. app/docs/data_model.md):
      plots:        geo_location (2dsphere), avito_id (unique sparse),
                    price, area_sotki, total_score
      users:        username (unique)
      infra_objects: location (2dsphere), составной (type, name), subtype
    """
    assert db is not None

    # plots
    plots = db[COL_PLOTS]
    await plots.create_index([("geo_location", GEOSPHERE)])
    await plots.create_index("avito_id", unique=True, sparse=True)
    await plots.create_index("created_at")
    await plots.create_index("price")
    await plots.create_index("area_sotki")
    await plots.create_index("price_per_sotka")
    await plots.create_index("infra_score")
    await plots.create_index("feature_score")
    await plots.create_index("total_score")
    logger.info(_INDEX_LOG_TEMPLATE, COL_PLOTS)

    # users
    users = db[COL_USERS]
    await users.create_index("username", unique=True)
    logger.info(_INDEX_LOG_TEMPLATE, COL_USERS)

    # infra_objects (единая коллекция с полем type + опц. subtype)
    infra = db[COL_INFRA]
    await infra.create_index([("location", GEOSPHERE)])
    await infra.create_index([("type", ASCENDING), ("name", ASCENDING)])
    await infra.create_index("subtype", sparse=True)
    logger.info(_INDEX_LOG_TEMPLATE, COL_INFRA)


async def seed_admin():
    """
    Создаёт учётки по умолчанию, если их ещё нет в БД.
    По умолчанию: admin/admin (role=admin) и user/user (role=user).
    Имена/пароли можно переопределить через env-переменные
    SEED_ADMIN_USERNAME/PASSWORD и SEED_USER_USERNAME/PASSWORD.
    """
    from auth import hash_password
    from datetime import datetime, timezone
    from config import (
        SEED_ADMIN_USERNAME, SEED_ADMIN_PASSWORD,
        SEED_USER_USERNAME, SEED_USER_PASSWORD,
    )

    repo = get_user_repo()
    defaults = [
        (SEED_ADMIN_USERNAME, SEED_ADMIN_PASSWORD, "admin"),
        (SEED_USER_USERNAME, SEED_USER_PASSWORD, "user"),
    ]
    for username, password, role in defaults:
        existing = await repo.find_by_username(username)
        if existing:
            logger.info("User '%s' already exists, skipping seed", username)
            continue
        await repo.insert_one({
            "username": username,
            "password_hash": hash_password(password),
            "role": role,
            "created_at": datetime.now(timezone.utc),
        })
        logger.info("Seeded default %s user (%s)", role, username)
