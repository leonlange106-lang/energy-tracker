# Changelog

Alle nennenswerten Änderungen an diesem Projekt werden in dieser Datei dokumentiert.

Das Format basiert auf [Keep a Changelog](https://keepachangelog.com/de/1.1.0/),
dieses Projekt folgt [Semantic Versioning](https://semver.org/lang/de/).

## [Unreleased]

### Fixed

- [Docs/README.md] Korrigiert den Datenmodell-Abschnitt: DB liegt unter `/config/zaehlwerk.db`, nicht unter `/share/zaehlwerk/zaehlwerk.db`.
- [Docs/MIGRATION.md] Korrigiert den Backup-Pfad von `/data/zaehlwerk.db` auf `/config/zaehlwerk.db`.

---

## [2.6.0] - 2026-07-18

### Added

- [Frontend/UI] Führt eine einklappbare Navigations-Sidebar ein: Navigation Rail (80 px) lässt sich zum Drawer (264 px) mit Textlabels aufklappen; der Zustand wird in `localStorage` unter `zw_nav_expanded` gehalten.
- [Frontend/UI] Blendet die Sidebar unterhalb von 840 px als modalen Drawer mit Scrim ein, bedienbar über den Menü-Button in der Top-App-Bar und schließbar per Scrim-Klick oder `Escape`.
- [Frontend/UI] Ergänzt die Navigationsziele Zählwerk, Bericht, Einstellungen und Admin-Tools; Admin-Tools ist als deaktivierter Platzhalter mit Badge angelegt.

### Changed

- [Frontend/UI] Speist Navigation Rail und Bottom Bar aus der zentralen Konstante `NAV_ITEMS` statt aus dupliziertem Markup.
- [Frontend/style.css] Führt das Layout-Token `--rail-w` ein; Top-App-Bar und Content-Container beziehen ihren linken Versatz daraus statt aus einem festen 80-px-Wert.

---

## [2.5.1] - 2026-07-17

### Changed

- [Frontend/OCR] Kalibriert die Zeichenerkennung anhand realer Zählerfotos: adaptiver Otsu-Threshold, PSM-6-Segmentierung, Mehrfach-Pass.
- [Frontend/UI] Präzisiert die Hinweistexte im Scanner-Overlay auf den tatsächlichen Beta-Reifegrad.

---

## [2.5.0] - 2026-07-17

### Added

- [Backend/notifier.py] Meldet überfällige Ablesungen als `persistent_notification` an Home Assistant; feste `notification_id` pro System verhindert Spam und entfernt die Meldung nach der Ablesung automatisch.
- [Backend/routers/readings.py] Ergänzt `GET /api/export.zip`: exportiert alle Systeme als CSV plus Systemkonfiguration als `systeme.json`.
- [Frontend/UI] Rechnet HA-Sensorwerte in die Systemeinheit um (Wh/kWh/MWh, L/m³) bei wählbarer Quelleinheit.

### Changed

- [Frontend/UI] Vereinheitlicht die Löschen-Buttons auf die Pill-Form des Designsystems.
- [Frontend/Chart] Dünnt X-Achsen-Labels ab 40 Datenpunkten automatisch aus.

---

## [2.4.0] - 2026-07-17

### Added

- [Frontend/UI] Übernimmt Zählerstände aus Home Assistant; Entity ist pro System über `zusatzfelder.ha_entity` konfigurierbar.
- [Backend/routers/systems.py] Ergänzt `DELETE /api/systems/{id}`: löscht Fehlanlagen endgültig inklusive aller zugehörigen Ablesungen.
- [Frontend/UI] Zeigt den Versionsverlauf in den Optionen an.

### Changed

- [Frontend/UI] Ersetzt den Lösch-Dialog durch 3-Sekunden-Halten mit Fortschritts-Outline und anschließender Bestätigung.
- [Frontend/UI] Markiert den Foto-Scanner als Beta.
- [Frontend/UI] Gibt Fälligkeiten ab 60 Tagen in Monaten statt in Tagen aus.

---

## [2.3.0] - 2026-07-17

### Added

- [Frontend/UI] Macht bestehende Ablesungen bearbeitbar.
- [Frontend/OCR] Ergänzt ein 7-Segment-Modell sowie Galerie-Upload mit Datumsübernahme aus EXIF.

### Changed

- [Frontend/UI] Stellt die Oberfläche auf Material Design 3 um: Farben, Typografie, Navigation Rail bzw. Bottom Bar, FAB, Ripple.
- [Backend/routers/readings.py] Sortiert bei Datumsgleichheit nach `meter_replaced`, damit Endstand des alten und Startstand des neuen Zählers am selben Tag korrekt aufeinanderfolgen.

### Fixed

- [Frontend/UI] Behebt mehrere Darstellungs- und Bedienfehler in der mobilen Ansicht.

---

## [2.2.0] - 2026-07-17

### Added

- [Backend/logic.py] Schätzt fehlende Kosten aus dem Ø-Preis je System (`zusatzfelder.preis`) und markiert geschätzte Werte über `cost_estimated`.
- [Backend/due.py] Ermöglicht ein festes Ablese-Intervall je System (`zusatzfelder.ablese_intervall_tage`) mit Vorrang vor der Median-Prognose.
- [Backend/routers/readings.py] Ergänzt `GET /api/systems/{id}/dashboard`: liefert Readings, Statistik und Chart-Daten in einem Request aus einer Berechnung statt in drei.
- [Frontend/OCR] Führt den Zählerstand-Scanner per Kamera ein (tesseract.js, Beta).

### Changed

- [Backend/config.py] Verlagert die Datenbank nach `/config/zaehlwerk.db` (addon_config), damit sie im regulären HA-Backup enthalten ist; migriert Altbestände aus `/share` und `/data` einmalig und nicht-destruktiv inklusive WAL-Sidecars.
- [Backend/database.py] Aktiviert `journal_mode=WAL`, `busy_timeout=15000`, `synchronous=NORMAL` und `foreign_keys=ON`.

### Fixed

- [Backend/database.py] Behebt `database is locked` bei parallelen Zugriffen.
- [Backend/routers/readings.py] Beseitigt das N+1-Query-Muster in der Übersicht durch einen Query über alle Systeme.
- [Backend/logic.py] Verhindert negative Verbräuche aus fehlerhaften Zählerständen; betroffene Intervalle werden als Lücke behandelt statt die Statistik zu verfälschen.

---

## [2.1.0] - 2026-07-16

### Added

- [Deployment/repository.yaml] Macht das Repository zu einer HA-Add-on-Quelle; Home Assistant erkennt neue Versionen selbst und bietet Update bzw. Auto-Update an.
- [Deployment/deploy.ps1] Ergänzt Ein-Klick-Deploy: ZIP entpacken, ins Repo spiegeln, committen, pushen; Version wird aus `zaehlwerk/config.yaml` gelesen.

---

## [2.0.0] - 2026-07-16

### Added

- [Backend/models.py] Führt das SQLite-Datenmodell ein: `systems` (UUID-PK, JSON-Zusatzfelder, Archivierung über `aktiv`) und `readings` (FK auf `systems.id`, indiziert auf `system_id` und `datum`).
- [Deployment/docker-compose.yml] Ermöglicht Standalone-Betrieb ohne Home Assistant.

### Changed

- [Backend/database.py] Ersetzt InfluxDB durch SQLite via SQLModel; die Anwendung läuft als ein Prozess mit einer Datei ohne externen Dienst.

### Removed

- [Backend] Entfernt die InfluxDB-Anbindung und damit die Notwendigkeit eines separaten LXC.

### BREAKING CHANGES

- Bestandsdaten werden nicht automatisch übernommen. Vor dem Update je System CSV exportieren, danach Systeme neu anlegen und CSVs importieren (siehe `MIGRATION.md`).

---

## [1.0.0] - 2026-07-15

### Added

- [Backend] Erstversion auf FastAPI mit InfluxDB als Zeitreihen-Speicher.
- [Backend/routers/imports.py] CSV-Import mit Datums- und Dezimaltrennzeichen-Toleranz.
- [Backend/report.py] PDF-Berichte je System und als Gesamtbericht.
- [Frontend/UI] Vue-3-Oberfläche ohne Build-Step inklusive Dark Mode.

---

[Unreleased]: https://github.com/leonlange106-lang/energy-tracker/compare/v2.6.0...HEAD
[2.6.0]: https://github.com/leonlange106-lang/energy-tracker/compare/v2.5.1...v2.6.0
[2.5.1]: https://github.com/leonlange106-lang/energy-tracker/compare/v2.5.0...v2.5.1
[2.5.0]: https://github.com/leonlange106-lang/energy-tracker/compare/v2.4.0...v2.5.0
[2.4.0]: https://github.com/leonlange106-lang/energy-tracker/compare/v2.3.0...v2.4.0
[2.3.0]: https://github.com/leonlange106-lang/energy-tracker/compare/v2.2.0...v2.3.0
[2.2.0]: https://github.com/leonlange106-lang/energy-tracker/compare/v2.1.0...v2.2.0
[2.1.0]: https://github.com/leonlange106-lang/energy-tracker/compare/v2.0.0...v2.1.0
[2.0.0]: https://github.com/leonlange106-lang/energy-tracker/compare/v1.0.0...v2.0.0
[1.0.0]: https://github.com/leonlange106-lang/energy-tracker/releases/tag/v1.0.0
