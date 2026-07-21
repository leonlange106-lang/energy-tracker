# Changelog

Alle nennenswerten Änderungen an diesem Projekt werden in dieser Datei dokumentiert.

Das Format basiert auf [Keep a Changelog](https://keepachangelog.com/de/1.1.0/),
dieses Projekt folgt [Semantic Versioning](https://semver.org/lang/de/).

## [Unreleased]

---

## [3.22.0] - 2026-07-21

### Added

- **[Backend/logic.py] Downsampling-Aggregation für die Diagramme.** `downsample_enriched()` verdichtet lange Ablesereihen für die Diagrammausgabe auf höchstens 600 Punkte (gleich große Index-Eimer). Je Eimer entsteht ein Punkt: Zählerstand am Eimer-Ende, Verbrauch als Eimersumme, Tagesverbrauch mengengewichtet – Verlauf UND Gesamtsumme bleiben exakt erhalten, Ausreißer- und Zählertausch-Marker gehen nicht verloren. Betroffen sind `GET /api/systems/{id}/chart-data` und der `chart`-Block von `GET /api/systems/{id}/dashboard` (letzterer meldet `downsampled` und `points_total`). Die **Werte-Tabelle bleibt unverändert vollständig** – verdichtet wird ausschließlich die Diagramm-Reihe.

### Hinweis

- Dies ist die umgesetzte, tragfähige Hälfte des ursprünglich als v4.0.0 geplanten Architektur-Splits: der Ticket-Punkt „Downsampling-Aggregation, um die UI-Performance zu halten“. Der dort ebenfalls vorgesehene **physische Split der `readings`-Tabelle in `readings_manual` + `telemetry`** wurde bewusst NICHT umgesetzt: 16 Backend-Module lesen `readings` direkt, und die Verbrauchslogik arbeitet auf EINER zeitsortierten Reihe – ein Split zwänge jeden Lesepfad zu UNION/Merge zweier Tabellen. Zugleich besteht die Prämisse „unbegrenzt wachsende Telemetrie“ hier nicht (MQTT ist seit v3.1.0 intervallgetaktet, die `source`-Spalte trennt bereits logisch, die Retention aus v3.20.0 begrenzt das Volumen). Ein breaking Schema-Umbau brächte damit hohes Risiko ohne realen Nutzen. Deshalb kein Major-Bump, sondern ein Minor mit dem konkreten Performance-Gewinn.

---

## [3.21.0] - 2026-07-20

### Added

- **[Quality/tests] Unit-Test-Suite für die Abrechnungs- und Verbrauchslogik** (`tests/test_billing_logic.py`, `tests/test_prognosis.py`). Reine Funktionstests gegen `app.logic` mit den kritischen Edge-Cases: Zählertausch mit/ohne Startstand, Null-Sturz-Schutz (kein negativer Verbrauch), Zählertausch bei unterjährigem Tarifwechsel, Preissenkung mitten im Intervall (MwSt.-Senkung als neue Bruttoperiode), Zeiträume ohne Ablesung (Lücken werden taggenau verteilt), Jahresgrundpreis inkl. Schaltjahr, sowie die Prognose-Randfälle (5-Jahres-Fenster schließt Altverbrauch aus, Abrechnungsmonat-Anker, Abschlags-Schwelle, zu wenig Daten → keine Prognose, ohne Tarif nur Verbrauch). Gesamtstand der Suite: **51 Tests**.
- **[Build/CI] GitHub-Actions-Workflow** (`.github/workflows/tests.yml`): führt Frontend-Syntaxprüfung und `pytest` bei jedem Push und Pull Request aus. Ein fehlgeschlagener Test macht den PR rot – die Suite ist damit Teil des Build-Prozesses und schlägt bei Regressionen sofort Alarm.

### Hinweis

- Die Tests laufen bewusst in der CI (vor dem Merge) und nicht im Add-on-Docker-Build: das Laufzeit-Image bleibt schlank (Test-Abhängigkeiten stehen getrennt in `requirements-dev.txt`), und ein fehlschlagender Test blockiert den Merge, statt erst den Image-Build in der Home-Assistant-Umgebung.

---

## [3.20.0] - 2026-07-20

### Added

- **[Backend/backup.py] Telemetrie-Aufbewahrungsregel.** Neue Einstellung `telemetry_keep_days` (Standard 0 = unbegrenzt). Ist der Wert > 0, verdünnt der tägliche Lauf MQTT-Ablesungen, die älter als diese Frist sind, auf einen Datensatz je Kalendermonat und System. Behalten wird der ÄLTESTE Datensatz je Monat, damit der Anfangsstand jeder Reihe erhalten bleibt – bei kumulativen Zählerständen ändert sich der Gesamtverbrauch dadurch nicht, nur die zeitliche Auflösung alter Telemetrie sinkt. Von Hand erfasste, importierte und aus Home Assistant übernommene Werte (`source != 'mqtt'`) werden nie angetastet.
- **[Frontend] Einstellung** unter Admin-Tools → Datenmanagement (Sicherungs-Zeitplan), mit Erklärung und Validierung (0–36500 Tage).
- **[Backend/backup.py] Datenpflege entkoppelt.** Protokoll-Beschneidung und Telemetrie-Verdünnung (`run_housekeeping`) laufen jetzt täglich auch dann, wenn die automatische Sicherung ausgeschaltet ist – die Datenbank soll nicht unbegrenzt wachsen, nur weil kein Backup aktiv ist.
- **[Quality/tests] Retention-Tests** (`tests/test_retention.py`): Gesamtverbrauch bleibt erhalten, andere Quellen werden verschont, `keep_days=0` ist ein No-op, die Einstellung steht im Settings-Vertrag.

### Hinweis

- Die im Ticket vermutete „unendlich wachsende Telemetrie-Tabelle“ besteht in dieser Form nicht: die MQTT-Übernahme ist seit v3.1.0 intervallgetaktet und schreibt je System höchstens einen Datensatz pro Periode (Standard täglich), statt pro Nachricht. Die Retention ist daher ein Sicherheitsventil für sehr lang laufende Installationen, kein Fix für eine außer Kontrolle geratene Tabelle. Der Standard bleibt bewusst „unbegrenzt“, damit ein Update kein Verhalten still ändert.
- Ein eigener Cron-Daemon kommt weiterhin nicht zum Einsatz (das Add-on-Image bringt keinen mit); die Bereinigung hängt am bestehenden asyncio-Tagesplaner im laufenden Prozess.

---

## [3.19.0] - 2026-07-20

### Added

- **[Quality/tests] Contract-Test-Suite (`tests/`).** Pytest-basierte Verträge für alle zentralen öffentlichen Endpunkte (`/api/health`, `/api/auth/status`, Systeme, Ablesungen, Statistik, System- und Gesamt-Dashboard inkl. `prognosis`, Tarife, Übersicht, persönliches Layout). Jeder Vertrag ist eine Liste der Felder, auf die `frontend/app.js` angewiesen ist; fehlt eines nach einer API-Änderung, wird der zugehörige Test rot und nennt das Feld beim Namen – der geforderte „sofortige Alarm“. Ergänzt um Eingabe-Validierungstests (ungültige Payloads → 422, ungeschützter Zugriff → 401) und Tests, die sicherstellen, dass die OpenAPI-Doku vollständig und trotz statischer Frontend-Auslieferung erreichbar bleibt. 24 Tests.
- **[Backend/main.py] OpenAPI-Dokumentation.** FastAPI erzeugt das Schema automatisch; die interaktive Doku liegt unter `/docs` (Swagger UI) und `/redoc`, das maschinenlesbare Schema unter `/openapi.json`. App-Beschreibung ergänzt, die auf Doku und Contract-Tests hinweist.
- **[Build] `requirements-dev.txt` und `pytest.ini`.** Test-Abhängigkeiten (pytest, httpx) sind bewusst vom Laufzeit-`requirements.txt` getrennt, damit das Add-on-Image schlank bleibt.

### Hinweis

- Die OpenAPI/Swagger-Dokumentation war durch FastAPI bereits vorhanden; neu ist die Absicherung, dass sie erreichbar und vollständig bleibt (der `/`-Mount für das Frontend hätte `/docs` sonst überschatten können), sowie die explizite Contract-Test-Ebene darüber.

---

## [3.18.0] - 2026-07-20

### Changed

- **[Backend/logic.py, models.py] Grundpreis ist jetzt ein JAHRESbetrag (zuvor Monatsbetrag).** Migration 10 multipliziert bestehende `tariffs.grundpreis`-Werte einmalig mit 12, damit der tatsächlich gemeinte Euro-Betrag erhalten bleibt (idempotent über `PRAGMA user_version` abgesichert). Die Umlage ist jetzt strikt tagesgenau: je Verbrauchstag `grundpreis / Kalendertage-des-jeweiligen-Jahres` – ein Intervall über einen Jahreswechsel zahlt für Tage in einem Schaltjahr 1/366, sonst 1/365. Ersetzt die bisherige 365,25/12-Näherung. UI-Felder und -Anzeigen auf „€/Jahr“ umgestellt; Obergrenze der Eingabe von 1000 auf 5000 angehoben.
- **[Backend/logic.py] Kostenprognose neu ausgerichtet.** Die frühere Jahreshochrechnung über den gesamten Bestand entfällt. `rolling_prognosis()` bildet einen gleitenden Durchschnitt der letzten fünf Jahre (nie die gesamte Historie – alte Nutzungsmuster, z. B. vor einer Sanierung, sollen die Vorhersage nicht verzerren) und projiziert ihn auf genau ein kommendes Abrechnungsjahr. Reicht die Datenlage im Fenster nicht (< 30 Tage), gibt es keine Prognose.

### Added

- **[Backend/logic.py, models.py] Zählertausch mit Startstand.** Neue Spalte `readings.meter_start` (Migration 9): Beim Tausch kann der Startstand des neuen Zählers erfasst werden; der Verbrauch des Intervalls ist dann `Ablesewert − Startstand` (Formel: Gesamt = (Endstand_Alt − Startstand_Alt) + (Stand_Neu − Startstand_Neu)). Fehlt der Startstand, gilt weiter die 0-Annahme – Bestandsdaten bleiben unverändert korrekt. Der abrupte Rücksprung des Zählerstands erzeugt keinen negativen Verbrauch (bestehender Guard bleibt).
- **[Backend/logic.py] Abschlags-Schwellenwarnung.** Ist am System ein monatlicher Abschlag hinterlegt, prüft die Prognose, ob die Jahreshochrechnung `12 × Abschlag` übersteigt, und meldet den Fehlbetrag.
- **[Backend/routers] Prognose in den Endpunkten.** `GET /api/systems/{id}/dashboard` und `GET /api/dashboard/data` liefern je System ein `prognosis`-Objekt (immer aus der vollen Historie berechnet, unabhängig vom angezeigten Zeitraum).
- **[Frontend] Je System einstellbar:** monatlicher Abschlag und Startmonat des Abrechnungsjahres (in den System-Zusatzfeldern). Die Kostenprognose-Kachel zeigt die Prognose fürs nächste Abrechnungsjahr, den zugrunde liegenden 5-Jahres-Schnitt und – bei Überschreitung – eine rote Warnung mit dem Fehlbetrag (zusätzlich per ⚠/✓ und nicht nur farblich codiert).
- **[Frontend] Ablesedialog:** optionales Feld „Startstand neuer Zähler“ beim Zählertausch.

### Hinweis

- Das **tagesgenaue Splitting der Ableseperioden bei Tarifwechseln** (Dynamic Tariff Engine) existiert bereits seit v2.16.0: `apply_tariffs()` verteilt den Verbrauch tageweise und ordnet jeden Tag dem gültigen Tarif zu; die Interpolation über einen Wechsel hinweg erfolgt über den gleichmäßig verteilten Tagesverbrauch des Intervalls. Dieser Ticket-Punkt war also im Kern schon erfüllt. Beim Härten fiel ein latenter Fehler auf: In `_tariff_for` wurde ein `datetime` (Ablesedatum) mit einem `date` (Tarifgrenze) verglichen – jetzt wird der Tag vor dem Vergleich auf ein `date` normalisiert.
- **Variable Steuersätze (MwSt.)** brauchen kein eigenes Feld: Preise werden brutto geführt, und ein zeitlich begrenzter Steuersatz wird bereits durch eine neue Tarifperiode zum neuen Bruttopreis abgebildet – das tagesgenaue Splitting greift dann automatisch.

---

## [3.17.1] - 2026-07-20

### Fixed

- [Frontend/app.js] Das Logo bzw. der Titel oben links in der Kopfzeile ist jetzt auf allen Ansichten eine Schaltfläche und führt global zurück zur Startseite (auf schmalen Geräten die kompakte Startseite, sonst die Systemübersicht) – auch aus den Admin-Tools heraus. Offene Overlays (Navigationsschublade, System-Auswahl) werden dabei geschlossen. Neue Methode `goHome()`.
- [Frontend/app.js] „Berichterstellung“ war über die untere Navigationsleiste nicht erreichbar: im Seitenrail ist der Bericht ein aufklappbarer Unterpunkt von „Auswertungen“, die schmale Bottom-Bar kennt aber keine Unterlisten. Der Bericht ist dort jetzt ein eigenes Ziel (fünf statt vier Einträge); es erscheint nur mit Export-Recht und wird hervorgehoben, solange der Berichtsdialog offen ist.
- [Frontend/app.js] Die schwebende ＋-Schaltfläche (FAB) wurde global gerendert und lag dadurch auch auf Dashboard, Startseite, Einstellungen und Admin-Tools – dort ohne Funktion und über den Speichern-Dialogen. Sie wird jetzt nur noch dort gerendert (`showFab`), wo sie tatsächlich etwas anlegt: in der Systemübersicht (neues System) und der Zähler-Detailansicht (neue Ablesung/neuer Zähler). Betrifft sowohl die schwebende Variante als auch die im Seitenrail angedockte.

---

## [3.17.0] - 2026-07-20

### Added

- [Frontend/app.js] Mobile Startseite: jeder aktive Zähler bekommt eine eigene Karte mit Status (aktueller Stand + Trend) und darunter einen großen, touch-optimierten „＋ Wert erfassen“-Knopf. Ein Tipp öffnet direkt den Ablesedialog des jeweiligen Zählers – ohne den bisherigen Umweg über die Übersicht und die Systemauswahl. Das war der Reibungspunkt beim Ablesen „im Vorbeigehen“ (z. B. im Keller). Neue Methode `mobileQuickRead(systemId, withScanner)`; die Karten sind nach Tagesverbrauch sortiert, der meistgenutzte Zähler steht oben.
- [Frontend/app.js] Kamera-Schnellzugriff je Zähler direkt auf der Startseite: der Kamera-Knopf öffnet Ablesedialog samt Foto-Erfassung für genau diesen Zähler.
- [Frontend/index.html] „Zum Startbildschirm hinzufügen“ startet die App jetzt im Vollbild ohne Browser-Leiste (`mobile-web-app-capable`, `apple-mobile-web-app-*`). Bewusst ohne Web-App-Manifest/Service-Worker: unter dem HA-Ingress liegt die App hinter einem dynamischen Basispfad, ein festes `start_url` würde fehlleiten.

### Hinweis

- Die dedizierte mobile Startseite selbst existiert bereits seit v3.10.0; neu in dieser Version ist die Schnellerfassung pro Zähler. Die frühere globale „Neue Ablesung“-Schaltfläche (`mobileNewReading`) entfällt in der Oberfläche, da jede Zählerkarte ihre eigene, direktere Aktion trägt; die Methode bleibt für einen möglichen Direktaufruf erhalten. Touch-Ziele sind mindestens 52 px hoch.

---

## [3.16.0] - 2026-07-20

### Added

- [Backend/schemas.py, routers/dashboard.py] Dashboard-Kacheln vom Typ Verlauf, Trend und Kostenprognose akzeptieren jetzt `timeframe: "custom"` mit `range_from`/`range_to`: ein frei wählbarer Zeitraum zusätzlich zu den bisherigen Voreinstellungen (7 Tage … Gesamt).
- [Frontend/app.js] Kachel-Editor: neue Schaltfläche „Benutzerdefiniert“ im Zeitraum-Auswahlfeld blendet zwei Datumsfelder (Von/Bis) ein. „Übernehmen“ bleibt gesperrt, bis ein gültiger Zeitraum (Start ≤ Ende, beide gesetzt) eingetragen ist – Validierung serverseitig zusätzlich abgesichert.
- [Frontend/app.js] Das für Kachel-Daten angefragte Zeitfenster (`GET /api/dashboard/data?months=…`) richtet sich jetzt nach dem am weitesten zurückliegenden benutzerdefinierten Zeitraum unter den eigenen Kacheln, statt starr bei 24 Monaten zu kappen.

### Fixed

- **[Frontend/app.js]** Seltener, aber reproduzierbarer Absturz der Dashboard-Diagramme (`Cannot read properties of null (reading 'save')`, aus Chart.js' internem Animator): trat auf, wenn eine Kachel kurz nach ihrer Erstellung bearbeitet, das Dashboard schnell nacheinander gespeichert/neu geladen, oder der Bearbeitungsmodus innerhalb der rund einsekündigen Eintrittsanimation eines Diagramms ausgelöst wurde – ein Resize während laufender Animation ließ Chart.js intern auf eine bereits zerstörte Instanz zugreifen, das Diagramm blieb dann leer. Betraf `WidgetLineChart` und `WidgetPieChart` gleichermaßen. Behoben, indem beide Kachel-Diagramme ohne Eintrittsanimation zeichnen (`animation: false`) und vor jedem `destroy()` zusätzlich `stop()` aufrufen.
- **[Backend/routers/dashboard.py]** `PUT /api/user/dashboard` schlug mit `TypeError: Object of type date is not JSON serializable` fehl, sobald eine Kachel einen benutzerdefinierten Zeitraum enthielt – `DashboardTile.model_dump()` lieferte `range_from`/`range_to` als Python-`date`-Objekte statt als Zeichenketten. Behoben durch `model_dump(mode="json")`.

### Hinweis

- Die übrigen Ticket-Punkte waren beim Nachsehen bereits vorhanden: die Zusammenführung von Dashboard und Bericht unter „Auswertungen“ stammt aus v3.9.0, der Pop-up-Editor für Kacheln ebenfalls aus v3.9.0, und das Übereinanderlegen mehrerer Systeme in einem Verlaufsdiagramm (`system_ids`, Mehrfachauswahl) existiert seit v3.5.0/v3.9.0 unverändert fort. Neu ist ausschließlich der benutzerdefinierte Zeitraum.

---

## [3.15.0] - 2026-07-20

### Fixed

- **[Frontend/app.js] Kritisch:** Die Herkunfts-Badges (HA/Import/Manuell) und der zugehörige Quellen-Filter in der Werte-Tabelle der Systemdetailansicht warfen bei jeder Zeile mit nicht-manueller Quelle `TypeError: sourceLabel is not a function` und rissen damit die Anzeige ab. Ursache: Die `SystemDetail`-Komponente führt ein eigenes, von der `App`-Wurzelkomponente unabhängiges `methods`-Objekt; `sourceLabel` war dort nie registriert. Da Vues zur Laufzeit kompilierte `template:`-Strings über `with(_ctx)` ausgewertet werden, greift eine fehlende Methode nicht automatisch auf eine gleichnamige globale Funktion zurück, sondern schlägt fehl. Jetzt in `SystemDetail.methods` mit registriert.

### Hinweis

- Ticket-Annahme war, die Backend-Logik für `source` existiere bereits und fehle nur in der UI-Anzeige. Tatsächlich existierten Badges und Filter im Frontend schon seit v3.7.0 – sichtbar wurden sie aber nie, weil (a) der in v3.13.0 behobene `Reading.source`-Bug bis dahin jede Ablesung als `manual` speicherte, wodurch der betroffene Code-Pfad nie durchlaufen wurde, und (b) der oben beschriebene `sourceLabel`-Fehler, sobald doch einmal eine andere Quelle auftrat, die Anzeige zum Absturz brachte.

---

## [3.14.0] - 2026-07-20

### Added

- [Backend/audit.py] `POST /api/admin/audit/rollback/{log_id}` macht einen einzelnen Protokolleintrag rückgängig: `UPDATE` schreibt die alten Feldwerte zurück, `DELETE` legt den Datensatz aus der vollständigen Momentaufnahme neu an, `INSERT` entfernt den seinerzeit angelegten Datensatz wieder. Läuft über das ORM statt über rohes SQL, damit der Rückgängig-Vorgang selbst automatisch als neuer Protokolleintrag erscheint – ohne zusätzlichen Code. Sammelvorgänge (CSV-Import, Bulk-Löschung) lassen sich nicht rückgängig machen, da dafür keine Einzeldaten protokolliert wurden.
- [Frontend/Admin] „↺ Rückgängig“-Schaltfläche direkt in den Zeilen der Änderungsprotokoll-Tabelle, mit Bestätigungsdialog.

### Fixed

- [Backend/audit.py] Verschachtelte Werte (z. B. `System.zusatzfelder`) landeten im Protokoll bisher als Python-Repr-Text statt als echtes JSON und waren weder sauber lesbar noch aus dem Protokoll rekonstruierbar – eine Voraussetzung für die Wiederherstellung aus einer `DELETE`-Momentaufnahme. Jetzt bleiben Objekte und Listen als JSON erhalten.

### Hinweis

- Ein Rückgängig prüft nicht, ob der Datensatz nach dem gewählten Eintrag noch einmal geändert wurde – in dem Fall überschreibt es die zwischenzeitliche Änderung. Das ist ein bewusster Kompromiss ohne vollständige Versionierung, kein Versehen.

---

## [3.13.0] - 2026-07-20

### Fixed

- **[Backend/models.py] Kritisch:** `Reading.source` war seit Einführung der Spalte (Migration 7, v3.7.0) nie im SQLModel-Klassenmodell deklariert. Die ORM-Zuordnung kannte die Spalte dadurch nicht: generierte `INSERT`-Anweisungen ließen sie aus, SQLite füllte sie über den Spalten-Standardwert `'manual'` auf. Jede Ablesung – unabhängig davon, ob sie manuell, per MQTT, über eine Home-Assistant-Entity oder per CSV-Import entstand – wurde dadurch in der Datenbank als `manual` gespeichert; `Reading.source` als Filterausdruck (z. B. beim Rohdaten-Export nach Quelle) war zudem nicht auswertbar. Jetzt korrekt deklariert. Bereits gespeicherte Ablesungen bleiben mit ihrer fälschlich eingetragenen Quelle stehen – das lässt sich nachträglich nicht rekonstruieren –, ab dieser Version wird die tatsächliche Herkunft aber wieder korrekt erfasst.

### Added

- [Backend/Frontend/MQTT] Unbeteiligte Geräte in der Auto-Discovery-Liste lassen sich per „✕ Ignorieren“ dauerhaft ausblenden (persistiert, übersteht einen Neustart) und über „Wieder anzeigen“ zurückholen.
- [Backend/notifier.py] Watchdog für MQTT-Systeme: meldet über `persistent_notification`, wenn ein per MQTT angebundenes System die konfigurierte Schwelle (Standard 48 h) ohne neuen Wert überschreitet. Die Schwelle skaliert automatisch mit dem Speicherintervall des Systems (mindestens das 1,5-fache der eigenen Periode) – ein wöchentlich speicherndes System löst dadurch keinen Fehlalarm aus, nur weil es per Design selten schreibt. Bewusst nur für MQTT: Werte über eine Home-Assistant-Entity entstehen erst, wenn jemand die App öffnet, Stille dort bedeutet "niemand hat abgelesen" und ist bereits über die reguläre Fälligkeits-Benachrichtigung abgedeckt.
- [Frontend/Admin] Watchdog ein-/ausschaltbar und Schwelle einstellbar unter Admin-Tools → Netzwerk.

---

## [3.12.0] - 2026-07-20

### Changed

- [Frontend/Admin] Admin-Tools zum vollständigen Tab-Dashboard erweitert: **System** (Kill-Switch, Anwendungsparameter), **Netzwerk** (MQTT-Einrichtung), **Zugriff** (Konten & Rollen), **Datenmanagement** (jetzt inkl. Sicherungs-Zeitplan), **Diagnose** (jetzt inkl. Laufzeit & Datenbank), sowie unverändert Abfrage, Protokoll und Änderungen.
- [Frontend/Einstellungen] Die bisherige Sektion A ("A · System") entfällt vollständig – ihr Inhalt ist in die Admin-Tools umgezogen. Einstellungen zeigt jetzt für **alle** Konten (nicht nur Administratoren) Darstellung, Diagrammfarben, Versionsverlauf und die eigene Kontokarte inkl. Abmelden-Button. Vorher konnten Nicht-Administratoren sich in der Oberfläche nicht abmelden, weil die Konto-Karte in der admin-exklusiven Sektion A steckte – das ist mit diesem Umzug nebenbei behoben.
- [Frontend/CSS] Die Reiterleiste der Admin-Tools quetschte bei acht Reitern die Beschriftung auf schmalen Bildschirmen unleserlich zusammen (geerbte Spaltenaufteilung `minmax(0,1fr)`). Reiter behalten jetzt ihre natürliche Breite; die Leiste scrollt bei Bedarf horizontal statt sich zu verzerren.

### Hinweis

- Datenumfang und Berechtigungen sind unverändert – der Zugriff auf `/api/settings`, `/api/backup` usw. bleibt serverseitig auf die Rolle `admin` beschränkt; es hat sich nur die Oberfläche neu sortiert.

---

## [3.11.1] - 2026-07-20

### Changed

- [Frontend/Admin] Die Wiederherstellung (sowohl aus einer bestehenden Sicherung als auch per Datei-Upload) verlangt jetzt zusätzlich zur Warnung die Eingabe des Wortes `RESTORE` in einem eigenen Bestätigungsdialog, bevor der Vorgang startet. Ein einfaches Ja/Nein wäre für eine so folgenreiche, unumkehrbare Aktion zu leicht versehentlich wegzuklicken.

### Hinweis

- Die im Ticket vermutete Vermischung von „Werte nachtragen" (CSV-Anhängen je System) und „Systemwiederherstellung" (destruktives Überschreiben) bestand bei der Durchsicht nicht: Ersteres liegt bereits ausschließlich in der Zähler-Detailansicht, Letzteres ist bereits über die Rollenprüfung (`/api/backup` erfordert `admin`) und die Admin-Tools-Navigation hart isoliert. Hier war folglich nur der fehlende Hard-Prompt zu ergänzen.

---

## [3.11.0] - 2026-07-20

### Fixed

- [Build/requirements.txt] **Behebt eine mit 3.10.1 eingeführte Regression:** Das dortige Pinnen auf `opencv-python-headless==5.0.0.93` zog transitiv `numpy>=2.3`, dessen offizielle Wheels mit der CPU-Baseline `x86-64-v2` (SSE4.2/POPCNT) gebaut sind. Auf x86-Hosts ohne diese Befehlssatzerweiterung (ältere/stromsparende CPUs, wie in einem konkreten Nutzer-Setup beobachtet) brach der Image-Build am Laufzeit-Import-Test mit `RuntimeError: NumPy was built with baseline optimizations (X86_V2) but your machine doesn't support` ab – der Fehler zeigte sich in Home Assistant nur als generisches „unknown error occurred while trying to build the image". `opencv-python-headless` deshalb auf `4.10.0.84` zurückgestuft und `numpy` explizit auf `1.26.4` gepinnt (Baseline nur SSE/SSE2/SSE3, breite Kompatibilität). `DEPS_VERSION` im Dockerfile erneut erhöht.

### Added

- [Backend/routers/backups.py] Ergänzt `POST /api/backup/restore/{filename}` zur Wiederherstellung aus einer bereits vorhandenen eigenen Sicherung sowie `POST /api/backup/import` zur Wiederherstellung aus einer hochgeladenen `.gz`-Sicherung.
- [Backend/backup.py] `restore_from_file` prüft Integrität (`PRAGMA integrity_check`) und Grundstruktur (erforderliche Tabellen) der Kandidatendatei, BEVOR sie live geschaltet wird. Vor jedem Austausch wird der aktuelle Bestand automatisch als Sicherheitskopie weggesichert; schlägt das fehl, bricht die Wiederherstellung ab, statt einen unwiederbringlichen Zustand zu riskieren. Ein Prozesslock verhindert gleichzeitige Wiederherstellungen.
- [Backend/backup.py] Der Dateitausch läuft am ORM vorbei und wird deshalb manuell im Änderungsprotokoll vermerkt (Aktion `RESTORE`).
- [Frontend/Admin] Neuer Menüpunkt „Datenmanagement" in den Admin-Tools: Sicherungsliste mit Download UND Wiederherstellung je Eintrag, Datei-Upload für externe Sicherungen, Bestätigungsdialog vor jeder Wiederherstellung.

### Changed

- [Frontend/UI] Sicherung erstellen, als ZIP/Rohdaten exportieren und die Sicherungsliste sind aus den Einstellungen in die Admin-Tools (Datenmanagement) umgezogen. Der Zeitplan (aktiv/Uhrzeit/Aufbewahrung) bleibt in den Einstellungen, da er eine Systemkonfiguration und keine Aktion ist.

### Hinweis

- Die im Vorfeld vermutete Redundanz unter den bestehenden Export-Endpunkten (`export.csv`, `export.zip`, `export/data.csv`, `export/data.json`) hat sich bei der Durchsicht nicht bestätigt – die vier decken unterschiedliche, dokumentierte Zwecke ab (Re-Import je System, Voll-Sicherung, externe Auswertung flach/strukturiert) und wurden unverändert belassen.

---

## [3.10.1] - 2026-07-20

### Fixed

- [Build/requirements.txt] Verpinnt sämtliche Python-Abhängigkeiten auf feste Versionen statt reiner Untergrenzen (`>=`). Eine Untergrenze ohne Obergrenze zieht bei jedem Build die jeweils neueste Version – zuletzt sprang `opencv-python-headless` dabei unbemerkt auf eine neue Hauptversion (5.x) und machte den Build nicht mehr reproduzierbar. Geprüft gegen einen sauberen Build (App-Start inkl. `/api/health`, OCR-Vorverarbeitung, PDF-Erzeugung).
- [Build/Dockerfile] Erhöht `DEPS_VERSION` auf 3, damit eine zwischengespeicherte `apt`-Ebene mit den alten Abhängigkeiten verworfen wird.
- [Docs/README.md] Korrigiert den Datenmodell-Abschnitt: DB liegt unter `/config/zaehlwerk.db`, nicht unter `/share/zaehlwerk/zaehlwerk.db`.
- [Docs/MIGRATION.md] Korrigiert den Backup-Pfad von `/data/zaehlwerk.db` auf `/config/zaehlwerk.db`.

---

## [3.10.0] - 2026-07-19

### Added

- [Frontend/Mobile] Ergänzt eine eigene Startseite für schmale Geräte mit festem, senkrechtem Aufbau: oben die drei Systeme mit dem höchsten Tagesverbrauch samt Trendanzeige, in der Mitte die Erfassung einer Ablesung mit unmittelbarem Zugriff auf die Kamera, unten die letzten drei Erfassungen.
- [Backend/routers/dashboard.py] Ergänzt die letzten Erfassungen in der Antwort von `GET /api/dashboard/data`, sodass die Startseite mit einer einzigen Anfrage auskommt.

### Changed

- [Frontend/Routing] Entscheidet beim Start anhand der Bildschirmbreite über die erste Ansicht: unterhalb von 768 Pixeln die kompakte Startseite, darüber die Systemliste. Die Entscheidung fällt einmalig und nicht bei jeder Größenänderung, da ein Wechsel der Ansicht mitten in der Bedienung überraschend wäre; über die Navigation bleiben beide erreichbar.
- [Frontend/Mobile] Stellt die Trendanzeige über Form und Farbe zugleich dar, damit sie im Hochkontrast-Theme und bei Farbfehlsichtigkeit unterscheidbar bleibt.

---

## [3.9.0] - 2026-07-19

### Changed

- [Frontend/Navigation] Fasst Dashboard und Bericht unter dem neuen Eintrag Auswertungen zusammen. Der Elternpunkt führt auf sein erstes Kind, statt ins Leere zu zeigen; die Unterliste öffnet sich wie beim Zählwerk über den Pfeil.
- [Frontend/Dashboard] Ersetzt die Schaltflächen zur Breiten- und Höhenänderung an den Kacheln durch einen zentrierten Einrichtungsdialog. Er fasst Art, Größe, Systemzuordnung, Zeitraum und Überschrift zusammen und arbeitet auf einer Arbeitskopie, sodass Abbrechen die Kachel unverändert lässt.
- [Frontend/app.js] Führt je Elternpunkt einen eigenen Auf- und Zuklappzustand. Mit einer gemeinsamen Angabe hätten sich beide Unterlisten stets zusammen geöffnet und geschlossen.

### Added

- [Frontend/Charts] Ergänzt die Zeitraumwahl je Kachel mit sieben Tagen, dreißig Tagen, neunzig Tagen, laufendem Jahr, zwölf Monaten und Gesamtbestand. Die Einschränkung erfolgt auf der bereits übertragenen Reihe, sodass keine zusätzlichen Abfragen entstehen.
- [Frontend/Charts] Ergänzt die Überlagerung mehrerer Systeme in einem Verlauf. Die Reihen erhalten eine gemeinsame Zeitachse, unterschiedliche Einheiten eine eigene Werteachse; dargestellt werden höchstens zwei, da weitere Achsen unlesbar würden.
- [Frontend/Charts] Ergänzt im Kreisdiagramm die absoluten Werte in Beschriftung und Kurzhinweis, zusätzlich zum Anteil und zur erfassten Menge in der jeweiligen Einheit.
- [Frontend/Charts] Ergänzt die Kacheln Trend und Kostenprognose. Der Trend vergleicht die laufende mit der vorangegangenen Periode gleicher Länge; die Prognose rechnet den Tagesverbrauch auf ein Jahr hoch und bewertet ihn mit dem Effektivpreis aus den Tarifen.
- [Backend/schemas.py] Ergänzt an der Kachel die Felder `system_ids` und `timeframe` sowie die Kacheltypen `trend` und `cost_forecast`. Das bisherige Feld `system_id` bleibt bestehen und wird als erstes Element geführt, sodass vorhandene Anordnungen unverändert weiterlaufen.

---

## [3.8.1] - 2026-07-19

### Added

- [Frontend/Reports] Ergänzt im Dialog vor dem Export die Auswahl der Datenquellen. Ohne Auswahl fließen alle Quellen ein; bei eingeschränkter Auswahl weist ein Hinweis darauf hin, dass Verbrauch und Kosten aus den verbleibenden Ablesungen berechnet werden und Intervalle dadurch länger ausfallen.
- [Backend/routers/readings.py] Ergänzt den Parameter `sources` an beiden Berichtsendpunkten sowie an den Rohdaten-Ausleitungen. Unbekannte Angaben werden verworfen; bleibt keine gültige übrig, gilt die Anfrage als ungefiltert.
- [Backend/routers/admin.py] Weist den Zustand der Texterkennung in der Diagnoseansicht aus, sodass ein unvollständiges Abbild dort erkennbar ist.

### Fixed

- [Build] Ergänzt im `Dockerfile` eine Kennung der Systemabhängigkeiten. Wird sie erhöht, verwirft Docker die zwischengespeicherte Installationsebene. Ohne diesen Griff behält der Supervisor eine vorhandene Ebene bei, solange sich der Befehl selbst nicht ändert – daran scheiterte die Erkennung nach 3.6.0.
- [Build] Prüft im `Dockerfile` unmittelbar nach der Installation, ob Tesseract samt deutschen Sprachdaten vorliegt, und lädt anschließend OpenCV und die Python-Bindung. Der Build bricht damit an der Ursache ab, statt ein Abbild auszuliefern, das die Kamera erst im Betrieb verweigert.

---

## [3.8.0] - 2026-07-19

### Added

- [Backend/Security] Ergänzt die Tabelle `audit_logs` mit Zeitpunkt, Konto, Aktion, Zieltabelle, Datensatzkennung sowie altem und neuem Wert als JSON; Migration 8 hebt `PRAGMA user_version` auf 8.
- [Backend/Middleware] Ergänzt Ereignisbehandlungen der SQLAlchemy-Sitzung, die Anlegen, Ändern und Löschen an Ablesungen, Systemen, Tarifen, Zählern, Konten und Einstellungen selbsttätig festhalten. Bei Änderungen werden ausschließlich die tatsächlich veränderten Felder mit ihrem vorherigen und neuen Wert abgelegt.
- [Backend/routers/admin.py] Ergänzt `GET /api/admin/audit` mit serverseitiger Seitenaufteilung und Filterung nach Aktion, Tabelle, Konto und Zeitraum sowie `GET /api/admin/audit/facets` für die Auswahlwerte.
- [Backend/routers/settings.py] Ergänzt den Parameter `audit_keep_days` mit einer Untergrenze von dreißig Tagen.
- [Backend/backup.py] Beschneidet das Änderungsprotokoll im täglichen Sicherungslauf, statt dafür einen zweiten Zeitplan zu führen.
- [Frontend/Admin] Ergänzt den Reiter Änderungen in den Admin-Werkzeugen mit schreibgeschützter Tabelle, Filterleiste und Seitenblättern.

### Security

- [Backend/Security] Setzt die Unveränderlichkeit auf Datenbankebene durch. Ein Trigger weist jedes `UPDATE` auf `audit_logs` ab, ein zweiter jedes `DELETE` an Einträgen, die jünger als dreißig Tage sind. Die Sperre greift damit auch bei Zugriff über die Datenbankabfrage der Admin-Werkzeuge oder unmittelbar über `sqlite3`, wo Ereignisse des ORM wirkungslos wären.
- [Backend/audit.py] Ermittelt das ausführende Konto über eine Kontextvariable, die die Middleware je Anfrage setzt und danach zurücksetzt. Ein Trigger allein könnte den Verursacher nicht feststellen, da SQLite keinen Sitzungskontext kennt.
- [Backend/audit.py] Ersetzt Passwort-Streuwerte, den Signaturschlüssel der Sitzungen und das Broker-Passwort im Protokoll durch eine Platzhalterfolge. Das Protokoll ist für jeden Administrator lesbar.
- [Backend/models.py] Verzichtet auf einen Fremdschlüssel zur Kontentabelle und führt den Benutzernamen zusätzlich als Text mit, damit Einträge das Entfernen eines Kontos überdauern.
- [Backend/audit.py] Fasst Vorgänge mit mehr als fünfundzwanzig betroffenen Datensätzen je Tabelle zu einem Sammeleintrag zusammen. Ein Import mit mehreren tausend Zeilen hätte die Tabelle andernfalls in einem Vorgang unbrauchbar aufgebläht.
- [Backend/audit.py] Schreibt die Einträge in derselben Transaktion wie die Änderung. Eine nebenläufige Warteschlange wäre schneller, verlöre Einträge aber gerade beim Abbruch mitten in einer Änderung.

---

## [3.7.0] - 2026-07-19

### Added

- [Backend/DB] Ergänzt die Spalte `source` an der Tabelle `readings` mit dem Vorgabewert `manual` sowie einen Index darauf; Migration 7 hebt `PRAGMA user_version` auf 7.
- [Frontend/UI] Kennzeichnet Ablesungen mit abweichender Herkunft über einen Chip in der Werte-Tabelle und ergänzt eine Filterleiste. Sie erscheint erst, wenn tatsächlich mehr als eine Quelle vorliegt.

### Changed

- [Backend/Ingestion] Schreibt die Herkunft in die eigene Spalte statt sie über das Notizfeld zu kennzeichnen. Die MQTT-Übernahme belegte bislang die Notiz mit dem Wort MQTT; dieses Feld gehört dem Nutzer und bleibt nun frei. Migration 7 überträgt bestehende Einträge und gibt die Notiz wieder frei.
- [Backend/routers/readings.py] Übernimmt die Herkunft aus der Anfrage, beschränkt auf `manual` und `ha_api`. Die Kennung `mqtt` setzt ausschließlich der Listener und lässt sich nicht über die Schnittstelle behaupten.
- [Backend/routers/imports.py] Kennzeichnet über CSV eingelesene Ablesungen mit `import`.
- [Frontend/app.js] Setzt `ha_api`, sobald ein Wert aus einer Home-Assistant-Entity übernommen wurde, und fällt auf `manual` zurück, sobald der Wert von Hand geändert wird.

### Fixed

- [Frontend/UI] Zeigt die Kamera-Schaltfläche im Ablesedialog wieder an. Sie wurde in 3.6.0 ausgeblendet, sobald die Statusabfrage der Texterkennung fehlschlug oder Tesseract im Abbild fehlte. Eine verschwundene Schaltfläche sieht wie ein Fehler aus und lässt sich nicht nachvollziehen; stattdessen nennt ein Hinweis beim Antippen den Grund.

---

## [3.6.0] - 2026-07-19

### Added

- [Backend/OCR] Ergänzt eine serverseitige Zählerstand-Erkennung auf Basis von Tesseract mit deutschen Sprachdaten und einer Bildvorverarbeitung über OpenCV.
- [Backend/OCR] Erzeugt vier Bildvarianten und übernimmt die mit der höchsten Zeichensicherheit: adaptiver Schwellwert für ungleichmäßige Beleuchtung, globaler Schwellwert für ausgeleuchtete Rollenzählwerke, invertiert für Anzeigen mit hellen Ziffern auf dunklem Grund sowie reine Kontrastanhebung ohne Binarisierung.
- [Backend/OCR] Berücksichtigt die Aufnahmerichtung aus den Bilddaten, glättet kantenerhaltend und skaliert kleine Aufnahmen hoch, da Tesseract unterhalb von rund dreißig Pixeln Zeichenhöhe kaum noch erkennt.
- [Backend/API] Ergänzt `POST /api/ocr/scan` und `GET /api/ocr/status`. Letzterer meldet, ob die Erkennung einsatzbereit ist, sodass die Oberfläche die Kamera andernfalls gar nicht erst anbietet.
- [Backend/OCR] Zieht den zuletzt erfassten Stand zur Auswahl heran. Ein Zählerfoto enthält neben dem Zählwerk häufig Seriennummer, Eichjahr und Typenbezeichnung; welche der erkannten Zahlen gemeint ist, lässt sich am Vorwert zuverlässig entscheiden.
- [Frontend/UI] Ergänzt nach der Erkennung einen Hinweis mit Sicherheitsangabe, letztem Stand und den übrigen erkannten Zahlen zur Auswahl; er verschwindet, sobald der Wert von Hand geändert wird.
- [Deployment/Dockerfile] Ergänzt `tesseract-ocr`, `tesseract-ocr-deu` sowie die von OpenCV benötigten Systembibliotheken und entfernt die Paketlisten im selben Schritt.
- [Deployment/requirements.txt] Ergänzt `pytesseract`, `opencv-python-headless` und `Pillow`.

### Changed

- [Frontend/UI] Verlagert die Erkennung vollständig auf den Server. Bisher lud die Oberfläche `tesseract.js` von einem Auslieferungsnetz; das scheiterte bei aktivem Offline-Modus, brachte keine deutschen Sprachdaten mit und ließ keine Vorverarbeitung zu. Damit entfällt die letzte funktionale Abhängigkeit von einem fremden Netz.
- [Frontend/app.js] Entfernt die clientseitige Bildvorverarbeitung und Kandidatenauswahl; beides liegt nun im Backend.

### Security

- [Backend/routers/ocr.py] Begrenzt Hochladungen auf zwölf Megabyte, prüft den Dateityp und liest die Datei begrenzt ein, statt sie vollständig in den Speicher zu nehmen.
- [Backend/ocr.py] Begrenzt die Bildfläche gegen Dekompressionsbomben und verarbeitet ausschließlich im Arbeitsspeicher, ohne die Datei abzulegen.
- [Backend/routers/ocr.py] Protokolliert Ergebnis und ausführendes Konto, niemals das Bild selbst.
- [Backend/auth.py] Beschränkt die Erkennung auf die Rolle Schreiber, da sie zur Erfassung gehört.

---

## [3.5.1] - 2026-07-19

### Fixed

- [Deployment] Legt das Changelog zusätzlich im Add-on-Ordner ab. Der Supervisor sucht die Datei unter `zaehlwerk/CHANGELOG.md`; im Repo-Root findet er sie nicht, weshalb der Update-Dialog bisher „No changelog found" meldete.

### Changed

- [Deployment/deploy.ps1] Kopiert das Changelog aus dem Repo-Root bei jedem Deploy in den Add-on-Ordner. Maßgeblich bleibt die Datei im Root, wie es Keep a Changelog vorsieht und GitHub erwartet; zwei getrennt gepflegte Kopien würden auseinanderlaufen.
- [Deployment/deploy.ps1] Bricht ab, wenn `config.yaml`, `app/version.py` und `frontend/app.js` nicht dieselbe Version tragen. Ein solcher Unterschied führte in 3.2.1 dazu, dass Home Assistant kein Update anbot.
- [Deployment/deploy.ps1] Setzt das Git-Tag nach dem Push selbst und überspringt es, falls es bereits besteht. Ein von Hand vor dem Deploy gesetztes Tag hing bisher am Vorgänger-Commit.

---

## [3.5.0] - 2026-07-19

### Added

- [Frontend/Dashboard] Ergänzt eine persönliche Startseite mit frei anordenbaren Kacheln auf einem vierspaltigen Raster. Ein Bearbeitungsmodus erlaubt Hinzufügen, Verschieben, Skalieren und Entfernen; außerhalb dieses Modus ist die Anordnung festgelegt.
- [Frontend/Dashboard] Ergänzt vier Kacheltypen: Letzter Stand je System, Verlauf des Tagesverbrauchs, Verteilung der Kosten über alle Systeme und Kostensumme des Zeitraums.
- [Frontend/Dashboard] Setzt Ziehen und Ablegen über die native Schnittstelle des Browsers um, ohne zusätzliche Bibliothek. Eine Rasterbibliothek käme über ein Auslieferungsnetz herein und liefe damit dem Offline-Ziel und der Sperre aus 2.12.0 zuwider.
- [Backend/DB] Ergänzt die Spalte `dashboard_layout` an der Tabelle `users` als JSON-Zeichenkette sowie Migration 6; `PRAGMA user_version` steht danach auf 6.
- [Backend/routers/dashboard.py] Ergänzt `GET`, `PUT` und `DELETE` auf `/api/user/dashboard` sowie `GET /api/dashboard/data`. Letzterer liefert Kennzahlen und Verläufe aller aktiven Systeme in einem Aufruf, statt je Kachel eine eigene Anfrage zu stellen.
- [Backend/schemas.py] Prüft jede Kachel gegen zulässige Typen, Rastergrenzen und die Spaltenzahl; eine Kachel, die über den rechten Rand hinausragt, wird abgewiesen.
- [Backend/auth.py] Ergänzt eine Zugriffsregel, die jedem angemeldeten Konto das Lesen und Schreiben des eigenen Layouts erlaubt. Ohne sie verlangte die Grundregel für schreibende Verfahren die Rolle Schreiber, und ein Leser hätte seine eigene Startseite nicht einrichten können.

### Changed

- [Frontend/Dashboard] Berechnet die Rasterkoordinaten nach jedem Verschieben aus der Reihenfolge neu. Dadurch entstehen weder Lücken noch Überlappungen, und gespeicherte Layouts bleiben innerhalb der Spaltenzahl gültig.
- [Frontend/Dashboard] Bricht das Raster unterhalb von 768 Pixeln auf eine Spalte und zwischen 768 und 1024 Pixeln auf zwei Spalten um; die gespeicherten Spannweiten werden dabei überschrieben, da eine zweispaltige Kachel sonst aus dem Raster ragte.
- [Backend/routers/dashboard.py] Liefert bei fehlendem oder unlesbarem Layout eine Vorbelegung statt eines Fehlers. Andernfalls käme ein Konto mit beschädigtem Eintrag nicht mehr auf seine Startseite und hätte keine Möglichkeit, das Layout zurückzusetzen.
- [Backend/routers/dashboard.py] Entfernt bei Kacheln den Verweis auf zwischenzeitlich gelöschte Systeme, statt die Kachel zu verwerfen; sie bleibt erhalten und kann neu belegt werden.

---

## [3.4.1] - 2026-07-19

### Fixed

- [Frontend/UI] Bezieht die Safe-Area in den Freiraum unterhalb des Inhalts ein. Auf Geräten mit Home-Indikator schiebt das System den sichtbaren Bereich nach oben; ohne diese Angabe fehlten dort rund 34 Pixel und die letzte Tabellenzeile lag erneut unter der schwebenden Schaltfläche.
- [Frontend/UI] Ordnet die überlagernden Ebenen neu. Die schwebende Schaltfläche lag mit Stufe 31 über der Navigationsleiste und hätte sie bei geänderten Abständen verdeckt; sie steht nun auf Stufe 28, also über dem Inhalt und unter der Navigation. Die vollständige Reihenfolge ist im Stylesheet dokumentiert.
- [Frontend/UI] Ergänzt Admin-Tools in der unteren Navigationsleiste. Der Eintrag wird ausschließlich für Konten mit Administratorrolle in den Seitenbaum aufgenommen und ist andernfalls nicht Bestandteil des Dokuments, nicht lediglich verborgen. Die Rolle stammt aus den serverseitig aufgelösten Rechten.
- [Frontend/UI] Macht die Einstellungen wieder für alle Konten erreichbar. Seit 3.2.0 war der Eintrag auf Administratoren beschränkt, wodurch auch Sektion B mit Darstellung, Farbpalette, Kontraststufe und Diagrammfarben unerreichbar war, obwohl diese Angaben gerätelokal sind und jedes Konto betreffen. Sektion A bleibt Administratoren vorbehalten.
- [Frontend/style.css] Führt die Beschriftungen der unteren Navigationsleiste gekürzt und mit Auslassungszeichen, damit vier Ziele auch auf schmalen Geräten nebeneinander passen.

---

## [3.4.0] - 2026-07-19

### Added

- [Frontend/Table] Ergänzt einen Auswahlmodus in der Werte-Tabelle. Er ist standardmäßig aus und wird über eine Schaltfläche in der Werkzeugleiste eingeschaltet; sichtbar ist sie nur für Konten mit Schreibrecht.
- [Frontend/Table] Ergänzt je Zeile ein Kontrollkästchen sowie eines in der Kopfzeile, das die aktuelle Seite auswählt. Bei teilweiser Auswahl wird der Zwischenstand angezeigt, sodass sich eine teilweise markierte Seite von einer leeren unterscheiden lässt.
- [Frontend/Table] Ergänzt einen Hinweis, sobald die Seite vollständig markiert ist, außerhalb aber weitere Treffer liegen, samt Schaltfläche zur Auswahl aller gefilterten Einträge.
- [Frontend/Table] Ergänzt eine Aktionsleiste, die ab dem ersten markierten Eintrag am unteren Rand einblendet, die Anzahl nennt und Aufheben sowie Löschen anbietet. Enthält die Auswahl Zählertausche, weist die Leiste deren Zahl gesondert aus.
- [Backend/routers/readings.py] Ergänzt `POST /api/systems/{id}/readings/bulk-delete`. Die Löschung erfolgt in einem Vorgang, da jeder Verbrauchswert sich aus dem Abstand zur Vorablesung ergibt und ein Abbruch mitten in einer Folge von Einzelaufrufen einen widersprüchlichen Bestand hinterlassen würde.
- [Backend/schemas.py] Begrenzt eine Sammellöschung auf tausend Kennungen je Aufruf.

### Changed

- [Frontend/Table] Blendet die Einzelaktionen je Zeile und die aufklappbare Detailzeile im Auswahlmodus aus, da der Klick auf die Zeile dort die Auswahl steuert.
- [Frontend/Table] Verwirft die Auswahl beim Ändern von Filter oder Ausreißer-Einschränkung sowie beim Verlassen des Reiters. Andernfalls blieben Einträge unsichtbar markiert und eine Löschung träfe Datensätze, die gerade niemand sieht.
- [Backend/routers/readings.py] Übergeht beim Sammellöschen Kennungen, die nicht zum System gehören oder nicht bestehen, statt den gesamten Vorgang abzubrechen; die Antwort nennt die tatsächlich gelöschte Anzahl und die verbleibenden Ablesungen.

### Fixed

- [Frontend/app.js] Führt zwei gleichnamige Beobachter für den aktiven Reiter zusammen. In einem Objektliteral überschreibt der zweite Eintrag den ersten stillschweigend, wodurch das Nachladen von Zählern und Tarifen ausgefallen wäre.

---

## [3.3.1] - 2026-07-19

### Fixed

- [Frontend/UI] Vergrößert den Freiraum unterhalb des Inhalts auf schmalen Anzeigen, sodass die schwebende Plus-Schaltfläche die letzte Tabellenzeile und die Blätterleiste nicht mehr verdeckt. Der Wert wird aus Abstand und Höhe der Schaltfläche berechnet statt geschätzt; die bisherigen 170 Pixel lagen unter den benötigten 152 Pixeln zuzüglich Luft.
- [Frontend/UI] Setzt Datums-, Zeit- und Zahlenfelder auf dieselbe Höhe wie Textfelder. Ohne zurückgesetzte Standarddarstellung behalten diese Felder in WebKit ihre eigene Höhe und addieren Innenabstand und Mindesthöhe darauf, wodurch sie auf dem iPhone etwa doppelt so hoch erschienen wie ein danebenliegendes Textfeld.
- [Frontend/UI] Vereinheitlicht die Höhe der Auswahlsegmente. Die Angabe `height: 38px` wurde von der Mindesthöhe aus dem Touch-Layout überstimmt, und umbrechende Beschriftungen ergaben je Schaltfläche eine andere Höhe.
- [Frontend/UI] Stellt die Auswahlsegmente auf ein Raster um. Die Spalten sind gleich breit, die Trennlinien entstehen über den Hintergrund und liegen dadurch auch bei mehrzeiliger Darstellung richtig; zuvor zeichnete der rechte Rand in der zweiten Zeile an der falschen Stelle.
- [Frontend/UI] Stellt die vierteilige Auswahl im Berichtsdialog unterhalb von 720 Pixeln als 2×2-Raster dar, statt sie mit ungleichen Höhen umbrechen zu lassen.
- [Frontend/UI] Reserviert den Platz des Hakens in den Auswahlsegmenten dauerhaft, sodass die Beschriftung beim Aktivieren nicht mehr zur Seite rückt.
- [Frontend/UI] Ordnet die Felder für Von und Bis im Berichtsdialog an der Grundlinie aus und stellt sie unterhalb von 520 Pixeln untereinander.

---

## [3.3.0] - 2026-07-19

### Added

- [Admin-Tools] Ergänzt einen eigenen Menüpunkt in der Seitenleiste, der ausschließlich Administratoren angezeigt und serverseitig auf diese Rolle beschränkt wird. Die Regel steht an erster Stelle der Zugriffstabelle, damit keine spätere Ergänzung sie aufweichen kann.
- [Admin-Tools] Ergänzt eine Diagnoseansicht mit Integritätsprüfung der Datenbank, Fremdschlüsselprüfung, Journal-Modus, Dateigröße einschließlich Write-Ahead-Protokoll, Fragmentierungsgrad sowie dem Zustand von Broker, Sicherung und ausgehenden Verbindungen.
- [Admin-Tools] Ergänzt eine lesende Datenbankabfrage mit Ergebnistabelle, Beispielabfragen und einer Übersicht aller Tabellen samt Spalten und Zeilenzahl.
- [Admin-Tools] Ergänzt eine Protokollansicht der letzten fünfhundert Meldungen der Anwendung, filterbar nach Stufe. Ein Ringpuffer im Prozess ersetzt das Anzapfen der Standardausgabe, die im Container dem Supervisor gehört.
- [Backend/routers/admin.py] Ergänzt `GET /api/admin/diagnostics`, `GET /api/admin/schema`, `GET /api/admin/logs` und `POST /api/admin/query`.

### Security

- [Admin-Tools] Verzichtet bewusst auf einen Endpunkt zur Ausführung beliebiger Befehle. Der Container führt `SUPERVISOR_TOKEN` in der Umgebung; ein solcher Endpunkt entspräche der Ausführung fremden Codes auf dem Host einschließlich Zugriff auf Supervisor-Schnittstelle, Sicherungen und die eingebundenen Verzeichnisse. Da die Oberfläche Bibliotheken über ein Auslieferungsnetz bezieht, genügte dafür eine einzelne Cross-Site-Scripting-Lücke, weil das Sitzungscookie bei jedem Aufruf aus dem Dokument mitgesendet wird. Für Shell-Zugriff ist das Add-on „Advanced SSH & Web Terminal" vorgesehen.
- [Backend/routers/admin.py] Öffnet die Datenbank für Abfragen schreibgeschützt und setzt zusätzlich `query_only`. Selbst bei Umgehung der Textprüfungen weist SQLite jeden Schreibversuch ab.
- [Backend/routers/admin.py] Lässt ausschließlich einzelne Anweisungen zu, die mit `SELECT` oder `WITH` beginnen, und weist verändernde Schlüsselwörter sowie `ATTACH`, `DETACH` und `PRAGMA` ab.
- [Backend/routers/admin.py] Begrenzt Ergebnisse auf fünfhundert Zeilen und bricht Abfragen nach fünf Sekunden über einen Fortschrittsrückruf ab.
- [Backend/routers/admin.py] Ersetzt den Signaturschlüssel der Sitzungen und das Broker-Passwort in Abfrageergebnissen durch eine Platzhalterfolge. Die Ersetzung erfolgt wertbasiert und greift daher auch bei Aliasen, Unterabfragen und Verkettungen. Der Signaturschlüssel erlaubte das Fälschen von Sitzungen für beliebige Konten und geht damit über die Befugnis eines Administrators hinaus.
- [Backend/routers/admin.py] Protokolliert jede Abfrage mit dem ausführenden Konto.

---

## [3.2.2] - 2026-07-19

### Changed

- [Deployment/config.yaml] Hebt die Version auf 3.2.2 an. Der Inhalt entspricht 3.2.1; die Nummer war bereits durch eine unvollständige Auslieferung belegt, in der `app/routers/auth.py` fehlte. Home Assistant vergleicht die Angabe in `config.yaml` mit der installierten Fassung und hätte bei gleicher Nummer kein Update angeboten.

---

## [3.2.1] - 2026-07-19

### Fixed

- [Backend/MQTT] Behebt einen Startabbruch mit `NameError: name 'DEFAULT_INTERVAL' is not defined`. Die in 3.1.0 ergänzten Konstanten für das Speicherintervall standen im Modul unterhalb des Zustandsobjekts, das sie bereits beim Import verwendet; der Rumpf eines Moduls wird jedoch von oben nach unten ausgeführt. Die Konstanten stehen nun vor ihrer ersten Verwendung.

---

## [3.2.0] - 2026-07-18

### Added

- [Backend/RBAC] Ergänzt vier Rollen mit aufsteigender Berechtigung: Gast sieht ausschließlich Auswertungen, Leser sieht alles einschließlich Ausleitungen, Schreiber erfasst Werte und pflegt Systeme, Zähler und Tarife, Administrator verwaltet zusätzlich Einstellungen, Sicherungen, Broker und Konten.
- [Backend/migrations.py] Ergänzt Migration 5, die die Spalte `role` an die Tabelle `users` anfügt und Bestandskonten einordnet: bisherige Administratoren behalten ihre Rechte, alle übrigen erhalten die Rolle Schreiber. Ein pauschales Herabstufen hätte bestehende Installationen lahmgelegt.
- [Backend/routers/auth.py] Ergänzt `GET /api/auth/users` und `PATCH /api/auth/users/{id}` zur Verwaltung von Rolle und Aktivstatus.
- [Backend/routers/auth.py] Ergänzt in `GET /api/auth/status` die aufgelösten Rechte und die verfügbaren Rollen, sodass die Oberfläche ihre Anzeige daraus ableitet, statt eigene Annahmen zu treffen.
- [Backend/routers/settings.py] Ergänzt den Parameter `default_role` für neu übernommene Home-Assistant-Konten.
- [Frontend/UI] Ergänzt die Rollenverwaltung in Sektion A der Einstellungen.

### Security

- [Backend/RBAC] Prüft die Berechtigung in der Middleware statt in den einzelnen Routen. Eine neu hinzugefügte Route ist damit von Beginn an abgedeckt, statt erst durch eine vergessene Absicherung offen zu stehen.
- [Backend/RBAC] Weist verändernde Verfahren für Leser und Gast mit HTTP 403 ab. Die Antwort nennt die erforderliche und die vorhandene Rolle.
- [Backend/RBAC] Beschränkt Einstellungen, Sicherungen, Broker-Verwaltung und Kontenverwaltung auf Administratoren, und zwar auch lesend: die Antwort auf `GET /api/settings` nennt Broker-Host, Benutzernamen und Sicherungspfade.
- [Backend/RBAC] Beschränkt Berichte und Rohdaten-Ausleitung auf die Rolle Leser aufwärts; Gästen bleibt die Ausleitung des Gesamtbestands verwehrt.
- [Backend/RBAC] Beschränkt lesende Aufrufe externer Dienste auf die Rolle Leser aufwärts, da sie ausgehende Verbindungen auslösen.
- [Backend/routers/auth.py] Verhindert, dass der letzte aktive Administrator sich herabstuft oder deaktiviert; andernfalls käme niemand mehr an Einstellungen und Rollenverwaltung.
- [Frontend/UI] Blendet Aktionen ohne Berechtigung vollständig aus, darunter die Plus-Schaltflächen, Bearbeiten und Löschen, Import sowie die Einstellungen. Maßgeblich sind die vom Server gemeldeten Rechte; die Durchsetzung bleibt im Backend.

---

## [3.1.0] - 2026-07-18

### Added

- [Backend/MQTT] Ergänzt ein wählbares Speicherintervall für übernommene Messwerte: täglich, wöchentlich ab Montag, monatlich, quartalsweise und jährlich. Je Periode wird ein Datensatz geführt und innerhalb der laufenden Periode fortgeschrieben.
- [Backend/MQTT] Ergänzt `zusatzfelder["mqtt_interval"]` je System; ohne Eintrag gilt die globale Vorgabe aus den Einstellungen.
- [Backend/routers/mqtt.py] Ergänzt `GET /api/mqtt/intervals` und weist Intervall sowie Herkunft der Einstellung in der Zuordnungstabelle aus.
- [Backend/routers/settings.py] Ergänzt den Parameter `mqtt_interval` mit Prüfung gegen die zulässigen Werte.
- [Frontend/UI] Ergänzt die Auswahl in den MQTT-Einstellungen und im Systemdialog; die Zuordnungstabelle zeigt je System das geltende Intervall und ob es abweichend gesetzt ist.

### Fixed

- [Backend/MQTT] Überschreibt keine von Hand erfassten Ablesungen mehr. Fortgeschrieben werden ausschließlich Datensätze aus der MQTT-Übernahme; liegt für den laufenden Tag bereits eine manuelle Ablesung vor, wird nichts geschrieben. Zwei Datensätze mit gleichem Datum hätten ein Intervall von null Tagen und damit einen unbrauchbaren Tagesverbrauch ergeben.
- [Frontend/UI] Zeigt Auswahlfelder im Systemdialog mit lesbarer Beschriftung an, sofern hinterlegt; zuvor erschien der technische Wert.

---

## [3.0.0] - 2026-07-18

### Added

- [Backend/Auth] Ergänzt die Tabelle `users` mit Benutzername, Anzeigename, Passwort-Hash, externer Kennung, Administratorkennzeichen und Zeitpunkt der letzten Anmeldung. Der Passwort-Hash ist bewusst optional, da Konten aus Home Assistant kein Passwort führen.
- [Backend/migrations.py] Ergänzt Migration 4 und hebt `PRAGMA user_version` auf 4.
- [Backend/Auth] Übernimmt unter Home Assistant die dort bereits erfolgte Anmeldung über die Ingress-Kopfzeilen und legt das zugehörige Konto bei Bedarf an. Eine zweite Anmeldemaske entfällt.
- [Backend/Auth] Ergänzt für den Standalone-Betrieb die Anmeldung mit bcrypt-Hash bei Kostenfaktor 12 und JSON Web Token nach HS256.
- [Backend/routers/auth.py] Ergänzt `GET /api/auth/status`, `POST /api/auth/setup`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me` und `POST /api/auth/password`.
- [Frontend/Auth] Ergänzt Anmeldemaske und Ersteinrichtung sowie die Kontoanzeige mit Abmeldung in Sektion A der Einstellungen.
- [Frontend/Auth] Ergänzt einen zentralen Abfangpunkt im API-Helfer, der eine abgelaufene Sitzung einmal behandelt und die Anmeldung einblendet, statt jede Aufrufstelle einzeln prüfen zu lassen.
- [Deployment/requirements.txt] Ergänzt `bcrypt>=4.1` und `PyJWT>=2.8`.

### Security

- [Backend/Auth] Schützt sämtliche Pfade unter `/api` über eine Middleware. Offen bleiben ausschließlich Health-Check, Statusabfrage, Anmeldung, Abmeldung und Ersteinrichtung.
- [Backend/Auth] Wertet die Ingress-Kopfzeilen nur aus, wenn `SUPERVISOR_TOKEN` gesetzt ist. Ohne diese Bindung könnte im Standalone-Betrieb jeder Aufrufer eine beliebige Identität behaupten, indem er die Kopfzeile selbst setzt.
- [Backend/Auth] Legt das Token in einem Cookie mit `HttpOnly`, `SameSite=Strict` und `Secure` bei HTTPS ab, statt im localStorage. Ein dort abgelegtes Token wäre für jedes Skript im Dokument lesbar; die Oberfläche bindet Bibliotheken über ein Auslieferungsnetz ein, sodass eine einzelne Cross-Site-Scripting-Lücke zum Verlust des Tokens führen würde.
- [Backend/Auth] Erzeugt den Signaturschlüssel je Installation und legt ihn in der Datenbank ab. Ein fest im Quelltext stehender Schlüssel wäre für alle Installationen derselbe.
- [Backend/Auth] Gibt beim Entschlüsseln des Tokens das zulässige Verfahren ausdrücklich an, sodass ein Token mit dem Verfahren `none` abgewiesen wird.
- [Backend/routers/auth.py] Beantwortet unbekannten Benutzernamen und falsches Passwort mit derselben Meldung, damit sich vorhandene Konten nicht über die Antwort ermitteln lassen.
- [Backend/routers/auth.py] Lässt die Ersteinrichtung nur zu, solange kein Konto besteht; andernfalls wäre der Endpunkt eine offene Tür zu einem Administratorkonto.
- [Backend/main.py] Verweigert den Start im Standalone-Betrieb, wenn `bcrypt` oder `PyJWT` fehlen, statt ungeschützt weiterzulaufen.

### BREAKING CHANGES

- Sämtliche API-Pfade erfordern ab dieser Version eine Identität. Unter Home Assistant geschieht das ohne Zutun über Ingress. Im Standalone-Betrieb erscheint beim ersten Aufruf die Ersteinrichtung; bestehende Skripte gegen die API benötigen fortan ein Token in der Kopfzeile `Authorization: Bearer`.
- Das Image muss neu gebaut werden, da `requirements.txt` zwei neue Abhängigkeiten enthält.

---

## [2.21.1] - 2026-07-18

### Fixed

- [Frontend/Tabs] Zeigt die Anzahl in den Reitern Zähler und Tarife bereits beim Laden der Systemansicht an. Bisher war die Beschriftung an den Ladezustand der jeweiligen Liste gebunden, und die wurde erst beim Anklicken des Reiters angefordert; die Zahl erschien deshalb nachträglich.
- [Frontend/Tabs] Trennt die Anzahl vom Ladezustand der Liste. Nach dem Öffnen eines Reiters gilt die geladene Liste als maßgeblich, sodass die Zahl auch nach Anlegen oder Löschen ohne erneuten Dashboard-Aufruf stimmt.

### Changed

- [Backend/API] Ergänzt `GET /api/systems/{id}/dashboard` um den Abschnitt `counts` mit der Anzahl der Zähler und Tarifperioden. Verwendet werden zwei Aggregatabfragen statt der vollständigen Datensätze, da die Oberfläche beim Laden nur die Zahl benötigt; die Listen selbst werden weiterhin erst beim Öffnen des jeweiligen Reiters geladen. Zwei zusätzliche Rundläufe je Systemansicht entfallen damit.

---

## [2.21.0] - 2026-07-18

### Added

- [Frontend/Mobile-Nav] Ergänzt die Systemauswahl auf schmalen Viewports als modales Bottom Sheet. Es listet dieselben Ziele wie die Unterliste der Desktop-Sidebar, jeweils mit Farbpunkt, Typ-Symbol, Name und Einheit, und hebt das geöffnete System hervor.
- [Frontend/Mobile-Nav] Ergänzt im Sheet einen Eintrag für die Übersicht sowie eine Schaltfläche zum Anlegen eines Systems.
- [Frontend/Mobile-Nav] Ergänzt am aktiven Zählwerk-Ziel der unteren Navigationsleiste einen Pfeil als Hinweis darauf, dass sich dort die Auswahl öffnen lässt.
- [Frontend/Mobile-Nav] Schließt das Sheet über Auswahl, Tippen auf den abgedunkelten Hintergrund, die Escape-Taste sowie beim Wechsel auf einen breiten Viewport, wo die Sidebar die Aufgabe übernimmt.

### Changed

- [Frontend/Mobile-Nav] Legt fest, dass ein Tipp auf das Zählwerk-Ziel zunächst zur Übersicht führt und erst ein weiterer Tipp auf das bereits aktive Ziel die Auswahl öffnet. Damit bleibt die Primäraktion des Navigationsziels erhalten, statt hinter einem Overlay zu verschwinden.
- [Frontend/style.css] Führt für das Sheet eigene Regeln ein, statt die Dialogdarstellung aus 2.9.1 mitzunutzen; jene greift erst ab 640 Pixel abwärts, die untere Navigationsleiste erscheint jedoch bereits ab 840 Pixel.

---

## [2.20.0] - 2026-07-18

### Fixed

- [Backend/MQTT] Erkennt Zählerstände nun auch dann, wenn der Gruppenname im Telegramm frei gewählt ist. Beim SML-Skript von Tasmota bestimmt der Anwender diesen Namen selbst, sodass ein Lesekopf beispielsweise unter `MT631.Total_in` veröffentlicht; die bisherige Prüfung fester Pfade wie `ENERGY.Total` konnte das grundsätzlich nicht treffen.
- [Backend/MQTT] Durchsucht die Nutzlast rekursiv bis Ebene sechs nach bekannten Feldnamen: OBIS-Kennzahl `1_8_0`, `Total_in`, `E_in`, `Zaehlerstand`, `Total`, `Counter`, `Verbrauch` und weitere, jeweils mit Rangfolge. Teiltreffer wie `SML_Total` werden nachrangig berücksichtigt.
- [Backend/MQTT] Schließt Felder aus, die sicher kein Zählerstand sind, darunter Momentanleistung, Spannung, Frequenz, Tages- und Vortageswerte, Signalstärke und Einspeisung. Ohne diese Sperre hätte die Suche bei einem Telegramm ohne Zählerstand einen beliebigen Zahlenwert übernommen.
- [Backend/MQTT] Wertet Zahlen aus, die als Zeichenkette mit Einheit vorliegen, etwa `"11265.043 kWh"`, und akzeptiert das Komma als Dezimaltrennzeichen.
- [Backend/MQTT] Verwirft Werte über zehn Millionen; manche Skripte geben Zeitstempel oder Seriennummern als Zahl aus, die sonst als Zählerstand durchgingen.

### Added

- [Backend/MQTT] Protokolliert bei nicht erkanntem Telegramm die vollständige rohe Nutzlast sowie sämtliche gefundenen Zahlenpfade mit Wert. Ohne diese Ausgabe ließ sich nicht bestimmen, auf welchem Pfad der Zählerstand tatsächlich liegt.
- [Backend/MQTT] Führt die rohe Nutzlast und die Zahlenpfade je erkanntem Gerät mit, begrenzt auf viertausend Zeichen.
- [Backend/MQTT] Ergänzt `zusatzfelder["mqtt_path"]` je System sowie `POST /api/mqtt/path`. Ein hinterlegter Pfad hat Vorrang vor der automatischen Erkennung, was mehrdeutige Telegramme auflöst, etwa bei einem Zweirichtungszähler mit Bezug und Einspeisung.
- [Frontend/UI] Zeigt bei nicht erkanntem Gerät die rohe Nutzlast und alle Zahlenfelder mit Wert aufklappbar an; bei mehreren möglichen Feldern wird die getroffene Wahl hervorgehoben.
- [Frontend/UI] Ergänzt das Feld MQTT JSON-Pfad im Systemdialog.

---

## [2.19.1] - 2026-07-18

### Fixed

- [Frontend/Settings] Verschiebt die Schaltflächen Speichern und Verwerfen aus der Karte Anwendungsparameter an das Ende von Sektion A. Sie galten schon bisher für sämtliche Felder der Sektion, standen aber seit den Ergänzungen um Kill-Switch, Sicherung und MQTT mitten auf der Seite und wirkten dadurch, als beträfen sie nur die umgebende Karte.
- [Frontend/Settings] Hält die Leiste über `position: sticky` beim Scrollen am unteren Rand sichtbar; am Seitenende kommt sie in ihrer natürlichen Position zur Ruhe. Anders als ein fest positioniertes Element braucht das keinen von Hand gepflegten Inhaltsabstand und bleibt nicht sichtbar, wenn Sektion B geöffnet ist.
- [Frontend/Settings] Rückt die Leiste auf schmalen Viewports über die untere Navigationsleiste, damit sie nicht darunter liegt.
- [Frontend/Settings] Beziffert die ungespeicherten Änderungen und sperrt das Speichern, solange ein Feld die Prüfung nicht besteht; zuvor führte ein Klick zu einer Fehlermeldung erst nach dem Versuch.
- [Frontend/Settings] Erkennt ein neu eingetragenes MQTT-Passwort als Änderung. Da der Server das Passwort nie zurückgibt, wurde es vom bisherigen Abgleich nicht erfasst und der Speichern-Button blieb gesperrt.

### Changed

- [Frontend/style.css] Kennzeichnet den Zustand der Leiste über die Rahmenfarbe statt über eine Farbfläche, damit die Unterscheidung im Hochkontrast-Theme und bei Farbfehlsichtigkeit erhalten bleibt.

---

## [2.19.0] - 2026-07-18

### Added

- [Backend/Export] Ergänzt `GET /api/export/data.csv`: ein flaches CSV über alle Systeme mit einer Zeile je Ablesung, angereichert um Intervalllänge, Verbrauch, Tagesverbrauch, Ausreißerkennzeichnung sowie erfasste, geschätzte und tarifbasierte Kosten.
- [Backend/Export] Ergänzt `GET /api/export/data.json`: ein vollständiger strukturierter Export mit Systemstammdaten, Zusatzfeldern, Statistik, Zähler-Metadaten, Tarifperioden und Ablesungen. Abgeleitete Werte und Metadaten lassen sich einzeln abwählen.
- [Backend/Export] Führt im JSON-Kopf Format- und Schemaversion, Anwendungsversion, Erstellungszeitpunkt und ausgewerteten Zeitraum mit, sodass ein einlesendes Werkzeug Formatänderungen erkennen kann, statt sie an den Feldern zu erraten.
- [Backend/Export] Ergänzt zwei CSV-Varianten: `de` mit Semikolon, Dezimalkomma und UTF-8-Kennung für Excel, `international` mit Komma und Dezimalpunkt für pandas und R.
- [Backend/Export] Beide Endpunkte übernehmen Zeitraum, Systemauswahl und die Einbeziehung archivierter Systeme aus denselben Parametern wie der PDF-Bericht.
- [Frontend/Export] Ergänzt im Dialog vor dem Export die Formate CSV und JSON samt Variantenwahl und weist aus, welche Formate wieder eingelesen werden können und welche nicht.
- [Frontend/UI] Ergänzt in Sektion A der Einstellungen einen direkten Einstieg in den Rohdaten-Export.

### Changed

- [Backend/version.py] Führt die Anwendungsversion an einer Stelle zusammen; `main.py` und die Laufzeitdiagnose beziehen sie von dort, statt sie jeweils eigenständig zu setzen.
- [Backend/Export] Baut CSV und JSON auf derselben Datenaufbereitung auf, damit beide Formate inhaltlich nicht auseinanderlaufen können.

---

## [2.18.0] - 2026-07-18

### Added

- [Backend/MQTT] Ergänzt einen nativen Tasmota-Parser. Er liest `ENERGY.Total`, `ENERGY.Total_In` und `COUNTER.C1` bis `C4` unmittelbar aus der Telemetrie, sodass kein JSON-Pfad von Hand hinterlegt werden muss. Die in `StatusSNS` verpackte Variante wird ebenfalls erkannt.
- [Backend/MQTT] Gibt dem Tasmota-Parser Vorrang vor der allgemeinen Schlüsselsuche; bei einem Gerät ohne Zählerstand, aber mit anderen Zahlenfeldern hätte diese sonst den falschen Wert übernommen.
- [Backend/MQTT] Ergänzt eine Auto-Discovery über `tele/+/SENSOR` und `tele/+/LWT`. Erkannte Geräte werden mit Topic, letztem Wert, ausgelesenem Pfad, Einheit und Momentanleistung geführt; gespeichert wird erst nach ausdrücklicher Zuordnung zu einem System.
- [Backend/MQTT] Wertet das LWT-Topic für die Online- und Offline-Anzeige je Gerät aus. Da Tasmota diese Nachricht mit Retain-Flag veröffentlicht, liegt der Zustand direkt nach dem Abonnieren vor, auch für Geräte, die gerade nicht senden.
- [Backend/routers/mqtt.py] Ergänzt `GET /api/mqtt/devices`, `POST /api/mqtt/devices/forget` und `POST /api/mqtt/assign`.
- [Backend/routers/settings.py] Ergänzt den Parameter `mqtt_tasmota_discovery` sowie das anpassbare Telemetrie-Präfix.
- [Frontend/UI] Ergänzt den Schalter Tasmota Auto-Discovery, die Geräteliste mit Zustandsanzeige und die Zuordnung eines Geräts zu einem System in einem Schritt.

### Changed

- [Backend/MQTT] Setzt den Standard des Basis-Topics von `zaehlwerk` auf `tele`, den Telemetrie-Präfix von Tasmota.
- [Frontend/style.css] Stellt den Verbindungszustand über gefüllten Punkt, Ring und Umriss dar statt allein über die Farbe, damit die Unterscheidung im Hochkontrast-Theme und bei Farbfehlsichtigkeit erhalten bleibt.

### Security

- [Backend/routers/mqtt.py] Weist die Zuordnung eines Topics ab, das bereits an einem anderen System hängt; derselbe Messwert würde sonst in zwei Zählwerke laufen.
- [Backend/schemas.py] Prüft das zuzuordnende Topic gegen ein Muster ohne Platzhalterzeichen und Leerraum, damit über die Zuordnung kein Wildcard-Abonnement entsteht.

---

## [2.17.0] - 2026-07-18

### Added

- [Backend/MQTT] Ergänzt einen MQTT-Listener auf Basis von `paho-mqtt`, der Zählerstände aus Broker-Nachrichten übernimmt. Der Neuaufbau der Verbindung erfolgt mit wachsendem Abstand über die Bibliothek selbst.
- [Backend/MQTT] Bezieht Host, Port, Benutzer und Passwort über die Supervisor-Schnittstelle `/services/mqtt`, sofern das Mosquitto-Add-on installiert ist; in diesem Fall muss kein Zugangsdatum gespeichert werden. Die manuelle Eingabe bleibt als Rückfallebene für den Standalone-Betrieb.
- [Backend/MQTT] Wertet drei Nutzlastformen aus: reine Zahl, flaches JSON und verschachteltes JSON. Der Schlüsselvergleich erfolgt ohne Rücksicht auf Groß- und Kleinschreibung, sodass unter anderem das Tasmota-Format `{"ENERGY":{"Total":…}}` erkannt wird. Komma als Dezimaltrennzeichen ist zulässig.
- [Backend/MQTT] Ordnet Topics über `zusatzfelder["mqtt_topic"]` einem System zu, analog zur bestehenden `ha_entity`; eine Schemaänderung ist dafür nicht nötig.
- [Backend/routers/mqtt.py] Ergänzt `GET /api/mqtt/status`, `POST /api/mqtt/restart` und `POST /api/mqtt/resubscribe`.
- [Backend/routers/settings.py] Ergänzt die Parameter `mqtt_enabled`, `mqtt_use_supervisor`, `mqtt_host`, `mqtt_port`, `mqtt_username`, `mqtt_password` und `mqtt_base_topic`.
- [Frontend/UI] Ergänzt die MQTT-Konfiguration in Sektion A der Einstellungen samt Verbindungsstatus, Topic-Zuordnung und Protokoll der letzten Ereignisse.
- [Frontend/UI] Ergänzt das Feld MQTT-Topic im Systemdialog.
- [Deployment/config.yaml] Ergänzt `services: mqtt:want`, damit der Supervisor die Zugangsdaten durchreicht; ohne Broker startet das Add-on unverändert.
- [Deployment/requirements.txt] Ergänzt `paho-mqtt>=2.1`.

### Changed

- [Backend/MQTT] Schreibt höchstens eine Ablesung je System und Tag und aktualisiert den Wert des laufenden Tages, statt anzuhängen. Ein Zähler, der im Sekundentakt sendet, würde die Datenbank sonst um Millionen Zeilen erweitern und die auf Intervallen beruhende Auswertung entwerten.
- [Backend/routers/settings.py] Verbindet den Listener nach dem Speichern der Einstellungen neu, sodass Änderungen ohne Neustart des Add-ons greifen.

### Security

- [Backend/routers/settings.py] Gibt das MQTT-Passwort nie zurück. Die Leseantwort meldet über `mqtt_password_set` lediglich, ob eines hinterlegt ist; ein leeres Feld beim Speichern lässt den bestehenden Wert unverändert, statt ihn zu löschen.
- [Backend/MQTT] Verwirft Werte, die unter dem zuletzt erfassten Zählerstand liegen, und protokolliert die Ablehnung. Ein Zählertausch oder eine Fehlmessung gehört von Hand erfasst und darf nicht automatisch in die Verbrauchsrechnung laufen.
- [Frontend/UI] Weist bei manuell eingetragenen Zugangsdaten darauf hin, dass diese unverschlüsselt in der Datenbankdatei liegen.

---

## [2.16.0] - 2026-07-18

### Added

- [Backend/database.py] Ergänzt die Tabelle `tariffs` mit Bezeichnung, Anbieter, Gültigkeitsbeginn und -ende, Arbeitspreis je Einheit und monatlichem Grundpreis. Fremdschlüssel auf `systems.id`, Indizes auf `system_id`, `gueltig_ab` und `gueltig_bis`.
- [Backend/migrations.py] Ergänzt Migration 3, die die Tabelle samt Indizes idempotent anlegt und `PRAGMA user_version` auf 3 hebt.
- [Backend/logic.py] Ergänzt `apply_tariffs()`. Der Verbrauch eines Intervalls wird gleichmäßig über dessen Tage verteilt und tageweise dem jeweils gültigen Tarif zugeordnet; ein Tarifwechsel innerhalb eines Intervalls wird dadurch korrekt aufgeteilt statt mit einem einzigen Preis überschlagen.
- [Backend/logic.py] Ergänzt `tariff_summary()` mit Gesamtkosten, getrennten Anteilen für Arbeits- und Grundpreis, Effektivpreis einschließlich Grundgebühr sowie dem Anteil der Intervalle mit hinterlegtem Tarif.
- [Backend/routers/tariffs.py] Ergänzt `GET`/`POST /api/systems/{id}/tariffs` sowie `PATCH`/`DELETE /api/tariffs/{id}`.
- [Backend/schemas.py] Ergänzt `TariffPlanCreate`, `TariffPlanUpdate` und `TariffPlanRead` mit Prüfung der Datumsreihenfolge und Obergrenzen für beide Preise.
- [Frontend/UI] Ergänzt den Reiter Tarife in der Systemansicht mit Anlegen, Bearbeiten und Löschen sowie Kennzeichnung der aktuell laufenden Periode.
- [Frontend/UI] Ergänzt in der Auswertung die Kacheln Kosten nach Tarif und Effektivpreis; bei unvollständiger Abdeckung wird der Anteil ausgewiesen.

### Changed

- [Backend/logic.py] Führt in `compute_intervals()` zusätzlich Intervalllänge und Datum der Vorablesung mit; beides wird für die Tarifzuordnung benötigt.
- [Backend/routers/readings.py] Reicht die Tarifperioden in die Anreicherung und mischt die Tarifkennzahlen in die Statistik beider Endpunkte.
- [Backend/routers/systems.py] Löscht beim endgültigen Entfernen eines Systems auch dessen Tarifperioden.

### Security

- [Backend/routers/tariffs.py] Weist einander überschneidende Zeiträume je System mit HTTP 409 ab. Ohne diese Prüfung wäre für einen Tag nicht eindeutig, welcher Preis gilt, und die Kostenrechnung würde stillschweigend den zuerst gefundenen Tarif verwenden.

---

## [2.15.0] - 2026-07-18

### Added

- [Frontend/Sidebar] Ergänzt eine aufklappbare Unterliste am Eintrag Zählwerk nach Material-3-Muster. Sie führt alle aktiven Systeme mit Farbpunkt, Name und Einheit auf und springt per Klick direkt in die Detailansicht.
- [Frontend/Sidebar] Trennt Navigation und Aufklappen in zwei Schaltflächen: der Eintrag selbst führt weiterhin zur Übersicht, der Pfeil daneben öffnet und schließt die Unterliste.
- [Frontend/Sidebar] Hebt das gerade geöffnete System in der Unterliste hervor und klappt sie beim Einsprung aus der Übersicht automatisch auf.
- [Frontend/Sidebar] Merkt sich den Auf- und Zuklappzustand in `localStorage` unter `zw_nav_sub`.
- [Frontend/Sidebar] Ergänzt Beschriftungen für Screenreader über `aria-expanded`, `aria-controls` und `role="group"`.

### Changed

- [Frontend/Sidebar] Blendet die Unterliste im eingeklappten Rail-Zustand aus, da dort keine Textbeschriftungen dargestellt werden; der gespeicherte Zustand bleibt erhalten.
- [Frontend/Sidebar] Begrenzt die Höhe der Unterliste auf 46 Prozent der Fensterhöhe mit eigenem Bildlauf, damit Bericht, Einstellungen und Admin-Tools auch bei vielen Systemen erreichbar bleiben.

### Fixed

- [Frontend/UI] Zieht die Beschriftung der Plus-Schaltfläche in der Sidebar auf `fabLabel` nach; die Umstellung aus 2.12.2 hatte diese Stelle übersehen, sodass dort weiterhin „Wert" stand, während der Zähler-Tab aktiv war.

---

## [2.14.0] - 2026-07-18

### Added

- [Backend/database.py] Ergänzt eine automatische tägliche Sicherung der SQLite-Datenbank nach `/backup`, dem Verzeichnis, das Home Assistant in seine eigenen Voll-Sicherungen aufnimmt. Ist `/backup` nicht gemappt, weicht das Modul auf `/share/zaehlwerk-backups` aus, statt den Dienst scheitern zu lassen.
- [Backend/database.py] Erstellt die Sicherung über die Online-Backup-Schnittstelle von SQLite statt über einen Dateikopiervorgang; die Kopie ist auch bei parallelen Schreibzugriffen in sich schlüssig und die Anwendung muss nicht angehalten werden.
- [Backend/database.py] Prüft jede Sicherung mit `PRAGMA integrity_check`, komprimiert sie anschließend und benennt sie erst danach auf den endgültigen Namen um; unvollständige Dateien werden nie sichtbar.
- [Backend/database.py] Ergänzt eine rollierende Bereinigung mit einstellbarer Aufbewahrungsdauer. Sie fasst ausschließlich Dateien des eigenen Namensmusters an und hält stets die drei neuesten Sicherungen vor, auch wenn alle älter als die Aufbewahrungsdauer sind.
- [Backend/routers/backups.py] Ergänzt `GET /api/backup`, `POST /api/backup/run`, `POST /api/backup/prune`, `GET /api/backup/{datei}` und `DELETE /api/backup/{datei}`.
- [Backend/routers/settings.py] Ergänzt die Parameter `backup_enabled`, `backup_time` und `backup_keep_days`; Uhrzeit und Aufbewahrung werden vor dem Speichern geprüft.
- [Frontend/UI] Ergänzt in Sektion A der Einstellungen die Sicherungsverwaltung mit Zeitplan, Aufbewahrung, sofortiger Sicherung, Übersicht der vorhandenen Stände und Download.
- [Deployment/config.yaml] Ergänzt `backup:rw` in der Zuordnung, damit `/backup` im Container verfügbar ist.

### Security

- [Backend/routers/backups.py] Prüft den Dateinamen beim Herunterladen und Löschen gegen das eigene Namensmuster; ohne diese Prüfung wäre der Parameter ein Pfadwechsel auf das Dateisystem des Add-ons.
- [Backend/database.py] Beschränkt die Bereinigung auf Dateien des Musters `zaehlwerk_JJJJMMTT-HHMMSS.db.gz`. In `/backup` liegen die Voll-Sicherungen von Home Assistant; ein unspezifisches Aufräumen nach Alter würde sie mit entfernen.

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

[Unreleased]: https://github.com/leonlange106-lang/energy-tracker/compare/v3.10.0...HEAD
[3.10.0]: https://github.com/leonlange106-lang/energy-tracker/compare/v3.9.0...v3.10.0
[3.9.0]: https://github.com/leonlange106-lang/energy-tracker/compare/v3.8.1...v3.9.0
[3.8.1]: https://github.com/leonlange106-lang/energy-tracker/compare/v3.8.0...v3.8.1
[3.8.0]: https://github.com/leonlange106-lang/energy-tracker/compare/v3.7.0...v3.8.0
[3.7.0]: https://github.com/leonlange106-lang/energy-tracker/compare/v3.6.0...v3.7.0
[3.6.0]: https://github.com/leonlange106-lang/energy-tracker/compare/v3.5.1...v3.6.0
[3.5.1]: https://github.com/leonlange106-lang/energy-tracker/compare/v3.5.0...v3.5.1
[3.5.0]: https://github.com/leonlange106-lang/energy-tracker/compare/v3.4.1...v3.5.0
[3.4.1]: https://github.com/leonlange106-lang/energy-tracker/compare/v3.4.0...v3.4.1
[3.4.0]: https://github.com/leonlange106-lang/energy-tracker/compare/v3.3.1...v3.4.0
[3.3.1]: https://github.com/leonlange106-lang/energy-tracker/compare/v3.3.0...v3.3.1
[3.3.0]: https://github.com/leonlange106-lang/energy-tracker/compare/v3.2.2...v3.3.0
[3.2.2]: https://github.com/leonlange106-lang/energy-tracker/compare/v3.2.1...v3.2.2
[3.2.1]: https://github.com/leonlange106-lang/energy-tracker/compare/v3.2.0...v3.2.1
[3.2.0]: https://github.com/leonlange106-lang/energy-tracker/compare/v3.1.0...v3.2.0
[3.1.0]: https://github.com/leonlange106-lang/energy-tracker/compare/v3.0.0...v3.1.0
[3.0.0]: https://github.com/leonlange106-lang/energy-tracker/compare/v2.21.1...v3.0.0
[2.21.1]: https://github.com/leonlange106-lang/energy-tracker/compare/v2.21.0...v2.21.1
[2.21.0]: https://github.com/leonlange106-lang/energy-tracker/compare/v2.20.0...v2.21.0
[2.20.0]: https://github.com/leonlange106-lang/energy-tracker/compare/v2.19.1...v2.20.0
[2.19.1]: https://github.com/leonlange106-lang/energy-tracker/compare/v2.19.0...v2.19.1
[2.19.0]: https://github.com/leonlange106-lang/energy-tracker/compare/v2.18.0...v2.19.0
[2.18.0]: https://github.com/leonlange106-lang/energy-tracker/compare/v2.17.0...v2.18.0
[2.17.0]: https://github.com/leonlange106-lang/energy-tracker/compare/v2.16.0...v2.17.0
[2.16.0]: https://github.com/leonlange106-lang/energy-tracker/compare/v2.15.0...v2.16.0
[2.15.0]: https://github.com/leonlange106-lang/energy-tracker/compare/v2.14.0...v2.15.0
[2.14.0]: https://github.com/leonlange106-lang/energy-tracker/compare/v2.13.0...v2.14.0
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
