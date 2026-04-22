"""
FastAPI-приложение: сервис объявлений земельных участков.
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import CORS_ORIGINS
from database import connect, disconnect, ensure_indexes, seed_admin
from seed_data import seed_initial_data
from routes.plots import router as plots_router
from routes.infrastructure import router as infra_router
from routes.data_io import router as data_io_router
from routes.auth import router as auth_router
from routes.users import router as users_router

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown."""
    logger.info("Starting up...")
    await connect()
    await ensure_indexes()
    await seed_admin()
    await seed_initial_data()
    logger.info("Ready.")
    yield
    logger.info("Shutting down...")
    await disconnect()


app = FastAPI(
    title="Land Plots Service",
    description="Сервис просмотра, поиска и аналитики объявлений земельных участков",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(plots_router)
app.include_router(infra_router)
app.include_router(data_io_router)
app.include_router(users_router)


@app.get("/api/health")
async def health():
    return {"status": "ok"}
