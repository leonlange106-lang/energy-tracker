# Zählwerk

Self-hosted Verbrauchs- & Zählerstands-Tracking (Strom, Gas, Wasser, PV, …).
**Standalone**: **FastAPI** + **SQLite** + **Vue 3 / Chart.js** – ein Prozess, eine Datei, kein externer Dienst.

## Installation
👉 **[`SETUP.md`](./SETUP.md)** – als HA-Add-on-Repository mit **Auto-Update** (empfohlen).
👉 **[`MIGRATION.md`](./MIGRATION.md)** – Umstieg von der alten InfluxDB-Version.
👉 Updates: `.\deploy.ps1 -Zip "...\energy-tracker.zip"` (Ein-Klick-Push).

## Features
Startseite mit letztem Stand **und Fälligkeits-Warnung** (Intervall pro System konfigurierbar, sonst Median-Prognose) · Systemverwaltung (Typ-Zusatzfelder, Archivieren) · Werterfassung (Zählertausch, Plausibilität) · sortier-/filterbare Tabelle (mobil scrollbar) · Chart (Linie/Balken, Zeiträume, Overlay mit 2. Achse, Gradient-Fläche, Ausreißer, Segmente bei Zählertausch) · Statistik inkl. Jahres-Prognose und Gas-kWh-Zusatz · PDF-Bericht (einzeln + Gesamt, mit Verlaufsflächen) · CSV-Import/-Export · Dark Mode · **Ø-Preis pro System** (automatische Kostenschätzung, als ≈ markiert) · **OCR-Scanner** (Zählerstand per Kamera, tesseract.js) · Mobile-Akkordeon-Tabelle.

## Technik-Notizen (v2.2)
- **DB in `/config`** (addon_config) → liegt automatisch im normalen HA-Backup. Auto-Migration von `/share` und `/data`.
- **SQLite WAL-Modus** + busy_timeout 15 s → keine `database is locked`-Fehler bei parallelen Zugriffen.
- **`/dashboard`-Endpoint**: readings + stats + chart in einem Request/einer Berechnung (vorher 3).
- **Overview ohne N+1**: ein Query für alle Systeme.
- **Negativ-Guard**: fehlerhafte Zählerstände erzeugen nie negative Verbräuche (werden als Lücke behandelt).

## Struktur (HA-Add-on-Repository)
```
repo/
├── repository.yaml            # macht das Repo zum HA-Add-on-Repository
├── zaehlwerk/                 # das Add-on = die App (self-contained)
│   ├── config.yaml            # Ingress, Panel "Zählwerk", /share-Persistenz
│   ├── Dockerfile, run.sh, requirements.txt
│   ├── app/                   # FastAPI: main, config, database, models, schemas, logic, report, routers/
│   └── frontend/              # index.html, style.css, app.js (Vue 3 CDN)
├── deploy.ps1                 # Ein-Klick: ZIP spiegeln, commit, push
├── docker-compose.yml         # optionaler Standalone-Betrieb (baut ./zaehlwerk)
├── SETUP.md, MIGRATION.md, import_template.csv
```

## Datenmodell (SQLite, in /share/zaehlwerk/zaehlwerk.db)
- **systems**: id (UUID), name, typ, einheit, farbe, icon, zusatzfelder (JSON), aktiv, erstellt_am
- **readings**: id (UUID), system_id (FK), datum, value, cost, meter_replaced, note

## Kern-Logik
Verbrauch = `value − value_vorher`; bei `meter_replaced` = `value` (neuer Zähler ab 0). Ausreißer = Tageswert > Ø + 2σ. Fälligkeit = letztes Datum + Median der bisherigen Intervalle.
