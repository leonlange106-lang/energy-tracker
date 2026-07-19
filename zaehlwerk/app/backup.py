"""Automatische Sicherung der SQLite-Datenbank nach /backup.

**Warum kein Dateikopieren.** Die Datenbank läuft seit 2.2.0 im WAL-Modus.
Ein `shutil.copy` der .db-Datei erwischt einen Stand ohne die noch nicht
eingecheckten Transaktionen aus der -wal-Datei; schreibt gleichzeitig jemand,
ist die Kopie im schlimmsten Fall in sich widersprüchlich. Verwendet wird
deshalb die Online-Backup-API von SQLite (`Connection.backup()`): sie liest
seitenweise unter Sperrschutz, läuft nebenläufig zu Schreibzugriffen und
liefert immer einen konsistenten Stand – ohne die App anzuhalten.

**Warum /backup.** Home Assistant nimmt dieses Verzeichnis in seine eigenen
Voll-Sicherungen auf. Damit landet die Datenbank in derselben Sicherungskette
wie der Rest der Installation. Fehlt das Mapping `backup:rw` im Manifest,
weicht das Modul auf /share aus, statt den Dienst scheitern zu lassen.

**Gefahr beim Aufräumen.** In /backup liegen die Voll-Sicherungen von Home
Assistant. Die rollierende Bereinigung fasst deshalb ausschließlich Dateien an,
die dem eigenen Namensmuster entsprechen – alles andere bleibt unberührt.
"""
import asyncio
import gzip
import logging
import os
import re
import shutil
import sqlite3
import tempfile
from datetime import datetime, timedelta
from pathlib import Path

from .config import settings as runtime_settings

log = logging.getLogger("zaehlwerk.backup")

# Namensmuster der eigenen Sicherungen. Die Bereinigung löscht NUR Treffer.
FILENAME_RE = re.compile(r"^zaehlwerk_(\d{8})-(\d{6})\.db\.gz$")
FILENAME_FMT = "zaehlwerk_%Y%m%d-%H%M%S.db.gz"

PRIMARY_DIR = Path("/backup")
FALLBACK_DIR = Path("/share/zaehlwerk-backups")


def backup_dir() -> Path:
    """/backup, falls vom Supervisor gemappt – sonst /share als Rückfallebene."""
    if PRIMARY_DIR.is_dir() and os.access(PRIMARY_DIR, os.W_OK):
        return PRIMARY_DIR
    FALLBACK_DIR.mkdir(parents=True, exist_ok=True)
    return FALLBACK_DIR


def _source_path() -> Path:
    return Path(runtime_settings.sqlite_path)


def create_backup() -> dict:
    """Erzeugt eine konsistente, komprimierte Sicherung.

    Ablauf: Online-Backup in eine temporäre Datei -> `PRAGMA integrity_check`
    auf der Kopie -> gzip -> atomares Umbenennen ins Zielverzeichnis. Die
    Zieldatei erscheint dadurch erst, wenn sie vollständig und geprüft ist.
    Bricht ein Schritt ab, bleibt nichts Halbfertiges liegen.
    """
    src = _source_path()
    if not src.exists():
        raise FileNotFoundError(f"Datenbank nicht gefunden: {src}")

    target_dir = backup_dir()
    target = target_dir / datetime.now().strftime(FILENAME_FMT)
    started = datetime.now()

    tmp_db = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
    tmp_db.close()
    tmp_db_path = Path(tmp_db.name)
    tmp_gz_path = target.with_suffix(target.suffix + ".part")

    try:
        # 1) Online-Backup: konsistent trotz paralleler Schreibzugriffe
        source_conn = sqlite3.connect(f"file:{src}?mode=ro", uri=True, timeout=30)
        dest_conn = sqlite3.connect(str(tmp_db_path))
        try:
            source_conn.backup(dest_conn, pages=200, sleep=0.05)
        finally:
            dest_conn.close()
            source_conn.close()

        # 2) Kopie prüfen, bevor sie als gültige Sicherung gilt
        check_conn = sqlite3.connect(str(tmp_db_path))
        try:
            result = check_conn.execute("PRAGMA integrity_check").fetchone()[0]
        finally:
            check_conn.close()
        if result != "ok":
            raise RuntimeError(f"Integritätsprüfung fehlgeschlagen: {result}")

        raw_size = tmp_db_path.stat().st_size

        # 3) Komprimieren und erst danach an den endgültigen Namen
        with open(tmp_db_path, "rb") as f_in, gzip.open(tmp_gz_path, "wb", compresslevel=6) as f_out:
            shutil.copyfileobj(f_in, f_out, length=1024 * 1024)
        tmp_gz_path.replace(target)

        info = {
            "file": target.name,
            "path": str(target),
            "size_bytes": target.stat().st_size,
            "source_bytes": raw_size,
            "created": started.isoformat(timespec="seconds"),
            "duration_ms": int((datetime.now() - started).total_seconds() * 1000),
        }
        log.info("Sicherung erstellt: %s (%s Bytes)", target.name, info["size_bytes"])
        return info
    finally:
        tmp_db_path.unlink(missing_ok=True)
        tmp_gz_path.unlink(missing_ok=True)


def list_backups() -> list[dict]:
    """Eigene Sicherungen, neueste zuerst. Fremde Dateien werden ignoriert."""
    out = []
    for entry in backup_dir().iterdir():
        if not entry.is_file():
            continue
        match = FILENAME_RE.match(entry.name)
        if not match:
            continue
        stamp = datetime.strptime(match.group(1) + match.group(2), "%Y%m%d%H%M%S")
        out.append({
            "file": entry.name,
            "created": stamp.isoformat(timespec="seconds"),
            "size_bytes": entry.stat().st_size,
            "age_days": (datetime.now() - stamp).days,
        })
    return sorted(out, key=lambda b: b["created"], reverse=True)


def prune(keep_days: int = 7, keep_min: int = 3) -> list[str]:
    """Rollierende Bereinigung.

    `keep_min` ist die Sicherung gegen die Sicherung: selbst wenn alle
    vorhandenen Sicherungen älter als `keep_days` sind – etwa weil das Add-on
    zwei Wochen aus war – bleiben die neuesten erhalten. Andernfalls würde
    ein einzelner Start ohne erfolgreiche Neusicherung den gesamten Bestand
    löschen.
    """
    entries = list_backups()
    if len(entries) <= keep_min:
        return []
    cutoff = datetime.now() - timedelta(days=keep_days)
    removed = []
    for entry in entries[keep_min:]:
        if datetime.fromisoformat(entry["created"]) < cutoff:
            path = backup_dir() / entry["file"]
            if FILENAME_RE.match(path.name):        # doppelter Boden
                path.unlink(missing_ok=True)
                removed.append(entry["file"])
    if removed:
        log.info("Bereinigt: %s Sicherung(en) entfernt", len(removed))
    return removed


def run_once(keep_days: int = 7, audit_keep_days: int = 365) -> dict:
    info = create_backup()
    info["pruned"] = prune(keep_days)
    # Änderungsprotokoll im selben Lauf beschneiden: es wächst mit jeder
    # Änderung und braucht sonst einen zweiten Zeitplan.
    try:
        from sqlmodel import Session
        from . import audit
        from .database import engine
        with Session(engine) as session:
            removed = audit.prune(session, audit_keep_days)
            session.commit()
        info["audit_pruned"] = removed
    except Exception as exc:  # noqa: BLE001
        log.warning("Protokoll-Bereinigung übersprungen: %s", exc)
        info["audit_pruned"] = 0
    return info


def _seconds_until(hhmm: str) -> float:
    """Sekunden bis zur nächsten Ausführung. Ungültige Zeitangabe -> 03:30."""
    try:
        hour, minute = (int(x) for x in str(hhmm).split(":", 1))
        if not (0 <= hour <= 23 and 0 <= minute <= 59):
            raise ValueError
    except (TypeError, ValueError):
        hour, minute = 3, 30
    now = datetime.now()
    nxt = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
    if nxt <= now:
        nxt += timedelta(days=1)
    return (nxt - now).total_seconds()


async def scheduler() -> None:
    """Tagesplaner. Bewusst kein cron: das Add-on-Image bringt keinen Cron-Daemon
    mit, und ein zweiter Prozess müsste sich die Datenbank mit uvicorn teilen.
    Ein asyncio-Task im laufenden Prozess kennt die Einstellungen ohnehin.

    Einstellungen werden vor JEDEM Durchlauf neu gelesen – Änderungen an
    Uhrzeit, Aufbewahrung oder Ein/Aus greifen ohne Neustart.
    """
    await asyncio.sleep(120)      # Startphase abwarten
    while True:
        try:
            from .routers.settings import get_setting
            enabled = await asyncio.to_thread(get_setting, "backup_enabled", True)
            at = await asyncio.to_thread(get_setting, "backup_time", "03:30")
            keep = int(await asyncio.to_thread(get_setting, "backup_keep_days", 7))
            audit_keep = int(await asyncio.to_thread(get_setting, "audit_keep_days", 365))
        except Exception:  # noqa: BLE001
            enabled, at, keep, audit_keep = True, "03:30", 7, 365

        wait = _seconds_until(at)
        # Nicht länger als eine Stunde am Stück schlafen: sonst würde eine
        # Änderung der Uhrzeit erst am Folgetag wirksam.
        await asyncio.sleep(min(wait, 3600))
        if wait > 3600:
            continue
        if not enabled:
            continue
        try:
            await asyncio.to_thread(run_once, keep, audit_keep)
        except Exception as exc:  # noqa: BLE001
            log.error("Automatische Sicherung fehlgeschlagen: %s", exc)
        await asyncio.sleep(90)   # Doppelauslösung innerhalb derselben Minute vermeiden
