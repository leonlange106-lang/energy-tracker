"""Datenmodell (SQLite) – Stammdaten UND Messwerte. Kein InfluxDB mehr."""
import uuid
from datetime import datetime
from enum import Enum
from typing import Optional

from sqlmodel import Column, Field, JSON, SQLModel


class SystemType(str, Enum):
    strom = "Strom"
    gas = "Gas"
    wasser = "Wasser"
    pv_erzeugung = "PV-Erzeugung"
    pv_einspeisung = "PV-Einspeisung"
    custom = "Custom"


class System(SQLModel, table=True):
    __tablename__ = "systems"

    # Stabile UUID (niemals der Name – Namen können sich ändern)
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    name: str
    typ: str
    einheit: str
    farbe: str = "#3b82f6"
    icon: str = "bolt"
    # Typ-spezifische Zusatzfelder (z.B. Gas: brennwert; PV: kwp) als JSON -> generisch erweiterbar
    zusatzfelder: dict = Field(default_factory=dict, sa_column=Column(JSON))
    # Kein Hard-Delete: Systeme werden archiviert (aktiv=False), Messreihen bleiben erhalten
    aktiv: bool = True
    erstellt_am: datetime = Field(default_factory=datetime.utcnow)


class Reading(SQLModel, table=True):
    __tablename__ = "readings"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    system_id: str = Field(index=True, foreign_key="systems.id")
    datum: datetime = Field(index=True)          # Ablesedatum (nicht Erfassungszeitpunkt)
    value: float
    cost: Optional[float] = None
    meter_replaced: bool = False
    note: Optional[str] = None



class AppSetting(SQLModel, table=True):
    """Anwendungsweite Einstellungen als Key/Value.

    Bewusst KV statt einer Spalte je Option: neue Optionen brauchen dann keine
    Schemaänderung und damit keine weitere Migration. Werte werden als Text
    abgelegt und beim Lesen typisiert (siehe routers/settings.py).
    """
    __tablename__ = "app_settings"

    key: str = Field(primary_key=True)
    value: str
