from pydantic import BaseModel, ConfigDict, Field
from typing import Optional
from datetime import datetime

class PlotCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=100)
    description: str = Field(..., min_length=10, max_length=80_000)
    price: float = Field(..., gt=0, le=10_000_000_000)
    area_sotki: float = Field(..., gt=0, le=100_000)
    location: str = Field(..., min_length=2, max_length=50)
    address: str = Field(..., min_length=5, max_length=2_500)
    geo_ref: str = Field(..., min_length=2, max_length=150)
    lat: float = Field(..., ge=-90, le=90)
    lon: float = Field(..., ge=-180, le=180)
    url: str = Field(default="", max_length=200)
    thumbnail: str = Field(default="", max_length=300)
    images_count: int = Field(default=0, ge=0, le=100)
    was_lowered: bool = False


class PlotUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=3, max_length=100)
    description: Optional[str] = Field(default=None, max_length=80_000)
    price: Optional[float] = Field(default=None, ge=0, le=10_000_000_000)
    area_sotki: Optional[float] = Field(default=None, gt=0, le=100_000)
    location: Optional[str] = Field(default=None, max_length=50)
    address: Optional[str] = Field(default=None, max_length=2_500)
    geo_ref: Optional[str] = Field(default=None, max_length=150)
    lat: Optional[float] = Field(default=None, ge=-90, le=90)
    lon: Optional[float] = Field(default=None, ge=-180, le=180)
    url: Optional[str] = Field(default=None, max_length=200)
    thumbnail: Optional[str] = Field(default=None, max_length=300)
    images_count: Optional[int] = Field(default=None, ge=0, le=100)
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

class InfraObjectCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=80)
    lat: float = Field(..., ge=-90, le=90)
    lon: float = Field(..., ge=-180, le=180)
    type: Optional[str] = Field(default=None, max_length=20)


class InfraObjectOut(BaseModel):
    id: str = Field(alias="_id")
    name: str
    lat: float = 0
    lon: float = 0
    type: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True)

class ImportResult(BaseModel):
    inserted: int
    collection: str


class ExportResult(BaseModel):
    collection: str
    count: int
    data: list[dict]
