"""MQTT-Status, Verbindungstest und Ereignisprotokoll."""
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from .. import mqtt_client
from ..database import get_session
from ..models import System
from ..schemas import MqttAssign
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


@router.get("/devices")
def devices():
    """Erkannte Tasmota-Geräte. Enthält keine Zugangsdaten."""
    return {"devices": mqtt_client.status()["devices"],
            "discovery": mqtt_client._state.get("discovery", False)}


@router.post("/devices/forget")
def forget():
    return {"cleared": mqtt_client.forget_devices()}


@router.post("/assign")
def assign(payload: MqttAssign, session: Session = Depends(get_session)):
    """Ein erkanntes Topic einem System zuordnen.

    Schreibt in `zusatzfelder["mqtt_topic"]` – dieselbe Stelle, die auch der
    Systemdialog bedient. Danach wird neu abonniert, damit die Übernahme
    sofort greift und nicht erst beim nächsten Verbindungsaufbau.
    """
    system = session.get(System, payload.system_id)
    if not system:
        raise HTTPException(404, "System nicht gefunden")

    # Ein Topic darf nicht an zwei Systemen hängen - sonst liefe derselbe Wert
    # in zwei Zaehlwerke.
    for other in session.exec(select(System).where(System.id != system.id)).all():
        if (other.zusatzfelder or {}).get("mqtt_topic") == payload.topic:
            raise HTTPException(409, f"Topic ist bereits '{other.name}' zugeordnet")

    extra = dict(system.zusatzfelder or {})
    extra["mqtt_topic"] = payload.topic
    system.zusatzfelder = extra
    session.add(system)
    session.commit()
    mqtt_client.resubscribe()
    return {"system": system.name, "topic": payload.topic}


@router.post("/resubscribe")
def resubscribe():
    mqtt_client.resubscribe()
    return {"subscriptions": mqtt_client.status()["subscriptions"]}
