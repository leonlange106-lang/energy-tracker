"""SQLite-Engine (Stammdaten). Kein separater DB-Dienst nötig."""
from pathlib import Path

from sqlmodel import SQLModel, Session, create_engine

from .config import settings

# Ordner für die DB-Datei sicherstellen
Path(settings.sqlite_path).parent.mkdir(parents=True, exist_ok=True)

engine = create_engine(
    f"sqlite:///{settings.sqlite_path}",
    echo=False,
    connect_args={"check_same_thread": False},
)


def init_db() -> None:
    # Import stellt sicher, dass die Modelle bei create_all registriert sind
    from . import models  # noqa: F401
    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine) as session:
        yield session
