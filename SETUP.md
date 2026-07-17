# Einrichtung: Zählwerk als HA-Add-on-Repository (mit Auto-Update)

Ab jetzt läuft Zählwerk als **Add-on-Repository** statt als lokales Add-on. Vorteil: **Home Assistant erkennt neue Versionen selbst**, zeigt einen Update-Button und kann automatisch aktualisieren. Dein einziger Aufwand pro Update: ein Doppelklick auf `deploy.ps1` am PC.

```
  PC:  Claude baut  ->  deploy.ps1 (1 Klick: push)  ->  GitHub
  HA:  erkennt neue Version  ->  Update-Button / Auto-Update  ->  fertig
```

---

## Einmalige Einrichtung

### 1. Repo auf GitHub „public" stellen
HA kann **private** Repos nicht als Add-on-Quelle klonen. Das ist unkritisch: Im Code sind **keine Geheimnisse** (die `.env` ist per `.gitignore` ausgeschlossen, es gibt keine Tokens/Passwörter im Repo – Zählwerk ist zero-config).

GitHub → dein Repo → **Settings** → ganz unten **Change visibility** → **Public**.

### 2. Repository in HA hinzufügen
HA → **Einstellungen → Add-ons → Add-on Store** → oben rechts **⋮ → Repositories** → URL eintragen:
```
https://github.com/leonlange106-lang/energy-tracker
```
→ **Hinzufügen**. Nach kurzem Laden erscheint im Store der Bereich **„Zählwerk Add-ons"** mit dem Add-on **Zählwerk**.

### 3. Installieren & starten
Add-on **Zählwerk** → **Installieren** (baut das Image) → **Starten** → **„In Seitenleiste anzeigen"** aktivieren.

> Das ist ein **neues** Add-on (eigener Slug `zaehlwerk`). Die Daten liegen jetzt persistent in `/share/zaehlwerk/` und überstehen künftige Updates **und** Add-on-Wechsel.

### 4. Daten einspielen
Systemliste ist leer → 3 Systeme neu anlegen (Strom kWh, Gas m³, Wasser m³) → pro System **⇪ Import** mit den 3 CSVs → die handgetippten Werte nachtragen.

### 5. Auto-Update aktivieren (optional, empfohlen)
Im Add-on **Zählwerk** → Reiter **Info** → Schalter **„Auto-Update"** an. HA installiert neue Versionen dann beim periodischen Check automatisch und meldet sie über die Update-Entität (kannst du im Dashboard/Benachrichtigungen einbinden).

### 6. Altes Add-on entfernen
Das alte **lokale** Add-on (Slug `energy_tracker`, InfluxDB-Version) → **Deinstallieren**. Erst prüfen, dass in der neuen Zählwerk-Instanz alle Werte korrekt sind. Danach kann auch der **LXC** weg.

---

## Der neue Update-Ablauf (nach der Einrichtung)

Wenn eine neue Version kommt (Claude hat gebaut, du hast das ZIP):

**PC – ein Befehl:**
```powershell
.\deploy.ps1 -Zip "$HOME\Downloads\energy-tracker.zip"
```
Das entpackt das ZIP, spiegelt es sauber ins Repo (entfernt auch alte Dateien), committet und pusht. Die Version wird aus `zaehlwerk/config.yaml` gelesen.

**HA:** erkennt die neue Version automatisch → **Update** klicken (oder nichts tun, wenn Auto-Update an ist). `/share/zaehlwerk/` bleibt erhalten – keine Datenmigration mehr nötig.

> Wichtig: Bei jedem inhaltlichen Update erhöht Claude die `version` in `zaehlwerk/config.yaml` – nur dann zeigt HA ein Update an.

---

## Standalone ohne HA (optional)
```bash
docker compose up -d --build   # baut ./zaehlwerk, DB unter /data
```
