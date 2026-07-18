"""Zählwerk – FastAPI-App. Liefert API + Frontend (statisch) aus einem Prozess."""
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .config import settings
from .database import init_db
from . import notifier, outbound
from .routers import (external, ha, imports, meters, readings,
                      settings as settings_router, systems)

app = FastAPI(title="Zählwerk API", version="2.12.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",")],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(systems.router)
app.include_router(readings.router)
app.include_router(imports.router)
app.include_router(external.router)
app.include_router(meters.router)
app.include_router(settings_router.router)
app.include_router(ha.router)


@app.on_event("startup")
async def _startup():
    # Reihenfolge zwingend: Guard VOR allem anderen installieren, damit keine
    # Verbindung in der Startphase durchrutscht. Der Guard laesst im Zweifel
    # nichts nach draussen - die Flagge startet auf True.
    outbound.install_socket_guard()
    init_db()
    from .routers.settings import get_setting
    outbound.set_offline(bool(get_setting("offline_mode", True)))
    import asyncio
    asyncio.create_task(notifier.watcher())


@app.get("/api/health")
def health():
    return {"status": "ok", "version": app.version, "db": settings.sqlite_path}


# Frontend statisch mit ausliefern (ein Prozess, ein Port)
_frontend = Path(__file__).resolve().parent.parent / "frontend"
if _frontend.is_dir():
    app.mount("/", StaticFiles(directory=str(_frontend), html=True), name="frontend")
