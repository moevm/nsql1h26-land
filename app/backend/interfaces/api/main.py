import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from domain.exceptions import (
    ConflictError,
    DomainError,
    InvalidIdError,
    NotAuthorizedError,
    NotFoundError,
    ValidationError,
)
from infrastructure.config import get_settings
from infrastructure.database import connect, disconnect, ensure_indexes, seed_admin

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting up...")
    await connect()
    await ensure_indexes()
    await seed_admin()
    logger.info("Ready.")
    yield
    logger.info("Shutting down...")
    await disconnect()


app = FastAPI(
    title="Land Plots Service",
    description="Сервис просмотра, поиска и аналитики объявлений земельных участков",
    version="2.0.0",
    lifespan=lifespan,
)

settings = get_settings()

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(DomainError)
async def domain_error_handler(request: Request, exc: DomainError):
    status_map = {
        NotFoundError: 404,
        NotAuthorizedError: 403,
        ConflictError: 409,
        InvalidIdError: 400,
        ValidationError: 422,
    }
    status = status_map.get(type(exc), 500)
    return JSONResponse(status_code=status, content={"detail": str(exc)})


from interfaces.api.routes.auth import router as auth_router
from interfaces.api.routes.plots import router as plots_router
from interfaces.api.routes.infrastructure import router as infra_router
from interfaces.api.routes.data_io import router as data_io_router
from interfaces.api.routes.users import router as users_router

app.include_router(auth_router)
app.include_router(plots_router)
app.include_router(infra_router)
app.include_router(data_io_router)
app.include_router(users_router)


@app.get("/api/health")
async def health():
    return {"status": "ok"}
