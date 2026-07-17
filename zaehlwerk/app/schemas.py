"""Request-/Response-Schemas (API-Vertrag), getrennt von der DB-Tabelle."""
from datetime import date, datetime
from typing import Any, Optional

from pydantic import BaseModel, Field


# ---------- Systeme ----------
class SystemCreate(BaseModel):
    name: str
    typ: str
    einheit: str
    farbe: str = "#3b82f6"
    icon: str = "bolt"
    zusatzfelder: dict[str, Any] = Field(default_factory=dict)


class SystemUpdate(BaseModel):
    name: Optional[str] = None
    typ: Optional[str] = None
    einheit: Optional[str] = None
    farbe: Optional[str] = None
    icon: Optional[str] = None
    zusatzfelder: Optional[dict[str, Any]] = None
    aktiv: Optional[bool] = None  # Archivieren = aktiv:false


class SystemRead(BaseModel):
    id: str
    name: str
    typ: str
    einheit: str
    farbe: str
    icon: str
    zusatzfelder: dict[str, Any]
    aktiv: bool
    erstellt_am: datetime


# ---------- Ablesungen ----------
class ReadingCreate(BaseModel):
    datum: date                       # Ablesedatum, NICHT Erfassungszeitpunkt
    value: float
    cost: Optional[float] = None
    meter_replaced: bool = False      # Zählertausch
    note: Optional[str] = None


class ReadingRead(BaseModel):
    id: str                           # base64(system_id|timestamp_ns)
    system_id: str
    datum: datetime
    value: float
    cost: Optional[float] = None
    meter_replaced: bool = False
    note: Optional[str] = None
    # abgeleitete Felder
    consumption: Optional[float] = None
    consumption_per_day: Optional[float] = None
    is_outlier: bool = False
    cost_effective: Optional[float] = None
    cost_estimated: bool = False


# ---------- Statistik / Chart ----------
class StatsRead(BaseModel):
    total_consumption: float
    total_cost: float
    total_days: float
    avg_per_day: Optional[float] = None
    cost_per_day: Optional[float] = None
    cost_per_unit: Optional[float] = None
    min_per_day: Optional[float] = None
    min_per_day_datum: Optional[datetime] = None
    max_per_day: Optional[float] = None
    max_per_day_datum: Optional[datetime] = None
    outlier_threshold: Optional[float] = None
    reading_count: int = 0
    cost_estimated: bool = False


class ChartData(BaseModel):
    system_id: str
    name: str
    unit: str
    color: str
    labels: list[str]
    values: list[Optional[float]]
    consumption: list[Optional[float]]
    consumption_per_day: list[Optional[float]]
    outliers: list[bool]
    meter_replaced: list[bool]


class ImportResult(BaseModel):
    imported: int
    skipped: int
    errors: list[str]
