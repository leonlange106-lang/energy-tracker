"""Ablesungen = Zeitreihen in InfluxDB. Plus abgeleitete Stats & Chart-Data."""
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlmodel import Session, select

from .. import influx, logic, report
from ..database import get_session
from ..models import System
from ..schemas import ChartData, ReadingCreate, ReadingRead, StatsRead

router = APIRouter(tags=["readings"])


def _require_system(system_id: str, session: Session) -> System:
    system = session.get(System, system_id)
    if not system:
        raise HTTPException(404, "System nicht gefunden")
    return system


@router.get("/api/systems/{system_id}/readings", response_model=list[ReadingRead])
def list_readings(
    system_id: str,
    from_: Optional[date] = Query(None, alias="from"),
    to: Optional[date] = Query(None),
    limit: Optional[int] = Query(None, ge=1, le=100000),
    session: Session = Depends(get_session),
):
    _require_system(system_id, session)
    raw = influx.query_readings(system_id, start=from_, stop=to, limit=limit)
    enriched = logic.mark_outliers(logic.compute_intervals(raw))
    return enriched


@router.post("/api/systems/{system_id}/readings", response_model=ReadingRead, status_code=201)
def create_reading(
    system_id: str, payload: ReadingCreate, session: Session = Depends(get_session)
):
    system = _require_system(system_id, session)

    # Plausibilität: Wert darf nicht kleiner als letzter bekannter Wert sein (außer Zählertausch)
    if not payload.meter_replaced:
        latest = influx.latest_reading(system_id)
        if latest and latest["value"] is not None and payload.value < latest["value"]:
            raise HTTPException(
                422,
                f"Wert {payload.value} < letzter Wert {latest['value']}. "
                f"Bei Zählertausch 'meter_replaced' setzen.",
            )

    rid = influx.write_reading(
        system_id=system_id,
        system_type=system.typ,
        datum=payload.datum,
        value=payload.value,
        cost=payload.cost,
        meter_replaced=payload.meter_replaced,
        note=payload.note,
    )
    return ReadingRead(
        id=rid,
        system_id=system_id,
        datum=influx._to_utc_dt(payload.datum),
        value=payload.value,
        cost=payload.cost,
        meter_replaced=payload.meter_replaced,
        note=payload.note,
    )


@router.delete("/api/readings/{reading_id}", status_code=204)
def delete_reading(reading_id: str):
    try:
        system_id, ts_ns = influx.decode_reading_id(reading_id)
    except Exception:
        raise HTTPException(400, "Ungültige reading_id")
    influx.delete_reading(system_id, ts_ns)


@router.get("/api/systems/{system_id}/stats", response_model=StatsRead)
def get_stats(
    system_id: str,
    from_: Optional[date] = Query(None, alias="from"),
    to: Optional[date] = Query(None),
    session: Session = Depends(get_session),
):
    _require_system(system_id, session)
    raw = influx.query_readings(system_id, start=from_, stop=to)
    enriched = logic.mark_outliers(logic.compute_intervals(raw))
    return logic.compute_stats(enriched)


@router.get("/api/systems/{system_id}/chart-data", response_model=ChartData)
def get_chart_data(
    system_id: str,
    from_: Optional[date] = Query(None, alias="from"),
    to: Optional[date] = Query(None),
    session: Session = Depends(get_session),
):
    system = _require_system(system_id, session)
    raw = influx.query_readings(system_id, start=from_, stop=to)
    enriched = logic.mark_outliers(logic.compute_intervals(raw))
    return ChartData(
        system_id=system_id,
        name=system.name,
        unit=system.einheit,
        color=system.farbe,
        labels=[e["datum"].date().isoformat() for e in enriched],
        values=[e["value"] for e in enriched],
        consumption=[e["consumption"] for e in enriched],
        consumption_per_day=[e["consumption_per_day"] for e in enriched],
        outliers=[e["is_outlier"] for e in enriched],
    )


@router.get("/api/overview")
def get_overview(session: Session = Depends(get_session)):
    """Letzter Zählerstand + Datum je aktivem System (für die Startseiten-Kacheln)."""
    systems = session.exec(select(System).where(System.aktiv == True)).all()  # noqa: E712
    out = {}
    for s in systems:
        latest = influx.latest_reading(s.id)
        if latest and latest.get("value") is not None:
            out[s.id] = {"value": latest["value"], "datum": latest["datum"].isoformat()}
    return out


@router.get("/api/systems/{system_id}/report.pdf")
def get_report(
    system_id: str,
    from_: Optional[date] = Query(None, alias="from"),
    to: Optional[date] = Query(None),
    session: Session = Depends(get_session),
):
    system = _require_system(system_id, session)
    raw = influx.query_readings(system_id, start=from_, stop=to)
    enriched = logic.mark_outliers(logic.compute_intervals(raw))
    stats = logic.compute_stats(enriched)
    pdf = report.build_report_pdf(
        system={"name": system.name, "typ": system.typ, "einheit": system.einheit},
        enriched=enriched,
        stats=stats,
        from_label=from_.strftime("%d.%m.%Y") if from_ else None,
        to_label=to.strftime("%d.%m.%Y") if to else None,
    )
    fname = f"energie-bericht_{system.name.replace(' ', '_')}.pdf"
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{fname}"'},
    )


@router.get("/api/report.pdf")
def get_combined_report(
    from_: Optional[date] = Query(None, alias="from"),
    to: Optional[date] = Query(None),
    session: Session = Depends(get_session),
):
    systems = session.exec(
        select(System).where(System.aktiv == True).order_by(System.name)  # noqa: E712
    ).all()
    sections = []
    for system in systems:
        raw = influx.query_readings(system.id, start=from_, stop=to)
        enriched = logic.mark_outliers(logic.compute_intervals(raw))
        sections.append({
            "system": {"name": system.name, "typ": system.typ, "einheit": system.einheit},
            "enriched": enriched,
            "stats": logic.compute_stats(enriched),
        })
    pdf = report.build_combined_report_pdf(
        sections,
        from_label=from_.strftime("%d.%m.%Y") if from_ else None,
        to_label=to.strftime("%d.%m.%Y") if to else None,
    )
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": 'inline; filename="energie-gesamtbericht.pdf"'},
    )
