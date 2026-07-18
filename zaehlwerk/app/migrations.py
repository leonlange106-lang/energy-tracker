"""Schema-Migrationen über PRAGMA user_version.

Warum überhaupt: `SQLModel.metadata.create_all()` legt fehlende Tabellen an,
ändert aber NIE bestehende. Ohne dieses Modul würde jede neue Spalte auf
Bestandsinstallationen still mit `OperationalError: no such column` enden.

Ablauf: SQLite hält pro Datei einen Integer (`PRAGMA user_version`, Default 0).
Beim Start läuft jede Migration mit einer höheren Nummer als der gespeicherten
Version genau einmal, aufsteigend, in einer Transaktion. Danach wird die
Version hochgesetzt. Ist die DB neu, hat `create_all()` bereits alles angelegt –
die Migrationen sind deshalb konsequent idempotent formuliert
(`ADD COLUMN` nur nach Spaltenprüfung).

Neue Migration ergänzen: Funktion schreiben, unten in MIGRATIONS eintragen.
Nummern werden nie wiederverwendet und nie umsortiert.
"""
import logging

from sqlalchemy import text
from sqlalchemy.engine import Connection

log = logging.getLogger("zaehlwerk.migrations")


def _columns(conn: Connection, table: str) -> set[str]:
    rows = conn.execute(text(f"PRAGMA table_info({table})")).fetchall()
    return {r[1] for r in rows}


def _table_exists(conn: Connection, table: str) -> bool:
    row = conn.execute(
        text("SELECT name FROM sqlite_master WHERE type='table' AND name=:t"),
        {"t": table},
    ).fetchone()
    return row is not None


# --------------------------------------------------------------------------
# Migration 1: Tabelle für anwendungsweite Einstellungen (Key/Value)
# --------------------------------------------------------------------------
def _m001_app_settings(conn: Connection) -> None:
    if _table_exists(conn, "app_settings"):
        return
    conn.execute(text("""
        CREATE TABLE app_settings (
            key   VARCHAR NOT NULL PRIMARY KEY,
            value VARCHAR NOT NULL
        )
    """))


# --------------------------------------------------------------------------
# Migration 2: Zaehler-Metadaten
# --------------------------------------------------------------------------
def _m002_meters(conn: Connection) -> None:
    if not _table_exists(conn, "meters"):
        conn.execute(text("""
            CREATE TABLE meters (
                id                   VARCHAR NOT NULL PRIMARY KEY,
                system_id            VARCHAR NOT NULL,
                hersteller           VARCHAR,
                modell               VARCHAR,
                zaehlernummer        VARCHAR,
                bauart               VARCHAR,
                baujahr              INTEGER,
                eichung_bis          DATE,
                messstellenbetreiber VARCHAR,
                stellen_vor          INTEGER,
                stellen_nach         INTEGER,
                eingebaut_am         DATE,
                ausgebaut_am         DATE,
                notiz                VARCHAR,
                erstellt_am          DATETIME NOT NULL,
                FOREIGN KEY(system_id) REFERENCES systems(id)
            )
        """))
    # Indizes getrennt und mit IF NOT EXISTS: laeuft auch, wenn die Tabelle
    # bei einer Neuinstallation schon von create_all() angelegt wurde.
    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_meters_system_id ON meters (system_id)"))
    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_meters_zaehlernummer ON meters (zaehlernummer)"))
    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_meters_eichung_bis ON meters (eichung_bis)"))


MIGRATIONS: list[tuple[int, str, callable]] = [
    (1, "app_settings-Tabelle anlegen", _m001_app_settings),
    (2, "meters-Tabelle fuer Zaehler-Metadaten anlegen", _m002_meters),
]


def run_migrations(engine) -> int:
    """Führt ausstehende Migrationen aus. Gibt die erreichte Schemaversion zurück."""
    with engine.begin() as conn:
        current = conn.execute(text("PRAGMA user_version")).scalar() or 0
        target = max((n for n, _, _ in MIGRATIONS), default=0)
        if current >= target:
            return current
        for number, label, fn in sorted(MIGRATIONS, key=lambda m: m[0]):
            if number <= current:
                continue
            log.info("Migration %s: %s", number, label)
            fn(conn)
            # user_version akzeptiert keine Bindeparameter -> Nummer ist eine
            # modulinterne Konstante, keine Nutzereingabe.
            conn.execute(text(f"PRAGMA user_version = {int(number)}"))
        return target


def schema_version(engine) -> int:
    with engine.connect() as conn:
        return conn.execute(text("PRAGMA user_version")).scalar() or 0
