# Energie-Tracker

Self-hosted Energie-/Verbrauchs-Tracking (Strom, Gas, Wasser, PV, …).
**FastAPI** + **InfluxDB 2.x** (Zeitreihen) + **SQLite** (Stammdaten) + **Vue 3 / Chart.js** (Frontend), ausgeliefert als **ein** Container-Stack.

## Schnellstart
👉 Komplette, laienverständliche Installation auf Proxmox: **[`DEPLOY_PROXMOX.md`](./DEPLOY_PROXMOX.md)**
👉 Integration als Home-Assistant-Add-on (Ingress, Sidebar/App): **[`HA_ADDON.md`](./HA_ADDON.md)**

Kurzform (Docker vorausgesetzt):
```bash
cp .env.example .env      # INFLUX_PASSWORD + INFLUX_TOKEN (openssl rand -hex 32) setzen
docker compose up -d --build
# App:      http://<host>:8000
# API-Doku: http://<host>:8000/docs
```

## Struktur
```
energy-tracker/
├── docker-compose.yml       # App + InfluxDB, Auto-Setup, Ressourcen-Limits
├── .env.example             # gemeinsame Zugangsdaten (Token/Org/Bucket)
├── DEPLOY_PROXMOX.md         # Schritt-für-Schritt-Anleitung (LXC, Docker, Tailscale, Backups)
├── import_template.csv       # CSV-Vorlage für Historien-Import
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── .env.example
│   ├── app/
│   │   ├── main.py          # FastAPI-App, Router-Mount, Static-Frontend, /api/health
│   │   ├── config.py        # ENV-Settings
│   │   ├── database.py      # SQLite/SQLModel-Engine
│   │   ├── influx.py        # InfluxDB-Wrapper + Reading-ID-Codec
│   │   ├── models.py        # System (SQLite-Tabelle)
│   │   ├── schemas.py       # Pydantic Request/Response
│   │   ├── logic.py         # Verbrauch, Kosten, Ausreißer, Stats
│   │   └── routers/
│   │       ├── systems.py   # CRUD Systeme
│   │       ├── readings.py  # Ablesungen, /stats, /chart-data
│   │       └── imports.py   # CSV-Vorlage + Bulk-Import
│   └── frontend/            # Vue 3 (CDN, kein Build) – wird von FastAPI statisch serviert
│       ├── index.html
│       ├── style.css
│       └── app.js
└── README.md
```

## Frontend-Features
Kachel-Menü aller Systeme · Systemverwaltung (anlegen/bearbeiten/archivieren, Typ-abhängige Zusatzfelder) · Werterfassung (Datum vorbelegt, Zählertausch-Checkbox, Plausibilitätsprüfung) · sortier-/filterbare Werte-Tabelle mit Pagination · Chart (Linie/Balken, Zeitraum Woche/Monat/Jahr/alle, mehrere Systeme überlagern, **Ausreißer farbig markiert**) · Statistik-Kacheln · **PDF-Bericht** (Statistik + Chart + Tabelle) · CSV-Import + Vorlage-Download. Responsive fürs Handy am Zähler.

## Datenmodell (Hybrid)
| Store | Inhalt | Warum |
|---|---|---|
| **SQLite** `systems` | Stammdaten (id, name, typ, einheit, farbe, icon, zusatzfelder JSON, aktiv, erstellt_am) | veränderliche Entitäten, kein separater Dienst |
| **InfluxDB** `readings` | Messwerte | Zeitreihen |

**InfluxDB-Schema:** Tags `system_id` (stabile UUID, nie der Name), `system_type` · Fields `value` (float), `cost` (float, opt.), `meter_replaced` (bool), `note` (string, opt.) · Timestamp = **Ablesedatum**.

## Lokal starten (später im LXC via Docker, Phase 3)
```bash
cd backend
cp .env.example .env          # Token/Org anpassen
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
Swagger-UI: `http://<host>:8000/docs` · Health: `/api/health`

## API-Referenz
| Methode | Pfad | Zweck |
|---|---|---|
| GET | `/api/systems?include_archived=` | Systeme listen |
| POST | `/api/systems` | System anlegen |
| GET | `/api/systems/{id}` | Einzelnes System |
| PATCH | `/api/systems/{id}` | Bearbeiten / archivieren (`aktiv:false`) |
| GET | `/api/systems/{id}/readings?from=&to=&limit=` | Ablesungen (+ abgeleitete Felder) |
| POST | `/api/systems/{id}/readings` | Neue Ablesung |
| DELETE | `/api/readings/{id}` | Ablesung löschen |
| GET | `/api/systems/{id}/stats?from=&to=` | Kennzahlen |
| GET | `/api/systems/{id}/chart-data?from=&to=` | Aufbereitete Zeitreihe fürs Chart |
| GET | `/api/import/template` | CSV-Vorlage |
| POST | `/api/systems/{id}/import` | CSV-Bulk-Import (multipart `file`) |

## Kern-Logik (analog Sheets/PDF-Bericht)
- **Verbrauch** je Intervall = `value_curr − value_prev`; bei `meter_replaced=true` = `value_curr` (neuer Zähler startet **immer bei 0** – feste Regel).
- **Verbrauch/Tag** = Verbrauch / Tage im Intervall.
- **Ausreißer** = Tageswert > Ø + 2×σ → `is_outlier:true`.
- **Stats**: Gesamtverbrauch, Gesamtkosten, Ø/Tag, Kosten/Tag, Kosten/Einheit, Min/Max mit Datum.
- **Plausibilität** bei POST: neuer Wert < letzter Wert → `422`, außer `meter_replaced`.

## Offene Punkte (aus Spec, umgesetzt)
- **Auth:** keine → Schutz nur über Tailscale.
- **InfluxDB:** neue, dedizierte Instanz.
- **Historie:** kein Auto-Import → `import_template.csv` + Import-Endpoint/-Button vorhanden.
