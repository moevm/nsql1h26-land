from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class GeoLocation:
    lat: float
    lon: float

    def to_mongo_point(self) -> dict:
        return {"type": "Point", "coordinates": [self.lon, self.lat]}


@dataclass(frozen=True)
class GeoScoreResult:
    distances: dict[str, dict]
    infra_score: float
    negative_score: float


@dataclass(frozen=True)
class FeatureResult:
    features: dict[str, float]
    feature_score: float
    features_text: str


@dataclass(frozen=True)
class Pagination:
    page: int = 1
    page_size: int = 20
    max_page_size: int = 100


@dataclass(frozen=True)
class Page:
    items: list = field(default_factory=list)
    total: int = 0
    page: int = 1
    page_size: int = 20
    pages: int = 0
    has_prev: bool = False
    has_next: bool = False
