"""Datenmodell (SQLite) – Stammdaten, Messwerte, Zähler-Metadaten, Einstellungen."""
import uuid
from datetime import date, datetime
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



class Meter(SQLModel, table=True):
    """Physischer Zähler als eigene Entität, 1:N unter einem System.

    Warum nicht als Spalten am System: Ein System (z. B. "Strom Hauptzähler")
    überlebt mehrere physische Zähler – der Zählertausch ist bereits über
    `Reading.meter_replaced` abgebildet. Metadaten am System würden beim
    Tausch die Historie des alten Geräts überschreiben.

    Bewusst NICHT verknüpft mit der Verbrauchsberechnung: `logic.py` bleibt
    unverändert. Diese Tabelle ist reine Dokumentation (Eichfrist, Seriennummer,
    Hersteller) und kann fehlen, ohne dass eine Auswertung bricht.
    """
    __tablename__ = "meters"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    system_id: str = Field(index=True, foreign_key="systems.id")

    hersteller: Optional[str] = None          # z. B. "Pipersberg", "EasyMeter", "Landis+Gyr"
    modell: Optional[str] = None              # z. B. "mMe4.0", "Q4000"
    zaehlernummer: Optional[str] = Field(default=None, index=True)   # aufgedruckte Nummer
    bauart: Optional[str] = None              # z. B. "Balgengaszaehler", "Ferraris", "mME"
    baujahr: Optional[int] = None

    # Eichfrist: in D je nach Medium 5-16 Jahre. Praktischer Kern dieser Tabelle.
    eichung_bis: Optional[date] = Field(default=None, index=True)
    messstellenbetreiber: Optional[str] = None

    # Stellenzahl -> Grundlage fuer Plausibilitaet und Ueberlauferkennung
    stellen_vor: Optional[int] = None
    stellen_nach: Optional[int] = None

    eingebaut_am: Optional[date] = None
    ausgebaut_am: Optional[date] = None        # None = aktuell verbaut
    notiz: Optional[str] = None
    erstellt_am: datetime = Field(default_factory=datetime.utcnow)


class Tariff(SQLModel, table=True):
    """Tarifperiode eines Systems.

    Zeitscheiben statt eines einzelnen Preises am System: Preise ändern sich,
    und ein Bestand über 24 Jahre mit einem heutigen Arbeitspreis zu bewerten
    wäre schlicht falsch. Jede Periode gilt ab `gueltig_ab` bis `gueltig_bis`;
    ist letzteres leer, läuft sie bis auf Weiteres.

    Der bestehende Ø-Preis in `System.zusatzfelder["preis"]` bleibt unberührt
    und dient weiter als grobe Schätzung, wenn für einen Zeitraum kein Tarif
    hinterlegt ist.
    """
    __tablename__ = "tariffs"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    system_id: str = Field(index=True, foreign_key="systems.id")

    name: Optional[str] = None                 # z. B. "Grundversorgung 2024"
    anbieter: Optional[str] = None
    gueltig_ab: date = Field(index=True)
    gueltig_bis: Optional[date] = Field(default=None, index=True)   # None = offen

    arbeitspreis: float                        # € je Einheit (kWh, m³ …), brutto
    grundpreis: float = 0.0                    # € je Monat, brutto
    notiz: Optional[str] = None
    erstellt_am: datetime = Field(default_factory=datetime.utcnow)


class AppSetting(SQLModel, table=True):
    """Anwendungsweite Einstellungen als Key/Value.

    Bewusst KV statt einer Spalte je Option: neue Optionen brauchen dann keine
    Schemaänderung und damit keine weitere Migration. Werte werden als Text
    abgelegt und beim Lesen typisiert (siehe routers/settings.py).
    """
    __tablename__ = "app_settings"

    key: str = Field(primary_key=True)
    value: str
