import os
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))


def _parse_csv_env(name: str, default: str) -> list[str]:
    raw = os.getenv(name, default)
    return [value.strip() for value in raw.split(",") if value.strip()]

# --- MongoDB ---
MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://mongo:27017")
MONGODB_DB = os.getenv("MONGODB_DB", "land_plots")

# --- Collections (см. app/docs/data_model.md) ---
COL_PLOTS = "plots"
COL_INFRA = "infra_objects"
COL_USERS = "users"

# Типы в infra_objects.type (по data_model.md)
INFRA_TYPES = [
    "metro_station",
    "hospital",
    "school",
    "kindergarten",
    "store",
    "pickup_point",
    "bus_stop",
    "negative",
]

# Внешние slug-идентификаторы (в API-путях, ключах export/import, стат.).
# Внутренне всё хранится в одной коллекции infra_objects с полем type.
INFRA_SLUG_TO_TYPE = {
    "metro_stations":   "metro_station",
    "hospitals":        "hospital",
    "schools":          "school",
    "kindergartens":    "kindergarten",
    "stores":           "store",
    "pickup_points":    "pickup_point",
    "bus_stops":        "bus_stop",
    "negative_objects": "negative",
}
INFRA_TYPE_TO_SLUG = {v: k for k, v in INFRA_SLUG_TO_TYPE.items()}
INFRA_SLUGS = list(INFRA_SLUG_TO_TYPE.keys())

# Backward-совместимые алиасы на внешние slug — используются в роутах/экспорте.
COL_METRO = "metro_stations"
COL_HOSPITALS = "hospitals"
COL_SCHOOLS = "schools"
COL_KINDERGARTENS = "kindergartens"
COL_STORES = "stores"
COL_PICKUP_POINTS = "pickup_points"
COL_BUS_STOPS = "bus_stops"
COL_NEGATIVE = "negative_objects"

INFRA_COLLECTIONS = [
    COL_METRO, COL_HOSPITALS, COL_SCHOOLS,
    COL_KINDERGARTENS, COL_STORES, COL_PICKUP_POINTS, COL_BUS_STOPS,
]

# --- Jina API ---
JINA_API_KEY = os.getenv("JINA_API_KEY", "")
JINA_RERANK_URL = "https://api.jina.ai/v1/rerank"
JINA_RERANK_MODEL = "jina-reranker-v2-base-multilingual"
JINA_EMBEDDINGS_URL = "https://api.jina.ai/v1/embeddings"
JINA_EMBEDDINGS_MODEL = os.getenv("JINA_EMBEDDINGS_MODEL", "jina-embeddings-v3")
JINA_EMBEDDINGS_DIM = int(os.getenv("JINA_EMBEDDINGS_DIM", "512"))
JINA_EMBEDDINGS_TIMEOUT = float(os.getenv("JINA_EMBEDDINGS_TIMEOUT", "30"))
JINA_EMBEDDINGS_BATCH = int(os.getenv("JINA_EMBEDDINGS_BATCH", "64"))
JINA_EMBEDDINGS_TASK = os.getenv("JINA_EMBEDDINGS_TASK", "text-matching")

# --- Feature definitions ---
FEATURE_THRESHOLD = 0.30
FEATURE_DEFINITIONS = {
    "has_gas":            ("к участку подведён газ, газоснабжение, газификация", 0.25),
    "has_electricity":    ("подведено электричество, электроснабжение, свет", 0.20),
    "has_water":          ("водоснабжение, водопровод, скважина, колодец", 0.20),
    "has_sewage":         ("канализация, септик, очистные сооружения", 0.15),
    "has_house":          ("на участке есть жилой дом, коттедж, дачный дом, баня, постройки", 0.30),
    "is_izhs":            ("категория земли ИЖС, индивидуальное жилищное строительство", 0.35),
    "is_snt":             ("садоводческое товарищество СНТ, дачное партнёрство ДНП", 0.10),
    "is_quiet":           ("тихое спокойное уединённое место", 0.20),
    "has_forest":         ("рядом лес, сосновый бор, берёзовая роща, хвойный лес, чаща", 0.10),
    "near_river":         ("рядом река, озеро, пруд, водоём", 0.10),
    "has_road":           ("хороший заезд, асфальтированная дорога к участку", 0.15),
    "has_fence":          ("участок огорожен забором, есть ограждение", 0.10),
    "flat_terrain":       ("ровный участок правильной формы, разработан, без уклона", 0.10),
    "has_communications": ("все коммуникации подведены к участку", 0.20),
    "documents_ready":    ("документы готовы к сделке", 0.15),
}
FEATURE_WEIGHTS = {k: v[1] for k, v in FEATURE_DEFINITIONS.items()}

FEATURE_LABELS = {
    "has_gas": "газ",
    "has_electricity": "электричество",
    "has_water": "водоснабжение",
    "has_sewage": "канализация",
    "has_house": "дом/постройки",
    "is_izhs": "ИЖС",
    "is_snt": "СНТ/ДНП",
    "is_quiet": "тихое место",
    "has_forest": "лес рядом",
    "near_river": "водоём рядом",
    "has_road": "хороший подъезд",
    "has_fence": "огорожен",
    "flat_terrain": "ровный участок",
    "has_communications": "коммуникации подведены",
    "documents_ready": "документы готовы",
}

# --- Scoring weights ---
WEIGHTS = {
    "infra":    0.35,
    "negative": 0.25,
    "features": 0.25,
    "price":    0.15,
}

# --- Geo thresholds ---
INFRA_MAX_DISTANCE_KM = 50.0
NEGATIVE_MIN_DISTANCE_KM = 0.5
NEGATIVE_MAX_DISTANCE_KM = 20.0

# --- Search ---
SEARCH_VECTOR_TOP_K = 100        # кол-во кандидатов для BM25 pre-ranking
SEARCH_JINA_TOP_N = 20
JINA_SCORE_THRESHOLD = 0.1        # порог Jina score — ниже отсекаем
ALPHA = 0.6
BETA = 0.4

# --- Auth / JWT ---
JWT_SECRET = os.getenv("JWT_SECRET", "land-plots-dev-secret-key-change-in-prod")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_HOURS = 72
PASSWORD_SALT = os.getenv("PASSWORD_SALT", JWT_SECRET)

# --- Pagination ---
DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 100

# --- CORS ---
CORS_ORIGINS = _parse_csv_env(
    "CORS_ORIGINS",
    "http://localhost:3000,http://localhost:5173",
)

# --- Seeding ---
SEED_ADMIN_USERNAME = os.getenv("SEED_ADMIN_USERNAME", "admin")
SEED_ADMIN_PASSWORD = os.getenv("SEED_ADMIN_PASSWORD", "admin")
SEED_USER_USERNAME = os.getenv("SEED_USER_USERNAME", "user")
SEED_USER_PASSWORD = os.getenv("SEED_USER_PASSWORD", "user")
SEED_DATA_DIR = os.getenv(
    "SEED_DATA_DIR",
    os.path.join(os.path.dirname(__file__), "..", "data"),
)
SEED_INFRA_FILE = os.getenv("SEED_INFRA_FILE", "infrastructure.json")
SEED_PLOTS_FILE = os.getenv("SEED_PLOTS_FILE", "enriched_cache.json")
