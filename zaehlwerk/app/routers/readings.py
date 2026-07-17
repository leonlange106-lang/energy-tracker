"""Ablesungen, Statistik, Chart-Daten, Export, PDF – alles aus SQLite."""
import csv
import io
from datetime import date, datetime, timedelta
from statistics import median
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlmodel import Session, select

from .. import logic, report
from ..database import get_session
from ..models import Reading, System
from ..schemas import ChartData, ReadingCreate, ReadingRead, StatsRead

router = APIRouter(tags=["readings"])


# ---------- Helfer ----------
def _require_system(system_id: str, session: Session) -> System:
    system = session.get(System, system_id)
    if not system:
        raise HTTPException(404, "System nicht gefunden")
    return system


def _reading_dict(r: Reading) -> dict:
    return {
        "id": r.id, "system_id": r.system_id, "datum": r.datum,
        "value": r.value, "cost": r.cost,
        "meter_replaced": r.meter_replaced, "note": r.note,
    }


def _query_readings(session: Session, system_id: str,
                    from_: Optional[date] = None, to: Optional[date] = None,
                    limit: Optional[int] = None) -> list[dict]:
    stmt = select(Reading).where(Reading.system_id == system_id)
    if from_:
        stmt = stmt.where(Reading.datum >= datetime(from_.year, from_.month, from_.day))
    if to:
        stmt = stmt.where(Reading.datum <= datetime(to.year, to.month, to.day, 23, 59, 59))
    # meter_replaced sortiert bei Datumsgleichheit ans Ende:
    # erst Endstand ALTER Zähler (normale Ablesung), dann Startstand NEUER Zähler (Tausch)
    rows = session.exec(stmt.order_by(Reading.datum, Reading.meter_replaced)).all()
    out = [_reading_dict(r) for r in rows]
    if limit:
        out = out[-limit:]
    return out


def _price(system: System) -> Optional[float]:
    """Durchschnittspreis €/Einheit aus den System-Zusatzfeldern (Fallback-Kosten)."""
    try:
        p = float((system.zusatzfelder or {}).get("preis") or 0)
        return p if p > 0 else None
    except (TypeError, ValueError):
        return None


def _enriched(session: Session, system: System,
              from_: Optional[date] = None, to: Optional[date] = None) -> list[dict]:
    raw = _query_readings(session, system.id, from_, to)
    return logic.mark_outliers(logic.compute_intervals(raw, price=_price(system)))


def _latest(session: Session, system_id: str) -> Optional[Reading]:
    return session.exec(
        select(Reading).where(Reading.system_id == system_id).order_by(Reading.datum.desc())
    ).first()


# ---------- Ablesungen ----------
@router.get("/api/systems/{system_id}/readings", response_model=list[ReadingRead])
def list_readings(
    system_id: str,
    from_: Optional[date] = Query(None, alias="from"),
    to: Optional[date] = Query(None),
    limit: Optional[int] = Query(None, ge=1, le=100000),
    session: Session = Depends(get_session),
):
    system = _require_system(system_id, session)
    enriched = _enriched(session, system, from_, to)
    if limit:
        enriched = enriched[-limit:]
    return enriched


@router.post("/api/systems/{system_id}/readings", response_model=ReadingRead, status_code=201)
def create_reading(system_id: str, payload: ReadingCreate, session: Session = Depends(get_session)):
    _require_system(system_id, session)
    if not payload.meter_replaced:
        latest = _latest(session, system_id)
        if latest and latest.value is not None and payload.value < latest.value:
            raise HTTPException(
                422,
                f"Wert {payload.value} < letzter Wert {latest.value}. "
                f"Bei Zählertausch 'meter_replaced' setzen.",
            )
    r = Reading(
        system_id=system_id,
        datum=datetime(payload.datum.year, payload.datum.month, payload.datum.day),
        value=payload.value,
        cost=payload.cost,
        meter_replaced=payload.meter_replaced,
        note=payload.note,
    )
    session.add(r)
    session.commit()
    session.refresh(r)
    return ReadingRead(**_reading_dict(r))


@router.put("/api/readings/{reading_id}", response_model=ReadingRead)
def update_reading(reading_id: str, payload: ReadingCreate, session: Session = Depends(get_session)):
    r = session.get(Reading, reading_id)
    if not r:
        raise HTTPException(404, "Ablesung nicht gefunden")
    r.datum = datetime(payload.datum.year, payload.datum.month, payload.datum.day)
    r.value = payload.value
    r.cost = payload.cost
    r.meter_replaced = payload.meter_replaced
    r.note = payload.note
    session.add(r)
    session.commit()
    session.refresh(r)
    return ReadingRead(**_reading_dict(r))


@router.delete("/api/readings/{reading_id}", status_code=204)
def delete_reading(reading_id: str, session: Session = Depends(get_session)):
    r = session.get(Reading, reading_id)
    if r:
        session.delete(r)
        session.commit()


# ---------- Auswertung ----------
@router.get("/api/systems/{system_id}/stats", response_model=StatsRead)
def get_stats(
    system_id: str,
    from_: Optional[date] = Query(None, alias="from"),
    to: Optional[date] = Query(None),
    session: Session = Depends(get_session),
):
    system = _require_system(system_id, session)
    return logic.compute_stats(_enriched(session, system, from_, to))


@router.get("/api/systems/{system_id}/chart-data", response_model=ChartData)
def get_chart_data(
    system_id: str,
    from_: Optional[date] = Query(None, alias="from"),
    to: Optional[date] = Query(None),
    session: Session = Depends(get_session),
):
    system = _require_system(system_id, session)
    enriched = _enriched(session, system, from_, to)
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
        meter_replaced=[bool(e.get("meter_replaced")) for e in enriched],
    )


@router.get("/api/systems/{system_id}/dashboard")
def get_dashboard(
    system_id: str,
    from_: Optional[date] = Query(None, alias="from"),
    to: Optional[date] = Query(None),
    session: Session = Depends(get_session),
):
    """Kombiniert readings + stats + chart-data in EINEM Request/EINER Berechnung."""
    system = _require_system(system_id, session)
    enriched = _enriched(session, system, from_, to)
    stats = logic.compute_stats(enriched)
    chart = {
        "system_id": system_id, "name": system.name, "unit": system.einheit,
        "color": system.farbe,
        "labels": [e["datum"].date().isoformat() for e in enriched],
        "values": [e["value"] for e in enriched],
        "consumption": [e["consumption"] for e in enriched],
        "consumption_per_day": [e["consumption_per_day"] for e in enriched],
        "outliers": [e["is_outlier"] for e in enriched],
        "meter_replaced": [bool(e.get("meter_replaced")) for e in enriched],
    }
    readings = [{**e, "datum": e["datum"].isoformat()} for e in enriched]
    return {"readings": readings, "stats": stats, "chart": chart}


@router.get("/api/overview")
def get_overview(session: Session = Depends(get_session)):
    """Letzter Stand + Fälligkeit je aktivem System. EIN Query für alle (kein N+1).
    Fälligkeit: konfiguriertes Intervall (zusatzfelder.ablese_intervall_tage) hat Vorrang,
    sonst Median der bisherigen Intervalle."""
    systems = session.exec(select(System).where(System.aktiv == True)).all()  # noqa: E712
    ids = [s.id for s in systems]
    if not ids:
        return {}
    all_rows = session.exec(
        select(Reading).where(Reading.system_id.in_(ids)).order_by(Reading.datum, Reading.meter_replaced)
    ).all()
    by_system: dict[str, list[Reading]] = {}
    for r in all_rows:
        by_system.setdefault(r.system_id, []).append(r)

    out = {}
    now = datetime.now()
    for s in systems:
        rows = by_system.get(s.id, [])
        if not rows or rows[-1].value is None:
            continue
        last = rows[-1]
        entry = {"value": last.value, "datum": last.datum.isoformat()}
        # konfiguriertes Intervall?
        interval = None
        try:
            iv = float((s.zusatzfelder or {}).get("ablese_intervall_tage") or 0)
            interval = iv if iv > 0 else None
        except (TypeError, ValueError):
            interval = None
        if interval is None and len(rows) >= 2:
            gaps = [(rows[i].datum - rows[i - 1].datum).days for i in range(1, len(rows))]
            gaps = [g for g in gaps if g > 0]
            interval = median(gaps) if gaps else None
        if interval:
            nxt = last.datum + timedelta(days=interval)
            entry["next_expected"] = nxt.date().isoformat()
            entry["overdue_days"] = (now - nxt).days
        out[s.id] = entry
    return out


# ---------- Export ----------
@router.get("/api/systems/{system_id}/export.csv")
def export_readings(
    system_id: str,
    from_: Optional[date] = Query(None, alias="from"),
    to: Optional[date] = Query(None),
    session: Session = Depends(get_session),
):
    """Alle Ablesungen als CSV – identisches Format wie der Import (Backup / Re-Import)."""
    system = _require_system(system_id, session)
    raw = _query_readings(session, system_id, from_, to)
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["datum", "wert", "kosten", "zaehlertausch", "notiz"])
    for r in raw:
        val, cost = r.get("value"), r.get("cost")
        w.writerow([
            r["datum"].date().isoformat(),
            ("" if val is None else (str(int(val)) if float(val).is_integer() else f"{val:.4f}".rstrip("0").rstrip("."))),
            ("" if cost is None else f"{cost:.2f}"),
            "ja" if r.get("meter_replaced") else "",
            r.get("note") or "",
        ])
    fname = f"zaehlwerk_{system.name.replace(' ', '_')}.csv"
    return Response(
        content=buf.getvalue(), media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'},
    )


# ---------- PDF ----------
@router.get("/api/systems/{system_id}/report.pdf")
def get_report(
    system_id: str,
    from_: Optional[date] = Query(None, alias="from"),
    to: Optional[date] = Query(None),
    session: Session = Depends(get_session),
):
    system = _require_system(system_id, session)
    enriched = _enriched(session, system, from_, to)
    pdf = report.build_report_pdf(
        system={"name": system.name, "typ": system.typ, "einheit": system.einheit},
        enriched=enriched,
        stats=logic.compute_stats(enriched),
        from_label=from_.strftime("%d.%m.%Y") if from_ else None,
        to_label=to.strftime("%d.%m.%Y") if to else None,
    )
    fname = f"zaehlwerk-bericht_{system.name.replace(' ', '_')}.pdf"
    return Response(content=pdf, media_type="application/pdf",
                    headers={"Content-Disposition": f'inline; filename="{fname}"'})


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
        enriched = _enriched(session, system, from_, to)
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
    return Response(content=pdf, media_type="application/pdf",
                    headers={"Content-Disposition": 'inline; filename="zaehlwerk-gesamtbericht.pdf"'})
