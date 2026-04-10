"""
Pydantic-модели для запросов и ответов.
"""

from pydantic import BaseModel, ConfigDict, Field
from typing import Optional
from datetime import datetime


# ---------- Plots ----------

class PlotCreate(BaseModel):
    """Данные для создания объявления."""
    title: str = Field(..., min_length=3, max_length=180)
    description: str = ""
    price: float = Field(default=0, ge=0)
    area_sotki: Optional[float] = Field(default=None, ge=0)
    location: str = ""
    address: str = ""
    geo_ref: str = ""
    lat: float = Field(..., ge=-90, le=90)
    lon: float = Field(..., ge=-180, le=180)
    url: str = ""
    thumbnail: str = ""
    images_count: int = Field(default=0, ge=0)
    was_lowered: bool = False


class PlotUpdate(BaseModel):
    """Данные для обновления объявления (все поля опциональны)."""
    title: Optional[str] = Field(default=None, min_length=3, max_length=180)
    description: Optional[str] = None
    price: Optional[float] = Field(default=None, ge=0)
    area_sotki: Optional[float] = Field(default=None, ge=0)
    location: Optional[str] = None
    address: Optional[str] = None
    geo_ref: Optional[str] = None
    lat: Optional[float] = Field(default=None, ge=-90, le=90)
    lon: Optional[float] = Field(default=None, ge=-180, le=180)
    url: Optional[str] = None
    thumbnail: Optional[str] = None
    images_count: Optional[int] = Field(default=None, ge=0)
    was_lowered: Optional[bool] = None


class PlotDistance(BaseModel):
    name: str = ""
    km: float = 0


class PlotDistances(BaseModel):
    nearest_metro: PlotDistance = Field(default_factory=PlotDistance)
    nearest_hospital: PlotDistance = Field(default_factory=PlotDistance)
    nearest_school: PlotDistance = Field(default_factory=PlotDistance)
    nearest_kindergarten: PlotDistance = Field(default_factory=PlotDistance)
    nearest_store: PlotDistance = Field(default_factory=PlotDistance)
    nearest_pickup_point: PlotDistance = Field(default_factory=PlotDistance)
    nearest_bus_stop: PlotDistance = Field(default_factory=PlotDistance)
    nearest_negative: PlotDistance = Field(default_factory=PlotDistance)


class PriceHistoryPoint(BaseModel):
    price: float
    at: datetime


class PlotOut(BaseModel):
    """Данные объявления для клиента."""
    id: str = Field(alias="_id")
    avito_id: Optional[int] = None
    title: str = ""
    description: str = ""
    price: float = 0
    area_sotki: Optional[float] = None
    price_per_sotka: Optional[float] = None
    location: str = ""
    address: str = ""
    geo_ref: str = ""
    lat: float = 0
    lon: float = 0
    url: str = ""
    thumbnail: str = ""
    images_count: int = 0
    was_lowered: bool = False
    features: dict[str, float] = Field(default_factory=dict)
    feature_score: float = 0
    features_text: str = ""
    distances: Optional[PlotDistances] = None
    infra_score: float = 0
    negative_score: float = 0
    total_score: float = 0
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    owner_id: Optional[str] = None
    owner_name: Optional[str] = None
    combined_score: Optional[float] = None
    jina_score: Optional[float] = None
    price_history: list[PriceHistoryPoint] = Field(default_factory=list)

    model_config = ConfigDict(populate_by_name=True)


class PlotListOut(BaseModel):
    """Постраничный список объявлений."""
    items: list[PlotOut]
    total: int
    page: int
    page_size: int
    pages: int
    has_prev: bool = False
    has_next: bool = False


class LocationStatsOut(BaseModel):
    location: str
    sample_size: int
    avg_price_per_sotka: Optional[float] = None
    median_price_per_sotka: Optional[float] = None
    avg_total_score: Optional[float] = None


class SellerProfileOut(BaseModel):
    username: str
    role: str
    member_since: Optional[datetime] = None
    plots_total: int
    avg_total_score: Optional[float] = None
    avg_price_per_sotka: Optional[float] = None


# ---------- Infrastructure ----------

class InfraObjectCreate(BaseModel):
    name: str
    lat: float
    lon: float
    type: Optional[str] = None  # только для negative_objects


class InfraObjectOut(BaseModel):
    id: str = Field(alias="_id")
    name: str
    lat: float = 0
    lon: float = 0
    type: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True)


# ---------- Data IO ----------

class ImportResult(BaseModel):
    inserted: int
    collection: str


class ExportResult(BaseModel):
    collection: str
    count: int
    data: list[dict]
