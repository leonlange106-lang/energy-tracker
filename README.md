# Zählwerk

Self-hosted Verbrauchs- & Zählerstands-Tracking (Strom, Gas, Wasser, PV, …).
**Standalone**: **FastAPI** + **SQLite** + **Vue 3 / Chart.js** – ein Prozess, eine Datei, kein externer Dienst.

> **v2:** InfluxDB wurde entfernt. Alles liegt jetzt in **einer SQLite-Datei**. Umstieg von v1: siehe **[`MIGRATION.md`](./MIGRATION.md)**.

## Betrieb
- **Als Home-Assistant-Add-on** (empfohlen, mit Ingress in Sidebar/App): Ordner `ha-addon/energy_tracker/`. Zero-Config, SQLite in `/data`.
- **Standalone via Docker** (ohne HA): `docker compose up -d --build` → `http://<host>:8000`.

## Features
Kachel-Startseite mit letztem Stand · Systemverwaltung (Typ-Zusatzfelder, Archivieren) · Werterfassung (Zählertausch, Plausibilität) · sortier-/filterbare Tabelle (mobil scrollbar) · Chart (Linie/Balken, Zeiträume, Overlay mit 2. Achse, **Gradient-Fläche**, **Ausreißer**, **Segmente bei Zählertausch**) · Statistik-Kacheln inkl. **Jahres-Prognose** und **Gas-kWh-Zusatz** · **PDF-Bericht** (einzeln + Gesamt) · **CSV-Import & -Export** (Backup) · **Dark Mode** (System/manuell).

## Struktur
```
zaehlwerk/
├── ha-addon/energy_tracker/   # HA-Add-on (self-contained, = die App)
│   ├── config.yaml            # zero-config, Ingress, Panel "Zählwerk"
│   ├── Dockerfile, run.sh, requirements.txt
│   ├── app/  frontend/
├── backend/                   # gleiche App-Quelle für Standalone-Docker
│   ├── Dockerfile, requirements.txt
│   ├── app/
│   │   ├── main.py            # FastAPI, Router, Static-Frontend, /api/health
│   │   ├── config.py          # nur SQLITE_PATH + CORS
│   │   ├── database.py        # SQLite-Engine (SQLModel)
│   │   ├── models.py          # System + Reading (beide SQLite)
│   │   ├── schemas.py, logic.py, report.py
│   │   └── routers/           # systems, readings, imports
│   └── frontend/              # index.html, style.css, app.js (Vue 3 CDN)
├── docker-compose.yml         # nur App (kein InfluxDB mehr)
├── import_template.csv
├── MIGRATION.md               # InfluxDB → SQLite
└── ha-addon/sync.sh           # backend/ -> ha-addon spiegeln
```

## Datenmodell (SQLite)
- **systems**: id (UUID), name, typ, einheit, farbe, icon, zusatzfelder (JSON), aktiv, erstellt_am
- **readings**: id (UUID), system_id (FK), datum, value, cost, meter_replaced, note

## Kern-Logik
Verbrauch = `value − value_vorher`; bei `meter_replaced` = `value` (neuer Zähler ab 0). Ausreißer = Tageswert > Ø + 2σ. Stats: Gesamtverbrauch/-kosten, Ø/Tag, Kosten/Einheit, Min/Max.
