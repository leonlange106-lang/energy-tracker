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
import re
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

# Auto-Discovery: erkannte Tasmota-Geräte. Schlüssel = Gerätename aus dem
# Topic (tele/<gerät>/SENSOR). Bewusst nur im Arbeitsspeicher – die Liste ist
# eine Einrichtungshilfe, kein Bestand, und baut sich nach einem Neustart
# binnen eines Telemetrie-Intervalls (Standard 300 s) von selbst wieder auf.
DISCOVERED: dict[str, dict] = {}

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
    "discovery": False,
    "discovery_prefix": "tele",
}

# Übliche Schlüssel in JSON-Nutzlasten, Reihenfolge = Priorität. Der Vergleich
# ist bewusst ohne Rücksicht auf Groß-/Kleinschreibung: Tasmota sendet
# {"ENERGY":{"Total":…}}, ESPHome {"value":…}, Shelly {"total":…}.
JSON_KEYS = ["value", "total", "total_kwh", "total_in", "energy", "state",
             "reading", "counter", "consumption", "volume", "meter_reading"]


# --------------------------------------------------------------------------
# Tasmota
# --------------------------------------------------------------------------
# Tasmota veröffentlicht unter tele/<gerät>/SENSOR ein JSON-Objekt, dessen
# Aufbau vom angeschlossenen Sensor abhängt. Für Zählwerk sind drei Zweige
# relevant:
#   ENERGY.Total      Stromzähler bzw. SML-Lesekopf (Hichi), Einheit kWh
#   ENERGY.Total_In   Zweirichtungszähler, Bezug
#   COUNTER.C1..C4    Impulseingänge – Reed-Kontakt am Gas- oder Wasserzähler
# Die Reihenfolge ist die Priorität: ein Gerät mit ENERGY liefert dort den
# Zählerstand, COUNTER wäre dann nur ein Nebenwert.
TASMOTA_PATHS = [
    (("energy", "total"),     "kWh",     "Stromzähler / SML-Lesekopf"),
    (("energy", "total_in"),  "kWh",     "Zweirichtungszähler (Bezug)"),
    (("counter", "c1"),       "Impulse", "Impulseingang C1"),
    (("counter", "c2"),       "Impulse", "Impulseingang C2"),
]

TASMOTA_SENSOR_RE = re.compile(r"^(?P<prefix>[^/]+)/(?P<device>[^/]+)/SENSOR$")
TASMOTA_LWT_RE = re.compile(r"^(?P<prefix>[^/]+)/(?P<device>[^/]+)/LWT$")


def _get_ci(obj: dict, key: str):
    """Schlüsselzugriff ohne Rücksicht auf Groß-/Kleinschreibung."""
    if not isinstance(obj, dict):
        return None
    for k, v in obj.items():
        if str(k).lower() == key:
            return v
    return None


def parse_tasmota(payload: str) -> Optional[dict]:
    """Tasmota-Nutzlast auswerten.

    Liefert {"value", "path", "unit", "kind", "extra"} oder None, wenn es sich
    nicht um eine Tasmota-Telemetrie mit verwertbarem Zählerstand handelt.
    `extra` enthält Momentanwerte wie Power – nicht zum Speichern, sondern zur
    Anzeige in der Geräteliste.
    """
    try:
        data = json.loads(payload)
    except (ValueError, TypeError):
        return None
    if not isinstance(data, dict):
        return None

    # StatusSNS umschließt bei manchen Abfragen dieselbe Struktur
    inner = _get_ci(data, "statussns")
    if isinstance(inner, dict):
        data = inner

    for path, unit, kind in TASMOTA_PATHS:
        node = data
        for part in path:
            node = _get_ci(node, part)
            if node is None:
                break
        if node is None:
            continue
        try:
            value = float(str(node).replace(",", "."))
        except (ValueError, TypeError):
            continue
        energy = _get_ci(data, "energy") or {}
        return {
            "value": value,
            "path": ".".join(p.upper() for p in path),
            "unit": unit,
            "kind": kind,
            "extra": {
                "power": _get_ci(energy, "power"),
                "today": _get_ci(energy, "today"),
                "time": _get_ci(data, "time"),
            },
        }
    return None


def _remember_device(topic: str, payload: str) -> None:
    """Gerät aus einer Discovery-Nachricht in die Liste aufnehmen."""
    match = TASMOTA_SENSOR_RE.match(topic)
    if not match:
        return
    parsed = parse_tasmota(payload)
    device = match.group("device")
    entry = DISCOVERED.setdefault(device, {"device": device, "topic": topic,
                                           "online": None, "assigned": False})
    entry.update({
        "topic": topic,
        "last_seen": datetime.now().isoformat(timespec="seconds"),
        "value": parsed["value"] if parsed else None,
        "path": parsed["path"] if parsed else None,
        "unit": parsed["unit"] if parsed else None,
        "kind": parsed["kind"] if parsed else "unbekannt",
        "power": (parsed or {}).get("extra", {}).get("power"),
        "usable": parsed is not None,
    })


def _remember_lwt(topic: str, payload: str) -> None:
    """Last Will and Testament: Tasmota meldet hier Online bzw. Offline.
    Das Retain-Flag sorgt dafür, dass der Zustand direkt beim Abonnieren
    ankommt – auch für Geräte, die gerade nicht senden."""
    match = TASMOTA_LWT_RE.match(topic)
    if not match:
        return
    device = match.group("device")
    entry = DISCOVERED.setdefault(device, {"device": device,
                                           "topic": f"{match.group('prefix')}/{device}/SENSOR",
                                           "usable": False, "assigned": False})
    entry["online"] = str(payload).strip().lower() == "online"
    entry["lwt_seen"] = datetime.now().isoformat(timespec="seconds")


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
    # Tasmota zuerst: die generische Suche würde bei einem Gerät ohne ENERGY,
    # aber mit anderen Zahlenfeldern, den falschen Wert greifen.
    tas = parse_tasmota(payload)
    value = tas["value"] if tas else parse_payload(payload)
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
        mapped = _topic_map(session)
    topics = list(mapped.keys())
    for topic in topics:
        client.subscribe(topic, qos=0)

    # Discovery: Wildcards zusätzlich zu den zugeordneten Topics. Sie schreiben
    # nichts in die Datenbank, sondern füllen nur die Geräteliste.
    if _state.get("discovery"):
        prefix = _state.get("discovery_prefix") or "tele"
        for wildcard in (f"{prefix}/+/SENSOR", f"{prefix}/+/LWT"):
            client.subscribe(wildcard, qos=0)
            topics.append(wildcard)
        _mark_assigned(mapped)
    _state["subscriptions"] = topics
    _event("info", f"Verbunden, {len(topics)} Abonnement(s)"
                   + (" inkl. Tasmota-Discovery" if _state.get("discovery") else ""))


def _mark_assigned(mapped: dict) -> None:
    """Geräte kennzeichnen, deren Topic bereits einem System zugeordnet ist."""
    for entry in DISCOVERED.values():
        system = mapped.get(entry.get("topic"))
        entry["assigned"] = bool(system)
        entry["system"] = system.name if system else None


def _on_disconnect(client, userdata, flags, reason_code=None, properties=None):
    _state["connected"] = False
    _event("warn", "Verbindung getrennt – automatischer Neuaufbau läuft")


def _on_message(client, userdata, msg):
    _state["messages"] += 1
    payload = msg.payload.decode("utf-8", errors="replace")
    try:
        if _state.get("discovery"):
            if TASMOTA_LWT_RE.match(msg.topic):
                _remember_lwt(msg.topic, payload)
                return                      # LWT enthält keinen Zählerstand
            if TASMOTA_SENSOR_RE.match(msg.topic):
                _remember_device(msg.topic, payload)
        # Geschrieben wird nur, wenn das Topic einem System zugeordnet ist.
        ingest(msg.topic, payload)
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
                       "source": broker["source"], "last_error": None,
                       "discovery": bool(cfg.get("mqtt_tasmota_discovery")),
                       "discovery_prefix": (cfg.get("mqtt_base_topic") or "tele").strip("/")})
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
    devices = sorted(DISCOVERED.values(),
                     key=lambda d: (not d.get("usable"), d.get("device", "")))
    return {**_state, "available": _paho_available(),
            "events": list(EVENTS)[:25], "devices": devices}


def forget_devices() -> int:
    n = len(DISCOVERED)
    DISCOVERED.clear()
    return n


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
