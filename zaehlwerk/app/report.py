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
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Flowable, PageBreak,
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
        c = self.canv
        pad_l, pad_r, pad_t, pad_b = 38, 10, 14, 26
        x0, x1 = pad_l, self.width - pad_r
        y0, y1 = pad_b, self.height - pad_t
        pts = self.enriched
        vals = [e["consumption_per_day"] for e in pts]
        vmax = (max(vals) if vals else 1) * 1.1 or 1
        n = len(pts)

        def px(i): return x0 + (x1 - x0) * i / (n - 1) if n > 1 else x0
        def py(v): return y0 + (y1 - y0) * (v / vmax)

        # 1) Verlaufsfläche unter der Kurve (Clip auf die Fläche + vertikaler Gradient)
        if n >= 2:
            c.saveState()
            p = c.beginPath()
            p.moveTo(px(0), y0)
            for i, e in enumerate(pts):
                p.lineTo(px(i), py(e["consumption_per_day"]))
            p.lineTo(px(n - 1), y0)
            p.close()
            c.clipPath(p, stroke=0, fill=0)
            # PDF-Gradienten können kein Alpha -> Deckkraft vorab gegen weißes Papier mischen
            def _blend(col, a):
                return colors.Color(col.red * a + (1 - a), col.green * a + (1 - a), col.blue * a + (1 - a))
            top = _blend(ACCENT, 0.42)   # oben kräftiger
            bot = _blend(ACCENT, 0.04)   # unten fast weiß
            c.linearGradient(x0, y1, x0, y0, (top, bot), positions=(0, 1), extend=True)
            c.restoreState()

        # 2) Gridlines, Achsenbeschriftung, Linie, Punkte
        d = Drawing(self.width, self.height)
        for i in range(5):
            gy = y0 + (y1 - y0) * i / 4
            d.add(Line(x0, gy, x1, gy, strokeColor=LINE, strokeWidth=0.5))
            d.add(String(x0 - 4, gy - 3, _fmt(vmax * i / 4, 0),
                         fontSize=6, fillColor=INK_SOFT, textAnchor="end"))
        if n >= 2:
            coords = []
            for i, e in enumerate(pts):
                coords += [px(i), py(e["consumption_per_day"])]
            d.add(PolyLine(coords, strokeColor=ACCENT, strokeWidth=1.4))
            for i, e in enumerate(pts):
                out = e.get("is_outlier")
                d.add(Circle(px(i), py(e["consumption_per_day"]), 3 if out else 1.6,
                             fillColor=WARN if out else ACCENT, strokeColor=None))
            for i in (0, n // 2, n - 1):
                lbl = pts[i]["datum"].strftime("%m/%y")
                d.add(String(px(i), y0 - 12, lbl, fontSize=6, fillColor=INK_SOFT, textAnchor="middle"))

        c.saveState()
        d.drawOn(c, 0, 0)
        c.restoreState()


def _styles():
    styles = getSampleStyleSheet()
    return {
        "base": styles,
        "h1": ParagraphStyle("h1", parent=styles["Title"], fontSize=18, textColor=INK, spaceAfter=2, alignment=0),
        "sub": ParagraphStyle("sub", parent=styles["Normal"], fontSize=9, textColor=INK_SOFT),
        "h2": ParagraphStyle("h2", parent=styles["Heading2"], fontSize=11, textColor=INK, spaceBefore=12, spaceAfter=6),
    }


def _system_flowables(system: dict, enriched: list[dict], stats: dict, sty: dict,
                      from_label: Optional[str], to_label: Optional[str]) -> list:
    styles, h1, sub, h2 = sty["base"], sty["h1"], sty["sub"], sty["h2"]
    unit = system["einheit"]
    story = []

    story.append(Paragraph(f"Zählwerk-Bericht · {system['name']}", h1))
    zeitraum = "gesamter Zeitraum" if not from_label else f"ab {from_label}"
    if to_label:
        zeitraum += f" bis {to_label}"
    story.append(Paragraph(
        f"{system['typ']} · Einheit {unit} · {zeitraum} · erstellt am {datetime.now().strftime('%d.%m.%Y %H:%M')}",
        sub))
    story.append(Spacer(1, 10))

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

    story.append(Paragraph("Verbrauch / Tag", h2))
    story.append(ConsumptionChart(enriched, width=174 * mm, height=60 * mm))
    story.append(Paragraph(
        '<font size="7" color="#5b6b7b">Amber = Ausreißer (Ø + 2× Standardabweichung)</font>',
        styles["Normal"]))

    story.append(Paragraph("Ablesungen", h2))
    rows = [["Datum", "Zählerstand", "Verbrauch", "Kosten", "Notiz"]]
    for e in reversed(enriched):
        flags = []
        if e.get("meter_replaced"):
            flags.append("Tausch")
        if e.get("is_outlier"):
            flags.append("Ausreißer")
        cons = _fmt(e["consumption"]) + (f"  [{', '.join(flags)}]" if flags else "")
        rows.append([
            _fmt_date(e["datum"]), _fmt(e["value"], 1), cons,
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
    return story


def build_report_pdf(system: dict, enriched: list[dict], stats: dict,
                     from_label: Optional[str], to_label: Optional[str]) -> bytes:
    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=18 * mm, rightMargin=18 * mm, topMargin=16 * mm, bottomMargin=16 * mm,
        title=f"Zählwerk-Bericht – {system['name']}",
    )
    doc.build(_system_flowables(system, enriched, stats, _styles(), from_label, to_label))
    return buf.getvalue()


def build_combined_report_pdf(sections: list[dict], from_label: Optional[str],
                              to_label: Optional[str]) -> bytes:
    """sections: Liste von {system, enriched, stats} -> ein PDF, ein Abschnitt je System."""
    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=18 * mm, rightMargin=18 * mm, topMargin=16 * mm, bottomMargin=16 * mm,
        title="Zählwerk-Gesamtbericht",
    )
    sty = _styles()
    story = []
    for i, sec in enumerate(sections):
        if i > 0:
            story.append(PageBreak())
        story += _system_flowables(sec["system"], sec["enriched"], sec["stats"], sty, from_label, to_label)
    if not sections:
        story.append(Paragraph("Keine aktiven Systeme vorhanden.", sty["h2"]))
    doc.build(story)
    return buf.getvalue()

