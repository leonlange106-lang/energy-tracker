"""Sicherungen: Status, manuelle Auslösung, Download, Bereinigung."""
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlmodel import Session

from .. import backup as bk
from ..database import get_session
from ..schemas import BackupStatus
from .settings import read_settings

router = APIRouter(prefix="/api/backup", tags=["backup"])


@router.get("", response_model=BackupStatus)
def status(session: Session = Depends(get_session)):
    cfg = read_settings(session)
    entries = bk.list_backups()
    directory = bk.backup_dir()
    return BackupStatus(
        enabled=bool(cfg.get("backup_enabled", True)),
        directory=str(directory),
        supervisor_backup_dir=directory == bk.PRIMARY_DIR,
        time=str(cfg.get("backup_time", "03:30")),
        keep_days=int(cfg.get("backup_keep_days", 7)),
        entries=entries,
        total_bytes=sum(e["size_bytes"] for e in entries),
    )


@router.post("/run")
def run_now(session: Session = Depends(get_session)):
    """Manuelle Sicherung. Läuft synchron – bei den hier üblichen Datenmengen
    dauert das Millisekunden, und die Rückmeldung soll den echten Ausgang
    zeigen statt nur die Annahme des Auftrags."""
    keep = int(read_settings(session).get("backup_keep_days", 7))
    try:
        return bk.run_once(keep)
    except FileNotFoundError as exc:
        raise HTTPException(404, str(exc))
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(500, f"Sicherung fehlgeschlagen: {exc}")


@router.post("/prune")
def prune_now(session: Session = Depends(get_session)):
    keep = int(read_settings(session).get("backup_keep_days", 7))
    return {"removed": bk.prune(keep)}


@router.get("/{filename}")
def download(filename: str):
    """Herunterladen. Der Dateiname wird gegen das eigene Muster geprüft –
    ohne das wäre der Parameter ein Pfad-Traversal auf das Dateisystem."""
    if not bk.FILENAME_RE.match(filename):
        raise HTTPException(400, "Ungültiger Dateiname")
    path: Path = bk.backup_dir() / filename
    if not path.is_file():
        raise HTTPException(404, "Sicherung nicht gefunden")
    return FileResponse(path, media_type="application/gzip", filename=filename)


@router.delete("/{filename}", status_code=204)
def remove(filename: str):
    if not bk.FILENAME_RE.match(filename):
        raise HTTPException(400, "Ungültiger Dateiname")
    (bk.backup_dir() / filename).unlink(missing_ok=True)
