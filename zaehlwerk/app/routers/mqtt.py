"""MQTT-Status, Verbindungstest und Ereignisprotokoll."""
from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from .. import mqtt_client
from ..database import get_session
from ..models import System
from .settings import read_settings

router = APIRouter(prefix="/api/mqtt", tags=["mqtt"])


@router.get("/status")
def status(session: Session = Depends(get_session)):
    cfg = read_settings(session)
    mapped = []
    for s in session.exec(select(System).where(System.aktiv == True)).all():  # noqa: E712
        topic = (s.zusatzfelder or {}).get("mqtt_topic")
        if topic:
            mapped.append({"system": s.name, "einheit": s.einheit, "topic": topic})
    return {
        **mqtt_client.status(),
        "enabled": bool(cfg.get("mqtt_enabled")),
        "use_supervisor": bool(cfg.get("mqtt_use_supervisor", True)),
        "supervisor_offer": mqtt_client.supervisor_broker() is not None,
        "mapped": mapped,
    }


@router.post("/restart")
def restart(session: Session = Depends(get_session)):
    """Neu verbinden – nach Änderung der Broker-Daten oder der Topics."""
    cfg = read_settings(session)
    if not cfg.get("mqtt_enabled"):
        mqtt_client.stop()
        return {"connected": False, "note": "MQTT ist deaktiviert"}
    return mqtt_client.start(cfg)


@router.post("/resubscribe")
def resubscribe():
    mqtt_client.resubscribe()
    return {"subscriptions": mqtt_client.status()["subscriptions"]}
