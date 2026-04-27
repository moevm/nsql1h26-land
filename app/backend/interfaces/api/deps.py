from __future__ import annotations

from typing import Generator

from fastapi import Depends, HTTPException, Request

from domain.entities import User
from domain.exceptions import DomainError, NotAuthorizedError
from domain.repository_interfaces import (
    InfraRepositoryInterface,
    PlotRepositoryInterface,
    UserRepositoryInterface,
)
from domain.use_cases.auth import GetCurrentUserUseCase, LoginUseCase, RegisterUseCase
from domain.use_cases.data_management import (
    ClearCollectionUseCase,
    ExportAllUseCase,
    ExportCollectionUseCase,
    GetStatsUseCase,
    ImportPlotsUseCase,
)
from domain.use_cases.infra import (
    CreateInfraObjectUseCase,
    DeleteInfraObjectUseCase,
    ListInfraTypesUseCase,
    ListInfraObjectsUseCase,
    ReplaceInfraCollectionUseCase,
)
from domain.use_cases.plots import (
    CreatePlotUseCase,
    DeletePlotUseCase,
    GetLocationStatsUseCase,
    GetLocationSuggestionsUseCase,
    GetMapPlotsUseCase,
    GetMyPlotsUseCase,
    GetPlotUseCase,
    GetPriceHistoryUseCase,
    ListPlotsUseCase,
    RecalculateAllScoresUseCase,
    SearchPlotsUseCase,
    UpdatePlotUseCase,
)
from domain.value_objects import GeoScoreResult
from domain.scoring import compute_geo_score, build_distances_map
from infrastructure.auth import (
    create_token,
    decode_token,
    hash_password,
    verify_password,
    TokenError,
)
from infrastructure.config import Settings, get_settings
from infrastructure.database import get_db, get_motor_client
from infrastructure.embeddings import JinaEmbeddingClient
from infrastructure.listing import (
    build_plot_filters,
    build_sort_spec,
    clamp_page,
    compute_pages,
    normalize_order,
    normalize_sort,
)
from infrastructure.repositories.infra_repository import MotorInfraRepository
from infrastructure.repositories.plot_repository import MotorPlotRepository
from infrastructure.repositories.user_repository import MotorUserRepository
from infrastructure.search import SearchEngine
from infrastructure.unit_of_work import MongoUnitOfWork
from infrastructure.listing import parse_area as _parse_area


# --- Repositories ---

def get_plot_repo() -> PlotRepositoryInterface:
    return MotorPlotRepository(get_db())


def get_infra_repo() -> InfraRepositoryInterface:
    return MotorInfraRepository(get_db())


def get_user_repo() -> UserRepositoryInterface:
    return MotorUserRepository(get_db())


# --- Settings ---

def _get_settings() -> Settings:
    return get_settings()


# --- UoW ---

def get_uow() -> MongoUnitOfWork:
    return MongoUnitOfWork()


# --- Auth Dependencies ---

async def get_current_user(request: Request) -> User:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(401, "Not authenticated")
    token = auth[7:]
    settings = _get_settings()
    use_case = GetCurrentUserUseCase(
        get_user_repo(),
        lambda t: decode_token(t, settings.jwt_secret, settings.jwt_algorithm),
    )
    try:
        return await use_case.execute(token)
    except (NotAuthorizedError, TokenError) as e:
        raise HTTPException(401, str(e))


async def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(403, "Admin access required")
    return user


# --- Compute Distances Helper ---

async def _compute_distances(infra_repo: InfraRepositoryInterface, lat: float, lon: float) -> GeoScoreResult:
    settings = _get_settings()
    nearest_by_type = await infra_repo.find_nearest_per_type(lon, lat)
    distances = build_distances_map(nearest_by_type, settings.infra_max_distance_km)
    return compute_geo_score(distances, settings.infra_max_distance_km)


# --- Embeddings Client ---

def _get_embedding_client() -> JinaEmbeddingClient:
    return JinaEmbeddingClient(_get_settings())


# --- Search Engine ---

def _get_search_engine() -> SearchEngine:
    return SearchEngine(_get_settings())


# --- Use Case Factories ---

def get_register_use_case() -> RegisterUseCase:
    settings = _get_settings()
    return RegisterUseCase(
        get_user_repo(),
        lambda pw: hash_password(pw, settings.password_salt),
        lambda uid, role: create_token(uid, role, settings.jwt_secret, settings.jwt_algorithm, settings.jwt_expire_hours),
    )


def get_login_use_case() -> LoginUseCase:
    settings = _get_settings()
    return LoginUseCase(
        get_user_repo(),
        lambda pw, ph: verify_password(pw, ph, settings.password_salt),
        lambda uid, role: create_token(uid, role, settings.jwt_secret, settings.jwt_algorithm, settings.jwt_expire_hours),
    )


def get_create_plot_use_case() -> CreatePlotUseCase:
    client = _get_embedding_client()
    engine = _get_search_engine()
    return CreatePlotUseCase(
        plot_repo=get_plot_repo(),
        infra_repo=get_infra_repo(),
        extract_features=client.extract_features,
        compute_distances=_compute_distances,
        invalidate_cache=engine.invalidate_cache,
    )


def get_update_plot_use_case() -> UpdatePlotUseCase:
    client = _get_embedding_client()
    engine = _get_search_engine()
    return UpdatePlotUseCase(
        plot_repo=get_plot_repo(),
        infra_repo=get_infra_repo(),
        extract_features=client.extract_features,
        compute_distances=_compute_distances,
        invalidate_cache=engine.invalidate_cache,
        parse_area=_parse_area,
    )


def get_delete_plot_use_case() -> DeletePlotUseCase:
    engine = _get_search_engine()
    return DeletePlotUseCase(
        plot_repo=get_plot_repo(),
        invalidate_cache=engine.invalidate_cache,
    )


def get_plot_use_case() -> GetPlotUseCase:
    return GetPlotUseCase(
        plot_repo=get_plot_repo(),
        infra_repo=get_infra_repo(),
        compute_distances=_compute_distances,
    )


def get_list_plots_use_case() -> ListPlotsUseCase:
    return ListPlotsUseCase(
        plot_repo=get_plot_repo(),
        build_filters=build_plot_filters,
        build_sort=build_sort_spec,
        compute_pages_fn=compute_pages,
        clamp_page_fn=clamp_page,
    )


def get_search_plots_use_case() -> SearchPlotsUseCase:
    return SearchPlotsUseCase(
        plot_repo=get_plot_repo(),
        search_engine=_get_search_engine(),
        build_filters=build_plot_filters,
        compute_pages_fn=compute_pages,
        clamp_page_fn=clamp_page,
    )


def get_map_plots_use_case() -> GetMapPlotsUseCase:
    return GetMapPlotsUseCase(
        plot_repo=get_plot_repo(),
        compute_pages_fn=compute_pages,
        clamp_page_fn=clamp_page,
    )


def get_my_plots_use_case() -> GetMyPlotsUseCase:
    return GetMyPlotsUseCase(
        plot_repo=get_plot_repo(),
        build_sort=build_sort_spec,
        compute_pages_fn=compute_pages,
        clamp_page_fn=clamp_page,
        normalize_sort_fn=normalize_sort,
        normalize_order_fn=normalize_order,
    )


def get_location_suggestions_use_case() -> GetLocationSuggestionsUseCase:
    return GetLocationSuggestionsUseCase(get_plot_repo())


def get_location_stats_use_case() -> GetLocationStatsUseCase:
    return GetLocationStatsUseCase(get_plot_repo())


def get_price_history_use_case() -> GetPriceHistoryUseCase:
    return GetPriceHistoryUseCase(get_plot_repo())


def get_recalculate_use_case() -> RecalculateAllScoresUseCase:
    return RecalculateAllScoresUseCase(
        plot_repo=get_plot_repo(),
        infra_repo=get_infra_repo(),
        compute_distances=_compute_distances,
    )


def get_list_infra_types_use_case() -> ListInfraTypesUseCase:
    s = _get_settings()
    return ListInfraTypesUseCase(s.infra_slugs)


def get_list_infra_objects_use_case() -> ListInfraObjectsUseCase:
    return ListInfraObjectsUseCase(get_infra_repo())


def get_create_infra_object_use_case() -> CreateInfraObjectUseCase:
    recalculate = get_recalculate_use_case()
    return CreateInfraObjectUseCase(
        infra_repo=get_infra_repo(),
        recalculate_fn=recalculate.execute,
    )


def get_delete_infra_object_use_case() -> DeleteInfraObjectUseCase:
    recalculate = get_recalculate_use_case()
    return DeleteInfraObjectUseCase(
        infra_repo=get_infra_repo(),
        recalculate_fn=recalculate.execute,
    )


def get_replace_infra_collection_use_case() -> ReplaceInfraCollectionUseCase:
    recalculate = get_recalculate_use_case()
    return ReplaceInfraCollectionUseCase(
        infra_repo=get_infra_repo(),
        uow_factory=get_uow,
        recalculate_fn=recalculate.execute,
    )


def get_export_all_use_case() -> ExportAllUseCase:
    s = _get_settings()
    return ExportAllUseCase(get_plot_repo(), get_infra_repo(), s.col_plots, s.infra_slugs)


def get_export_collection_use_case() -> ExportCollectionUseCase:
    s = _get_settings()
    return ExportCollectionUseCase(get_plot_repo(), get_infra_repo(), s.all_collections, s.col_plots)


def get_import_plots_use_case() -> ImportPlotsUseCase:
    s = _get_settings()
    client = _get_embedding_client()
    engine = _get_search_engine()
    return ImportPlotsUseCase(
        plot_repo=get_plot_repo(),
        infra_repo=get_infra_repo(),
        uow_factory=get_uow,
        extract_features_batch=client.extract_features_batch,
        compute_distances=_compute_distances,
        invalidate_cache=engine.invalidate_cache,
        parse_area=_parse_area,
        feature_keys=list(s.feature_definitions.keys()),
    )


def get_clear_collection_use_case() -> ClearCollectionUseCase:
    s = _get_settings()
    recalculate = get_recalculate_use_case()
    engine = _get_search_engine()
    return ClearCollectionUseCase(
        plot_repo=get_plot_repo(),
        infra_repo=get_infra_repo(),
        invalidate_cache=engine.invalidate_cache,
        recalculate_fn=recalculate.execute,
        all_collections=s.all_collections,
        col_plots=s.col_plots,
    )


def get_stats_use_case() -> GetStatsUseCase:
    s = _get_settings()
    return GetStatsUseCase(get_plot_repo(), get_infra_repo(), s.col_plots, s.infra_slugs)
