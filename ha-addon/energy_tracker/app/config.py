"""Zentrale Konfiguration. Alle Werte via ENV / .env überschreibbar.

Zusatz: Läuft die App als Home-Assistant-Add-on, liegen die Optionen in
/data/options.json. Diese werden hier VOR Settings() nach ENV überführt,
damit dieselbe Codebasis in LXC (Docker/.env) und Add-on funktioniert.
"""
import json
import os
from pathlib import Path

from pydantic_settings import BaseSettings

# --- Home-Assistant-Add-on-Optionen (falls vorhanden) ---
_opts = Path("/data/options.json")
if _opts.exists():
    try:
        _data = json.loads(_opts.read_text())
        for _key in ("influx_url", "influx_token", "influx_org", "influx_bucket"):
            if _data.get(_key):
                os.environ.setdefault(_key.upper(), str(_data[_key]))
    except Exception:
        pass

# Add-on stellt persistentes /data bereit -> SQLite dorthin, falls nicht explizit gesetzt
if Path("/data").is_dir():
    os.environ.setdefault("SQLITE_PATH", "/data/systems.db")


class Settings(BaseSettings):
    # InfluxDB (Time-Series: Messwerte)
    influx_url: str = "http://influxdb:8086"
    influx_token: str = "changeme-token"
    influx_org: str = "energy"
    influx_bucket: str = "readings"

    # SQLite (Stammdaten: Systeme)
    sqlite_path: str = "./data/systems.db"

    # CORS (bei getrenntem Frontend-Host relevant; "*" ok hinter Tailscale)
    cors_origins: str = "*"

    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()
