# Migration: InfluxDB → SQLite (Zählwerk v2, standalone)

Ab v2 speichert Zählwerk **alles in einer SQLite-Datei** – kein InfluxDB, kein LXC mehr nötig. Deine bestehenden Messwerte ziehen per CSV um (verlustfrei).

> ⚠️ **Reihenfolge einhalten!** Zuerst exportieren, DANN umbauen. Nach dem Umbau liest die neue App die alte InfluxDB nicht mehr.

## Schritt 1 – Werte sichern (im AKTUELLEN Add-on, VOR dem Update)

Noch läuft die alte Version (mit InfluxDB + Export-Button). Für **jedes** System:
- System öffnen → **⇩ Export** → CSV speichern.

Du hast dann 3 Dateien, z. B. `zaehlwerk_Strom_Hauptzähler.csv`, `zaehlwerk_Gas.csv`, `zaehlwerk_Wasser.csv`.

> Alternativ reichen die ursprünglichen `import_*.csv`, **falls** du seit dem Import keine neuen Werte erfasst hast. Frisch exportieren ist sicherer.

## Schritt 2 – v2 deployen

PC → `deploy.ps1` (oder ZIP + Push), dann im HA-Terminal den Add-on-Ordner ersetzen und in der HA-UI **⋮ → Rebuild → Starten**.

Nach dem Rebuild ist die Systemliste **leer** – erwartet, weil die neue SQLite-DB frisch ist (die InfluxDB-Werte im LXC bleiben unberührt, werden aber nicht mehr gelesen).

## Schritt 3 – Systeme neu anlegen + CSVs importieren

Für jedes System:
1. **＋ System** → Name + Typ + **gleiche Einheit** wie vorher (Strom = kWh, Gas = m³, Wasser = m³).
2. System öffnen → **⇪ Import** → die passende CSV hochladen.

Fertig – alle Werte, Zählertausche und Kosten sind wieder da, jetzt in SQLite.

## Schritt 4 – InfluxDB/LXC abschalten (optional)

Wird nicht mehr gebraucht. Wenn du den LXC nur dafür betrieben hast:
```bash
cd /opt/energy-tracker
docker compose down          # stoppt influxdb + app im LXC
```
Den LXC kannst du danach in Proxmox stoppen/archivieren. **Erst prüfen**, dass in Zählwerk (Add-on) alle Werte korrekt drin sind!

## Backup ab jetzt

Nur noch **eine Datei**: die SQLite-DB im Add-on (`/data/zaehlwerk.db`). Das HA-Add-on-Backup sichert sie automatisch mit. Zusätzlich kannst du jederzeit pro System per **⇩ Export** eine CSV ziehen.
