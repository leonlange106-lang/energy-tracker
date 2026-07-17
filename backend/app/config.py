"""Zentrale Konfiguration. Zählwerk ist standalone (nur SQLite, kein externer Dienst)."""
import os
from pathlib import Path

from pydantic_settings import BaseSettings

# Home-Assistant-Add-on stellt persistentes /data bereit -> DB dorthin, falls nicht gesetzt
if Path("/data").is_dir():
    os.environ.setdefault("SQLITE_PATH", "/data/zaehlwerk.db")


class Settings(BaseSettings):
    # Eine SQLite-Datei für Stammdaten UND Messwerte
    sqlite_path: str = "./data/zaehlwerk.db"
    # CORS (hinter Ingress/Tailscale unkritisch)
    cors_origins: str = "*"

    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()
