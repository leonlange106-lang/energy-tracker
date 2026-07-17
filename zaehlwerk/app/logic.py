"""Ableitungen aus den rohen Ablesungen (Logik analog zum bestehenden Sheets-/PDF-Bericht).

REGEL Zählertausch: Ist eine Ablesung meter_replaced=True, startet der neue Zähler IMMER bei 0.
Der Verbrauch dieses Intervalls entspricht damit exakt dem abgelesenen Wert selbst.
"""
import statistics
from typing import Optional


def compute_intervals(readings: list[dict]) -> list[dict]:
    """readings: chronologisch aufsteigend. Reichert um consumption / consumption_per_day an."""
    out: list[dict] = []
    for i, r in enumerate(readings):
        e = dict(r)
        e["consumption"] = None
        e["consumption_per_day"] = None
        if i > 0:
            prev = readings[i - 1]
            days = (r["datum"] - prev["datum"]).total_seconds() / 86400
            if r.get("meter_replaced"):
                cons = float(r["value"])                    # neuer Zähler startet immer bei 0
            else:
                cons = float(r["value"]) - float(prev["value"])
            e["consumption"] = cons
            e["consumption_per_day"] = (cons / days) if days > 0 else cons
        out.append(e)
    return out


def outlier_threshold(enriched: list[dict]) -> Optional[float]:
    """Schwelle = Ø + 2×Standardabweichung der Tageswerte (wie im PDF-Bericht)."""
    vals = [e["consumption_per_day"] for e in enriched if e["consumption_per_day"] is not None]
    if len(vals) < 2:
        return None
    return statistics.mean(vals) + 2 * statistics.pstdev(vals)


def mark_outliers(enriched: list[dict]) -> list[dict]:
    thr = outlier_threshold(enriched)
    for e in enriched:
        pd = e["consumption_per_day"]
        e["is_outlier"] = bool(thr is not None and pd is not None and pd > thr)
    return enriched


def compute_stats(enriched: list[dict]) -> dict:
    cons_vals = [e["consumption"] for e in enriched if e["consumption"] is not None]
    per_days = [
        (e["consumption_per_day"], e["datum"])
        for e in enriched
        if e["consumption_per_day"] is not None
    ]
    costs = [e["cost"] for e in enriched if e.get("cost") is not None]

    total_consumption = sum(cons_vals) if cons_vals else 0.0
    total_cost = sum(costs) if costs else 0.0

    total_days = 0.0
    if len(enriched) >= 2:
        total_days = (enriched[-1]["datum"] - enriched[0]["datum"]).total_seconds() / 86400

    avg_per_day = (total_consumption / total_days) if total_days > 0 else None
    cost_per_day = (total_cost / total_days) if total_days > 0 and total_cost else None
    cost_per_unit = (total_cost / total_consumption) if total_consumption and total_cost else None

    min_pd = max_pd = min_dt = max_dt = None
    if per_days:
        min_item = min(per_days, key=lambda x: x[0])
        max_item = max(per_days, key=lambda x: x[0])
        min_pd, min_dt = min_item
        max_pd, max_dt = max_item

    return {
        "total_consumption": round(total_consumption, 3),
        "total_cost": round(total_cost, 2),
        "total_days": round(total_days, 1),
        "avg_per_day": round(avg_per_day, 3) if avg_per_day is not None else None,
        "cost_per_day": round(cost_per_day, 4) if cost_per_day is not None else None,
        "cost_per_unit": round(cost_per_unit, 4) if cost_per_unit is not None else None,
        "min_per_day": round(min_pd, 3) if min_pd is not None else None,
        "min_per_day_datum": min_dt,
        "max_per_day": round(max_pd, 3) if max_pd is not None else None,
        "max_per_day_datum": max_dt,
        "outlier_threshold": outlier_threshold(enriched),
        "reading_count": len(enriched),
    }
