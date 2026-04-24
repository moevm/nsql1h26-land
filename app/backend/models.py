from pydantic import BaseModel, ConfigDict, Field
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
    title: str | None = Field(default=None, min_length=3, max_length=100)
    description: str | None = Field(default=None, max_length=80_000)
    price: float | None = Field(default=None, ge=0, le=10_000_000_000)
    area_sotki: float | None = Field(default=None, gt=0, le=100_000)
    location: str | None = Field(default=None, max_length=50)
    address: str | None = Field(default=None, max_length=2_500)
    geo_ref: str | None = Field(default=None, max_length=150)
    lat: float | None = Field(default=None, ge=-90, le=90)
    lon: float | None = Field(default=None, ge=-180, le=180)
    url: str | None = Field(default=None, max_length=200)
    thumbnail: str | None = Field(default=None, max_length=300)
    images_count: int | None = Field(default=None, ge=0, le=100)
    was_lowered: bool | None = None


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
    features: dict[str, float] = Field(default_factory=dict)
    feature_score: float = 0
    features_text: str = ""
    distances: PlotDistances | None = None
    infra_score: float = 0
    negative_score: float = 0
    total_score: float = 0
    created_at: datetime | None = None
    updated_at: datetime | None = None
    owner_id: str | None = None
    owner_name: str | None = None
    combined_score: float | None = None
    jina_score: float | None = None
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
    avg_price_per_sotka: float | None = None
    median_price_per_sotka: float | None = None
    avg_total_score: float | None = None


class SellerProfileOut(BaseModel):
    username: str
    role: str
    member_since: datetime | None = None
    plots_total: int
    avg_total_score: float | None = None
    avg_price_per_sotka: float | None = None

class InfraObjectCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=80)
    lat: float = Field(..., ge=-90, le=90)
    lon: float = Field(..., ge=-180, le=180)
    type: str | None = Field(default=None, max_length=20)


class InfraObjectOut(BaseModel):
    id: str = Field(alias="_id")
    name: str
    lat: float = 0
    lon: float = 0
    type: str | None = None

    model_config = ConfigDict(populate_by_name=True)

class ImportResult(BaseModel):
    inserted: int
    collection: str


class ExportResult(BaseModel):
    collection: str
    count: int
    data: list[dict]
