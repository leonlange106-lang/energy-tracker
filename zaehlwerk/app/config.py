"""Konfiguration. Zählwerk ist standalone (nur SQLite). DB liegt persistent in /share
(HA-Add-on) und überlebt damit Add-on-Updates UND -Wechsel. Fallback: /data bzw. lokal."""
import os
import shutil
from pathlib import Path

from pydantic_settings import BaseSettings

# --- Datenpfad bestimmen (nur wenn nicht via ENV vorgegeben) ---
_data_db = Path("/data/zaehlwerk.db")
if Path("/share").is_dir():
    _share = Path("/share/zaehlwerk")
    _share.mkdir(parents=True, exist_ok=True)
    _target = _share / "zaehlwerk.db"
    # Einmalige Migration von /data (ältere Add-on-Version) nach /share
    if not _target.exists() and _data_db.exists():
        try:
            shutil.copy2(_data_db, _target)
        except Exception:
            pass
    os.environ.setdefault("SQLITE_PATH", str(_target))
elif Path("/data").is_dir():
    os.environ.setdefault("SQLITE_PATH", str(_data_db))


class Settings(BaseSettings):
    sqlite_path: str = "./data/zaehlwerk.db"
    cors_origins: str = "*"

    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()
