# Installations-Anleitung: Energie-Tracker auf Proxmox

Diese Anleitung führt dich **komplett von null** bis zur laufenden App. Kein Vorwissen zu Docker nötig – einfach Schritt für Schritt. Jeder Befehl ist zum Kopieren.

**Was am Ende läuft:**

```
        Dein Handy / Laptop
                │  (im Heimnetz oder via Tailscale)
                ▼
   ┌─────────────────────────────────┐
   │  Proxmox-Host                    │
   │  └── LXC-Container "energy"      │
   │       └── Docker                 │
   │            ├── app  :8000  ◀── Web-Oberfläche + API
   │            └── influxdb :8086   ◀── Messwert-Datenbank
   └─────────────────────────────────┘
```

**Zeitaufwand:** ~30 Minuten. **Kosten:** 0 €.

---

## Übersicht der Schritte
1. LXC-Container in Proxmox anlegen
2. Nesting aktivieren (Pflicht für Docker)
3. Container starten & Grundpakete installieren
4. Docker installieren
5. Projektdateien in den Container bringen
6. Zugangsdaten (`.env`) anlegen
7. Stack starten
8. App im Browser öffnen & erstes System anlegen
9. Tailscale für sicheren Fernzugriff (empfohlen)
10. Backups einrichten
11. Updates
12. Troubleshooting

---

## Voraussetzungen
- **Proxmox VE 8.x** läuft, du kommst ins Web-Interface (`https://<proxmox-ip>:8006`).
- Ein **LXC-Template für Debian 12** ist verfügbar (laden wir in Schritt 1 sonst herunter).
- Internet auf dem Proxmox-Host (für Downloads).

---

## Schritt 1 – LXC-Container anlegen

### 1a. Debian-12-Template sicherstellen
1. Im Proxmox-Web-UI links den **Storage `local`** anklicken → Reiter **CT Templates**.
2. Button **Templates** → in der Liste `debian-12-standard` suchen → **Download**.
   (Falls schon vorhanden: überspringen.)

### 1b. Container erstellen
Oben rechts **„Create CT"** klicken und diese Werte setzen:

| Reiter | Feld | Wert |
|---|---|---|
| **General** | Hostname | `energy` |
| | Unprivileged container | ✅ **angehakt lassen** |
| | Password | ein sicheres Root-Passwort setzen (merken!) |
| **Template** | Template | `debian-12-standard…` |
| **Disks** | Disk size | **10 GB** |
| **CPU** | Cores | **2** |
| **Memory** | Memory | **1024 MB** (RAM), Swap **512 MB** |
| **Network** | IPv4 | **DHCP** (einfach) *oder* feste IP, wenn du eine willst |
| **DNS** | — | Standard (vom Host übernehmen) |

→ **Finish**. Container **noch nicht starten**.

> Merke dir die **Container-ID** (z. B. `101`) – die brauchst du gleich.

---

## Schritt 2 – Nesting aktivieren (Pflicht für Docker)

Docker läuft in einem unprivilegierten LXC nur mit aktiviertem **Nesting**.

**Variante A (Web-UI):** Container anklicken → **Options** → **Features** → doppelklick → **Nesting** ✅ → OK.

**Variante B (Shell auf dem Proxmox-Host):** ersetze `101` durch deine ID:
```bash
pct set 101 --features nesting=1,keyctl=1
```

Danach den Container **starten** (Rechtsklick → Start).

---

## Schritt 3 – In den Container & Grundpakete

Container anklicken → **Console** öffnen (oder auf dem Host: `pct enter 101`). Als `root` einloggen.

```bash
apt update && apt upgrade -y
apt install -y curl ca-certificates git nano
```

---

## Schritt 4 – Docker installieren

Offizielles Docker-Skript (funktioniert auf Debian 12):
```bash
curl -fsSL https://get.docker.com | sh
```
Prüfen, ob es läuft:
```bash
docker run --rm hello-world
```
→ Wenn „Hello from Docker!" erscheint, passt alles. Falls hier ein Fehler kommt: siehe **Troubleshooting** (meist fehlt Nesting aus Schritt 2).

---

## Schritt 5 – Projektdateien in den Container bringen

Du hast den Ordner `energy-tracker/` (mit `backend/`, `docker-compose.yml`, `.env.example` usw.). Wähle **einen** Weg:

### Weg A – Per Git (wenn du das Projekt in ein Repo gelegt hast)
```bash
cd /opt
git clone <DEINE-REPO-URL> energy-tracker
cd energy-tracker
```

### Weg B – Per SCP von deinem PC (ohne Git)
Auf **deinem eigenen Rechner** (nicht im Container), im Ordner, der `energy-tracker/` enthält:
```bash
# <ip> = IP-Adresse des Containers (in Proxmox unter Summary sichtbar)
scp -r energy-tracker root@<ip>:/opt/
```
Dann zurück in der Container-Konsole:
```bash
cd /opt/energy-tracker
```

### Weg C – Manuell (Notlösung)
Ordner anlegen und Dateien mit `nano` einfügen:
```bash
mkdir -p /opt/energy-tracker && cd /opt/energy-tracker
nano docker-compose.yml   # Inhalt reinkopieren, Strg+O speichern, Strg+X schließen
```
(Für alle Dateien wiederholen – aufwändig, daher lieber Weg A oder B.)

---

## Schritt 6 – Zugangsdaten anlegen (`.env`)

Im Projektordner (`/opt/energy-tracker`):
```bash
cp .env.example .env
```
Sicheren Token erzeugen und direkt anzeigen:
```bash
openssl rand -hex 32
```
Die ausgegebene Zeichenkette kopieren. Dann `.env` öffnen:
```bash
nano .env
```
Und ausfüllen:
- `INFLUX_PASSWORD=` → ein Passwort deiner Wahl (min. 8 Zeichen)
- `INFLUX_TOKEN=` → den eben erzeugten `openssl`-Wert einsetzen

Speichern: **Strg+O**, **Enter**, **Strg+X**.

> ⚠️ Diese Werte werden beim **ersten** Start in InfluxDB festgeschrieben. Später ändern wirkt nicht rückwirkend – dann müsstest du das Volume neu anlegen (siehe Troubleshooting).

---

## Schritt 7 – Stack starten

```bash
cd /opt/energy-tracker
docker compose up -d --build
```
Das dauert beim ersten Mal 1–3 Minuten (Image-Build). Status prüfen:
```bash
docker compose ps
```
Beide Dienste sollten **running** / **healthy** sein. Logs bei Bedarf:
```bash
docker compose logs -f app
```
(Mit **Strg+C** verlässt du die Log-Ansicht, der Dienst läuft weiter.)

---

## Schritt 8 – App öffnen & erstes System

IP des Containers herausfinden (falls unbekannt):
```bash
hostname -I
```
Im Browser öffnen:
```
http://<container-ip>:8000
```
Du siehst die leere Oberfläche. Jetzt:
1. **＋ System** klicken → z. B. Name „Strom Hauptzähler", Typ **Strom**, Farbe wählen → **Speichern**.
2. Ins System klicken → **＋ Neuer Wert** → Zählerstand + Datum → **Speichern**.
3. **Historie importieren:** im System → **⇪ Import** → **Vorlage herunterladen**, deinen Google-Sheets-Export ins Vorlagenformat bringen (`datum, wert, kosten, zaehlertausch, notiz`) → hochladen.

**Swagger-API-Doku** (für Tests/Debug): `http://<container-ip>:8000/docs`

---

## Schritt 9 – Tailscale (sicherer Fernzugriff, empfohlen)

Damit erreichst du die App von unterwegs, **ohne** Ports am Router zu öffnen.

Im Container:
```bash
curl -fsSL https://tailscale.com/install.sh | sh
tailscale up
```
Es erscheint ein Login-Link → im Browser öffnen, mit deinem Tailscale-Konto bestätigen. Danach:
```bash
tailscale ip -4
```
Die App ist dann über diese Tailscale-IP erreichbar: `http://<tailscale-ip>:8000` – auch mobil, überall.

> Optional mit MagicDNS: `http://energy:8000`. Kein Auth in der App nötig, weil der Zugang bereits über dein privates Tailnet abgesichert ist (genau wie geplant).

---

## Schritt 10 – Backups

Es gibt zwei Datentöpfe: **SQLite** (deine Systeme) und **InfluxDB** (die Messwerte). Beide liegen in Docker-Volumes.

### Bequemster Weg: Proxmox-Snapshot des ganzen Containers
Proxmox-Web-UI → Container → **Backup** → **Backup now** (Storage wählen, Modus „Snapshot"). Oder unter **Datacenter → Backup** einen automatischen Zeitplan (z. B. wöchentlich) einrichten. Das sichert alles inkl. Volumes.

### Zusätzlich (granular) im Container
```bash
# SQLite-Datei sichern
docker run --rm -v energy-tracker_app-data:/data -v /root/backups:/backup \
  alpine sh -c "cp /data/systems.db /backup/systems-$(date +%F).db"

# InfluxDB sichern
docker exec -it energy-tracker-influxdb-1 influx backup /var/lib/influxdb2/backup-$(date +%F)
```
(Volume-/Container-Namen ggf. mit `docker volume ls` bzw. `docker ps` prüfen.)

---

## Schritt 11 – Updates

Bei neuen Projektständen:
```bash
cd /opt/energy-tracker
git pull            # nur bei Weg A; sonst neue Dateien per SCP kopieren
docker compose up -d --build
```
Deine Daten bleiben erhalten (liegen in den Volumes, nicht im Image).

---

## Schritt 12 – Troubleshooting

| Symptom | Ursache / Lösung |
|---|---|
| `docker run hello-world` schlägt fehl, „operation not permitted" | **Nesting** nicht aktiv. Schritt 2 nachholen, Container neu starten. Zusätzlich hilft oft `pct set <ID> --features nesting=1,keyctl=1`. |
| App-Container startet, aber `/api/health` zeigt `"influx": false` | InfluxDB noch am Hochfahren (Healthcheck abwarten) **oder** Token in `.env` stimmt nicht mit dem überein, mit dem Influx initialisiert wurde. |
| Token/Passwort in `.env` geändert, aber Login klappt nicht | Init-Werte gelten nur beim **ersten** Start. Zum Zurücksetzen (⚠️ löscht Messwerte): `docker compose down` → `docker volume rm energy-tracker_influx-data energy-tracker_influx-config` → `docker compose up -d`. |
| Browser lädt Oberfläche nicht / leere Seite | Läuft die App? `docker compose ps` + `docker compose logs app`. Richtiger Port `:8000`? Firewall (Proxmox-Datacenter/Node/CT-Ebene) prüfen. |
| Charts/Oberfläche bleiben leer trotz laufender App | Vue/Chart.js werden per CDN geladen – ohne Internet im Container klappt das nicht. Siehe **Offline-Betrieb** unten. |
| „Wert kleiner als letzter Wert" beim Speichern | Plausibilitätsprüfung. Bei echtem **Zählertausch** die Checkbox setzen (neuer Zähler startet bei 0). |
| Container hat keine Internet-/DNS-Verbindung | DNS im CT prüfen (`cat /etc/resolv.conf`), ggf. auf deinen AdGuard/Router zeigen lassen. |

### Offline-Betrieb (kein Internet im Container)
Standardmäßig lädt das Frontend **Vue** und **Chart.js** per CDN. Für 100 % lokalen Betrieb:
1. Die zwei Dateien einmalig herunterladen und nach `backend/frontend/vendor/` legen:
   - `vue.global.prod.js` (von jsdelivr, Version 3.4.38)
   - `chart.umd.min.js` (von jsdelivr, Chart.js 4.4.3)
2. In `backend/frontend/index.html` die zwei `<script src="https://cdn.jsdelivr.net/…">` auf `src="/vendor/vue.global.prod.js"` bzw. `src="/vendor/chart.umd.min.js"` umstellen.
3. `docker compose up -d --build`.

---

## Nützliche Befehle (Spickzettel)

```bash
docker compose ps              # Status
docker compose logs -f app     # App-Logs live
docker compose logs -f influxdb
docker compose restart app     # nur App neu starten
docker compose down            # Stack stoppen (Daten bleiben)
docker compose up -d --build   # bauen + starten
docker stats                   # Ressourcenverbrauch live
```

## Links
- Proxmox LXC-Doku: https://pve.proxmox.com/wiki/Linux_Container
- Docker (offizielles Install-Skript): https://get.docker.com
- Docker Compose Referenz: https://docs.docker.com/compose/
- InfluxDB 2.x Docker: https://hub.docker.com/_/influxdb
- Tailscale: https://tailscale.com/kb/1085/deploy-and-configure/
