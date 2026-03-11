"""
Pydantic-модели для запросов и ответов.
"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


# ---------- Plots ----------

class PlotCreate(BaseModel):
    """Данные для создания объявления."""
    title: str
    description: str = ""
    price: float = 0
    area_sotki: Optional[float] = None
    location: str = ""
    address: str = ""
    geo_ref: str = ""
    lat: float
    lon: float
    url: str = ""
    thumbnail: str = ""
    images_count: int = 0
    was_lowered: bool = False


class PlotUpdate(BaseModel):
    """Данные для обновления объявления (все поля опциональны)."""
    title: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    area_sotki: Optional[float] = None
    location: Optional[str] = None
    address: Optional[str] = None
    geo_ref: Optional[str] = None
    lat: Optional[float] = None
    lon: Optional[float] = None
    url: Optional[str] = None
    thumbnail: Optional[str] = None
    images_count: Optional[int] = None
    was_lowered: Optional[bool] = None


class PlotDistance(BaseModel):
    name: str = ""
    km: float = 0


class PlotDistances(BaseModel):
    nearest_metro: PlotDistance = PlotDistance()
    nearest_hospital: PlotDistance = PlotDistance()
    nearest_school: PlotDistance = PlotDistance()
    nearest_kindergarten: PlotDistance = PlotDistance()
    nearest_store: PlotDistance = PlotDistance()
    nearest_pickup_point: PlotDistance = PlotDistance()
    nearest_bus_stop: PlotDistance = PlotDistance()
    nearest_negative: PlotDistance = PlotDistance()


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
    features: dict = {}
    feature_score: float = 0
    features_text: str = ""
    distances: PlotDistances = PlotDistances()
    infra_score: float = 0
    negative_score: float = 0
    total_score: float = 0
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    owner_id: Optional[str] = None
    owner_name: Optional[str] = None

    class Config:
        populate_by_name = True


class PlotListOut(BaseModel):
    """Постраничный список объявлений."""
    items: list[PlotOut]
    total: int
    page: int
    page_size: int
    pages: int


class SearchQuery(BaseModel):
    """Параметры поиска."""
    query: str
    top_n: int = 20
    min_price: Optional[float] = None
    max_price: Optional[float] = None
    min_area: Optional[float] = None
    max_area: Optional[float] = None


class SearchResultItem(PlotOut):
    """Результат поиска с дополнительными скорами."""
    combined_score: Optional[float] = None
    jina_score: Optional[float] = None


class SearchResultOut(BaseModel):
    items: list[SearchResultItem]
    total: int
    query: str
    page: int
    page_size: int
    pages: int
    can_expand: bool = False  # есть ещё кандидаты за пределами кэша


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

    class Config:
        populate_by_name = True


# ---------- Data IO ----------

class ImportResult(BaseModel):
    inserted: int
    collection: str


class ExportResult(BaseModel):
    collection: str
    count: int
    data: list[dict]
