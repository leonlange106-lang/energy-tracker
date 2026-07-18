"""Einstellungen.

Bewusste Trennung, die sich aus dem Add-on-Modell ergibt:

* **Anwendungsparameter** (Benachrichtigungsintervall, Ausreißer-Sigma …)
  gehören der App und liegen in SQLite. Schreibbar über PUT /api/settings.
* **Laufzeit-/Containerparameter** (DB-Pfad, CORS, Port, Architektur) gehören
  dem Supervisor bzw. dem Image. Die App liefert sie ausschließlich LESEND
  über GET /api/system/info aus. Würde sie sie selbst ändern, liefe der
  Zustand gegen `config.yaml` auseinander und wäre nach jedem Add-on-Update
  wieder überschrieben.

Validierung passiert in den Pydantic-Schemas und damit VOR jedem Schreibzugriff:
FastAPI antwortet bei Regelverstoß mit 422 und Feldnamen, gespeichert wird nichts.
"""
import os
import platform
import sys
from pathlib import Path

from fastapi import APIRouter, Depends
from sqlmodel import Session, func, select

from ..config import settings as runtime_settings
from ..database import engine, get_session
from ..migrations import schema_version
from ..models import AppSetting, Reading, System
from ..schemas import AppSettingsRead, AppSettingsUpdate, SystemInfo

router = APIRouter(tags=["settings"])

# Anwendungsparameter mit Standardwerten. Nur diese Schlüssel werden gelesen
# und geschrieben – unbekannte Keys in der Tabelle werden ignoriert.
DEFAULTS: dict[str, object] = {
    "notify_enabled": True,
    "notify_interval_hours": 6,
    "default_interval_days": 0,
    "outlier_sigma": 2.0,
}

_CASTS = {
    "notify_enabled": lambda v: str(v).lower() in {"1", "true", "ja", "yes"},
    "notify_interval_hours": int,
    "default_interval_days": int,
    "outlier_sigma": float,
}


def read_settings(session: Session) -> dict:
    """Gespeicherte Werte über die Defaults legen. Defekte Einträge fallen
    auf den Standard zurück, statt die App beim Start scheitern zu lassen."""
    values = dict(DEFAULTS)
    for row in session.exec(select(AppSetting)).all():
        if row.key not in DEFAULTS:
            continue
        try:
            values[row.key] = _CASTS[row.key](row.value)
        except (TypeError, ValueError):
            pass
    return values


def get_setting(key: str, default=None):
    """Einzelwert außerhalb eines Request-Kontexts (z. B. im Notifier-Loop)."""
    with Session(engine) as session:
        return read_settings(session).get(key, default)


@router.get("/api/settings", response_model=AppSettingsRead)
def get_settings(session: Session = Depends(get_session)):
    return AppSettingsRead(**read_settings(session))


@router.put("/api/settings", response_model=AppSettingsRead)
def update_settings(payload: AppSettingsUpdate, session: Session = Depends(get_session)):
    """Teil-Update. Die Validierung hat bereits stattgefunden, wenn dieser
    Rumpf läuft – ungültige Werte erreichen die Datenbank nie."""
    for key, value in payload.model_dump(exclude_unset=True).items():
        if key not in DEFAULTS:
            continue
        row = session.get(AppSetting, key)
        raw = "true" if value is True else "false" if value is False else str(value)
        if row:
            row.value = raw
        else:
            row = AppSetting(key=key, value=raw)
        session.add(row)
    session.commit()
    return AppSettingsRead(**read_settings(session))


@router.get("/api/system/info", response_model=SystemInfo)
def system_info(session: Session = Depends(get_session)):
    """Read-only Diagnose. Enthält bewusst keine Tokens oder URLs."""
    db_path = Path(runtime_settings.sqlite_path)
    size = 0
    for suffix in ("", "-wal", "-shm"):
        p = Path(str(db_path) + suffix)
        if p.exists():
            size += p.stat().st_size

    with engine.connect() as conn:
        from sqlalchemy import text
        journal = conn.execute(text("PRAGMA journal_mode")).scalar()
        fk = bool(conn.execute(text("PRAGMA foreign_keys")).scalar())

    supervised = bool(os.environ.get("SUPERVISOR_TOKEN"))
    return SystemInfo(
        app_version=os.environ.get("ZW_VERSION", "2.9.0"),
        schema_version=schema_version(engine),
        python_version=sys.version.split()[0],
        platform=platform.machine(),
        db_path=str(db_path),
        db_exists=db_path.exists(),
        db_size_bytes=size,
        journal_mode=str(journal),
        foreign_keys=fk,
        runtime="Home Assistant Add-on" if supervised else "Standalone (Docker/lokal)",
        supervisor_available=supervised,
        system_count=session.exec(select(func.count()).select_from(System)).one(),
        reading_count=session.exec(select(func.count()).select_from(Reading)).one(),
    )
