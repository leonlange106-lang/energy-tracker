"""FastAPI-App: liefert API + (später) Frontend als statische Dateien -> ein Prozess, ein Port."""
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from . import influx
from .config import settings
from .database import init_db
from .routers import imports, readings, systems

app = FastAPI(title="Energy Tracker API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",")],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(systems.router)
app.include_router(readings.router)
app.include_router(imports.router)


@app.on_event("startup")
def _startup():
    init_db()


@app.get("/api/health")
def health():
    return {"status": "ok", "influx": influx.ping()}


# Frontend (Phase 2) statisch mit ausliefern, falls vorhanden.
_frontend = Path(__file__).resolve().parent.parent / "frontend"
if _frontend.is_dir():
    app.mount("/", StaticFiles(directory=str(_frontend), html=True), name="frontend")
