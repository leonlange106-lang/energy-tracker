"""Request-/Response-Schemas (API-Vertrag), getrennt von der DB-Tabelle."""
from datetime import date, datetime
from typing import Any, Optional

from pydantic import BaseModel, Field, field_validator


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


# ---------- Anwendungseinstellungen ----------
class AppSettingsRead(BaseModel):
    notify_enabled: bool
    notify_interval_hours: int
    default_interval_days: int
    outlier_sigma: float


class AppSettingsUpdate(BaseModel):
    """Teil-Update mit Grenzen. Verstoesse -> HTTP 422 VOR dem Schreibzugriff.

    Grenzen begruendet:
    - notify_interval_hours 1..168: unter 1 h waere Spam, ueber 7 Tage sinnlos,
      weil Ablesungen frueher faellig werden.
    - default_interval_days 0..3650: 0 = automatische Median-Prognose.
    - outlier_sigma 1.0..5.0: unter 1 sigma waere fast jeder Wert ein
      Ausreisser, ueber 5 sigma praktisch keiner mehr.
    """
    notify_enabled: Optional[bool] = None
    notify_interval_hours: Optional[int] = Field(None, ge=1, le=168)
    default_interval_days: Optional[int] = Field(None, ge=0, le=3650)
    outlier_sigma: Optional[float] = Field(None, ge=1.0, le=5.0)

    @field_validator("outlier_sigma")
    @classmethod
    def _round_sigma(cls, v):
        return None if v is None else round(v, 2)


class SystemInfo(BaseModel):
    """Read-only Laufzeitdiagnose (Sektion A der Einstellungen)."""
    app_version: str
    schema_version: int
    python_version: str
    platform: str
    db_path: str
    db_exists: bool
    db_size_bytes: int
    journal_mode: str
    foreign_keys: bool
    runtime: str
    supervisor_available: bool
    system_count: int
    reading_count: int
