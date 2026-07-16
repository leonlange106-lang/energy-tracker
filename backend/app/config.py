"""Zentrale Konfiguration. Alle Werte via ENV / .env überschreibbar."""
from pydantic_settings import BaseSettings


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
