# Home-Assistant-Integration (Weg 2a) + PDF-Bericht

Ziel: Die App läuft als **HA-Add-on mit Ingress** → erscheint als Menüpunkt **„Energie"** in der HA-Sidebar und der **HA-App**, Werte direkt dort nachpflegen. **InfluxDB bleibt im LXC** (minimal-invasiv). PDF-Export ist eingebaut.

```
   HA-App / Sidebar  ──(Ingress)──►  Add-on "Energie-Tracker" (FastAPI+UI)
   [HAOS 192.168.178.43]                       │
                                               ▼  (InfluxDB-Token, LAN)
                                     LXC "energy"  ──►  InfluxDB :8086
```

---

## Architektur-Hinweis vorab (wichtig!)
- **Messwerte** (InfluxDB) sind geteilt → bleiben im LXC.
- **Systeme/Stammdaten** (SQLite) liegen **pro App-Instanz getrennt**. Das Add-on startet also mit **leerer Systemliste**.
- Da du bisher nur **Testdaten** hast: Systeme im Add-on **neu anlegen** und die echte Historie **dort** per CSV importieren. Die Test-Einträge aus der LXC-App kannst du ignorieren.
- (Fortgeschritten: Wenn du später doch echte Daten in der LXC-App hättest, müsste man `systems.db` mitkopieren, damit die `system_id`s zusammenpassen — sag Bescheid, falls nötig.)

---

## Schritt 1 – InfluxDB im LXC fürs LAN öffnen

Damit das Add-on (anderer Host) die DB erreicht. In der **LXC-Konsole**:
```bash
cd /opt/energy-tracker
git pull
docker compose up -d
```
Die aktualisierte `docker-compose.yml` bindet InfluxDB jetzt auf `8086:8086` (statt nur localhost). Daten bleiben erhalten (Volume). Prüfen:
```bash
docker compose ps        # influxdb weiterhin healthy
hostname -I              # <-- LXC-IP notieren (z.B. 192.168.178.50)
grep INFLUX_TOKEN .env   # <-- Token notieren (brauchst du in Schritt 4)
```

---

## Schritt 2 – Add-on-Dateien nach HA bringen

Die Add-on-Dateien liegen im Repo unter `ha-addon/energy_tracker/`. Sie müssen nach **`/addons/energy_tracker/`** in HA.

**Weg über Terminal & SSH** (Add-on hast du installiert). Analog zum LXC per Deploy Key:
```bash
# im HA-Terminal
ssh-keygen -t ed25519 -C "energy-ha" -f ~/.ssh/id_ed25519 -N ""
cat ~/.ssh/id_ed25519.pub
```
→ diese Zeile als **zweiten Deploy Key** im Repo hinterlegen (GitHub → Repo → Settings → Deploy keys → Add, ohne Write-Access). Dann:
```bash
cd /addons
git clone git@github.com:leonlange106-lang/energy-tracker.git _src
cp -r _src/ha-addon/energy_tracker /addons/energy_tracker
rm -rf _src
ls /addons/energy_tracker      # config.yaml, Dockerfile, run.sh, app/, frontend/ ...
```
> Kein Git im HA-Terminal? Alternativ die Dateien per SCP von deinem PC nach `/addons/energy_tracker/` kopieren.

---

## Schritt 3 – Add-on installieren

1. HA → **Einstellungen** → **Add-ons** → **Add-on Store**.
2. Oben rechts **⋮** → **Repositories neu laden** (bzw. Seite neu laden).
3. Ganz unten erscheint der Abschnitt **„Lokale Add-ons"** mit **„Energie-Tracker"**.
4. Anklicken → **Installieren** (baut das Image, 1–3 Min).

---

## Schritt 4 – Verbindung konfigurieren

Im Add-on den Reiter **Konfiguration**:
```yaml
influx_url: "http://192.168.178.50:8086"   # <-- deine LXC-IP aus Schritt 1
influx_token: "<Token aus der LXC .env>"    # <-- exakt derselbe Token
influx_org: "energy"
influx_bucket: "readings"
```
**Speichern.**

---

## Schritt 5 – Starten & öffnen

1. Reiter **Info** → **Starten**.
2. **„In Seitenleiste anzeigen"** aktivieren.
3. Reiter **Protokoll** kurz prüfen: uvicorn startet, keine Fehler.
4. In der Sidebar erscheint **„Energie"** → anklicken. Die App lädt eingebettet — auch in der **HA-App** auf dem Handy.

**Funktionstest:** System anlegen → Wert erfassen → speichern. Wenn der Wert bleibt, steht die Kette **Add-on → InfluxDB(LXC)**.

---

## PDF-Bericht

In jedem System oben rechts **⇩ PDF-Bericht**. Erzeugt für den aktuell gewählten Zeitraum einen PDF mit Statistik-Kacheln, Verbrauchs-Chart (Ausreißer amber) und der Werte-Tabelle. Öffnet im Browser-Tab → speichern/teilen.

---

## Schritt 6 – LXC-App abschalten (optional)

Die UI läuft jetzt im Add-on, den `app`-Container im LXC brauchst du nicht mehr (InfluxDB muss weiterlaufen):
```bash
cd /opt/energy-tracker
docker compose stop app
```
InfluxDB (`docker compose ps` → influxdb) bleibt aktiv. Rückgängig: `docker compose start app`.

---

## Updates einspielen

Wenn sich der App-Code ändert:
```bash
# auf dem PC (Repo-Root): App-Stand ins Add-on-Paket spiegeln
sh ha-addon/sync.sh
git add . && git commit -m "update" && git push
```
```bash
# im HA-Terminal: neuen Stand holen
cd /addons && rm -rf _src && git clone git@github.com:leonlange106-lang/energy-tracker.git _src
cp -r _src/ha-addon/energy_tracker/* /addons/energy_tracker/ && rm -rf _src
```
Dann im Add-on: **neu bauen** (Add-on → ⋮ → **Rebuild**) → **Starten**. `/data` (SQLite) bleibt erhalten.

---

## Troubleshooting

| Symptom | Ursache / Lösung |
|---|---|
| Add-on startet, UI zeigt „influx: false" / keine Werte | `influx_url` (LXC-IP + `:8086`) oder `influx_token` falsch. LXC-Port offen? (`docker compose ps` im LXC → `0.0.0.0:8086`) |
| „Energie" nicht in Sidebar | Add-on gestartet? „In Seitenleiste anzeigen" aktiv? Seite neu laden. |
| UI lädt, aber CSS/Chart fehlen | Frontend nutzt relative Pfade für Ingress — sicherstellen, dass der **aktuelle** Stand deployt ist (Rebuild). |
| Add-on erscheint nicht unter „Lokale Add-ons" | Liegt `config.yaml` direkt in `/addons/energy_tracker/`? Store neu laden. |
| Systemliste im Add-on leer, obwohl im LXC angelegt | Erwartet — SQLite ist pro Instanz. Systeme im Add-on neu anlegen (siehe Architektur-Hinweis). |
| Influx im LXC nach `up -d` „unhealthy" | kurz warten; Logs: `docker compose logs influxdb`. |
