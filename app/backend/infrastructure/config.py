from __future__ import annotations

import os
from dataclasses import dataclass, field


def _parse_csv_env(name: str, default: str) -> list[str]:
    raw = os.getenv(name, default)
    return [v.strip() for v in raw.split(",") if v.strip()]


@dataclass
class Settings:
    mongodb_uri: str = "mongodb://mongo:27017"
    mongodb_db: str = "land_plots"

    col_plots: str = "plots"
    col_infra: str = "infra_objects"
    col_users: str = "users"

    infra_types: list[str] = field(default_factory=lambda: [
        "metro_station", "hospital", "school", "kindergarten",
        "store", "pickup_point", "bus_stop", "negative",
    ])

    infra_slug_to_type: dict[str, str] = field(default_factory=lambda: {
        "metro_stations": "metro_station",
        "hospitals": "hospital",
        "schools": "school",
        "kindergartens": "kindergarten",
        "stores": "store",
        "pickup_points": "pickup_point",
        "bus_stops": "bus_stop",
        "negative_objects": "negative",
    })

    jina_api_key: str = ""
    jina_rerank_url: str = "https://api.jina.ai/v1/rerank"
    jina_rerank_model: str = "jina-reranker-v2-base-multilingual"
    jina_embeddings_url: str = "https://api.jina.ai/v1/embeddings"
    jina_embeddings_model: str = "jina-embeddings-v3"
    jina_embeddings_dim: int = 512
    jina_embeddings_timeout: float = 30.0
    jina_embeddings_batch: int = 64
    jina_embeddings_task: str = "text-matching"

    feature_threshold: float = 0.60
    feature_definitions: dict[str, tuple[str, float]] = field(default_factory=lambda: {
        "has_gas": ("к участку подведён газ, газоснабжение, газификация", 0.25),
        "has_electricity": ("подведено электричество, электроснабжение, свет", 0.20),
        "has_water": ("водоснабжение, водопровод, скважина, колодец", 0.20),
        "has_sewage": ("канализация, септик, очистные сооружения", 0.15),
        "has_house": ("на участке есть жилой дом, коттедж, дачный дом, баня, постройки", 0.30),
        "is_izhs": ("категория земли ИЖС, индивидуальное жилищное строительство", 0.35),
        "is_snt": ("садоводческое товарищество СНТ, дачное партнёрство ДНП", 0.10),
        "is_quiet": ("тихое спокойное уединённое место", 0.20),
        "has_forest": ("рядом лес, сосновый бор, берёзовая роща, хвойный лес, чаща", 0.10),
        "near_river": ("рядом река, озеро, пруд, водоём", 0.10),
        "has_road": ("хороший заезд, асфальтированная дорога к участку", 0.15),
        "has_fence": ("участок огорожен забором, есть ограждение", 0.10),
        "flat_terrain": ("ровный участок правильной формы, разработан, без уклона", 0.10),
        "has_communications": ("все коммуникации подведены к участку", 0.20),
        "documents_ready": ("документы готовы к сделке", 0.15),
    })

    weights: dict[str, float] = field(default_factory=lambda: {
        "infra": 0.35, "negative": 0.25, "features": 0.25, "price": 0.15,
    })

    infra_max_distance_km: float = 50.0
    negative_min_distance_km: float = 0.5
    negative_max_distance_km: float = 20.0

    search_vector_top_k: int = 100
    search_jina_top_n: int = 20
    jina_score_threshold: float = 0.1
    alpha: float = 0.3
    beta: float = 0.7

    jwt_secret: str = ""
    jwt_algorithm: str = "HS256"
    jwt_expire_hours: int = 72
    password_salt: str = ""

    default_page_size: int = 20
    max_page_size: int = 100

    cors_origins: list[str] = field(default_factory=lambda: [
        "http://localhost:3000", "http://localhost:5173",
    ])

    seed_admin_username: str = "admin"
    seed_admin_password: str = "admin"
    seed_user_username: str = "user"
    seed_user_password: str = "user"
    seed_data_dir: str = ""
    seed_infra_file: str = "infrastructure.json"
    seed_plots_file: str = "enriched_cache.json"

    def __post_init__(self):
        self.mongodb_uri = os.getenv("MONGODB_URI", self.mongodb_uri)
        self.mongodb_db = os.getenv("MONGODB_DB", self.mongodb_db)
        self.jina_api_key = os.getenv("JINA_API_KEY", self.jina_api_key)
        self.jina_embeddings_model = os.getenv("JINA_EMBEDDINGS_MODEL", self.jina_embeddings_model)
        self.jina_embeddings_dim = int(os.getenv("JINA_EMBEDDINGS_DIM", str(self.jina_embeddings_dim)))
        self.jina_embeddings_timeout = float(os.getenv("JINA_EMBEDDINGS_TIMEOUT", str(self.jina_embeddings_timeout)))
        self.jina_embeddings_batch = int(os.getenv("JINA_EMBEDDINGS_BATCH", str(self.jina_embeddings_batch)))
        self.jina_embeddings_task = os.getenv("JINA_EMBEDDINGS_TASK", self.jina_embeddings_task)
        self.jwt_secret = os.getenv("JWT_SECRET", "land-plots-dev-secret-key-change-in-prod")
        self.jwt_algorithm = os.getenv("JWT_ALGORITHM", self.jwt_algorithm)
        self.jwt_expire_hours = int(os.getenv("JWT_EXPIRE_HOURS", str(self.jwt_expire_hours)))
        self.password_salt = os.getenv("PASSWORD_SALT", self.jwt_secret)
        self.cors_origins = _parse_csv_env("CORS_ORIGINS", ",".join(self.cors_origins))
        self.seed_admin_username = os.getenv("SEED_ADMIN_USERNAME", self.seed_admin_username)
        self.seed_admin_password = os.getenv("SEED_ADMIN_PASSWORD", self.seed_admin_password)
        self.seed_user_username = os.getenv("SEED_USER_USERNAME", self.seed_user_username)
        self.seed_user_password = os.getenv("SEED_USER_PASSWORD", self.seed_user_password)
        self.seed_data_dir = os.getenv("SEED_DATA_DIR", os.path.join(os.path.dirname(__file__), "..", "..", "data"))
        self.seed_infra_file = os.getenv("SEED_INFRA_FILE", self.seed_infra_file)
        self.seed_plots_file = os.getenv("SEED_PLOTS_FILE", self.seed_plots_file)

    @property
    def feature_weights(self) -> dict[str, float]:
        return {k: v[1] for k, v in self.feature_definitions.items()}

    @property
    def feature_labels(self) -> dict[str, str]:
        return {
            "has_gas": "газ", "has_electricity": "электричество",
            "has_water": "водоснабжение", "has_sewage": "канализация",
            "has_house": "дом/постройки", "is_izhs": "ИЖС",
            "is_snt": "СНТ/ДНП", "is_quiet": "тихое место",
            "has_forest": "лес рядом", "near_river": "водоём рядом",
            "has_road": "хороший подъезд", "has_fence": "огорожен",
            "flat_terrain": "ровный участок", "has_communications": "коммуникации подведены",
            "documents_ready": "документы готовы",
        }

    @property
    def infra_type_to_slug(self) -> dict[str, str]:
        return {v: k for k, v in self.infra_slug_to_type.items()}

    @property
    def infra_slugs(self) -> list[str]:
        return list(self.infra_slug_to_type.keys())

    @property
    def all_collections(self) -> list[str]:
        return [self.col_plots] + self.infra_slugs


_settings: Settings | None = None


def get_settings() -> Settings:
    global _settings
    if _settings is None:
        _settings = Settings()
    return _settings
