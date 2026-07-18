"""Zählwerk – FastAPI-App. Liefert API + Frontend (statisch) aus einem Prozess."""
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .config import settings
from .database import init_db
from . import notifier
from .routers import ha, imports, readings, settings as settings_router, systems

app = FastAPI(title="Zählwerk API", version="2.9.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",")],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(systems.router)
app.include_router(readings.router)
app.include_router(imports.router)
app.include_router(settings_router.router)
app.include_router(ha.router)


@app.on_event("startup")
async def _startup():
    init_db()
    import asyncio
    asyncio.create_task(notifier.watcher())


@app.get("/api/health")
def health():
    return {"status": "ok", "version": app.version, "db": settings.sqlite_path}


# Frontend statisch mit ausliefern (ein Prozess, ein Port)
_frontend = Path(__file__).resolve().parent.parent / "frontend"
if _frontend.is_dir():
    app.mount("/", StaticFiles(directory=str(_frontend), html=True), name="frontend")
