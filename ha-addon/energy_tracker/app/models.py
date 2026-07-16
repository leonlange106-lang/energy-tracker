"""Stammdaten-Modell (SQLite). Messwerte liegen NICHT hier, sondern in InfluxDB."""
import uuid
from datetime import datetime
from enum import Enum

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

    # Stabile UUID -> wird als Influx-Tag system_id genutzt (niemals der Name!)
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    name: str
    typ: str
    einheit: str
    farbe: str = "#3b82f6"
    icon: str = "bolt"
    # Typ-spezifische Zusatzfelder (z.B. PV: kwp, verguetung_ct) als JSON -> generisch erweiterbar
    zusatzfelder: dict = Field(default_factory=dict, sa_column=Column(JSON))
    # Kein Hard-Delete: Systeme werden archiviert (aktiv=False), Messreihen bleiben erhalten
    aktiv: bool = True
    erstellt_am: datetime = Field(default_factory=datetime.utcnow)
