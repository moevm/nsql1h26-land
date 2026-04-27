from __future__ import annotations

import logging
from datetime import datetime, timezone

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from pymongo import ASCENDING, GEOSPHERE

from infrastructure.config import get_settings

logger = logging.getLogger(__name__)

client: AsyncIOMotorClient | None = None
db: AsyncIOMotorDatabase | None = None


async def connect():
    global client, db
    settings = get_settings()
    client = AsyncIOMotorClient(settings.mongodb_uri, serverSelectionTimeoutMS=3000)
    db = client[settings.mongodb_db]
    await db.command("ping")
    logger.info("Connected to MongoDB: %s / %s", settings.mongodb_uri, settings.mongodb_db)


async def disconnect():
    global client, db
    if db is not None:
        await db.command("ping")
    if client:
        client.close()
        logger.info("Disconnected from MongoDB")


def get_db() -> AsyncIOMotorDatabase:
    assert db is not None, "Database not connected"
    return db


def get_motor_client() -> AsyncIOMotorClient:
    assert client is not None, "Database not connected"
    return client


async def ensure_indexes():
    assert db is not None
    settings = get_settings()

    plots = db[settings.col_plots]
    await plots.create_index([("geo_location", GEOSPHERE)])
    await plots.create_index("avito_id", unique=True, sparse=True)
    await plots.create_index("created_at")
    await plots.create_index("price")
    await plots.create_index("area_sotki")
    await plots.create_index("price_per_sotka")
    await plots.create_index("infra_score")
    await plots.create_index("feature_score")
    await plots.create_index("total_score")
    logger.info("Indexes on '%s' ensured", settings.col_plots)

    users = db[settings.col_users]
    await users.create_index("username", unique=True)
    logger.info("Indexes on '%s' ensured", settings.col_users)

    infra = db[settings.col_infra]
    await infra.create_index([("location", GEOSPHERE)])
    await infra.create_index([("type", ASCENDING), ("name", ASCENDING)])
    await infra.create_index("subtype", sparse=True)
    logger.info("Indexes on '%s' ensured", settings.col_infra)


async def seed_admin():
    from infrastructure.auth import hash_password
    from infrastructure.repositories.user_repository import MotorUserRepository
    from domain.entities import User

    settings = get_settings()
    repo = MotorUserRepository(get_db())
    defaults = [
        (settings.seed_admin_username, settings.seed_admin_password, "admin"),
        (settings.seed_user_username, settings.seed_user_password, "user"),
    ]
    for username, password, role in defaults:
        pw_hash = hash_password(password, settings.password_salt)
        existing = await repo.find_by_username(username)
        if existing:
            if existing.password_hash != pw_hash:
                await repo.update_password(existing.id, pw_hash)
                logger.info("Updated password for '%s'", username)
            else:
                logger.info("User '%s' already exists, skipping seed", username)
            continue
        user = User(username=username, password_hash=pw_hash, role=role, created_at=datetime.now(timezone.utc))
        await repo.insert_one(user)
        logger.info("Seeded default %s user (%s)", role, username)
