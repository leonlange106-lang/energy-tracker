"""PDF-Bericht pro System: Kopf + Statistik-Kacheln + Verbrauchs-Chart + Werte-Tabelle.
Layout angelehnt an den bisherigen Google-Sheets-/PDF-Bericht. Reines reportlab (keine System-Libs)."""
from datetime import datetime
from io import BytesIO
from typing import Optional

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Flowable,
)
from reportlab.graphics.shapes import Drawing, PolyLine, Line, Circle, String, Rect

ACCENT = colors.HexColor("#0e7c86")
INK = colors.HexColor("#172533")
INK_SOFT = colors.HexColor("#5b6b7b")
LINE = colors.HexColor("#cfd8e1")
WARN = colors.HexColor("#d9820a")


def _fmt(n, dec=2):
    if n is None:
        return "–"
    return f"{n:,.{dec}f}".replace(",", "X").replace(".", ",").replace("X", ".")


def _fmt_date(dt):
    return dt.strftime("%d.%m.%Y") if dt else "–"


class ConsumptionChart(Flowable):
    """Verbrauch/Tag als Liniendiagramm; Ausreißer amber markiert."""

    def __init__(self, enriched, width=460, height=180):
        super().__init__()
        self.width = width
        self.height = height
        self.enriched = [e for e in enriched if e.get("consumption_per_day") is not None]

    def draw(self):
        d = Drawing(self.width, self.height)
        pad_l, pad_r, pad_t, pad_b = 38, 10, 14, 26
        x0, x1 = pad_l, self.width - pad_r
        y0, y1 = pad_b, self.height - pad_t
        pts = self.enriched

        # Achsenrahmen + Gridlines
        vals = [e["consumption_per_day"] for e in pts]
        vmax = max(vals) if vals else 1
        vmax = vmax * 1.1 or 1
        for i in range(5):
            gy = y0 + (y1 - y0) * i / 4
            d.add(Line(x0, gy, x1, gy, strokeColor=LINE, strokeWidth=0.5))
            d.add(String(x0 - 4, gy - 3, _fmt(vmax * i / 4, 0),
                         fontSize=6, fillColor=INK_SOFT, textAnchor="end"))

        if len(pts) >= 2:
            n = len(pts)
            def px(i): return x0 + (x1 - x0) * i / (n - 1)
            def py(v): return y0 + (y1 - y0) * (v / vmax)

            coords = []
            for i, e in enumerate(pts):
                coords += [px(i), py(e["consumption_per_day"])]
            d.add(PolyLine(coords, strokeColor=ACCENT, strokeWidth=1.4))

            for i, e in enumerate(pts):
                out = e.get("is_outlier")
                d.add(Circle(px(i), py(e["consumption_per_day"]), 3 if out else 1.6,
                             fillColor=WARN if out else ACCENT, strokeColor=None))

            # X-Labels (Anfang / Mitte / Ende)
            for i in (0, n // 2, n - 1):
                lbl = pts[i]["datum"].strftime("%m/%y")
                d.add(String(px(i), y0 - 12, lbl, fontSize=6, fillColor=INK_SOFT, textAnchor="middle"))

        self.canv.saveState()
        d.drawOn(self.canv, 0, 0)
        self.canv.restoreState()


def build_report_pdf(system: dict, enriched: list[dict], stats: dict,
                     from_label: Optional[str], to_label: Optional[str]) -> bytes:
    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=18 * mm, rightMargin=18 * mm, topMargin=16 * mm, bottomMargin=16 * mm,
        title=f"Energie-Bericht – {system['name']}",
    )
    styles = getSampleStyleSheet()
    h1 = ParagraphStyle("h1", parent=styles["Title"], fontSize=18, textColor=INK, spaceAfter=2, alignment=0)
    sub = ParagraphStyle("sub", parent=styles["Normal"], fontSize=9, textColor=INK_SOFT)
    h2 = ParagraphStyle("h2", parent=styles["Heading2"], fontSize=11, textColor=INK, spaceBefore=12, spaceAfter=6)
    unit = system["einheit"]
    story = []

    # Kopf
    story.append(Paragraph(f"Energie-Bericht · {system['name']}", h1))
    zeitraum = "gesamter Zeitraum" if not from_label else f"ab {from_label}"
    if to_label:
        zeitraum += f" bis {to_label}"
    story.append(Paragraph(
        f"{system['typ']} · Einheit {unit} · {zeitraum} · erstellt am {datetime.now().strftime('%d.%m.%Y %H:%M')}",
        sub))
    story.append(Spacer(1, 10))

    # Statistik-Kacheln (3x2 Grid)
    def cell(label, value, subv=""):
        block = f'<font size="7" color="#5b6b7b">{label.upper()}</font><br/>' \
                f'<font size="13" color="#172533">{value}</font>'
        if subv:
            block += f'<br/><font size="7" color="#5b6b7b">{subv}</font>'
        return Paragraph(block, styles["Normal"])

    stat_rows = [
        [cell("Gesamtverbrauch", f"{_fmt(stats['total_consumption'])} {unit}"),
         cell("Ø / Tag", f"{_fmt(stats['avg_per_day'], 3)} {unit}"),
         cell("Gesamtkosten", f"{_fmt(stats['total_cost'])} €")],
        [cell("Kosten / Einheit", f"{_fmt(stats['cost_per_unit'], 4)} €"),
         cell("Max / Tag", _fmt(stats["max_per_day"], 3), _fmt_date(stats["max_per_day_datum"])),
         cell("Min / Tag", _fmt(stats["min_per_day"], 3), _fmt_date(stats["min_per_day_datum"]))],
    ]
    st = Table(stat_rows, colWidths=[58 * mm] * 3)
    st.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.5, LINE),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, LINE),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(st)

    # Chart
    story.append(Paragraph("Verbrauch / Tag", h2))
    story.append(ConsumptionChart(enriched, width=174 * mm, height=60 * mm))
    story.append(Paragraph(
        '<font size="7" color="#5b6b7b">Amber = Ausreißer (Ø + 2× Standardabweichung)</font>',
        styles["Normal"]))

    # Werte-Tabelle
    story.append(Paragraph("Ablesungen", h2))
    header = ["Datum", "Zählerstand", "Verbrauch", "Kosten", "Notiz"]
    rows = [header]
    for e in reversed(enriched):  # neueste oben
        flags = []
        if e.get("meter_replaced"):
            flags.append("Tausch")
        if e.get("is_outlier"):
            flags.append("Ausreißer")
        cons = _fmt(e["consumption"]) + (f"  [{', '.join(flags)}]" if flags else "")
        rows.append([
            _fmt_date(e["datum"]),
            _fmt(e["value"], 1),
            cons,
            "–" if e.get("cost") is None else _fmt(e["cost"]),
            (e.get("note") or "")[:40],
        ])
    tbl = Table(rows, colWidths=[24 * mm, 30 * mm, 46 * mm, 24 * mm, 50 * mm], repeatRows=1)
    tbl.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("BACKGROUND", (0, 0), (-1, 0), ACCENT),
        ("ALIGN", (1, 0), (3, -1), "RIGHT"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f4f7f9")]),
        ("LINEBELOW", (0, 0), (-1, -1), 0.4, LINE),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(tbl)

    doc.build(story)
    return buf.getvalue()
