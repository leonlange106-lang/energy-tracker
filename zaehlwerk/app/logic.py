"""Ableitungen aus den rohen Ablesungen.

REGEL Zählertausch: meter_replaced=True -> neuer Zähler startet IMMER bei 0,
der Verbrauch des Intervalls ist exakt der abgelesene Wert selbst.
Guard: Verbrauch wird nie negativ (fehlerhafte Daten werden auf None gesetzt
statt Statistiken zu verfälschen).

KOSTEN: Explizit erfasste Kosten haben Vorrang. Fehlen sie und ist ein
Durchschnittspreis (€/Einheit) am System hinterlegt, wird geschätzt:
cost_effective = consumption * preis. Geschätzte Werte werden markiert.

TARIFE (seit 2.16.0): Liegen Tarifperioden vor, wird der Verbrauch tageweise
dem jeweils gültigen Preis zugeordnet - siehe apply_tariffs() unten.
"""
from datetime import date, timedelta
import statistics
from typing import Optional


def compute_intervals(readings: list[dict], price: Optional[float] = None) -> list[dict]:
    """readings: chronologisch aufsteigend. Reichert an um consumption,
    consumption_per_day, cost_effective, cost_estimated."""
    out: list[dict] = []
    for i, r in enumerate(readings):
        e = dict(r)
        e["consumption"] = None
        e["consumption_per_day"] = None
        e["days"] = None
        e["prev_datum"] = None
        if i > 0:
            prev = readings[i - 1]
            days = (r["datum"] - prev["datum"]).total_seconds() / 86400
            e["days"] = int(round(days))
            e["prev_datum"] = prev["datum"]
            if r.get("meter_replaced"):
                cons = float(r["value"])                    # neuer Zähler ab 0
            else:
                cons = float(r["value"]) - float(prev["value"])
            if cons < 0:
                cons = None                                 # Datenfehler -> nicht verfälschen
            e["consumption"] = cons
            e["consumption_per_day"] = (cons / days) if (cons is not None and days > 0) else cons
        # Kosten: explizit > geschätzt (Preis) > None
        if e.get("cost") is not None:
            e["cost_effective"] = float(e["cost"])
            e["cost_estimated"] = False
        elif price and e["consumption"] is not None:
            e["cost_effective"] = e["consumption"] * price
            e["cost_estimated"] = True
        else:
            e["cost_effective"] = None
            e["cost_estimated"] = False
        out.append(e)
    return out


DEFAULT_SIGMA = 2.0


def outlier_threshold(enriched: list[dict], sigma: float = DEFAULT_SIGMA) -> Optional[float]:
    vals = [e["consumption_per_day"] for e in enriched if e["consumption_per_day"] is not None]
    if len(vals) < 2:
        return None
    return statistics.mean(vals) + sigma * statistics.pstdev(vals)


def mark_outliers(enriched: list[dict], sigma: float = DEFAULT_SIGMA) -> list[dict]:
    thr = outlier_threshold(enriched, sigma)
    for e in enriched:
        pd = e["consumption_per_day"]
        e["is_outlier"] = bool(thr is not None and pd is not None and pd > thr)
    return enriched


def compute_stats(enriched: list[dict], sigma: float = DEFAULT_SIGMA) -> dict:
    cons_vals = [e["consumption"] for e in enriched if e["consumption"] is not None]
    per_days = [
        (e["consumption_per_day"], e["datum"])
        for e in enriched if e["consumption_per_day"] is not None
    ]
    costs = [e["cost_effective"] for e in enriched if e.get("cost_effective") is not None]
    any_estimated = any(e.get("cost_estimated") for e in enriched)

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
        min_pd, min_dt = min(per_days, key=lambda x: x[0])
        max_pd, max_dt = max(per_days, key=lambda x: x[0])

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
        "outlier_threshold": outlier_threshold(enriched, sigma),
        "reading_count": len(enriched),
        "cost_estimated": any_estimated,
    }


# ==========================================================================
# Tarifbasierte Kostenberechnung
# ==========================================================================
# Grundgedanke: Zwischen zwei Ablesungen ist nur der Gesamtverbrauch bekannt,
# nicht sein zeitlicher Verlauf. Er wird deshalb gleichmäßig über die Tage des
# Intervalls verteilt (`consumption_per_day`) und anschließend tageweise dem
# jeweils gültigen Tarif zugeordnet. Ein Intervall, das über einen Tarifwechsel
# hinweggeht, wird also korrekt aufgeteilt – genau der Fall, den eine simple
# Multiplikation mit einem einzigen Preis falsch berechnet.
#
# Der Grundpreis ist ein Monatsbetrag. Er wird mit 12/365.25 auf einen Tagessatz
# umgerechnet. Die Abweichung gegenüber taggenauer Monatslänge liegt unter einem
# Prozent und ist bei jährlichen Ablesungen ohne Belang.
_DAYS_PER_MONTH = 365.25 / 12


def _tariff_for(tariffs: list[dict], day: date) -> Optional[dict]:
    """Erste Periode, die diesen Tag abdeckt. Perioden sind überschneidungsfrei
    (wird beim Speichern geprüft), daher ist die erste zugleich die einzige."""
    for t in tariffs:
        if t["gueltig_ab"] <= day and (t["gueltig_bis"] is None or day <= t["gueltig_bis"]):
            return t
    return None


def apply_tariffs(enriched: list[dict], tariffs: list[dict]) -> list[dict]:
    """Ergänzt je Intervall die tarifbasierten Kosten.

    Neue Felder je Eintrag:
      cost_tariff         Gesamt (Arbeits- + Grundpreis) oder None
      cost_tariff_energy  nur Arbeitspreis
      cost_tariff_base    nur Grundpreis
      tariff_coverage     Anteil der Tage mit hinterlegtem Tarif (0.0-1.0)
      tariff_names        beteiligte Tarife, für die Anzeige

    Die vorhandenen Felder `cost` (erfasst) und `cost_estimated` bleiben
    unangetastet – die Tarifrechnung tritt daneben, nicht an ihre Stelle.
    """
    if not tariffs:
        return enriched

    for e in enriched:
        e["cost_tariff"] = None
        e["cost_tariff_energy"] = None
        e["cost_tariff_base"] = None
        e["tariff_coverage"] = 0.0
        e["tariff_names"] = []

        per_day = e.get("consumption_per_day")
        days = e.get("days")
        prev = e.get("prev_datum")
        if per_day is None or not days or not prev:
            continue

        energy = 0.0
        base = 0.0
        covered = 0
        names = []
        # Verbrauchstage sind die Tage NACH der Vorablesung bis einschließlich
        # der aktuellen - die Vorablesung selbst gehört zum vorigen Intervall.
        for i in range(1, days + 1):
            day = prev + timedelta(days=i)
            t = _tariff_for(tariffs, day)
            if not t:
                continue
            covered += 1
            energy += per_day * t["arbeitspreis"]
            base += (t.get("grundpreis") or 0.0) / _DAYS_PER_MONTH
            label = t.get("name") or t.get("anbieter") or "Tarif"
            if label not in names:
                names.append(label)

        if covered:
            e["cost_tariff_energy"] = round(energy, 2)
            e["cost_tariff_base"] = round(base, 2)
            e["cost_tariff"] = round(energy + base, 2)
            e["tariff_coverage"] = round(covered / days, 4)
            e["tariff_names"] = names
    return enriched


def tariff_summary(enriched: list[dict]) -> dict:
    """Kennzahlen über alle Intervalle mit Tarifabdeckung."""
    rows = [e for e in enriched if e.get("cost_tariff") is not None]
    if not rows:
        return {"total_cost_tariff": None, "total_energy_cost": None,
                "total_base_cost": None, "avg_price_effective": None,
                "covered_intervals": 0, "coverage_ratio": 0.0}
    total = sum(r["cost_tariff"] for r in rows)
    energy = sum(r["cost_tariff_energy"] for r in rows)
    base = sum(r["cost_tariff_base"] for r in rows)
    consumption = sum(r["consumption"] for r in rows if r.get("consumption"))
    with_interval = [e for e in enriched if e.get("consumption") is not None]
    return {
        "total_cost_tariff": round(total, 2),
        "total_energy_cost": round(energy, 2),
        "total_base_cost": round(base, 2),
        # Effektivpreis inklusive Grundgebühr - die Zahl, die man mit dem
        # beworbenen Arbeitspreis vergleichen will.
        "avg_price_effective": round(total / consumption, 4) if consumption else None,
        "covered_intervals": len(rows),
        "coverage_ratio": round(len(rows) / len(with_interval), 4) if with_interval else 0.0,
    }
