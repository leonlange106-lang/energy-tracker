"""Zählwerk – FastAPI-App. Liefert API + Frontend (statisch) aus einem Prozess."""
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .config import settings
from .database import init_db
from .version import APP_VERSION
from . import backup as backup_mod, mqtt_client, notifier, outbound
from .routers import (backups, external, ha, imports, meters, mqtt, readings,
                      settings as settings_router, systems, tariffs)

app = FastAPI(title="Zählwerk API", version=APP_VERSION)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",")],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(systems.router)
app.include_router(readings.router)
app.include_router(imports.router)
app.include_router(backups.router)
app.include_router(external.router)
app.include_router(meters.router)
app.include_router(tariffs.router)
app.include_router(mqtt.router)
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
    asyncio.create_task(backup_mod.scheduler())
    # MQTT nach dem Socket-Guard starten: ein Broker im eigenen Netz ist von
    # der Sperre nicht betroffen, ein oeffentlicher schon - und genau so soll es sein.
    await asyncio.to_thread(mqtt_client.boot)


@app.get("/api/health")
def health():
    return {"status": "ok", "version": app.version, "db": settings.sqlite_path}


# Frontend statisch mit ausliefern (ein Prozess, ein Port)
_frontend = Path(__file__).resolve().parent.parent / "frontend"
if _frontend.is_dir():
    app.mount("/", StaticFiles(directory=str(_frontend), html=True), name="frontend")
