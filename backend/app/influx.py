"""InfluxDB 2.x Wrapper. Nur Zeitreihen (Measurement 'readings')."""
import base64
from datetime import date, datetime, timedelta, timezone
from typing import Optional

from influxdb_client import InfluxDBClient, Point, WritePrecision
from influxdb_client.client.write_api import SYNCHRONOUS

from .config import settings

_client = InfluxDBClient(
    url=settings.influx_url,
    token=settings.influx_token,
    org=settings.influx_org,
)
_write = _client.write_api(write_options=SYNCHRONOUS)
_query = _client.query_api()
_delete = _client.delete_api()

BUCKET = settings.influx_bucket
ORG = settings.influx_org


# ---------- Reading-ID (Influx kennt keine Row-ID -> aus system_id + Timestamp bauen) ----------
def encode_reading_id(system_id: str, ts_ns: int) -> str:
    return base64.urlsafe_b64encode(f"{system_id}|{ts_ns}".encode()).decode()


def decode_reading_id(rid: str) -> tuple[str, int]:
    system_id, ts_ns = base64.urlsafe_b64decode(rid.encode()).decode().split("|")
    return system_id, int(ts_ns)


# ---------- Zeit-Helfer ----------
def _to_utc_dt(d) -> datetime:
    if isinstance(d, datetime):
        return d if d.tzinfo else d.replace(tzinfo=timezone.utc)
    # date -> Mitternacht UTC
    return datetime(d.year, d.month, d.day, tzinfo=timezone.utc)


def _flux_time(d) -> str:
    return _to_utc_dt(d).isoformat().replace("+00:00", "Z")


def _dt_to_ns(dt: datetime) -> int:
    dt = _to_utc_dt(dt)
    return int(dt.timestamp()) * 1_000_000_000 + dt.microsecond * 1000


# ---------- Schreiben ----------
def write_reading(
    system_id: str,
    system_type: str,
    datum,
    value: float,
    cost: Optional[float],
    meter_replaced: bool,
    note: Optional[str],
) -> str:
    dt = _to_utc_dt(datum)
    point = (
        Point("readings")
        .tag("system_id", system_id)
        .tag("system_type", system_type)
        .field("value", float(value))
        .field("meter_replaced", bool(meter_replaced))
        .time(dt, WritePrecision.NS)
    )
    if cost is not None:
        point = point.field("cost", float(cost))
    if note:
        point = point.field("note", str(note))
    _write.write(bucket=BUCKET, org=ORG, record=point)
    return encode_reading_id(system_id, _dt_to_ns(dt))


# ---------- Lesen ----------
def query_readings(
    system_id: str,
    start=None,
    stop=None,
    limit: Optional[int] = None,
) -> list[dict]:
    rng_start = _flux_time(start) if start else "1970-01-01T00:00:00Z"
    rng_stop = _flux_time(stop) if stop else "now()"
    flux = f'''
from(bucket: "{BUCKET}")
  |> range(start: {rng_start}, stop: {rng_stop})
  |> filter(fn: (r) => r._measurement == "readings")
  |> filter(fn: (r) => r.system_id == "{system_id}")
  |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
  |> sort(columns: ["_time"], desc: false)
'''
    results: list[dict] = []
    for table in _query.query(flux, org=ORG):
        for rec in table.records:
            t = rec.get_time()
            v = rec.values
            results.append(
                {
                    "id": encode_reading_id(system_id, _dt_to_ns(t)),
                    "system_id": system_id,
                    "datum": t,
                    "value": v.get("value"),
                    "cost": v.get("cost"),
                    "meter_replaced": bool(v.get("meter_replaced") or False),
                    "note": v.get("note"),
                }
            )
    if limit:
        # Liste ist chronologisch aufsteigend -> für "letzte N" hinten abschneiden
        results = results[-limit:]
    return results


def latest_reading(system_id: str) -> Optional[dict]:
    """Neuester Messwert (für Plausibilitäts-Check bei neuer Ablesung)."""
    flux = f'''
from(bucket: "{BUCKET}")
  |> range(start: 1970-01-01T00:00:00Z)
  |> filter(fn: (r) => r._measurement == "readings")
  |> filter(fn: (r) => r.system_id == "{system_id}")
  |> filter(fn: (r) => r._field == "value")
  |> last()
'''
    for table in _query.query(flux, org=ORG):
        for rec in table.records:
            return {"value": rec.get_value(), "datum": rec.get_time()}
    return None


# ---------- Löschen ----------
def delete_reading(system_id: str, ts_ns: int) -> None:
    t = datetime.fromtimestamp(ts_ns / 1e9, tz=timezone.utc)
    # 1-ms-Fenster um den exakten Timestamp (Ablesungen sind auf Tagesebene -> kollisionsfrei)
    start = t - timedelta(milliseconds=1)
    stop = t + timedelta(milliseconds=1)
    _delete.delete(
        start,
        stop,
        f'_measurement="readings" AND system_id="{system_id}"',
        bucket=BUCKET,
        org=ORG,
    )


def ping() -> bool:
    try:
        return _client.ping()
    except Exception:
        return False
