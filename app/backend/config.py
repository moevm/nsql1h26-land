"""
Конфигурация бэкенда — сервиса объявлений земельных участков.
"""

import os
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

# --- MongoDB ---
MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://mongo:27017")
MONGODB_DB = os.getenv("MONGODB_DB", "land_plots")

# --- Collections ---
COL_PLOTS = "plots"
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

# --- Sentence-transformers ---
EMBEDDINGS_MODEL_NAME = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
EMBEDDING_DIM = 384  # размерность эмбеддинга модели

# --- Jina API ---
JINA_API_KEY = os.getenv("JINA_API_KEY", "")
JINA_RERANK_URL = "https://api.jina.ai/v1/rerank"
JINA_RERANK_MODEL = "jina-reranker-v2-base-multilingual"

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
SEARCH_VECTOR_TOP_K = 100        # начальное кол-во кандидатов из vector search
SEARCH_VECTOR_EXPAND_STEP = 100  # шаг расширения при выходе за кэш
SEARCH_VECTOR_MAX_K = 500        # максимальный top_k для vector search
SEARCH_JINA_TOP_N = 20
JINA_SCORE_THRESHOLD = 0.1        # порог Jina score — ниже отсекаем
ALPHA = 0.6
BETA = 0.4

# --- Pagination ---
DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 100
