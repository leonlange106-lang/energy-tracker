"""MQTT-Ingestion: Zählerstände aus Broker-Nachrichten übernehmen.

**Zugangsdaten.** Läuft das Add-on unter Home Assistant und ist das
Mosquitto-Add-on installiert, holt sich Zählwerk Host, Port, Benutzer und
Passwort über die Supervisor-Schnittstelle `/services/mqtt`. Dann muss – und
soll – hier gar kein Passwort gespeichert werden. Die manuelle Eingabe ist
nur die Rückfallebene für den Standalone-Betrieb; das Passwort liegt dann
unverschlüsselt in der SQLite-Datei, was in den Einstellungen auch so
ausgewiesen wird.

**Warum nicht jede Nachricht eine neue Ablesung ergibt.** Ein Smart Meter
sendet im Sekundentakt. Für jede Nachricht eine Zeile anzulegen, würde die
Datenbank binnen Wochen um Millionen Zeilen aufblähen und die gesamte
Auswertung entwerten: Verbrauch, Ausreißer und Fälligkeiten rechnen mit
Intervallen zwischen Ablesungen, nicht mit einem Messstrom. Der Listener
schreibt deshalb **höchstens eine Ablesung je System und Tag** und
aktualisiert den Wert des laufenden Tages, statt anzuhängen.

**Kill-Switch.** Ein Broker im eigenen Netz ist von der Sperre aus 2.12.0 nicht
betroffen – sie greift nur für öffentliche Adressen. Ein Broker im Internet
wird dagegen blockiert, solange der Offline-Modus aktiv ist.
"""
import json
import logging
import os
import threading
import urllib.request
from collections import deque
from datetime import date, datetime
from typing import Any, Optional

from sqlmodel import Session, select

from .database import engine
from .models import Reading, System

log = logging.getLogger("zaehlwerk.mqtt")

# Ringpuffer der letzten Ereignisse – reine Diagnosehilfe für die Oberfläche,
# damit man beim Einrichten sieht, ob und was ankommt.
EVENTS: deque = deque(maxlen=60)

_client = None
_lock = threading.Lock()
_state: dict[str, Any] = {
    "connected": False,
    "broker": None,
    "source": None,          # "supervisor" | "manuell"
    "last_error": None,
    "subscriptions": [],
    "messages": 0,
    "written": 0,
}

# Übliche Schlüssel in JSON-Nutzlasten, Reihenfolge = Priorität. Der Vergleich
# ist bewusst ohne Rücksicht auf Groß-/Kleinschreibung: Tasmota sendet
# {"ENERGY":{"Total":…}}, ESPHome {"value":…}, Shelly {"total":…}.
JSON_KEYS = ["value", "total", "total_kwh", "total_in", "energy", "state",
             "reading", "counter", "consumption", "volume", "meter_reading"]


def _event(level: str, text: str, **extra) -> None:
    EVENTS.appendleft({"ts": datetime.now().isoformat(timespec="seconds"),
                       "level": level, "text": text, **extra})
    (log.warning if level == "warn" else log.info)(text)


# --------------------------------------------------------------------------
# Broker-Zugangsdaten
# --------------------------------------------------------------------------
def supervisor_broker() -> Optional[dict]:
    """Zugangsdaten vom Supervisor. None, wenn kein MQTT-Dienst bereitsteht."""
    token = os.environ.get("SUPERVISOR_TOKEN")
    if not token:
        return None
    req = urllib.request.Request(
        "http://supervisor/services/mqtt",
        headers={"Authorization": f"Bearer {token}"},
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode("utf-8")).get("data") or {}
    except Exception as exc:  # noqa: BLE001
        log.info("Kein MQTT-Dienst über den Supervisor verfügbar: %s", exc)
        return None
    if not data.get("host"):
        return None
    return {
        "host": data["host"],
        "port": int(data.get("port") or 1883),
        "username": data.get("username") or None,
        "password": data.get("password") or None,
        "source": "supervisor",
    }


def resolve_broker(cfg: dict) -> Optional[dict]:
    """Supervisor hat Vorrang, sofern nicht ausdrücklich abgewählt."""
    if cfg.get("mqtt_use_supervisor", True):
        found = supervisor_broker()
        if found:
            return found
    host = (cfg.get("mqtt_host") or "").strip()
    if not host:
        return None
    return {
        "host": host,
        "port": int(cfg.get("mqtt_port") or 1883),
        "username": (cfg.get("mqtt_username") or "").strip() or None,
        "password": cfg.get("mqtt_password") or None,
        "source": "manuell",
    }


# --------------------------------------------------------------------------
# Nutzlast auswerten
# --------------------------------------------------------------------------
def parse_payload(payload: str) -> Optional[float]:
    """Zahl aus der Nachricht ziehen.

    Unterstützt drei Formen, weil in der Praxis alle drei vorkommen:
    reine Zahl (`1234.5`), JSON mit bekanntem Schlüssel
    (`{"value": 1234.5}`) und verschachteltes JSON (`{"data": {"total": …}}`).
    Komma als Dezimaltrennzeichen wird akzeptiert.
    """
    text = (payload or "").strip()
    if not text:
        return None

    try:
        return float(text.replace(",", "."))
    except ValueError:
        pass

    try:
        data = json.loads(text)
    except (ValueError, TypeError):
        return None

    def dig(obj, depth=0):
        if depth > 3 or not isinstance(obj, dict):
            return None
        lowered = {str(k).lower(): v for k, v in obj.items()}
        for key in JSON_KEYS:
            if key in lowered:
                try:
                    return float(str(lowered[key]).replace(",", "."))
                except (ValueError, TypeError):
                    continue
        for val in obj.values():
            found = dig(val, depth + 1)
            if found is not None:
                return found
        return None

    return dig(data)


# --------------------------------------------------------------------------
# Schreiben
# --------------------------------------------------------------------------
def _topic_map(session: Session) -> dict[str, System]:
    """Topic -> System. Das Topic steht in `zusatzfelder["mqtt_topic"]`,
    analog zur bereits vorhandenen `ha_entity`. Kein Schemaeingriff nötig."""
    out = {}
    for system in session.exec(select(System).where(System.aktiv == True)).all():  # noqa: E712
        topic = (system.zusatzfelder or {}).get("mqtt_topic")
        if topic:
            out[str(topic).strip()] = system
    return out


def ingest(topic: str, payload: str) -> Optional[dict]:
    """Eine Nachricht verarbeiten. Gibt das Ergebnis zurück oder None."""
    value = parse_payload(payload)
    if value is None:
        _event("warn", f"Nutzlast nicht auswertbar auf {topic}", topic=topic)
        return None

    with Session(engine) as session:
        system = _topic_map(session).get(topic)
        if not system:
            return None

        today = date.today()
        existing = session.exec(
            select(Reading).where(Reading.system_id == system.id, Reading.datum == today)
        ).first()

        previous = session.exec(
            select(Reading).where(Reading.system_id == system.id, Reading.datum < today)
            .order_by(Reading.datum.desc())
        ).first()

        # Plausibilität: Zählerstände laufen aufwärts. Ein kleinerer Wert deutet
        # auf einen Zählertausch oder eine Fehlmessung hin – beides gehört von
        # Hand erfasst, nicht automatisch geschrieben.
        if previous and value < float(previous.value):
            _event("warn",
                   f"{system.name}: {value} liegt unter dem letzten Stand "
                   f"{previous.value} – verworfen", topic=topic, system=system.name)
            return None

        if existing:
            if float(existing.value) == value:
                return None                      # nichts Neues
            existing.value = value
            existing.note = (existing.note or "MQTT")
            session.add(existing)
            action = "aktualisiert"
        else:
            session.add(Reading(system_id=system.id, datum=today, value=value,
                                meter_replaced=False, note="MQTT"))
            action = "angelegt"

        session.commit()
        _state["written"] += 1
        _event("info", f"{system.name}: {value} {system.einheit} {action}",
               topic=topic, system=system.name, value=value)
        return {"system": system.name, "value": value, "action": action}


# --------------------------------------------------------------------------
# Client
# --------------------------------------------------------------------------
def _on_connect(client, userdata, flags, reason_code, properties=None):
    ok = getattr(reason_code, "is_failure", None)
    success = (reason_code == 0) if ok is None else not reason_code.is_failure
    _state["connected"] = bool(success)
    if not success:
        _state["last_error"] = f"Verbindung abgelehnt: {reason_code}"
        _event("warn", _state["last_error"])
        return
    _state["last_error"] = None
    with Session(engine) as session:
        topics = list(_topic_map(session).keys())
    _state["subscriptions"] = topics
    for topic in topics:
        client.subscribe(topic, qos=0)
    _event("info", f"Verbunden, {len(topics)} Topic(s) abonniert")


def _on_disconnect(client, userdata, flags, reason_code=None, properties=None):
    _state["connected"] = False
    _event("warn", "Verbindung getrennt – automatischer Neuaufbau läuft")


def _on_message(client, userdata, msg):
    _state["messages"] += 1
    try:
        ingest(msg.topic, msg.payload.decode("utf-8", errors="replace"))
    except Exception as exc:  # noqa: BLE001
        _event("warn", f"Verarbeitung fehlgeschlagen: {exc}", topic=msg.topic)


def start(cfg: dict) -> dict:
    """Client starten. Idempotent: ein laufender Client wird zuvor beendet."""
    global _client
    try:
        import paho.mqtt.client as mqtt
    except ImportError:
        _state["last_error"] = "paho-mqtt ist nicht installiert"
        return dict(_state)

    stop()
    broker = resolve_broker(cfg)
    if not broker:
        _state["last_error"] = "Kein Broker konfiguriert"
        return dict(_state)

    with _lock:
        client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2,
                             client_id=f"zaehlwerk-{os.getpid()}")
        if broker["username"]:
            client.username_pw_set(broker["username"], broker["password"])
        client.on_connect = _on_connect
        client.on_disconnect = _on_disconnect
        client.on_message = _on_message
        # Neuaufbau der Verbindung übernimmt paho selbst, mit wachsendem Abstand
        client.reconnect_delay_set(min_delay=1, max_delay=120)
        _state.update({"broker": f"{broker['host']}:{broker['port']}",
                       "source": broker["source"], "last_error": None})
        try:
            client.connect_async(broker["host"], broker["port"], keepalive=60)
            client.loop_start()
            _client = client
        except Exception as exc:  # noqa: BLE001
            _state["last_error"] = str(exc)
            _event("warn", f"Verbindungsaufbau fehlgeschlagen: {exc}")
    return dict(_state)


def stop() -> None:
    global _client
    with _lock:
        if _client is not None:
            try:
                _client.loop_stop()
                _client.disconnect()
            except Exception:  # noqa: BLE001
                pass
            _client = None
    _state.update({"connected": False, "subscriptions": []})


def resubscribe() -> None:
    """Nach Änderung der Topics erneut abonnieren, ohne neu zu verbinden."""
    if _client is not None and _state["connected"]:
        _on_connect(_client, None, None, 0)


def status() -> dict:
    return {**_state, "available": _paho_available(),
            "events": list(EVENTS)[:25]}


def _paho_available() -> bool:
    try:
        import paho.mqtt.client  # noqa: F401
        return True
    except ImportError:
        return False


def boot() -> None:
    """Beim Start aufrufen. Läuft still weiter, wenn MQTT nicht aktiv ist."""
    try:
        from .routers.settings import read_settings
        with Session(engine) as session:
            cfg = read_settings(session)
        if cfg.get("mqtt_enabled"):
            start(cfg)
    except Exception as exc:  # noqa: BLE001
        log.error("MQTT-Start fehlgeschlagen: %s", exc)
