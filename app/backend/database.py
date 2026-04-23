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
    global client, db
    client = AsyncIOMotorClient(MONGODB_URI)
    db = client[MONGODB_DB]
    await db.command("ping")
    logger.info("Connected to MongoDB: %s / %s", MONGODB_URI, MONGODB_DB)


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

def get_plot_repo():
    from repositories.plot_repository import PlotRepository
    return PlotRepository(get_db())


def get_infra_repo():
    from repositories.infra_repository import InfraRepository
    return InfraRepository(get_db())


def get_user_repo():
    from repositories.user_repository import UserRepository
    return UserRepository(get_db())


async def ensure_indexes():
    assert db is not None

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

    users = db[COL_USERS]
    await users.create_index("username", unique=True)
    logger.info(_INDEX_LOG_TEMPLATE, COL_USERS)

    infra = db[COL_INFRA]
    await infra.create_index([("location", GEOSPHERE)])
    await infra.create_index([("type", ASCENDING), ("name", ASCENDING)])
    await infra.create_index("subtype", sparse=True)
    logger.info(_INDEX_LOG_TEMPLATE, COL_INFRA)


async def seed_admin():
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
        pw_hash = hash_password(password)
        existing = await repo.find_by_username(username)
        if existing:
            if existing.get("password_hash") != pw_hash:
                await repo.update_password(existing["_id"], pw_hash)
                logger.info("Updated password for '%s'", username)
            else:
                logger.info("User '%s' already exists, skipping seed", username)
            continue
        await repo.insert_one({
            "username": username,
            "password_hash": pw_hash,
            "role": role,
            "created_at": datetime.now(timezone.utc),
        })
        logger.info("Seeded default %s user (%s)", role, username)
