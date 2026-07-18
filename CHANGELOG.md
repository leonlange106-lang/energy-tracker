# Changelog

Alle nennenswerten Änderungen an diesem Projekt werden in dieser Datei dokumentiert.

Das Format basiert auf [Keep a Changelog](https://keepachangelog.com/de/1.1.0/),
dieses Projekt folgt [Semantic Versioning](https://semver.org/lang/de/).

## [Unreleased]

### Fixed

- [Docs/README.md] Korrigiert den Datenmodell-Abschnitt: DB liegt unter `/config/zaehlwerk.db`, nicht unter `/share/zaehlwerk/zaehlwerk.db`.
- [Docs/MIGRATION.md] Korrigiert den Backup-Pfad von `/data/zaehlwerk.db` auf `/config/zaehlwerk.db`.

---

## [2.13.0] - 2026-07-18

### Added

- [Frontend/Export] Ergänzt einen Konfigurationsdialog vor dem Export. Der Menüpunkt Bericht startet den Download nicht mehr unmittelbar, sondern öffnet Zeitraum-, System- und Darstellungsoptionen.
- [Frontend/Export] Ergänzt die Zeitraum-Vorauswahl Gesamt, laufendes Jahr, zwölf Monate und Vorjahr sowie freie Von-bis-Eingabe.
- [Frontend/Export] Ergänzt die Systemauswahl über Kontrollkästchen samt Alle- und Keins-Schaltfläche und optionaler Einbeziehung archivierter Systeme.
- [Frontend/Export] Übernimmt auf Wunsch die Farbrollen der aktiven Palette in den Bericht und zeigt die übergebenen Werte als Farbmuster an.
- [Backend/report.py] Ergänzt die Klasse `Theme`, über die Akzent-, Text-, Linien- und Ausreißerfarbe je Export gesetzt werden; ohne Angabe gilt die bisherige Werkseinstellung.
- [Backend/report.py] Ergänzt `system_colors`: im Gesamtbericht wird jedes Diagramm in der Farbe seines Systems gezeichnet statt durchgehend in der Akzentfarbe.
- [Backend/routers/readings.py] Ergänzt an beiden PDF-Endpunkten die Parameter `systems`, `include_inactive`, `accent`, `ink`, `ink_soft`, `line`, `warn`, `system_colors`, `include_chart` und `include_table`.

### Changed

- [Backend/report.py] Löst die Farbwerte aus den Modulkonstanten und reicht sie über das Theme-Objekt bis in Diagramm, Tabellenraster und Fließtext durch.
- [Frontend/Export] Bildet die Farbrollen für den Export im Dunkelmodus auf helle Entsprechungen ab, da der Bericht auf weißem Papier erscheint.

### Security

- [Backend/report.py] Prüft alle Farbparameter gegen `^#[0-9a-fA-F]{6}$` und fällt sonst auf die Werkseinstellung zurück; die Werte stammen aus der Anfrage und fließen unmittelbar in die PDF-Erzeugung.
- [Backend/routers/readings.py] Filtert die Systemauswahl über die Datenbank statt über die Eingabe; unbekannte Kennungen entfallen still.

---

## [2.12.2] - 2026-07-18

### Fixed

- [Frontend/Tabs] Schließt die Panels der Systemansicht gegenseitig aus. Das Werte-Panel war ein `v-else` ohne Bedingung und fing damit auch den Zustand `tab === "meters"` ab; das in 2.11.0 ergänzte Zähler-Panel stand zudem außerhalb des `transition`-Blocks und bildete eine zweite, unabhängige Bedingungskette. Bei aktivem Zähler-Tab wurden Ablesungstabelle samt Filter und Blätterleiste zusätzlich gerendert.
- [Frontend/Tabs] Führt alle drei Panels in einer durchgehenden Kette `loading → chart → list → meters` innerhalb des `transition`-Blocks zusammen, sodass genau eines im DOM liegt.
- [Frontend/Tabs] Zeigt im Zähler-Tab während des Ladens einen Ladeindikator statt kurzzeitig einer leeren Zählerliste.
- [Frontend/UI] Bezieht die Aktion der Plus-Schaltfläche auf den aktiven Tab: im Zähler-Tab legt sie einen Zähler an statt einer Ablesung. Die Beschriftung folgt entsprechend.

---

## [2.12.1] - 2026-07-18

### Fixed

- [Frontend/UI] Beseitigt die doppelte Navigation auf schmalen Viewports. Der in 2.6.0 eingeführte Drawer lag dort zusätzlich zur Bottom-Bar an; unterhalb von 841 px sind Rail, Drawer, Scrim und Menü-Button jetzt vollständig abgeschaltet, oberhalb ist es die Bottom-Bar.
- [Frontend/UI] Behebt den vertikalen Versatz des Kamera-Buttons im Ablesedialog. `.btn` fehlte `justify-content: center`, wodurch der Inhalt linksbündig saß; zusätzlich zog `align-items: stretch` aus 2.9.1 den Button auf die volle Feldhöhe statt ihn quadratisch zu lassen.
- [Frontend/style.css] Stellt `.input-scan` auf ein zweispaltiges Grid mit `minmax(0, 1fr)` um. Feld und Button liegen damit auf einer gemeinsamen Mittelachse, unabhängig von Schriftgröße und Fokusrahmen; lange Einheiten laufen nicht mehr über.
- [Frontend/app.js] Schließt einen offenen Drawer beim Verkleinern des Fensters; andernfalls blieb er unsichtbar über der Bottom-Bar liegen und fing Klicks ab.

### Changed

- [Frontend/style.css] Reduziert die Ziffernhöhe im Zählerstandsfeld auf Touch-Geräten von 24 px auf 22 px mit symmetrischem Innenabstand, sodass Feld und 60-px-Scanner-Button bündig abschließen.

---

## [2.12.0] - 2026-07-18

### Added

- [Backend/outbound.py] Ergänzt ein zentrales Gate für ausgehende Verbindungen mit Anbieter-Allowlist, HTTPS-Zwang, Weiterleitungsprüfung und Zwischenspeicher je Anbieter.
- [Backend/routers/external.py] Ergänzt `GET /api/external/weather` (Open-Meteo) und `GET /api/external/tariff` (aWATTar Day-Ahead) sowie `GET /api/external/status` und `POST /api/external/cache/clear`.
- [Backend/routers/settings.py] Ergänzt den Anwendungsparameter `offline_mode`; der Auslieferungszustand ist gesperrt.
- [Frontend/UI] Ergänzt den Kill-Switch samt Zustandsanzeige, Anbieterliste und Zwischenspeicher-Verwaltung in Sektion A der Einstellungen.
- [Backend/outbound.py] Liefert im Offline-Modus vorhandene zwischengespeicherte Daten weiter aus, auch abgelaufene, statt einen Fehler zu werfen.

### Security

- [Backend/outbound.py] Sperrt ausgehende Verbindungen bei aktivem Kill-Switch auf Netzwerkebene: `install_socket_guard()` ersetzt `socket.getaddrinfo` und verweigert die Auflösung öffentlicher Adressen. Die Sperre greift damit auch für Code, der das Anwendungs-Gate umgeht. Loopback, private Netze und die Supervisor-Namen bleiben erreichbar, damit Benachrichtigungen und Entity-Abfragen weiterlaufen.
- [Backend/main.py] Installiert die Sperre vor der Datenbankinitialisierung; die Flagge startet auf gesperrt und wird erst danach aus den Einstellungen gesetzt, sodass in der Startphase keine Verbindung durchrutschen kann.
- [Backend/outbound.py] Hält die Anbieter-Allowlist fest im Code. Frei konfigurierbare Zieladressen wären hinter dem Ingress-Proxy eine SSRF-Lücke. Beide Anbieter arbeiten ohne Zugangsschlüssel, es liegen keine Geheimnisse im Repository.
- [Backend/outbound.py] Prüft nach einer Weiterleitung erneut gegen die Allowlist; ein 302 auf einen fremden Host würde die Prüfung sonst aushebeln.
- [Backend/routers/external.py] Reduziert die übertragenen Koordinaten auf drei Nachkommastellen (rund 110 m), da der Wetterdienst keine genauere Standortangabe benötigt.

---

## [2.11.0] - 2026-07-18

### Added

- [Frontend/app.js] Ergänzt eine regelbasierte Hardware-Empfehlung für die Smart-Meter-Nachrüstung. `hwSuggest()` wertet Medium, Bauart, Modell und Hersteller aus und liefert je Zähler das passende Ausleseverfahren samt Begründung und Sicherheitsgrad.
- [Frontend/app.js] Ergänzt neun Regeln: moderne Messeinrichtung, iMSys, Ferraris, Balgengaszähler, elektronischer Gaszähler, Ultraschall-Wasserzähler, mechanischer Wasserzähler, kamerabasierte Rückfallebene und PV-Wechselrichter.
- [Frontend/UI] Ergänzt den Reiter Zähler in der Systemansicht mit Anlegen, Bearbeiten und Löschen der Metadaten aus 2.10.0; ohne ihn waren die Felder nur über die API erreichbar.
- [Frontend/UI] Ergänzt eine Live-Vorschau der Empfehlung im Zählerdialog, die schon beim Eintippen der Bauart reagiert.
- [Frontend/UI] Ergänzt ein Eichfrist-Badge je Zähler mit den Stufen gültig, endet demnächst und abgelaufen.

### Changed

- [Frontend/style.css] Kennzeichnet den Sicherheitsgrad einer Empfehlung über die linke Kante statt über Farbflächen, damit die Abstufung in allen Paletten und im Hochkontrast-Theme lesbar bleibt.

---

## [2.10.1] - 2026-07-18

### Fixed

- [Frontend/UI] Stellt die Systemverwaltung wieder her. Mit dem Umbau der Einstellungen zur eigenen Seite in 2.9.0 entfiel der einzige Aufrufer von `editSystem`; das in `SystemDetail` deklarierte `edit`-Ereignis wurde nie ausgelöst. Damit waren Umbenennen, Einheit, Farbe, Ø-Preis, Ableseintervall, HA-Entity und Archivieren unerreichbar. Die Systemansicht hat jetzt eine Schaltfläche „✎ Bearbeiten“.
- [Frontend/UI] Verdrahtet das endgültige Löschen eines Systems. `confirmDeleteSystem()` und der Endpunkt `DELETE /api/systems/{id}` bestehen seit 2.4.0, eine auslösende Schaltfläche gab es nie. Der Dialog enthält sie nun als Halten-Schaltfläche.
- [Frontend/app.js] Löst nach dem Speichern einer Ablesung das `changed`-Ereignis aus; Kachelwerte und Fälligkeits-Badges der Übersicht blieben bis zum nächsten Wechsel in die Systemliste veraltet.

### Changed

- [Frontend/UI] Ersetzt die native `confirm()`-Rückfrage beim Systemlöschen durch das Drei-Sekunden-Halten, das seit 2.4.0 für alle übrigen Löschvorgänge gilt; `confirm()` kann im WebView der Home-Assistant-App unterdrückt werden.

---

## [2.10.0] - 2026-07-18

### Added

- [Backend/database.py] Ergänzt die Tabelle `meters` für Zähler-Metadaten: Hersteller, Modell, Zählernummer, Bauart, Baujahr, Eichfrist, Messstellenbetreiber, Stellenzahl vor und nach dem Komma, Ein- und Ausbaudatum, Notiz. Fremdschlüssel auf `systems.id`, Indizes auf `system_id`, `zaehlernummer` und `eichung_bis`.
- [Backend/migrations.py] Ergänzt Migration 2, die die Tabelle samt Indizes idempotent anlegt und `PRAGMA user_version` auf 2 hebt.
- [Backend/routers/meters.py] Ergänzt CRUD-Endpunkte: `GET`/`POST /api/systems/{id}/meters` sowie `GET`/`PATCH`/`DELETE /api/meters/{id}`.
- [Backend/routers/meters.py] Ergänzt `GET /api/meters/calibration-due` mit Vorlauf in Tagen für abgelaufene und demnächst fällige Eichfristen.
- [Backend/routers/meters.py] Ergänzt `GET /api/meters/bauarten` als Vorschlagsliste für die Oberfläche.
- [Backend/schemas.py] Ergänzt `MeterCreate`, `MeterUpdate`, `MeterRead` und `MeterCalibrationEntry`; Datumsplausibilität und Längen werden vor dem Schreibzugriff geprüft, die Zählernummer ist je System eindeutig.

### Changed

- [Backend/routers/readings.py] Nimmt die Zähler-Metadaten als `zaehler.json` in den Gesamt-Export auf, da `SETUP.md` und `MIGRATION.md` diesen Export als Backup-Weg ausweisen.
- [Backend/routers/systems.py] Löscht beim endgültigen Entfernen eines Systems auch dessen Zähler-Metadaten; andernfalls scheitert der Commit an der aktiven Fremdschlüsselprüfung.
- [Backend/routers/settings.py] Ergänzt die Anzahl erfasster Zähler in der Laufzeitdiagnose.

---

## [2.9.1] - 2026-07-18

### Changed

- [Frontend/style.css] Führt ein Touch-Layout-System über `(pointer: coarse)` ein: Trefferflächen skalieren auf 48 px (WCAG 2.5.5), Formularfelder auf 16 px. Die Steuerung hängt am Eingabegerät statt an der Fensterbreite.
- [Frontend/style.css] Hebt die Schriftgröße aller Formularfelder auf Touch-Geräten auf 16 px an; darunter zoomt iOS Safari das fokussierte Feld automatisch heran und verschiebt das gesamte Layout.
- [Frontend/style.css] Stellt Dialoge unterhalb von 640 px als Bottom-Sheet dar: Kopf und Aktionsleiste stehen fest, nur der Rumpf scrollt; die Primäraktion liegt breit in der Daumenzone.
- [Frontend/style.css] Ersetzt `vh` durch `dvh` in der Dialoghöhe, damit ein- und ausfahrende Browserleiste und Bildschirmtastatur die Aktionsleiste nicht mehr verdecken.
- [Frontend/style.css] Reserviert die Scrollbar-Rinne über `scrollbar-gutter: stable`, gibt der Messwertzeile eine feste Mindesthöhe und hält Platz für Validierungsmeldungen frei; alle drei verhinderten Sprünge im Layout.
- [Frontend/style.css] Entfernt die Spinner an Zahlenfeldern auf Touch-Geräten, da sie unter dem Daumen nicht bedienbar sind und Breite kosten.
- [Frontend/app.js] Stellt im Ablesedialog den Zählerstand über die volle Breite an den Anfang und vergrößert Ziffernanzeige und Scanner-Button; das Datum ist ohnehin vorbelegt.
- [Frontend/app.js] Ergänzt `inputmode="decimal"`, `enterkeyhint` und `autocomplete="off"` an den Zahlenfeldern und setzt den Autofokus nur auf Zeigergeräten, damit auf Touch nicht sofort die Tastatur hochfährt.

---

## [2.9.0] - 2026-07-18

### Added

- [Backend/migrations.py] Führt ein Schema-Migrationsverfahren über `PRAGMA user_version` ein; Migrationen laufen beim Start genau einmal, aufsteigend und in einer Transaktion.
- [Backend/models.py] Ergänzt die Tabelle `app_settings` als Key/Value-Speicher für anwendungsweite Parameter.
- [Backend/routers/settings.py] Ergänzt `GET`/`PUT /api/settings` für Benachrichtigungsschalter, Prüfintervall, Standard-Ableseintervall und Ausreißer-Schwelle.
- [Backend/routers/settings.py] Ergänzt `GET /api/system/info` als read-only Laufzeitdiagnose (Betriebsart, Schema-Version, DB-Pfad und -Größe, Journal-Modus, Datenbestand).
- [Backend/schemas.py] Ergänzt `AppSettingsUpdate` mit Wertebereichen; ungültige Eingaben werden mit HTTP 422 abgewiesen, bevor geschrieben wird.
- [Frontend/UI] Ergänzt eine Einstellungsseite mit Sektion A (System) und Sektion B (Web-App) samt clientseitiger Vorprüfung und Feldfehlern.

### Changed

- [Frontend/UI] Löst die Einstellungen aus dem Modal und führt sie als eigene Ansicht; der Sidebar-Eintrag navigiert dorthin, statt ein Overlay zu öffnen.
- [Frontend/UI] Verschiebt CSV-Import und -Export aus den Einstellungen in die Kopfzeile der Systemansicht, wo sie fachlich hingehören.
- [Backend/logic.py] Nimmt die Ausreißer-Schwelle als Parameter entgegen, statt 2 σ fest zu verdrahten.
- [Backend/notifier.py] Liest Intervall und Ein/Aus in jedem Zyklus neu aus den Einstellungen; Änderungen greifen ohne Add-on-Neustart.
- [Backend/database.py] Ruft nach `create_all()` die Migrationen auf; beide Schritte sind idempotent.

---

## [2.8.0] - 2026-07-18

### Added

- [Frontend/UI] Ergänzt einen freien Farbwähler (`input[type=color]`) im Systemdialog zusätzlich zu den acht Presets; der gewählte Wert landet wie bisher in `System.farbe` in SQLite.
- [Frontend/UI] Ergänzt in den Einstellungen einen Abschnitt Diagrammfarben für Ausreißer-Markierung, Gitternetz und Achsenbeschriftung, jeweils mit Rücksetzer auf den Theme-Standard.
- [Frontend/app.js] Ergänzt den Store `chartPrefs` mit Persistenz in `localStorage` unter `zw_chart_colors`; leere Werte fallen auf die M3-Rolle zurück.
- [Frontend/app.js] Ergänzt eine WCAG-Kontrastprüfung und warnt, sobald eine gewählte Farbe gegenüber der Diagrammfläche unter 3:1 liegt.

### Changed

- [Frontend/app.js] Bezieht Gitternetz-, Achsen- und Ausreißerfarbe über `chartColor()` statt direkt aus `cssVar()`; die Chart-Komponente zeichnet bei Farbwechsel über den Watcher `prefSignature` sofort neu.

---

## [2.7.0] - 2026-07-18

### Added

- [Frontend/style.css] Ergänzt die Farbpaletten Indigo und Ember als vollständige M3-Rollensätze für Hell- und Dunkelmodus; die Achse wird über `data-palette` am Wurzelelement gesteuert.
- [Frontend/style.css] Ergänzt eine Hochkontrast-Stufe über `data-contrast="high"`: verstärkte Neutralrollen, sichtbare Konturen auf Flächen, 2 px Button-Rahmen; palettenunabhängig für beide Modi.
- [Frontend/style.css] Ergänzt einen Fokusring über `:focus-visible` für alle bedienbaren Elemente (WCAG 2.4.11); zuvor existierte kein Fokusindikator.
- [Frontend/UI] Ergänzt Palette- und Kontrastauswahl in den Einstellungen; beide Werte werden in `localStorage` gehalten (`zw_palette`, `zw_contrast`).
- [Frontend/UI] Übernimmt die Systempräferenz `prefers-contrast: more`, solange der Nutzer keine eigene Kontraststufe gewählt hat.

### Changed

- [Frontend/app.js] Trennt das Theming in drei unabhängige Achsen (Modus, Palette, Kontrast) statt eines einzelnen Hell-/Dunkel-Schalters.
- [Frontend/index.html] Erweitert das Pre-Paint-Skript um Palette und Kontrast, damit beim Laden keine Farbumschaltung sichtbar wird.
- [Frontend/style.css] Ersetzt hartkodierte Farbwerte in `.nav-scrim` und `.toast.err` durch die Rollen `--md-scrim` und `--md-error-container`.
- [Frontend/app.js] Bezieht die Ausreißerfarbe in Chart und Legende aus der neuen Rolle `--md-outlier` statt aus dem literalen Wert `#d9820a`.

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

[Unreleased]: https://github.com/leonlange106-lang/energy-tracker/compare/v2.13.0...HEAD
[2.13.0]: https://github.com/leonlange106-lang/energy-tracker/compare/v2.12.2...v2.13.0
[2.12.2]: https://github.com/leonlange106-lang/energy-tracker/compare/v2.12.1...v2.12.2
[2.12.1]: https://github.com/leonlange106-lang/energy-tracker/compare/v2.12.0...v2.12.1
[2.12.0]: https://github.com/leonlange106-lang/energy-tracker/compare/v2.11.0...v2.12.0
[2.11.0]: https://github.com/leonlange106-lang/energy-tracker/compare/v2.10.1...v2.11.0
[2.10.1]: https://github.com/leonlange106-lang/energy-tracker/compare/v2.10.0...v2.10.1
[2.10.0]: https://github.com/leonlange106-lang/energy-tracker/compare/v2.9.1...v2.10.0
[2.9.1]: https://github.com/leonlange106-lang/energy-tracker/compare/v2.9.0...v2.9.1
[2.9.0]: https://github.com/leonlange106-lang/energy-tracker/compare/v2.8.0...v2.9.0
[2.8.0]: https://github.com/leonlange106-lang/energy-tracker/compare/v2.7.0...v2.8.0
[2.7.0]: https://github.com/leonlange106-lang/energy-tracker/compare/v2.6.0...v2.7.0
[2.6.0]: https://github.com/leonlange106-lang/energy-tracker/compare/v2.5.1...v2.6.0
[2.5.1]: https://github.com/leonlange106-lang/energy-tracker/compare/v2.5.0...v2.5.1
[2.5.0]: https://github.com/leonlange106-lang/energy-tracker/compare/v2.4.0...v2.5.0
[2.4.0]: https://github.com/leonlange106-lang/energy-tracker/compare/v2.3.0...v2.4.0
[2.3.0]: https://github.com/leonlange106-lang/energy-tracker/compare/v2.2.0...v2.3.0
[2.2.0]: https://github.com/leonlange106-lang/energy-tracker/compare/v2.1.0...v2.2.0
[2.1.0]: https://github.com/leonlange106-lang/energy-tracker/compare/v2.0.0...v2.1.0
[2.0.0]: https://github.com/leonlange106-lang/energy-tracker/compare/v1.0.0...v2.0.0
[1.0.0]: https://github.com/leonlange106-lang/energy-tracker/releases/tag/v1.0.0
