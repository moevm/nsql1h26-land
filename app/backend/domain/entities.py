from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class User:
    id: str | None = None
    username: str = ""
    role: str = "user"
    password_hash: str = ""
    created_at: datetime | None = None


@dataclass
class PriceHistoryEntry:
    price: float
    at: datetime


@dataclass
class Plot:
    id: str | None = None
    avito_id: int | None = None
    title: str = ""
    description: str = ""
    price: float = 0
    area_sotki: float | None = None
    price_per_sotka: float | None = None
    location: str = ""
    address: str = ""
    geo_ref: str = ""
    lat: float = 0
    lon: float = 0
    url: str = ""
    thumbnail: str = ""
    images_count: int = 0
    was_lowered: bool = False
    features: dict[str, float] = field(default_factory=dict)
    feature_score: float = 0
    features_text: str = ""
    infra_score: float = 0
    negative_score: float = 0
    total_score: float = 0
    distances: dict[str, dict] | None = None
    price_history: list[PriceHistoryEntry] = field(default_factory=list)
    owner_id: str | None = None
    owner_name: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


@dataclass
class InfraObject:
    id: str | None = None
    name: str = ""
    lat: float = 0
    lon: float = 0
    type: str | None = None
    subtype: str | None = None
    dist_meters: float | None = None
