"""Überfälligkeits-Benachrichtigungen nach Home Assistant (persistent_notification).
Feste notification_id pro System -> ersetzt sich selbst statt zu spammen; wird
automatisch entfernt, sobald wieder abgelesen wurde. Läuft alle 6 h."""
import asyncio
import json
import os
import urllib.request

from sqlmodel import Session

from .database import engine
from .due import system_due_entries


def _ha_service(path: str, payload: dict) -> None:
    token = os.environ.get("SUPERVISOR_TOKEN")
    if not token:
        return
    req = urllib.request.Request(
        f"http://supervisor/core/api/services/{path}",
        data=json.dumps(payload).encode(),
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=10):
        pass


def check_and_notify() -> None:
    with Session(engine) as session:
        for e in system_due_entries(session):
            s = e["system"]
            od = e.get("overdue_days")
            nid = f"zaehlwerk_due_{s.id}"
            if od is not None and od > 0:
                span = f"{round(od / 30)} Monaten" if od >= 60 else f"{od} Tagen"
                _ha_service("persistent_notification/create", {
                    "notification_id": nid,
                    "title": f"Zählwerk: {s.name} ablesen",
                    "message": (
                        f"Die Ablesung für \u201e{s.name}\u201c ist seit {span} überfällig "
                        f"(letzter Stand {e['value']:g} {s.einheit} am {e['datum'].strftime('%d.%m.%Y')})."
                    ),
                })
            else:
                try:
                    _ha_service("persistent_notification/dismiss", {"notification_id": nid})
                except Exception:  # noqa: BLE001
                    pass


async def watcher() -> None:
    if not os.environ.get("SUPERVISOR_TOKEN"):
        return                                   # Standalone ohne HA
    await asyncio.sleep(90)                      # HA nach Add-on-Start Zeit geben
    while True:
        try:
            await asyncio.to_thread(check_and_notify)
        except Exception:  # noqa: BLE001
            pass                                 # HA temporär weg -> nächster Zyklus
        await asyncio.sleep(6 * 3600)
