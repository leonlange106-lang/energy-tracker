/* =========================================================================
   Zählwerk – Frontend (Vue 3, ohne Build-Step)
   ========================================================================= */
const { createApp, reactive } = Vue;

/* ---------- Version & Changelog ---------- */
const APP_VERSION = "3.3.0";
const APP_CHANGELOG = [
  { v: "3.3.0", d: "19.07.2026", items: [
    "Admin-Tools: Diagnose, lesende Datenbankabfrage, Anwendungsprotokoll",
    "Nur für Administratoren, serverseitig durchgesetzt",
    "Kein Shell-Zugang – dafür ist das Add-on „Advanced SSH & Web Terminal\" vorgesehen",
  ]},
  { v: "3.2.2", d: "19.07.2026", items: [
    "Erneute Auslieferung des 3.2.1-Standes unter neuer Nummer",
  ]},
  { v: "3.2.1", d: "19.07.2026", items: [
    "Startabbruch behoben: Modulkonstante wurde vor ihrer Definition verwendet",
    "Auslieferung als vollständiges Paket statt Einzeldateien",
  ]},
  { v: "3.2.0", d: "18.07.2026", items: [
    "Rollen: Administrator, Schreiber, Leser, Gast",
    "Verändernde Aufrufe werden für Leser und Gast serverseitig abgewiesen",
    "Oberfläche blendet Aktionen ohne Berechtigung aus",
    "Rollenverwaltung in den Einstellungen",
  ]},
  { v: "3.1.0", d: "18.07.2026", items: [
    "MQTT-Speicherintervall wählbar: täglich, wöchentlich, monatlich, quartalsweise, jährlich",
    "Je System abweichend einstellbar, sonst gilt die globale Vorgabe",
    "Von Hand erfasste Ablesungen werden nie durch MQTT überschrieben",
  ]},
  { v: "3.0.0", d: "18.07.2026", items: [
    "Benutzerkonten und Anmeldung; alle API-Pfade sind geschützt",
    "Unter Home Assistant übernimmt Zählwerk die dortige Anmeldung – kein zweiter Login",
    "Standalone: bcrypt-Passwörter, JWT im HttpOnly-Cookie, Ersteinrichtung beim ersten Start",
  ]},
  { v: "2.21.1", d: "18.07.2026", items: [
    "Reiter „Zähler\" und „Tarife\" zeigen ihre Anzahl schon beim Laden der Seite",
    "Anzahlen kommen aus dem Dashboard-Request – keine zusätzlichen Abfragen",
  ]},
  { v: "2.21.0", d: "18.07.2026", items: [
    "Mobile Systemauswahl als Modal Bottom Sheet über die untere Navigationsleiste",
    "Tipp auf das bereits aktive Zählwerk-Ziel öffnet die Liste, sonst führt er zur Übersicht",
    "Gleiche Sprungziele wie in der Desktop-Sidebar",
  ]},
  { v: "2.20.0", d: "18.07.2026", items: [
    "SML-Telegramme werden erkannt, auch wenn der Gruppenname frei gewählt ist",
    "Rohdaten und alle Zahlenpfade werden bei nicht erkanntem Telegramm angezeigt",
    "JSON-Pfad je System festlegbar – schlägt die automatische Erkennung",
  ]},
  { v: "2.19.1", d: "18.07.2026", items: [
    "Speichern-Leiste am Ende der Einstellungen statt mitten auf der Seite",
    "Bleibt beim Scrollen am unteren Rand sichtbar und zeigt die Zahl der Änderungen",
    "Speichern gesperrt, solange ein Feld fehlerhaft ist",
  ]},
  { v: "2.19.0", d: "18.07.2026", items: [
    "Rohdaten-Export als flaches CSV über alle Systeme und als strukturiertes JSON",
    "CSV wahlweise für Excel (Semikolon, Dezimalkomma, BOM) oder pandas/R",
    "Beide Formate mit Verbrauch, Tagesverbrauch, Ausreißern und Kosten",
  ]},
  { v: "2.18.0", d: "18.07.2026", items: [
    "Tasmota nativ: ENERGY.Total, Total_In und COUNTER.C1 ohne manuelle JSON-Pfade",
    "Auto-Discovery über tele/+/SENSOR mit Geräteliste und Ein-Klick-Zuordnung",
    "Online-/Offline-Anzeige je Gerät über das LWT-Topic",
  ]},
  { v: "2.17.0", d: "18.07.2026", items: [
    "MQTT-Ingestion: Zählerstände aus Broker-Nachrichten übernehmen",
    "Zugangsdaten kommen vom Mosquitto-Add-on – kein Passwort nötig",
    "Höchstens eine Ablesung je System und Tag; Werte laufen nie rückwärts",
    "Topic je System im Bearbeiten-Dialog, Ereignisprotokoll in den Einstellungen",
  ]},
  { v: "2.16.0", d: "18.07.2026", items: [
    "Tarifperioden je System: Arbeitspreis, Grundgebühr, Gültigkeitszeitraum",
    "Kostenrechnung tageweise – ein Tarifwechsel mitten im Intervall wird korrekt aufgeteilt",
    "Effektivpreis inklusive Grundgebühr in der Auswertung",
  ]},
  { v: "2.15.0", d: "18.07.2026", items: [
    "Sidebar: „Zählwerk\" lässt sich aufklappen und listet alle aktiven Systeme",
    "Direkter Sprung in ein System aus der Sidebar, aktives System hervorgehoben",
    "Pfeil klappt auf, der Eintrag selbst führt weiterhin zur Übersicht",
  ]},
  { v: "2.14.0", d: "18.07.2026", items: [
    "Tägliche automatische Sicherung der Datenbank nach /backup",
    "Konsistent trotz laufender Schreibzugriffe (SQLite Online-Backup + Integritätsprüfung)",
    "Rollierende Bereinigung; die drei neuesten Sicherungen bleiben immer erhalten",
    "Manuelle Sicherung und Download in den Einstellungen",
  ]},
  { v: "2.13.0", d: "18.07.2026", items: [
    "Bericht öffnet einen Konfigurationsdialog statt sofort zu exportieren",
    "Zeitraum-Vorauswahl, System-Checkboxen, Diagramm/Tabelle abwählbar",
    "PDF übernimmt auf Wunsch die App-Farben; Diagramme je System in Systemfarbe",
  ]},
  { v: "2.12.2", d: "18.07.2026", items: [
    "Tabs schließen sich gegenseitig aus – Werte und Zähler wurden gleichzeitig angezeigt",
    "FAB passt sich dem aktiven Tab an (Zähler statt Ablesung)",
  ]},
  { v: "2.12.1", d: "18.07.2026", items: [
    "Nur noch eine Navigation je Viewport: mobil Bottom-Bar, Desktop Sidebar",
    "Kamera-Button im Ablesedialog wieder quadratisch und mittig zum Eingabefeld",
  ]},
  { v: "2.12.0", d: "18.07.2026", items: [
    "Internet-Kill-Switch: sperrt ausgehende Verbindungen auf Socket-Ebene, Standard ist gesperrt",
    "Optionale externe Daten: Wetter (Open-Meteo) und Day-Ahead-Preise (aWATTar)",
    "Anbieter-Allowlist fest im Code, keine Schlüssel, keine frei setzbaren URLs",
    "Offline fehlertolerant: zwischengespeicherte Daten bleiben abrufbar",
  ]},
  { v: "2.11.0", d: "18.07.2026", items: [
    "Zähler-Tab: Metadaten aus 2.10.0 endlich in der Oberfläche pflegbar",
    "Hardware-Empfehlung je Zähler (Hichi IR, Reed-Kontakt, AI-on-the-edge, wM-Bus …)",
    "Live-Vorschau der Empfehlung schon beim Eintippen der Bauart",
    "Eichfrist-Badge je Zähler",
  ]},
  { v: "2.10.1", d: "18.07.2026", items: [
    "Systemverwaltung wieder erreichbar: „✎ Bearbeiten\" in der Systemansicht",
    "Systeme endgültig löschbar – der Button fehlte seit 2.4.0",
    "Kachelwerte und Fälligkeits-Badges aktualisieren sich nach dem Erfassen sofort",
  ]},
  { v: "2.10.0", d: "18.07.2026", items: [
    "Zähler-Metadaten: Hersteller, Modell, Zählernummer, Bauart, Eichfrist je System",
    "Eichfristen-Übersicht über die API",
    "Zähler-Metadaten im Gesamt-Export enthalten",
  ]},
  { v: "2.9.1", d: "18.07.2026", items: [
    "Dialoge auf dem Handy als Bottom-Sheet mit feststehender Aktionsleiste",
    "Alle Trefferflächen auf 48 px, Formularfelder auf 16 px (kein iOS-Auto-Zoom mehr)",
    "Ablesedialog: Zählerstand steht zuoberst, Scanner-Button vergrößert",
    "Layout springt nicht mehr bei Tastatur, Scrollbar oder Validierungsmeldung",
  ]},
  { v: "2.9.0", d: "18.07.2026", items: [
    "Einstellungen als eigene Seite mit Sektion A (System) und B (Web-App)",
    "Serverseitige Anwendungsparameter: Benachrichtigungsintervall, Standard-Ableseintervall, Ausreißer-Schwelle",
    "Schema-Migrationen über PRAGMA user_version",
    "Laufzeit- und Datenbankdiagnose (read-only)",
    "Import/Export direkt in der Systemansicht statt in den Einstellungen",
  ]},
  { v: "2.8.0", d: "18.07.2026", items: [
    "Freie Farbwahl je System zusätzlich zu den acht Presets",
    "Diagrammfarben für Ausreißer, Gitternetz und Achsen in den Einstellungen konfigurierbar",
    "Kontrastwarnung bei schwer erkennbaren Farben (WCAG-Verhältnis unter 3:1)",
  ]},
  { v: "2.7.0", d: "18.07.2026", items: [
    "Wählbare Farbpaletten: Teal, Indigo, Ember – unabhängig vom Hell-/Dunkel-Modus",
    "Hochkontrast-Theme (WCAG AAA) für beide Modi und alle Paletten",
    "Sichtbarer Fokusring auf allen bedienbaren Elementen",
    "Systempräferenz „prefers-contrast\" wird automatisch übernommen",
  ]},
  { v: "2.6.0", d: "18.07.2026", items: [
    "Einklappbare Navigations-Sidebar (Rail 80px ↔ Drawer 264px), Zustand bleibt gespeichert",
    "Mobile: Sidebar als modaler Drawer mit Scrim über den Menü-Button in der Top-App-Bar",
    "Navigationsziele Zählwerk, Bericht, Einstellungen und Admin-Tools (Platzhalter)",
  ]},
  { v: "2.5.1", d: "17.07.2026", items: [
    "OCR anhand echter Zählerfotos kalibriert: adaptiver Otsu-Threshold, PSM-6-Segmentierung, Mehrfach-Pass",
    "Realistischere Scanner-Hinweise (Beta)",
  ]},
  { v: "2.5.0", d: "17.07.2026", items: [
    "HA-Benachrichtigung bei überfälliger Ablesung (persistent, verschwindet nach Ablesung automatisch)",
    "Gesamt-Export: alle Systeme als CSV + Systemkonfiguration in einem ZIP",
    "Einheiten-Umrechnung für HA-Sensoren (Wh/kWh/MWh, L/m³) mit wählbarer Quelleinheit",
    "Löschen-Buttons ans UI-Design angeglichen (Pill-Form)",
    "Chart: X-Labels dünnen ab 40 Punkten automatisch aus",
  ]},
  { v: "2.4.0", d: "17.07.2026", items: [
    "Löschen überarbeitet: 3-Sekunden-Halten mit Fortschritts-Outline + Bestätigung",
    "Systeme endgültig löschbar (Falschanlage) inkl. aller Ablesungen",
    "Zählerstand-Übernahme aus Home Assistant (Entity pro System konfigurierbar)",
    "Versionsverlauf in den Optionen", "Foto-Scanner als Beta markiert", "Fälligkeit ab 2 Monaten in Monaten angezeigt",
  ]},
  { v: "2.3.x", d: "17.07.2026", items: [
    "Material-Design-3-Redesign (Farben, Typografie, Navigation Rail/Bottom-Bar, FAB, Ripple)",
    "Ablesungen bearbeitbar", "Zählertausch: Endstand alt + Startstand neu am selben Tag",
    "Foto-Scan: 7-Segment-Modell, Galerie-Upload mit EXIF-Datum", "Diverse Mobile-Fixes",
  ]},
  { v: "2.2.0", d: "17.07.2026", items: [
    "Ø-Preis pro System (Kostenschätzung, als ≈ markiert)", "Ablese-Intervall pro System",
    "SQLite-WAL + DB im HA-Backup (/config)", "Dashboard-Endpoint (1 Request statt 3)", "OCR-Scanner (Beta)",
  ]},
  { v: "2.1.0", d: "16.07.2026", items: ["HA-Add-on-Repository mit Auto-Update", "Ein-Klick-Deploy (deploy.ps1)"] },
  { v: "2.0.0", d: "16.07.2026", items: ["Standalone: InfluxDB durch SQLite ersetzt, LXC überflüssig"] },
  { v: "1.x", d: "15.07.2026", items: ["Erstversion: FastAPI + InfluxDB + Vue 3, CSV-Import, PDF-Berichte, Dark Mode"] },
];

/* ---------- Theme (Light/Dark, System-follow + manuell) ---------- */
/* Drei unabhaengige Achsen: Modus (hell/dunkel/auto), Palette, Kontrast.
   Alle drei werden als data-Attribute am <html> gesetzt; das CSS kombiniert sie. */
const PALETTES = [
  { key: "teal",   label: "Teal",   swatch: "#00696F" },
  { key: "indigo", label: "Indigo", swatch: "#4A5C92" },
  { key: "ember",  label: "Ember",  swatch: "#984716" },
];
const CONTRASTS = [
  { key: "standard", label: "Standard" },
  { key: "high",     label: "Hoher Kontrast" },
];
const themeStore = reactive({
  mode:     localStorage.getItem("zw_theme") || "auto",
  palette:  localStorage.getItem("zw_palette") || "teal",
  contrast: localStorage.getItem("zw_contrast") || "standard",
  dark: false,
});
function applyTheme() {
  const sysDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const sysContrast = window.matchMedia("(prefers-contrast: more)").matches;
  themeStore.dark = themeStore.mode === "dark" || (themeStore.mode === "auto" && sysDark);
  const el = document.documentElement;
  el.setAttribute("data-theme", themeStore.dark ? "dark" : "light");
  el.setAttribute("data-palette", themeStore.palette);
  // Systemweite Kontrastpraeferenz gewinnt, wenn der Nutzer nichts Eigenes gewaehlt hat
  el.setAttribute("data-contrast",
    themeStore.contrast === "standard" && sysContrast ? "high" : themeStore.contrast);
}
function setTheme(mode) {
  themeStore.mode = mode;
  localStorage.setItem("zw_theme", mode);
  applyTheme();
}
function setPalette(key) {
  themeStore.palette = key;
  localStorage.setItem("zw_palette", key);
  applyTheme();
}
function setContrast(key) {
  themeStore.contrast = key;
  localStorage.setItem("zw_contrast", key);
  applyTheme();
}
applyTheme();
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
  if (themeStore.mode === "auto") applyTheme();
});
window.matchMedia("(prefers-contrast: more)").addEventListener("change", () => {
  if (themeStore.contrast === "standard") applyTheme();
});
// aktuelle Theme-Farbe aus CSS lesen (für Chart.js)
const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/* ---------- Chart-Farben (nutzerdefiniert, geraetelokal) ----------
   Bewusst localStorage statt SQLite: das Repo hat KEIN Schema-Migrations-
   verfahren (SQLModel.create_all legt nur an, aendert nichts). Eine neue
   Spalte wuerde Bestandsinstallationen mit "no such column" brechen.
   Systemfarben (System.farbe) bleiben dagegen in SQLite - sie werden auch
   serverseitig fuer die PDF-Berichte gebraucht.
   null / "" = Theme-Standard verwenden (Fallback auf die M3-Rolle).        */
const CHART_COLOR_KEYS = [
  { key: "outlier", label: "Ausreißer-Markierung", role: "--md-outlier" },
  { key: "grid",    label: "Gitternetz",           role: "--chart-grid" },
  { key: "axis",    label: "Achsenbeschriftung",   role: "--ink-soft" },
];
function loadChartPrefs() {
  try { return JSON.parse(localStorage.getItem("zw_chart_colors")) || {}; }
  catch (_) { return {}; }
}
const chartPrefs = reactive(loadChartPrefs());
function setChartColor(key, value) {
  if (value) chartPrefs[key] = value; else delete chartPrefs[key];
  localStorage.setItem("zw_chart_colors", JSON.stringify(chartPrefs));
}
function resetChartColors() {
  Object.keys(chartPrefs).forEach((k) => delete chartPrefs[k]);
  localStorage.removeItem("zw_chart_colors");
}
/* Nutzerwert schlaegt Theme-Rolle schlaegt Literal-Fallback */
function chartColor(key, fallback) {
  const def = CHART_COLOR_KEYS.find((c) => c.key === key);
  return chartPrefs[key] || (def && cssVar(def.role)) || fallback;
}

/* ---------- Kontrastpruefung (WCAG 2.1 relative Luminanz) ---------- */
function hexToRgb(hex) {
  const h = String(hex || "").replace("#", "");
  const f = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  if (f.length !== 6) return null;
  return [0, 2, 4].map((i) => parseInt(f.slice(i, i + 2), 16));
}
function luminance(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const [r, g, b] = rgb.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrastRatio(a, b) {
  const la = luminance(a), lb = luminance(b);
  if (la === null || lb === null) return null;
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
/* Verhaeltnis der Farbe zur aktuellen Chart-Flaeche; <3:1 = auf dem Untergrund kaum sichtbar */
function contrastToSurface(hex) {
  const surface = cssVar("--md-surface-c-low") || (themeStore.dark ? "#161D1D" : "#EFF5F5");
  return contrastRatio(hex, surface);
}

/* ---------- Stammdaten / Konstanten ---------- */
const SYSTEM_TYPES = [
  { v: "Strom",          unit: "kWh", icon: "⚡" },
  { v: "Gas",            unit: "m³",  icon: "🔥" },
  { v: "Wasser",         unit: "m³",  icon: "💧" },
  { v: "PV-Erzeugung",   unit: "kWh", icon: "☀" },
  { v: "PV-Einspeisung", unit: "kWh", icon: "⬆" },
  { v: "Custom",         unit: "",    icon: "▦" },
];
// Felder, die es bei JEDEM System gibt (Kosten-Fallback + Fälligkeit)
const COMMON_FIELDS = [
  { key: "preis", label: "Ø-Preis €/Einheit (für Kostenschätzung, optional)", type: "number" },
  { key: "ablese_intervall_tage", label: "Ablese-Intervall in Tagen (für Fälligkeit, optional)", type: "number" },
  { key: "ha_entity", label: "HA-Entity Zählerstand (optional, z. B. sensor.stromzaehler)", type: "text" },
  { key: "mqtt_topic", label: "MQTT-Topic (optional, z. B. tele/hichi/SENSOR)", type: "text" },
  { key: "mqtt_path", label: "MQTT JSON-Pfad (optional, z. B. MT631.Total_in)", type: "text" },
  { key: "mqtt_interval", label: "MQTT-Speicherintervall (leer = globale Vorgabe)", type: "select",
    options: ["", "daily", "weekly", "monthly", "quarterly", "yearly"],
    labels: { "": "Globale Vorgabe", daily: "Täglich", weekly: "Wöchentlich",
              monthly: "Monatlich", quarterly: "Quartalsweise", yearly: "Jährlich" } },
  { key: "ha_unit", label: "Einheit des HA-Sensors (leer = wie von HA gemeldet)", type: "select",
    options: ["", "Wh", "kWh", "MWh", "L", "m³"] },
];

/* ---------- Einheiten-Umrechnung (HA-Sensor -> Systemeinheit) ---------- */
const UNIT_FACTORS = {
  energie: { "wh": 0.001, "kwh": 1, "mwh": 1000 },        // Basis kWh
  volumen: { "l": 0.001, "dm³": 0.001, "dm3": 0.001, "m³": 1, "m3": 1 },  // Basis m³
};
function normUnit(u) { return String(u || "").trim().toLowerCase().replace("m3", "m³"); }
function convertUnit(value, fromU, toU) {
  const f = normUnit(fromU), t = normUnit(toU);
  if (!f || !t || f === t) return { value, converted: false };
  for (const cat of Object.values(UNIT_FACTORS)) {
    if (f in cat && t in cat) return { value: value * cat[f] / cat[t], converted: true };
  }
  return null;  // inkompatibel (z. B. Wh -> m³)
}
const EXTRA_FIELDS = {
  "Gas":            [{ key: "brennwert", label: "Brennwert (kWh/m³)", type: "number" },
                     { key: "zustandszahl", label: "Zustandszahl (Standard 0,95)", type: "number" }],
  "PV-Erzeugung":   [{ key: "kwp",           label: "Installierte Leistung (kWp)", type: "number" }],
  "PV-Einspeisung": [{ key: "verguetung_ct", label: "Einspeisevergütung (ct/kWh)", type: "number" }],
};
const PALETTE = ["#0e7c86", "#d9820a", "#3b6fb5", "#2f8f5b", "#a4508b", "#c0453b", "#6b7280", "#0891b2"];

/* ---------- Navigation (Sidebar) ----------
   Zentrale Deklaration statt dupliziertem Markup in Rail und Bottom-Bar.
   `action` verweist auf eine Methode der Root-App; `disabled` = Platzhalter
   für noch nicht implementierte Bereiche (Admin-Tools).                     */
const SVG = {
  home:   '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11 L12 3 L21 11"/><path d="M5 10 V20 H19 V10"/></svg>',
  report: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M12 18v-6"/><path d="M9 15l3 3 3-3"/></svg>',
  cog:    '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  admin:  '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v5c0 4.4-2.9 8.2-7 10-4.1-1.8-7-5.6-7-10V6z"/><path d="M9.5 12l1.8 1.8L15 10"/></svg>',
  chevron: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>',
  menu:   '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h16"/></svg>',
};
const NAV_ITEMS = [
  { key: "zaehlwerk",    label: "Zählwerk",     icon: SVG.home,   action: "back",                primary: true, expandable: true },
  { key: "bericht",      label: "Bericht",      icon: SVG.report, action: "openCombinedReport",  primary: true, needsSystems: true },
  { key: "einstellungen",label: "Einstellungen",icon: SVG.cog,    action: "openSettings",        primary: true },
  { key: "admin",        label: "Admin-Tools",  icon: SVG.admin,  action: "openAdmin", adminOnly: true },
];
const NAV_BREAKPOINT = 840;   // identisch zum CSS-Breakpoint Rail <-> Bottom-Bar

/* =========================================================================
   Hardware-Empfehlung fuer Smart-Meter-Nachruestung
   -------------------------------------------------------------------------
   Regelbasiert, bewusst kein Scoring-Modell: die Zuordnung Zaehlerbauart ->
   Ausleseverfahren ist deterministisch und nachvollziehbar. Jede Regel
   liefert mit, WORAN sie erkannt hat und wie sicher das ist - damit der
   Nutzer eine Fehlzuordnung sofort sieht, statt einer Blackbox zu vertrauen.

   Reihenfolge = Spezifitaet. Die erste zutreffende Regel je Medium gewinnt,
   generische Regeln greifen nur als Rueckfallebene.
   ========================================================================= */
const HW_CONFIDENCE = {
  sicher:       { label: "eindeutig",   rank: 3 },
  wahrscheinlich:{ label: "wahrscheinlich", rank: 2 },
  generisch:    { label: "Rückfallebene", rank: 1 },
};

/* Normalisiert Freitext: Kleinschreibung, Umlaute, Sonderzeichen raus.
   "Balgengaszähler" / "balgengas-zaehler" / "BALGENGASZAEHLER" -> gleich. */
function hwNorm(s) {
  return String(s || "").toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, " ").trim();
}
const hwHas = (hay, ...needles) => needles.some((n) => hwNorm(hay).includes(hwNorm(n)));

const HW_RULES = [
  /* ---------------- Strom ---------------- */
  {
    id: "strom-imsys",
    medium: "Strom",
    confidence: "sicher",
    match: (c) => hwHas(c.bauart, "imsys", "intelligentes messsystem", "smart meter gateway", "smgw")
               || hwHas(c.modell, "smgw"),
    grund: "iMSys bzw. Smart-Meter-Gateway erkannt",
    titel: "Auslesung über die HAN-Schnittstelle des Gateways",
    hardware: [
      "HAN-Adapter des Messstellenbetreibers (CLS-Schnittstelle)",
      "Alternativ: separater eigener Zähler hinter dem iMSys",
    ],
    hinweis: "Ein iMSys gehört dem Messstellenbetreiber und ist plombiert. Der Zugang zur HAN-Schnittstelle wird beim Betreiber beantragt – ein optischer Lesekopf ist hier weder nötig noch zulässig.",
  },
  {
    id: "strom-mme",
    medium: "Strom",
    confidence: "sicher",
    match: (c) => hwHas(c.bauart, "mme", "moderne messeinrichtung", "ehz")
               || hwHas(c.modell, "mme", "ehz", "q3a", "q3b", "e220", "dd3", "dd4", "sml"),
    grund: "moderne Messeinrichtung mit optischer Schnittstelle (D0/SML)",
    titel: "Optischer Lesekopf an der Infrarot-Schnittstelle",
    hardware: [
      "Hichi IR-Lesekopf (Tasmota vorinstalliert) – Magnethalterung, berührungslos",
      "Alternativ: Tibber Pulse IR oder volkszaehler-Lesekopf mit ESPHome",
    ],
    hinweis: "Für die vollständigen Daten inklusive momentaner Leistung ist meist die vierstellige INF-PIN nötig – kostenlos beim Messstellenbetreiber anzufordern. Ohne PIN liefert der Zähler nur den Zählerstand.",
  },
  {
    id: "strom-ferraris",
    medium: "Strom",
    confidence: "sicher",
    match: (c) => hwHas(c.bauart, "ferraris", "drehscheibe", "induktionszaehler")
               || hwHas(c.bauart, "wechselstromzaehler", "drehstromzaehler"),
    grund: "mechanischer Zähler mit rotierender Scheibe",
    titel: "Reflexlichtschranke auf die Markierung der Drehscheibe",
    hardware: [
      "TCRT5000 Reflexkoppler an ESP32/ESP8266 mit ESPHome",
      "Alternativ: Hichi Ferraris-Sensor (fertig konfektioniert)",
    ],
    hinweis: "Die Umdrehungszahl pro kWh steht auf dem Typenschild (z. B. 75 U/kWh) und muss in der Konfiguration hinterlegt werden. Der Sensor wird außen aufgeklebt, die Plombe bleibt unberührt.",
  },

  /* ---------------- Gas ---------------- */
  {
    id: "gas-balgen",
    medium: "Gas",
    confidence: "sicher",
    match: (c) => hwHas(c.bauart, "balgengas", "balgen")
               || hwHas(c.modell, "bk g4", "bk g6", "bk4", "g4 rf1", "g4"),
    grund: "Balgengaszähler erkannt",
    titel: "Reed-Kontakt an der Magnetziffer",
    hardware: [
      "Reed-Kontakt oder Hall-Sensor an ESP32/ESP8266 mit ESPHome",
      "Fertiglösung: Impulsgeber des Herstellers (z. B. Elster IN-Z61)",
    ],
    hinweis: "Voraussetzung ist ein Magnet in der letzten Ziffernrolle – erkennbar an einem Punkt oder Stern neben der Ziffer, oder per Reed-Test. Fehlt er, bleibt nur die Kameralösung.",
    fallbackId: "universal-kamera",
  },
  {
    id: "gas-ultraschall",
    medium: "Gas",
    confidence: "wahrscheinlich",
    match: (c) => hwHas(c.bauart, "ultraschall", "drehkolben", "turbinenrad"),
    grund: "elektronischer Gaszähler",
    titel: "Auslesung über die vorhandene Datenschnittstelle",
    hardware: [
      "Optischer Lesekopf, falls IR-Schnittstelle vorhanden",
      "M-Bus- oder wM-Bus-Empfänger, je nach Ausstattung",
    ],
    hinweis: "Elektronische Gaszähler bringen die Schnittstelle meist mit. Welche es ist, steht im Datenblatt zum Modell – Bauart und Modell hier vollständig eintragen hilft bei der Eingrenzung.",
  },

  /* ---------------- Wasser ---------------- */
  {
    id: "wasser-ultraschall",
    medium: "Wasser",
    confidence: "sicher",
    match: (c) => hwHas(c.bauart, "ultraschall") || hwHas(c.modell, "ultraschall"),
    grund: "Ultraschall-Wasserzähler, sendet in der Regel per Funk",
    titel: "wM-Bus-Empfänger auf 868 MHz",
    hardware: [
      "ESP32 mit CC1101-Funkmodul und wM-Bus-Firmware",
      "Alternativ: USB-Stick mit wM-Bus-Empfang plus wmbusmeters",
    ],
    hinweis: "Viele Zähler senden verschlüsselt. Der AES-Schlüssel gehört zum Zähler und wird beim Versorger angefragt – ohne ihn kommen nur Telegramme ohne lesbare Werte an.",
  },
  {
    id: "wasser-fluegelrad",
    medium: "Wasser",
    confidence: "sicher",
    match: (c) => hwHas(c.bauart, "fluegelrad", "woltmann", "mehrstrahl", "einstrahl")
               || hwHas(c.hersteller, "pipersberg"),
    grund: "mechanischer Wasserzähler mit Rollenzählwerk",
    titel: "Kamerabasierte Zifferblatt-Erkennung",
    hardware: [
      "AI-on-the-edge-device auf ESP32-CAM",
      "Alternativ: Reed-Kontakt, falls eine Ziffernrolle einen Magneten trägt",
    ],
    hinweis: "Die Kameralösung braucht eine feste Halterung und gleichmäßige Beleuchtung – beides bringt das fertige Gehäuse mit. Sie ist berührungslos und damit unabhängig von Plomben.",
  },

  /* ---------------- Medienunabhängig ---------------- */
  {
    id: "universal-kamera",
    medium: null,
    confidence: "generisch",
    match: (c) => ["Strom", "Gas", "Wasser"].includes(c.typ),
    grund: "funktioniert an jedem Rollenzählwerk, unabhängig von Bauart und Hersteller",
    titel: "Kamerabasierte Zifferblatt-Erkennung",
    hardware: ["AI-on-the-edge-device auf ESP32-CAM"],
    hinweis: "Die Rückfallebene, wenn keine elektrische oder optische Schnittstelle existiert. Liefert den Zählerstand, aber keine Momentanwerte.",
  },
  {
    id: "pv-wechselrichter",
    medium: null,
    confidence: "wahrscheinlich",
    match: (c) => c.typ === "PV-Erzeugung" || c.typ === "PV-Einspeisung",
    grund: "PV-Daten kommen vom Wechselrichter, nicht vom Zähler",
    titel: "Anbindung des Wechselrichters statt des Zählers",
    hardware: [
      "Modbus TCP oder RTU zum Wechselrichter (SunSpec)",
      "Alternativ: Hersteller-Integration in Home Assistant",
    ],
    hinweis: "Für die Einspeisung ist zusätzlich der Zweirichtungszähler relevant – dafür gelten die Empfehlungen zu Strom.",
  },
];

/* Liefert die Empfehlungen zu einem Zaehler. Erste passende spezifische Regel
   je Medium plus die generische Rueckfallebene, falls sie nicht ohnehin traf. */
function hwSuggest(meter, system) {
  const ctx = {
    typ: system ? system.typ : null,
    bauart: meter ? meter.bauart : null,
    modell: meter ? meter.modell : null,
    hersteller: meter ? meter.hersteller : null,
  };
  const hits = [];
  const spezifisch = HW_RULES.filter(
    (r) => r.medium && r.medium === ctx.typ && r.match(ctx));
  if (spezifisch.length) hits.push(spezifisch[0]);
  HW_RULES.filter((r) => !r.medium && r.match(ctx)).forEach((r) => {
    if (!hits.some((h) => h.id === r.id)) hits.push(r);
  });
  // Wenn eine spezifische Regel griff, ist die generische Kamera nur noch
  // Beiwerk -> nach hinten und als solche markiert.
  return hits.map((r) => ({ ...r, conf: HW_CONFIDENCE[r.confidence] }))
             .sort((a, b) => b.conf.rank - a.conf.rank);
}

/* ---------- Helfer ---------- */
/* Zentrale Stelle für Sitzungsverlust. Statt an jedem Aufruf einzeln auf 401
   zu prüfen, meldet der Interceptor es einmal – die Oberfläche blendet dann
   die Anmeldung ein. Der Rückruf wird von der App beim Start gesetzt. */
const authStore = reactive({ status: null, checked: false });

/* Rechte modulweit verfügbar machen: die Root-App und die Unterkomponenten
   müssen dieselbe Quelle nutzen, sonst blendet die eine aus, was die andere
   noch anzeigt. Durchgesetzt werden die Rechte ohnehin im Backend. */
function perms() {
  return (authStore.status || {}).permissions
         || { role: "guest", write: false, admin: false, export: false, settings: false };
}
const canWriteNow = () => !!perms().write;
const canExportNow = () => !!perms().export;
let onUnauthorized = () => {};

async function api(path, opts = {}) {
  // Führenden Slash entfernen -> relativer Request. Funktioniert direkt (LXC)
  // UND hinter Home-Assistant-Ingress (dynamischer Basis-Pfad).
  const url = path.replace(/^\//, "");
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    // Sitzungscookie mitsenden. Nötig, weil das Token als HttpOnly-Cookie
    // gehalten wird und für JavaScript unsichtbar ist.
    credentials: "same-origin",
    ...opts,
  });
  if (res.status === 401) {
    authStore.status = { ...(authStore.status || {}), authenticated: false };
    onUnauthorized();
    throw new Error("Sitzung abgelaufen – bitte neu anmelden");
  }
  if (!res.ok) {
    let d;
    try { d = await res.json(); } catch (_) {}
    throw new Error((d && d.detail) || res.statusText || "Fehler");
  }
  return res.status === 204 ? null : res.json();
}
const today = () => new Date().toISOString().slice(0, 10);

// Ingress-sicherer Download: holt die Datei im authentifizierten Kontext (fetch mit
// Session-Cookie) und bietet sie als lokalen Blob an. Kein externer Browser -> kein 401.
async function fetchBlobDownload(path, filename) {
  const res = await fetch(path.replace(/^\//, ""));
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
}
function fmt(n, dec = 2) {
  if (n === null || n === undefined || Number.isNaN(n)) return "–";
  return Number(n).toLocaleString("de-DE", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}
function fmtDate(iso) {
  if (!iso) return "–";
  return new Date(iso).toLocaleDateString("de-DE");
}
function typeIcon(typ) {
  const t = SYSTEM_TYPES.find((x) => x.v === typ);
  return t ? t.icon : "▦";
}

/* =========================================================================
   Hold-to-Delete-Button: 3 s halten, Outline zeichnet sich im Uhrzeigersinn,
   erst DANACH feuert @held (Aufrufer zeigt zusätzlich Bestätigungs-Popup).
   ========================================================================= */
const HoldButton = {
  props: { small: Boolean, round: Boolean, title: String },
  emits: ["held"],
  data: () => ({ holding: false }),
  template: `
  <button type="button" class="holdbtn" :class="{small, round, holding}"
          :title="title || 'Zum Löschen 3 Sekunden gedrückt halten'"
          @pointerdown.stop.prevent="start" @pointerup="cancel" @pointerleave="cancel"
          @pointercancel="cancel" @contextmenu.prevent @click.stop.prevent>
    <svg class="hold-ring" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <rect x="3" y="3" width="94" height="94" :rx="round ? 50 : 16" ry="50" pathLength="100" />
    </svg>
    <span class="hold-inner"><slot></slot></span>
  </button>`,
  methods: {
    start() {
      this.holding = true;
      this._t = setTimeout(() => { this.holding = false; this.$emit("held"); }, 3000);
    },
    cancel() { this.holding = false; clearTimeout(this._t); },
  },
  beforeUnmount() { clearTimeout(this._t); },
};

/* =========================================================================
   Chart-Komponente – reiner Renderer (Datasets kommen fertig vom Parent)
   ========================================================================= */
const EnergyChart = {
  props: { labels: Array, datasets: Array, chartType: String, hasY2: Boolean, y2Label: String },
  template: `<div class="chart-box"><canvas ref="cv"></canvas></div>`,
  mounted() { this.schedule(); },
  beforeUnmount() { this.destroy(); },
  computed: {
    isDark() { return themeStore.dark; },
    prefSignature() { return JSON.stringify(chartPrefs); },
  },
  watch: {
    prefSignature() { this.schedule(); },   // Farbwahl -> Chart sofort neu zeichnen
    labels() { this.schedule(); },
    datasets() { this.schedule(); },
    chartType() { this.schedule(); },
    hasY2() { this.schedule(); },
    isDark() { this.schedule(); },   // Theme-Wechsel -> Chartfarben neu
  },
  methods: {
    destroy() {
      const cv = this.$refs.cv;
      if (cv && typeof Chart !== "undefined") {
        const existing = Chart.getChart(cv);   // offizieller Weg: JEDE Instanz am Canvas killen
        if (existing) existing.destroy();
      }
    },
    schedule() {
      if (this._pending) return;
      this._pending = true;
      this.$nextTick(() => { this._pending = false; this.build(); });
    },
    build() {
      const cv = this.$refs.cv;
      if (!cv || typeof Chart === "undefined") return;
      this.destroy();
      const ctx = cv.getContext("2d");
      const grid = chartColor("grid", "#e2e8ee");
      const tick = chartColor("axis", "#5b6b7b");

      // Datasets klonen (Props nicht mutieren) + Gradient-Fläche fürs Primärsystem (Linie)
      const datasets = this.datasets.map((d, i) => {
        const ds = { ...d };
        if (i === 0 && (this.chartType || "line") === "line" && ds.fill !== false) {
          const col = ds.borderColor || "#0e7c86";
          const grad = ctx.createLinearGradient(0, 0, 0, cv.clientHeight || 320);
          grad.addColorStop(0, col + "59");   // oben ~35%
          grad.addColorStop(1, col + "05");   // unten fast transparent
          ds.backgroundColor = grad;
          ds.fill = true;
        }
        return ds;
      });

      const scales = {
        x: { grid: { color: grid }, ticks: {
          color: tick, maxRotation: 90, minRotation: 90, font: { size: 9 },
          // <=40 Punkte: jedes Datum (wie gehabt); darüber automatisch ausdünnen
          autoSkip: this.labels.length > 40, maxTicksLimit: this.labels.length > 40 ? 40 : undefined,
        } },
        y: { grid: { color: grid }, ticks: { color: tick, font: { size: 11 } }, beginAtZero: false, position: "left" },
      };
      if (this.hasY2) {
        scales.y2 = {
          position: "right", beginAtZero: true,
          grid: { drawOnChartArea: false },
          ticks: { color: tick, font: { size: 11 } },
          title: { display: !!this.y2Label, text: this.y2Label, color: tick, font: { size: 10 } },
        };
      }
      new Chart(ctx, {
        type: this.chartType || "line",
        data: { labels: this.labels, datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: "index", intersect: false },
          plugins: {
            legend: { display: datasets.length > 1, position: "bottom", labels: { color: tick, boxWidth: 12, font: { size: 12 } } },
            tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${fmt(c.parsed.y)}` } },
          },
          scales,
        },
      });
    },
  },
};

/* =========================================================================
   System-Detail – Chart + Tabelle + Erfassung + Import
   ========================================================================= */
const SystemDetail = {
  components: { EnergyChart, HoldButton },
  inject: ["notify"],
  props: { system: Object },
  emits: ["back", "edit", "changed"],
  data: () => ({
    tab: "chart",
    // Zähler-Metadaten (v2.10.0) + Hardware-Empfehlung
    meters: [],
    metersLoaded: false,
    // Anzahlen getrennt von den Listen: sie stammen aus dem Dashboard-Request
    // und stehen damit schon vor dem ersten Öffnen des jeweiligen Reiters.
    meterCount: null,
    tariffCount: null,
    showMeter: false,
    meterForm: null,
    bauarten: [],
    tariffs: [],
    tariffsLoaded: false,
    showTariff: false,
    tariffForm: null,
    loading: true,
    readings: [],
    stats: null,
    chartData: null,
    // Chart-Steuerung
    mode: "consumption",       // value | consumption | per_day
    chartType: "line",         // line | bar
    range: "all",              // week | month | year | all
    overlayIds: [],
    overlayData: {},
    allSystems: [],
    // Tabelle
    expandedId: null,
    sortKey: "datum",
    sortDir: "desc",
    filter: "",
    onlyOutliers: false,
    page: 1,
    perPage: 15,
    // Modals
    showReading: false,
    showScanner: false,
    scanFileMode: false,
    scanBusy: false,
    scanStatus: "",
    showImport: false,
    reading: null,
    importFile: null,
    importResult: null,
    busy: false,
  }),
  computed: {
    fromParam() {
      if (this.range === "all") return null;
      const d = new Date();
      if (this.range === "week") d.setDate(d.getDate() - 7);
      if (this.range === "month") d.setMonth(d.getMonth() - 1);
      if (this.range === "year") d.setFullYear(d.getFullYear() - 1);
      return d.toISOString().slice(0, 10);
    },
    haEntity() { return (this.system.zusatzfelder || {}).ha_entity || null; },
    modeLabel() {
      return { value: "Zählerstand", consumption: "Verbrauch", per_day: "Verbrauch/Tag" }[this.mode];
    },
    // C: Jahres-Hochrechnung (klar als Prognose markiert, keine echten Werte)
    forecast() {
      const s = this.stats;
      if (!s || s.avg_per_day == null) return null;
      const cons = s.avg_per_day * 365;
      return { cons, cost: s.cost_per_unit != null ? cons * s.cost_per_unit : null };
    },
    // D: Gas zusätzlich in kWh (nur Zusatz zu m³, nie Ersatz)
    gasKwh() {
      if (this.system.typ !== "Gas") return null;
      const z = this.system.zusatzfelder || {};
      const bw = parseFloat(z.brennwert);
      if (!bw) return null;
      const zz = parseFloat(z.zustandszahl) || 0.95;
      const s = this.stats;
      if (!s) return null;
      return { total: s.total_consumption * bw * zz, faktor: bw * zz };
    },
    overlayOptions() {
      return this.allSystems.filter((s) => s.id !== this.system.id && s.aktiv);
    },
    outlierColor() { return chartColor("outlier", "#9A6A00"); },
    canWrite() { return canWriteNow(); },
    canExport() { return canExportNow(); },
    chart() {
      if (!this.chartData) return { labels: [], datasets: [] };
      const pick = (cd) =>
        this.mode === "value" ? cd.values : this.mode === "per_day" ? cd.consumption_per_day : cd.consumption;
      const labelSet = new Set(this.chartData.labels);
      const overlays = this.overlayIds.map((id) => this.overlayData[id]).filter(Boolean);
      overlays.forEach((cd) => cd.labels.forEach((l) => labelSet.add(l)));
      const labels = [...labelSet].sort();
      const toMap = (cd) => { const m = {}; const p = pick(cd); cd.labels.forEach((l, i) => (m[l] = p[i])); return m; };

      const pm = toMap(this.chartData);
      const idxOf = (l) => this.chartData.labels.indexOf(l);
      const primData = labels.map((l) => (l in pm ? pm[l] : null));
      const ptColor = labels.map((l) => { const i = idxOf(l); return i >= 0 && this.chartData.outliers[i] ? chartColor("outlier", "#9A6A00") : this.chartData.color; });
      const ptRad = labels.map((l) => { const i = idxOf(l); return i >= 0 && this.chartData.outliers[i] ? 5 : this.chartType === "bar" ? 0 : 2; });

      // E: im Zählerstand-Modus die Linie an Zählertausch-Punkten trennen (Segmente je Zähler)
      const swapLabels = new Set(
        this.chartData.labels.filter((l, i) => this.chartData.meter_replaced && this.chartData.meter_replaced[i])
      );
      const isValue = this.mode === "value";
      const prim = {
        label: this.system.name, data: primData,
        borderColor: this.chartData.color,
        backgroundColor: this.chartType === "bar" ? this.chartData.color + "cc" : this.chartData.color + "22",
        pointBackgroundColor: ptColor, pointRadius: ptRad, borderWidth: 2, tension: 0.25,
        fill: this.chartType === "line" && !isValue, spanGaps: true,
      };
      if (isValue && this.chartType === "line") {
        prim.segment = {
          borderColor: (ctx) => (swapLabels.has(labels[ctx.p1DataIndex]) ? "transparent" : undefined),
        };
      }
      const datasets = [prim];
      const overlayUnits = new Set();
      overlays.forEach((cd) => {
        const m = toMap(cd);
        overlayUnits.add(cd.unit);
        datasets.push({
          label: `${cd.name} (${cd.unit})`, data: labels.map((l) => (l in m ? m[l] : null)),
          borderColor: cd.color, backgroundColor: cd.color + "18",
          pointRadius: this.chartType === "bar" ? 0 : 2, borderWidth: 1.5,
          borderDash: [5, 4], tension: 0.25, fill: false, spanGaps: true,
          yAxisID: "y2",   // eigene rechte Achse (unterschiedliche Größenordnung/Einheit)
        });
      });
      return {
        labels, datasets,
        hasY2: overlays.length > 0,
        y2Label: [...overlayUnits].join(" / "),
      };
    },
    filtered() {
      let rows = this.readings.slice();
      if (this.onlyOutliers) rows = rows.filter((r) => r.is_outlier);
      if (this.filter.trim()) {
        const q = this.filter.toLowerCase();
        rows = rows.filter((r) => (r.note || "").toLowerCase().includes(q) || fmtDate(r.datum).includes(q));
      }
      const dir = this.sortDir === "asc" ? 1 : -1;
      rows.sort((a, b) => {
        let av = a[this.sortKey], bv = b[this.sortKey];
        if (this.sortKey === "datum") {
          // ISO-Strings sortieren lexikographisch korrekt – kein Date-Parsing
          // (neuere WebViews parsen uneinheitlich -> nicht-deterministische Reihenfolge)
          av = String(av); bv = String(bv);
        }
        av = av ?? -Infinity; bv = bv ?? -Infinity;
        return av < bv ? -dir : av > bv ? dir : 0;
      });
      return rows;
    },
    pageCount() { return Math.max(1, Math.ceil(this.filtered.length / this.perPage)); },
    paged() { const s = (this.page - 1) * this.perPage; return this.filtered.slice(s, s + this.perPage); },
    latestValue() {
      if (!this.readings.length) return null;
      return this.readings.reduce((a, b) => (new Date(a.datum) > new Date(b.datum) ? a : b)).value;
    },
    extraFields() { return EXTRA_FIELDS[this.system.typ] || []; },
  },
  watch: {
    range() { this.loadDynamic(); },
    tab(v) {
      if (v === "meters" && !this.metersLoaded) this.loadMeters();
      if (v === "tariffs" && !this.tariffsLoaded) this.loadTariffs();
    },
    overlayIds() { this.loadOverlays(); },
  },
  async mounted() {
    await this.loadAll();
    try { this.allSystems = await api("/api/systems"); } catch (_) {}
  },
  methods: {
    fmt, fmtDate, typeIcon,
    async loadAll() { this.loading = true; await this.loadDynamic(); this.loading = false; },

    /* ---------- Zähler-Metadaten ---------- */
    async loadMeters() {
      try {
        const [ms, ba] = await Promise.all([
          api(`/api/systems/${this.system.id}/meters`),
          this.bauarten.length ? Promise.resolve(this.bauarten) : api("/api/meters/bauarten"),
        ]);
        this.meters = ms;
        this.bauarten = ba;
        this.metersLoaded = true;
        // Nach dem Laden gilt die Liste als maßgeblich – so bleibt die Zahl
        // auch nach Anlegen oder Löschen korrekt, ohne erneuten Dashboard-Aufruf.
        this.meterCount = ms.length;
      } catch (e) { this.notify("Zähler nicht ladbar: " + e.message, "err"); }
    },
    openMeter(m) {
      this.meterForm = m
        ? { ...m }
        : { id: null, hersteller: "", modell: "", zaehlernummer: "", bauart: "",
            baujahr: null, eichung_bis: null, messstellenbetreiber: "",
            stellen_vor: null, stellen_nach: null,
            eingebaut_am: null, ausgebaut_am: null, notiz: "" };
      this.showMeter = true;
    },
    async saveMeter() {
      const f = this.meterForm;
      // Leerstrings zu null: das Backend trimmt zwar auch, aber so bleibt die
      // Vorschau der Empfehlung schon vor dem Speichern konsistent.
      const clean = (v) => (v === "" || v === undefined ? null : v);
      const body = JSON.stringify({
        hersteller: clean(f.hersteller), modell: clean(f.modell),
        zaehlernummer: clean(f.zaehlernummer), bauart: clean(f.bauart),
        baujahr: f.baujahr ? Number(f.baujahr) : null,
        eichung_bis: clean(f.eichung_bis),
        messstellenbetreiber: clean(f.messstellenbetreiber),
        stellen_vor: f.stellen_vor ? Number(f.stellen_vor) : null,
        stellen_nach: f.stellen_nach !== null && f.stellen_nach !== "" ? Number(f.stellen_nach) : null,
        eingebaut_am: clean(f.eingebaut_am), ausgebaut_am: clean(f.ausgebaut_am),
        notiz: clean(f.notiz),
      });
      this.busy = true;
      try {
        if (f.id) await api(`/api/meters/${f.id}`, { method: "PATCH", body });
        else await api(`/api/systems/${this.system.id}/meters`, { method: "POST", body });
        this.showMeter = false;
        this.notify(f.id ? "Zähler aktualisiert" : "Zähler angelegt", "ok");
        await this.loadMeters();
      } catch (e) { this.notify(e.message, "err"); }
      finally { this.busy = false; }
    },
    async deleteMeter(m) {
      try {
        await api(`/api/meters/${m.id}`, { method: "DELETE" });
        this.notify("Zähler gelöscht", "ok");
        await this.loadMeters();
      } catch (e) { this.notify(e.message, "err"); }
    },

    /* ---------- Tarife ---------- */
    async loadTariffs() {
      try {
        this.tariffs = await api(`/api/systems/${this.system.id}/tariffs`);
        this.tariffsLoaded = true;
        this.tariffCount = this.tariffs.length;
      } catch (e) { this.notify("Tarife nicht ladbar: " + e.message, "err"); }
    },
    openTariff(t) {
      this.tariffForm = t
        ? { ...t }
        : { id: null, name: "", anbieter: "", gueltig_ab: today(), gueltig_bis: null,
            arbeitspreis: null, grundpreis: 0, notiz: "" };
      this.showTariff = true;
    },
    async saveTariff() {
      const f = this.tariffForm;
      if (f.arbeitspreis === null || f.arbeitspreis === "") {
        this.notify("Arbeitspreis fehlt", "err"); return;
      }
      const clean = (v) => (v === "" || v === undefined ? null : v);
      const body = JSON.stringify({
        name: clean(f.name), anbieter: clean(f.anbieter),
        gueltig_ab: f.gueltig_ab, gueltig_bis: clean(f.gueltig_bis),
        arbeitspreis: Number(f.arbeitspreis),
        grundpreis: Number(f.grundpreis || 0),
        notiz: clean(f.notiz),
      });
      this.busy = true;
      try {
        if (f.id) await api(`/api/tariffs/${f.id}`, { method: "PATCH", body });
        else await api(`/api/systems/${this.system.id}/tariffs`, { method: "POST", body });
        this.showTariff = false;
        this.notify(f.id ? "Tarif aktualisiert" : "Tarif angelegt", "ok");
        await this.loadTariffs();
        await this.loadDynamic();      // Kosten neu rechnen lassen
      } catch (e) { this.notify(e.message, "err"); }
      finally { this.busy = false; }
    },
    async deleteTariff(t) {
      try {
        await api(`/api/tariffs/${t.id}`, { method: "DELETE" });
        this.notify("Tarif gelöscht", "ok");
        await this.loadTariffs();
        await this.loadDynamic();
      } catch (e) { this.notify(e.message, "err"); }
    },
    tariffRange(t) {
      const ab = fmtDate(t.gueltig_ab);
      return t.gueltig_bis ? `${ab} – ${fmtDate(t.gueltig_bis)}` : `ab ${ab}`;
    },

    /* ---------- Hardware-Empfehlung ---------- */
    suggestFor(meter) { return hwSuggest(meter, this.system); },
    eichungLabel(m) {
      if (m.eichung_bis === null || m.eichung_faellig_in_tagen === null) return null;
      const d = m.eichung_faellig_in_tagen;
      if (d < 0) return { level: "over", text: `Eichung abgelaufen seit ${Math.abs(d)} T` };
      if (d <= 180) return { level: "soon", text: `Eichung endet in ${d} T` };
      return { level: "ok", text: `Eichung bis ${fmtDate(m.eichung_bis)}` };
    },
    async loadDynamic() {
      const q = this.fromParam ? `?from=${this.fromParam}` : "";
      // Ein kombinierter Request statt drei (eine Berechnung im Backend)
      const d = await api(`/api/systems/${this.system.id}/dashboard${q}`);
      this.readings = d.readings; this.stats = d.stats; this.chartData = d.chart;
      // Anzahlen kommen direkt mit – die Reiter zeigen sie ab dem ersten
      // Rendern, ohne dass die vollständigen Listen geladen werden müssen.
      if (d.counts) {
        this.meterCount = d.counts.meters;
        this.tariffCount = d.counts.tariffs;
      }
      this.page = 1;
      this.expandedId = null;
      await this.loadOverlays();
    },
    async loadOverlays() {
      const q = this.fromParam ? `?from=${this.fromParam}` : "";
      for (const id of this.overlayIds) {
        if (!this.overlayData[id]) {
          try {
            const cd = await api(`/api/systems/${id}/chart-data${q}`);
            this.overlayData = { ...this.overlayData, [id]: cd };  // neue Referenz -> sicher reaktiv
          } catch (_) {}
        }
      }
    },
    toggleOverlay(id) {
      const i = this.overlayIds.indexOf(id);
      if (i >= 0) this.overlayIds.splice(i, 1);
      else this.overlayIds.push(id);
    },
    toggleRow(id) { this.expandedId = this.expandedId === id ? null : id; },
    setSort(k) { if (this.sortKey === k) this.sortDir = this.sortDir === "asc" ? "desc" : "asc"; else { this.sortKey = k; this.sortDir = "desc"; } },
    arrow(k) { return this.sortKey === k ? (this.sortDir === "asc" ? "↑" : "↓") : ""; },

    /* Ablesung */
    focusValue() {
      // Nur auf Zeigergeraeten automatisch fokussieren: auf Touch wuerde die
      // Tastatur sofort hochfahren und den Dialog zusammenschieben, bevor der
      // Nutzer ueberhaupt sieht, welches System er erfasst.
      if (window.matchMedia("(pointer: fine)").matches) {
        this.$nextTick(() => this.$refs.valueInput && this.$refs.valueInput.focus());
      }
    },
    openReading() {
      this.reading = { id: null, datum: today(), value: null, cost: null, meter_replaced: false, note: "" };
      this.showReading = true;
      this.focusValue();
    },
    openEditReading(r) {
      this.reading = {
        id: r.id,
        datum: String(r.datum).slice(0, 10),
        value: r.value,
        cost: r.cost,
        meter_replaced: !!r.meter_replaced,
        note: r.note || "",
      };
      this.showReading = true;
    },
    async fetchHaValue() {
      try {
        const r = await api(`/api/ha/state/${encodeURIComponent(this.haEntity)}`);
        const raw = parseFloat(String(r.state).replace(",", "."));
        if (!isFinite(raw)) throw new Error(`Entity liefert '${r.state}' – kein numerischer Zählerstand`);
        // Quelleinheit: konfigurierte Einheit schlägt HA-Meldung; Ziel: Systemeinheit
        const srcUnit = (this.system.zusatzfelder || {}).ha_unit || r.unit || this.system.einheit;
        const res = convertUnit(raw, srcUnit, this.system.einheit);
        if (res === null) throw new Error(`Einheit '${srcUnit}' ist nicht nach '${this.system.einheit}' umrechenbar`);
        const v = Math.round(res.value * 1000) / 1000;
        this.reading.value = v;
        this.notify(res.converted
          ? `Übernommen: ${fmt(raw)} ${srcUnit} → ${fmt(v)} ${this.system.einheit} (${r.name || this.haEntity})`
          : `Übernommen: ${fmt(v)} ${this.system.einheit} (${r.name || this.haEntity})`, "ok");
      } catch (e) { this.notify(e.message, "err"); }
    },

    /* ---------- OCR-Scanner (tesseract.js, lazy; Stream ODER natives Foto) ---------- */
    async openScanner() {
      // HA-App-WebViews (v.a. iOS) stellen keinen Kamera-Stream bereit -> natives Foto als Fallback
      const hasStream = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
      this.scanFileMode = !hasStream;
      this.showScanner = true;
      if (!hasStream) {
        this.scanStatus = "Diese Umgebung erlaubt keinen Live-Stream – nutze die native Kamera per Foto.";
        return;
      }
      this.scanStatus = "Kamera wird gestartet …";
      this.$nextTick(async () => {
        try {
          this._stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment", width: { ideal: 1920 } }, audio: false,
          });
          this.$refs.scanVideo.srcObject = this._stream;
          await this.$refs.scanVideo.play();
          this.scanStatus = "Zählerstand mittig ins Feld halten, dann auslösen.";
        } catch (e) {
          // Stream verweigert (Berechtigung etc.) -> ebenfalls auf natives Foto wechseln
          this.scanFileMode = true;
          this.scanStatus = "Kein Stream (" + e.message + ") – nutze die native Kamera per Foto.";
        }
      });
    },
    closeStreamOnly() {
      if (this._stream) { this._stream.getTracks().forEach((t) => t.stop()); this._stream = null; }
    },
    closeScanner() {
      this.closeStreamOnly();
      this.showScanner = false; this.scanBusy = false;
    },
    triggerScanFile() { this.$refs.scanFile && this.$refs.scanFile.click(); },
    triggerGalleryFile() { this.$refs.galleryFile && this.$refs.galleryFile.click(); },
    async exifDate(file) {
      // Minimal-EXIF: DateTimeOriginal (0x9003) aus JPEG-APP1 lesen. Fallback: Datei-Änderungsdatum.
      try {
        const buf = new DataView(await file.slice(0, 256 * 1024).arrayBuffer());
        if (buf.getUint16(0) !== 0xFFD8) throw 0;                    // kein JPEG
        let off = 2;
        while (off < buf.byteLength - 4) {
          if (buf.getUint8(off) !== 0xFF) break;
          const marker = buf.getUint8(off + 1);
          const size = buf.getUint16(off + 2);
          if (marker === 0xE1 && buf.getUint32(off + 4) === 0x45786966) {  // "Exif"
            const t = off + 10;                                       // TIFF-Header
            const le = buf.getUint16(t) === 0x4949;                   // Byte-Order
            const g16 = (o) => buf.getUint16(o, le), g32 = (o) => buf.getUint32(o, le);
            const scanIfd = (ifd, wantTag) => {
              const n = g16(ifd);
              for (let i = 0; i < n; i++) {
                const e = ifd + 2 + i * 12;
                if (g16(e) === wantTag) return e;
              }
              return null;
            };
            const ifd0 = t + g32(t + 4);
            const exifPtr = scanIfd(ifd0, 0x8769);
            if (exifPtr) {
              const exifIfd = t + g32(exifPtr + 8);
              const dto = scanIfd(exifIfd, 0x9003);
              if (dto) {
                const strOff = t + g32(dto + 8);
                let str = "";
                for (let i = 0; i < 19; i++) str += String.fromCharCode(buf.getUint8(strOff + i));
                const m = str.match(/^(\d{4}):(\d{2}):(\d{2})/);
                if (m) return `${m[1]}-${m[2]}-${m[3]}`;
              }
            }
            break;
          }
          off += 2 + size;
        }
      } catch (_) {}
      if (file.lastModified) return new Date(file.lastModified).toISOString().slice(0, 10);
      return null;
    },
    async onScanFile(ev) {
      const file = ev.target.files && ev.target.files[0];
      ev.target.value = "";
      if (!file) return;
      if (!this.reading.id) {
        const d = await this.exifDate(file);
        if (d) { this.reading.datum = d; this.notify("Ablesedatum aus Foto: " + fmtDate(d), "ok"); }
      }
      const img = new Image();
      img.onload = () => {
        // mittleren Streifen ausschneiden (dort liegt das Zählwerk)
        const cw = img.naturalWidth, ch = img.naturalHeight;
        const cropH = Math.round(ch * 0.34);
        const canvas = document.createElement("canvas");
        canvas.width = cw; canvas.height = cropH;
        canvas.getContext("2d").drawImage(img, 0, (ch - cropH) / 2, cw, cropH, 0, 0, cw, cropH);
        URL.revokeObjectURL(img.src);
        this.runOcr(canvas);
      };
      img.src = URL.createObjectURL(file);
    },
    async captureScan() {
      if (this.scanFileMode) { this.triggerScanFile(); return; }
      const video = this.$refs.scanVideo;
      if (!video || !video.videoWidth) return;
      const cw = video.videoWidth, ch = video.videoHeight;
      const cropH = Math.round(ch * 0.28);
      const canvas = document.createElement("canvas");
      canvas.width = cw; canvas.height = cropH;
      canvas.getContext("2d").drawImage(video, 0, (ch - cropH) / 2, cw, cropH, 0, 0, cw, cropH);
      this.runOcr(canvas);
    },
    preprocessForOcr(src) {
      // Hochskalieren + Graustufen + Otsu-Threshold (empirisch auf echten Zählerfotos kalibriert).
      const scale = Math.max(1, Math.min(3, 1400 / src.width));
      const c = document.createElement("canvas");
      c.width = Math.round(src.width * scale);
      c.height = Math.round(src.height * scale);
      const ctx = c.getContext("2d");
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(src, 0, 0, c.width, c.height);
      const img = ctx.getImageData(0, 0, c.width, c.height);
      const d = img.data;
      const n = d.length / 4;
      // Graustufen + Histogramm
      const hist = new Array(256).fill(0);
      for (let i = 0; i < d.length; i += 4) {
        const g = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) | 0;
        d[i] = d[i + 1] = d[i + 2] = g;
        hist[g]++;
      }
      // Otsu-Schwelle (maximiert die Zwischenklassen-Varianz) – adaptiv statt fixem Faktor
      let sumAll = 0;
      for (let t = 0; t < 256; t++) sumAll += t * hist[t];
      let sumB = 0, wB = 0, best = 0, thr = 128;
      for (let t = 0; t < 256; t++) {
        wB += hist[t];
        if (wB === 0) continue;
        const wF = n - wB;
        if (wF === 0) break;
        sumB += t * hist[t];
        const mB = sumB / wB, mF = (sumAll - sumB) / wF;
        const between = wB * wF * (mB - mF) * (mB - mF);
        if (between > best) { best = between; thr = t; }
      }
      // Binarisieren + Polarität bestimmen
      let dark = 0;
      for (let i = 0; i < d.length; i += 4) {
        const v = d[i] <= thr ? 0 : 255;
        d[i] = d[i + 1] = d[i + 2] = v;
        if (v === 0) dark++;
      }
      // Mehr dunkel als hell -> Ziffern vermutlich hell (LCD) -> invertieren (Tesseract will dunkel/hell)
      if (dark > n / 2) {
        for (let i = 0; i < d.length; i += 4) {
          const v = 255 - d[i];
          d[i] = d[i + 1] = d[i + 2] = v;
        }
      }
      ctx.putImageData(img, 0, 0);
      return c;
    },
    pickOcrCandidate(text, modelBonus = 0) {
      // Zeilenweise auswerten: die kWh-Zeile ist das Zählwerk, Adress-/Typenschild-Zeilen nicht.
      const last = this.latestValue;
      const cands = [];
      for (let line of String(text).split(/\n/)) {
        const hasKwh = /kwh/i.test(line);
        // OBIS-Codes (1.8.0 etc.) entfernen, dann Einheiten raus
        let l = line.replace(/\b\d\.\d{1,2}\.\d\b/g, " ").replace(/kwh|m³|m3/gi, " ");
        const letters = (l.match(/[a-zäöüß]/gi) || []).length;
        l = l.replace(/(\d)[ \t]+(?=\d)/g, "$1");
        for (const m of l.match(/\d+[.,]?\d*/g) || []) {
          const num = parseFloat(m.replace(",", "."));
          const digits = m.replace(/[.,]/g, "").length;
          let score = digits + modelBonus;
          if (digits > 8) score -= 100;                 // Seriennummer o.ä.
          if (digits < 3) score -= 20;                  // 473 W etc. eher nicht das Zählwerk
          if (hasKwh) score += 200;                     // Einheit direkt daneben -> Zählwerk
          if (letters >= 4) score -= 60;                // Adresse/Typenschild
          if (last !== null && isFinite(num)) {
            if (num >= last && num <= last + 100000) score += 100;
            else if (num < last) score -= 50;
            else score -= 30;
          }
          cands.push({ m, num, score, fromKwh: hasKwh });
        }
      }
      if (!cands.length) return null;
      cands.sort((a, b) => b.score - a.score);
      return cands[0];
    },
    async runOcr(canvas) {
      this.scanBusy = true;
      this.scanStatus = "Texterkennung läuft …";
      try {
        if (typeof Tesseract === "undefined") {
          this.scanStatus = "Lade Texterkennung (einmalig) …";
          await new Promise((res, rej) => {
            const sc = document.createElement("script");
            sc.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";
            sc.onload = res; sc.onerror = () => rej(new Error("tesseract.js nicht ladbar (offline?)"));
            document.head.appendChild(sc);
          });
          this.scanStatus = "Texterkennung läuft …";
        }
        const prepped = this.preprocessForOcr(canvas);
        // Mehrere Segmentierungs-Modi: PSM 6 (Block) traf im Kalibriertest am besten,
        // PSM 11 (sparse) und 7 (Zeile) als Ergänzung. Bester Kandidat per Scoring.
        let best = null;
        for (const psm of ["6", "11", "7"]) {
          const r = await Tesseract.recognize(prepped, "eng", {
            tessedit_char_whitelist: "0123456789., kWhm³",
            tessedit_pageseg_mode: psm,
          });
          const cand = this.pickOcrCandidate(r.data.text);
          if (cand && (!best || cand.score > best.score)) best = cand;
          if (best && best.fromKwh && best.score > 200) break;   // klarer Treffer -> fertig
        }

        // Kein Treffer aus der kWh-Zeile? -> LCD vermutlich 7-Segment, Spezial-Modell versuchen
        if (!best || !best.fromKwh) {
          try {
            this.scanStatus = "Digital-Display erkannt – lade 7-Segment-Modell …";
            const r2 = await Tesseract.recognize(prepped, "letsgodigital", {
              langPath: "https://cdn.jsdelivr.net/gh/arturaugusto/display_ocr@master/letsgodigital",
              gzip: false,
              tessedit_pageseg_mode: "7",
            });
            const b2 = this.pickOcrCandidate(r2.data.text, 40);
            if (b2 && (!best || b2.score > best.score)) best = b2;
          } catch (_) { /* Modell nicht ladbar -> beim eng-Ergebnis bleiben */ }
        }

        if (best) {
          this.reading.value = best.m.replace(",", ".");
          this.notify("Erkannt: " + best.m + " – bitte prüfen!", "ok");
          this.closeScanner();
        } else {
          this.scanStatus = "Nichts erkannt – Zählwerk formatfüllend in den Rahmen, mehr Licht, nochmal versuchen.";
        }
      } catch (e) {
        this.scanStatus = "Fehler: " + e.message;
      } finally {
        this.scanBusy = false;
      }
    },

    async saveReading() {
      if (this.reading.value === null || this.reading.value === "") { this.notify("Zählerwert fehlt", "err"); return; }
      this.busy = true;
      try {
        const body = JSON.stringify({
          datum: this.reading.datum,
          value: Number(this.reading.value),
          cost: this.reading.cost === "" || this.reading.cost === null ? null : Number(this.reading.cost),
          meter_replaced: this.reading.meter_replaced,
          note: this.reading.note || null,
        });
        if (this.reading.id) {
          await api(`/api/readings/${this.reading.id}`, { method: "PUT", body });
        } else {
          await api(`/api/systems/${this.system.id}/readings`, { method: "POST", body });
        }
        this.showReading = false;
        this.notify(this.reading.id ? "Ablesung aktualisiert" : "Ablesung gespeichert", "ok");
        await this.loadDynamic();
        this.$emit("changed");   // Parent aktualisiert Kachelwerte und Fälligkeits-Badges
      } catch (e) { this.notify(e.message, "err"); }
      finally { this.busy = false; }
    },
    async deleteReading(r) {
      if (!confirm(`Ablesung vom ${fmtDate(r.datum)} löschen?`)) return;
      try { await api(`/api/readings/${r.id}`, { method: "DELETE" }); this.notify("Ablesung gelöscht", "ok"); await this.loadDynamic(); }
      catch (e) { this.notify(e.message, "err"); }
    },

    /* Import */
    openImport() { this.importFile = null; this.importResult = null; this.showImport = true; },
    downloadTemplate() {
      fetchBlobDownload("api/import/template", "import_template.csv")
        .catch((e) => this.notify("Download fehlgeschlagen: " + e.message, "err"));
    },
    openReport() {
      const q = this.fromParam ? `?from=${this.fromParam}` : "";
      const name = this.system.name.replace(/\s+/g, "_");
      fetchBlobDownload(`api/systems/${this.system.id}/report.pdf${q}`, `zaehlwerk-bericht_${name}.pdf`)
        .catch((e) => this.notify("PDF fehlgeschlagen: " + e.message, "err"));
    },
    openExport() {
      const name = this.system.name.replace(/\s+/g, "_");
      fetchBlobDownload(`api/systems/${this.system.id}/export.csv`, `zaehlwerk_${name}.csv`)
        .catch((e) => this.notify("Export fehlgeschlagen: " + e.message, "err"));
    },
    onFile(e) { this.importFile = e.target.files[0] || null; },
    async runImport() {
      if (!this.importFile) { this.notify("Keine Datei gewählt", "err"); return; }
      this.busy = true;
      try {
        const fd = new FormData(); fd.append("file", this.importFile);
        const res = await fetch(`api/systems/${this.system.id}/import`, { method: "POST", body: fd });
        if (!res.ok) throw new Error((await res.json()).detail || "Import fehlgeschlagen");
        this.importResult = await res.json();
        this.notify(`${this.importResult.imported} Werte importiert`, "ok");
        await this.loadDynamic();
      } catch (e) { this.notify(e.message, "err"); }
      finally { this.busy = false; }
    },
  },
  template: `
  <div>
    <div class="detail-head">
      <div class="dh-main">
        <div class="dh-type">{{ typeIcon(system.typ) }} {{ system.typ }} · {{ system.einheit }}</div>
        <h2>{{ system.name }}</h2>
      </div>
      <div class="counter" v-if="latestValue !== null">
        <div>
          <span class="clabel">Letzter Stand</span>
          <span class="cval">{{ fmt(latestValue, 1) }}</span>
          <span class="cunit">{{ system.einheit }}</span>
        </div>
      </div>
      <div class="dh-actions">
        <button v-if="canWrite" class="btn btn-sm" @click="$emit('edit', system)"
                title="System bearbeiten, archivieren oder löschen">✎ Bearbeiten</button>
        <button v-if="canWrite" class="btn btn-sm" @click="openImport">⇪ Import</button>
        <button v-if="canExport" class="btn btn-sm" @click="openExport">⇩ CSV</button>
        <button v-if="canExport" class="btn btn-tonal btn-sm" @click="openReport">⇩ PDF</button>
      </div>
    </div>

    <div class="tabs">
      <button class="tab" :class="{active: tab==='chart'}" @click="tab='chart'">Auswertung</button>
      <button class="tab" :class="{active: tab==='list'}" @click="tab='list'">Werte ({{ readings.length }})</button>
      <button class="tab" :class="{active: tab==='meters'}" @click="tab='meters'">Zähler<span v-if="meterCount"> ({{ meterCount }})</span></button>
      <button class="tab" :class="{active: tab==='tariffs'}" @click="tab='tariffs'">Tarife<span v-if="tariffCount"> ({{ tariffCount }})</span></button>
    </div>

    <transition name="m3sw" mode="out-in">
    <div v-if="loading" class="center-load" key="load"><span class="spin"></span></div>

    <!-- AUSWERTUNG -->
    <div v-else-if="tab==='chart'" key="chart">
      <div class="stats" v-if="stats">
        <div class="stat"><div class="s-label">Gesamtverbrauch</div><div class="s-val num">{{ fmt(stats.total_consumption) }}<span class="u">{{ system.einheit }}</span></div></div>
        <div class="stat"><div class="s-label">Ø / Tag</div><div class="s-val num">{{ fmt(stats.avg_per_day, 3) }}<span class="u">{{ system.einheit }}</span></div></div>
        <div class="stat"><div class="s-label">Gesamtkosten <span v-if="stats.cost_estimated" class="s-tag">≈ inkl. Schätzung</span></div><div class="s-val num">{{ stats.cost_estimated ? '≈ ' : '' }}{{ fmt(stats.total_cost) }}<span class="u">€</span></div></div>
        <div class="stat"><div class="s-label">Kosten / Einheit <span v-if="stats.cost_estimated" class="s-tag">≈</span></div><div class="s-val num">{{ fmt(stats.cost_per_unit, 4) }}<span class="u">€</span></div></div>
        <div class="stat"><div class="s-label">Max / Tag</div><div class="s-val num">{{ fmt(stats.max_per_day, 3) }}</div><div class="s-sub">{{ fmtDate(stats.max_per_day_datum) }}</div></div>
        <div class="stat"><div class="s-label">Min / Tag</div><div class="s-val num">{{ fmt(stats.min_per_day, 3) }}</div><div class="s-sub">{{ fmtDate(stats.min_per_day_datum) }}</div></div>
        <div class="stat" v-if="gasKwh"><div class="s-label">Gesamt in kWh <span class="s-tag">Zusatz</span></div><div class="s-val num">{{ fmt(gasKwh.total) }}<span class="u">kWh</span></div><div class="s-sub">Brennwert × Zustandszahl = {{ fmt(gasKwh.faktor, 3) }}</div></div>
        <div class="stat tariff" v-if="stats.total_cost_tariff !== null && stats.total_cost_tariff !== undefined">
          <div class="s-label">Kosten nach Tarif
            <span class="s-tag" v-if="stats.coverage_ratio < 1">{{ Math.round(stats.coverage_ratio*100) }} % abgedeckt</span>
          </div>
          <div class="s-val num">{{ fmt(stats.total_cost_tariff) }}<span class="u">€</span></div>
          <div class="s-sub">{{ fmt(stats.total_energy_cost) }} € Arbeit + {{ fmt(stats.total_base_cost) }} € Grund</div>
        </div>
        <div class="stat tariff" v-if="stats.avg_price_effective">
          <div class="s-label">Effektivpreis <span class="s-tag">inkl. Grundgebühr</span></div>
          <div class="s-val num">{{ fmt(stats.avg_price_effective, 4) }}<span class="u">€/{{ system.einheit }}</span></div>
          <div class="s-sub">{{ stats.covered_intervals }} Intervalle mit Tarif</div>
        </div>
        <div class="stat forecast" v-if="forecast"><div class="s-label">⌁ Hochrechnung Jahr <span class="s-tag warn">Prognose</span></div><div class="s-val num">{{ fmt(forecast.cons) }}<span class="u">{{ system.einheit }}</span></div><div class="s-sub" v-if="forecast.cost !== null">≈ {{ fmt(forecast.cost) }} € Kosten</div></div>
      </div>

      <div class="card">
        <div class="chart-controls">
          <div class="seg">
            <button v-for="m in [['consumption','Verbrauch'],['per_day','pro Tag'],['value','Zählerstand']]" :key="m[0]" :class="{active: mode===m[0]}" @click="mode=m[0]">{{ m[1] }}</button>
          </div>
          <div class="seg">
            <button :class="{active: chartType==='line'}" @click="chartType='line'">Linie</button>
            <button :class="{active: chartType==='bar'}" @click="chartType='bar'">Balken</button>
          </div>
          <div class="seg">
            <button v-for="r in [['week','Woche'],['month','Monat'],['year','Jahr'],['all','Alles']]" :key="r[0]" :class="{active: range===r[0]}" @click="range=r[0]">{{ r[1] }}</button>
          </div>
          <div class="seg" v-if="overlayOptions.length" style="flex-wrap:wrap">
            <button v-for="s in overlayOptions" :key="s.id"
                    :class="{active: overlayIds.includes(s.id)}"
                    @click="toggleOverlay(s.id)" :title="'System überlagern: ' + s.name">
              + {{ s.name }}
            </button>
          </div>
        </div>
        <energy-chart :labels="chart.labels" :datasets="chart.datasets" :chart-type="chartType" :has-y2="chart.hasY2" :y2-label="chart.y2Label" />
        <div class="legend-hint">
          <span><span class="dot" :style="{background: chartData ? chartData.color : '#0e7c86'}"></span>{{ modeLabel }}</span>
          <span><span class="dot" :style="{background: outlierColor}"></span>Ausreißer (Ø + 2σ)</span>
        </div>
      </div>
    </div>

    <!-- WERTE-TABELLE -->
    <div v-else-if="tab==='list'" key="list">
      <div class="table-tools">
        <input class="input" v-model="filter" placeholder="Filtern (Notiz / Datum)…" />
        <label class="check"><input type="checkbox" v-model="onlyOutliers" /> nur Ausreißer</label>
        <div class="spacer" style="flex:1"></div>
      </div>

      <div v-if="!readings.length" class="empty">
        <h3>Noch keine Werte</h3>
        <p>Erfasse deine erste Ablesung oder importiere die bestehende Historie per CSV.</p>
        <button class="btn btn-primary" @click="openReading">Erste Ablesung erfassen</button>
      </div>

      <div class="card" v-else>
        <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th @click="setSort('datum')">Datum <span class="arrow">{{ arrow('datum') }}</span></th>
              <th @click="setSort('value')" class="r">Zählerstand <span class="arrow">{{ arrow('value') }}</span></th>
              <th @click="setSort('consumption')" class="r">Verbrauch <span class="arrow">{{ arrow('consumption') }}</span></th>
              <th @click="setSort('cost')" class="r col-cost">Kosten <span class="arrow">{{ arrow('cost') }}</span></th>
              <th class="col-note">Notiz</th>
              <th class="col-del"></th>
            </tr>
          </thead>
          <tbody>
            <template v-for="r in paged" :key="r.id">
            <tr class="row-main" :class="{expanded: expandedId===r.id}" @click="toggleRow(r.id)">
              <td>{{ fmtDate(r.datum) }}</td>
              <td class="r num">{{ fmt(r.value, 1) }}</td>
              <td class="r num">
                {{ fmt(r.consumption) }}
                <span v-if="r.meter_replaced" class="tag tag-swap">Tausch</span>
                <span v-if="r.is_outlier" class="tag tag-out">Ausreißer</span>
                <span class="chevron" aria-hidden="true">{{ expandedId===r.id ? '▾' : '▸' }}</span>
              </td>
              <td class="r num col-cost">{{ r.cost_effective === null || r.cost_effective === undefined ? '–' : (r.cost_estimated ? '≈ ' : '') + fmt(r.cost_effective) }}</td>
              <td class="col-note">{{ r.note || '' }}</td>
              <td class="r col-del" style="white-space:nowrap">
                <button class="iconbtn" style="width:32px;height:32px" @click.stop="openEditReading(r)" title="Bearbeiten">✎</button>
                <hold-button :small="true" :round="true" @held="deleteReading(r)">✕</hold-button>
              </td>
            </tr>
            <tr v-if="expandedId===r.id" class="row-detail">
              <td colspan="6">
                <div class="detail-grid">
                  <div><span class="dg-label">Kosten</span><span class="num">{{ r.cost_effective === null || r.cost_effective === undefined ? '–' : (r.cost_estimated ? '≈ ' : '') + fmt(r.cost_effective) + ' €' }}<span v-if="r.cost_estimated" class="hint-inline"> (geschätzt via Ø-Preis)</span></span></div>
                  <div><span class="dg-label">Verbrauch/Tag</span><span class="num">{{ fmt(r.consumption_per_day, 3) }}</span></div>
                  <div v-if="r.note"><span class="dg-label">Notiz</span><span>{{ r.note }}</span></div>
                  <div style="display:flex;gap:8px">
                    <button class="btn btn-sm btn-tonal" @click.stop="openEditReading(r)">✎ Bearbeiten</button>
                    <hold-button :small="true" @held="deleteReading(r)">✕ Löschen (halten)</hold-button>
                  </div>
                </div>
              </td>
            </tr>
            </template>
          </tbody>
        </table>
        </div>
        <div class="pager" v-if="pageCount > 1">
          <button class="btn btn-sm" :disabled="page<=1" @click="page--">‹ Zurück</button>
          <span>Seite {{ page }} / {{ pageCount }}</span>
          <button class="btn btn-sm" :disabled="page>=pageCount" @click="page++">Weiter ›</button>
        </div>
      </div>
    </div>

    <!-- TAB: Zähler + Hardware-Empfehlung -->
    <div v-else-if="tab==='meters'" key="meters">
      <div v-if="!metersLoaded" class="center-load"><span class="spin"></span></div>
      <div class="empty" v-else-if="!meters.length">
        <h3>Noch kein Zähler hinterlegt</h3>
        <p>Trag Hersteller, Modell und Bauart ein – daraus leitet Zählwerk passende Auslese-Hardware für die Smart-Meter-Nachrüstung ab.</p>
        <button class="btn btn-primary" v-if="canWrite" @click="openMeter(null)">＋ Zähler anlegen</button>
      </div>

      <div v-else>
        <div class="eyebrow">
          Zähler
          <button class="btn btn-sm" v-if="canWrite" @click="openMeter(null)">＋ Zähler</button>
        </div>

        <div v-for="m in meters" :key="m.id" class="card meter-card" :class="{removed: !m.aktiv}">
          <div class="meter-head">
            <div>
              <div class="m-title">
                {{ m.hersteller || 'Hersteller unbekannt' }}<span v-if="m.modell"> · {{ m.modell }}</span>
              </div>
              <div class="m-sub">
                <span v-if="m.bauart">{{ m.bauart }}</span>
                <span v-if="m.zaehlernummer" class="num">Nr. {{ m.zaehlernummer }}</span>
                <span v-if="!m.aktiv">ausgebaut {{ fmtDate(m.ausgebaut_am) }}</span>
              </div>
            </div>
            <div class="m-actions" v-if="canWrite">
              <button class="btn btn-sm" @click="openMeter(m)">✎</button>
              <hold-button :small="true" @held="deleteMeter(m)">✕ halten</hold-button>
            </div>
          </div>

          <div v-if="eichungLabel(m)" class="due-badge" :class="eichungLabel(m).level">
            {{ eichungLabel(m).level === 'ok' ? '✓' : '⚠' }} {{ eichungLabel(m).text }}
          </div>

          <!-- Auto-Suggest -->
          <div class="hw-block" v-if="m.aktiv">
            <div class="hw-head">Auslese-Hardware</div>
            <div v-for="s in suggestFor(m)" :key="s.id" class="hw-item" :class="'conf-' + s.confidence">
              <div class="hw-top">
                <span class="hw-titel">{{ s.titel }}</span>
                <span class="hw-conf">{{ s.conf.label }}</span>
              </div>
              <div class="hw-grund">erkannt an: {{ s.grund }}</div>
              <ul class="hw-list"><li v-for="(h,i) in s.hardware" :key="i">{{ h }}</li></ul>
              <div class="hw-hinweis">{{ s.hinweis }}</div>
            </div>
            <div class="hint hw-disclaimer">
              Vorschläge ohne Gewähr. Zähler sind plombiert – alle genannten Verfahren arbeiten
              berührungslos von außen. Plomben nicht öffnen, Zähler nicht umbauen.
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- TAB: Tarife -->
    <div v-else-if="tab==='tariffs'" key="tariffs">
      <div v-if="!tariffsLoaded" class="center-load"><span class="spin"></span></div>
      <div class="empty" v-else-if="!tariffs.length">
        <h3>Noch kein Tarif hinterlegt</h3>
        <p>Mit Arbeitspreis und Grundgebühr je Zeitraum rechnet Zählwerk die Kosten
           jedes Intervalls selbst aus – auch wenn mitten darin der Tarif gewechselt hat.</p>
        <button class="btn btn-primary" v-if="canWrite" @click="openTariff(null)">＋ Tarif anlegen</button>
      </div>
      <div v-else>
        <div class="eyebrow">Tarife <button class="btn btn-sm" v-if="canWrite" @click="openTariff(null)">＋ Tarif</button></div>
        <div v-for="t in tariffs" :key="t.id" class="card tariff-card" :class="{current: t.aktiv}">
          <div class="tf-head">
            <div>
              <div class="tf-name">{{ t.name || 'Ohne Bezeichnung' }}<span v-if="t.anbieter"> · {{ t.anbieter }}</span></div>
              <div class="tf-range">{{ tariffRange(t) }}<span v-if="t.aktiv" class="tf-now">aktuell</span></div>
            </div>
            <div class="m-actions" v-if="canWrite">
              <button class="btn btn-sm" @click="openTariff(t)">✎</button>
              <hold-button :small="true" @held="deleteTariff(t)">✕ halten</hold-button>
            </div>
          </div>
          <div class="tf-prices">
            <span><small>Arbeitspreis</small>{{ fmt(t.arbeitspreis, 4) }} €/{{ system.einheit }}</span>
            <span><small>Grundpreis</small>{{ fmt(t.grundpreis, 2) }} €/Monat</span>
          </div>
          <div class="hint" v-if="t.notiz">{{ t.notiz }}</div>
        </div>
      </div>
    </div>

    </transition>

    <!-- MODAL: Tarif -->
    <div class="overlay" v-if="showTariff" @click.self="showTariff=false">
      <div class="modal" v-if="tariffForm">
        <div class="modal-head"><h3>{{ tariffForm.id ? 'Tarif bearbeiten' : 'Neuer Tarif' }}</h3></div>
        <div class="modal-body">
          <div class="field-row">
            <div class="field"><label>Bezeichnung</label>
              <input class="input" v-model="tariffForm.name" placeholder="z. B. Grundversorgung 2024" /></div>
            <div class="field"><label>Anbieter</label>
              <input class="input" v-model="tariffForm.anbieter" /></div>
          </div>
          <div class="field-row">
            <div class="field"><label>Gültig ab</label>
              <input class="input" type="date" v-model="tariffForm.gueltig_ab" /></div>
            <div class="field"><label>Gültig bis</label>
              <input class="input" type="date" v-model="tariffForm.gueltig_bis" />
              <div class="hint">Leer = läuft bis auf Weiteres.</div></div>
          </div>
          <div class="field-row">
            <div class="field"><label>Arbeitspreis (€/{{ system.einheit }})</label>
              <input class="input" type="number" step="0.0001" min="0" inputmode="decimal"
                     v-model="tariffForm.arbeitspreis" placeholder="0,2950" /></div>
            <div class="field"><label>Grundpreis (€/Monat)</label>
              <input class="input" type="number" step="0.01" min="0" inputmode="decimal"
                     v-model="tariffForm.grundpreis" /></div>
          </div>
          <label class="tf"><input class="tf-input" v-model="tariffForm.notiz" placeholder=" " /><span class="tf-label">Notiz (optional)</span></label>
          <div class="hint">
            Zeiträume dürfen sich nicht überschneiden – sonst wäre für einen Tag nicht
            eindeutig, welcher Preis gilt. Der Server weist das ab.
          </div>
        </div>
        <div class="modal-foot">
          <button class="btn" @click="showTariff=false">Abbrechen</button>
          <button class="btn btn-primary" :disabled="busy" @click="saveTariff">Speichern</button>
        </div>
      </div>
    </div>

    <!-- MODAL: Zähler -->
    <div class="overlay" v-if="showMeter" @click.self="showMeter=false">
      <div class="modal">
        <div class="modal-head"><h3>{{ meterForm.id ? 'Zähler bearbeiten' : 'Neuer Zähler' }}</h3></div>
        <div class="modal-body">
          <div class="field-row">
            <div class="field"><label>Hersteller</label>
              <input class="input" v-model="meterForm.hersteller" placeholder="z. B. Pipersberg" /></div>
            <div class="field"><label>Modell</label>
              <input class="input" v-model="meterForm.modell" placeholder="z. B. mMe4.0" /></div>
          </div>
          <div class="field">
            <label>Bauart</label>
            <input class="input" v-model="meterForm.bauart" list="zw-bauarten" placeholder="Vorschläge verfügbar" />
            <datalist id="zw-bauarten"><option v-for="b in bauarten" :key="b" :value="b"></option></datalist>
          </div>

          <!-- Live-Vorschau: reagiert auf jede Eingabe, noch vor dem Speichern -->
          <div class="hw-preview" v-if="suggestFor(meterForm).length">
            <div class="hw-head">Passende Hardware</div>
            <div v-for="s in suggestFor(meterForm)" :key="s.id" class="hw-item" :class="'conf-' + s.confidence">
              <div class="hw-top">
                <span class="hw-titel">{{ s.titel }}</span>
                <span class="hw-conf">{{ s.conf.label }}</span>
              </div>
              <ul class="hw-list"><li v-for="(h,i) in s.hardware" :key="i">{{ h }}</li></ul>
            </div>
          </div>

          <div class="field-row">
            <div class="field"><label>Zählernummer</label>
              <input class="input" v-model="meterForm.zaehlernummer" /></div>
            <div class="field"><label>Baujahr</label>
              <input class="input" type="number" inputmode="numeric" min="1900" max="2100" v-model="meterForm.baujahr" /></div>
          </div>
          <div class="field-row">
            <div class="field"><label>Eichung gültig bis</label>
              <input class="input" type="date" v-model="meterForm.eichung_bis" /></div>
            <div class="field"><label>Messstellenbetreiber</label>
              <input class="input" v-model="meterForm.messstellenbetreiber" /></div>
          </div>
          <div class="field-row">
            <div class="field"><label>Stellen vor dem Komma</label>
              <input class="input" type="number" inputmode="numeric" min="1" max="12" v-model="meterForm.stellen_vor" /></div>
            <div class="field"><label>Stellen nach dem Komma</label>
              <input class="input" type="number" inputmode="numeric" min="0" max="6" v-model="meterForm.stellen_nach" /></div>
          </div>
          <div class="field-row">
            <div class="field"><label>Eingebaut am</label>
              <input class="input" type="date" v-model="meterForm.eingebaut_am" /></div>
            <div class="field"><label>Ausgebaut am</label>
              <input class="input" type="date" v-model="meterForm.ausgebaut_am" /></div>
          </div>
          <label class="tf"><input class="tf-input" v-model="meterForm.notiz" placeholder=" " /><span class="tf-label">Notiz (optional)</span></label>
        </div>
        <div class="modal-foot">
          <button class="btn" @click="showMeter=false">Abbrechen</button>
          <button class="btn btn-primary" :disabled="busy" @click="saveMeter">Speichern</button>
        </div>
      </div>
    </div>

    <!-- MODAL: Ablesung -->
    <div class="overlay" v-if="showReading" @click.self="showReading=false">
      <div class="modal">
        <div class="modal-head"><h3>{{ reading.id ? 'Ablesung bearbeiten' : 'Neue Ablesung' }} – {{ system.name }}</h3></div>
        <div class="modal-body">
          <!-- Primaerfeld zuerst und ueber die volle Breite: im Keller wird
               zuerst der Zaehlerstand getippt, das Datum ist vorbelegt. -->
          <div class="field reading-value">
            <div class="input-scan">
              <label class="tf"><input class="tf-input" type="number" step="any"
                     inputmode="decimal" enterkeyhint="done" autocomplete="off"
                     v-model="reading.value" placeholder=" " ref="valueInput" /><span class="tf-label">Zählerstand ({{ system.einheit }})</span></label>
              <button class="btn scan-trigger" @click="openScanner"
                      aria-label="Zählerstand per Kamera scannen" title="Zählerstand per Kamera scannen (Beta)">📷</button>
            </div>
          </div>
          <div class="field"><label>Datum</label><input class="input" type="date" v-model="reading.datum" /></div>
          <label class="tf"><input class="tf-input" type="number" step="any"
                 inputmode="decimal" autocomplete="off"
                 v-model="reading.cost" placeholder=" " /><span class="tf-label">Kosten € (optional)</span></label>
          <div class="field">
            <button v-if="haEntity && !reading.id" class="btn btn-tonal btn-sm" style="margin-bottom:14px" :disabled="busy" @click="fetchHaValue">⌂ Zählerstand aus Home Assistant übernehmen</button>
            <label class="check"><input type="checkbox" v-model="reading.meter_replaced" /> Startstand NEUER Zähler (Zählertausch)</label>
            <div class="hint" v-if="reading.meter_replaced">Vorgehen beim Tausch: <strong>1.</strong> Endstand des alten Zählers als normale Ablesung erfassen. <strong>2.</strong> Diesen Eintrag hier mit dem Startstand des neuen Zählers (meist 0) anlegen – gleiches Datum ist ok.</div>
            <div class="hint" v-if="latestValue!==null && !reading.meter_replaced">Letzter Stand: {{ fmt(latestValue,1) }} {{ system.einheit }} – neuer Wert muss ≥ sein.</div>
          </div>
          <label class="tf"><input class="tf-input" v-model="reading.note" placeholder=" " /><span class="tf-label">Notiz (optional)</span></label>
        </div>
        <div class="modal-foot">
          <button class="btn" @click="showReading=false">Abbrechen</button>
          <button class="btn btn-primary" :disabled="busy" @click="saveReading">Speichern</button>
        </div>
      </div>
    </div>

    <!-- OVERLAY: OCR-Scanner -->
    <div class="overlay" v-if="showScanner" @click.self="closeScanner">
      <div class="modal modal-scan">
        <div class="modal-head"><h3>📷 Zählerstand scannen <span class="beta">Beta</span></h3></div>
        <div class="modal-body">
          <div class="scan-stage" v-if="!scanFileMode">
            <video ref="scanVideo" playsinline muted></video>
            <div class="scan-frame"></div>
          </div>
          <button v-else class="scan-filebtn" @click="triggerScanFile">📷 Foto mit nativer Kamera aufnehmen</button>
          <button class="scan-filebtn scan-gallery" @click="triggerGalleryFile">🖼 Foto aus Galerie wählen<br /><small>Ablesedatum wird aus den Foto-Metadaten übernommen</small></button>
          <input ref="scanFile" type="file" accept="image/*" capture="environment" style="display:none" @change="onScanFile" />
          <input ref="galleryFile" type="file" accept="image/*" style="display:none" @change="onScanFile" />
          <div class="hint" style="margin-top:8px">{{ scanStatus }}</div>
          <button v-if="!scanFileMode" class="crumb" style="margin-top:6px" @click="scanFileMode=true; closeStreamOnly()">Stream klappt nicht? → Stattdessen natives Foto nutzen</button>
          <div class="hint"><strong>Beta.</strong> Für beste Ergebnisse: Zählwerk <strong>formatfüllend</strong> und <strong>gerade</strong> in den Rahmen, gutes Licht, keine Spiegelung. Am zuverlässigsten bei geraden schwarz-weißen Rollenzählwerken. Digitale LCD-Displays und runde/schräge Zähler sind fehleranfällig – Wert immer prüfen.</div>
        </div>
        <div class="modal-foot">
          <button class="btn" @click="closeScanner">Abbrechen</button>
          <button class="btn btn-primary" :disabled="scanBusy" @click="captureScan">{{ scanBusy ? 'Erkenne …' : (scanFileMode ? 'Foto aufnehmen' : 'Auslösen') }}</button>
        </div>
      </div>
    </div>

    <!-- MODAL: Import -->
    <div class="overlay" v-if="showImport" @click.self="showImport=false">
      <div class="modal">
        <div class="modal-head"><h3>CSV-Import – {{ system.name }}</h3></div>
        <div class="modal-body">
          <p class="hint">Spalten: <code>datum, wert, kosten, zaehlertausch, notiz</code>. Datum als <code>JJJJ-MM-TT</code> oder <code>TT.MM.JJJJ</code>.</p>
          <div class="field"><button class="btn btn-sm" @click="downloadTemplate">⤓ Vorlage herunterladen</button></div>
          <div class="field"><label>CSV-Datei</label><input class="input" type="file" accept=".csv" @change="onFile" /></div>
          <div v-if="importResult" class="hint">
            <strong>{{ importResult.imported }}</strong> importiert, {{ importResult.skipped }} übersprungen.
            <ul v-if="importResult.errors.length"><li v-for="(e,i) in importResult.errors" :key="i">{{ e }}</li></ul>
          </div>
        </div>
        <div class="modal-foot">
          <button class="btn" @click="showImport=false">Schließen</button>
          <button class="btn btn-primary" :disabled="busy || !importFile" @click="runImport">Importieren</button>
        </div>
      </div>
    </div>
  </div>
  `,
};

/* =========================================================================
   Root-App
   ========================================================================= */
createApp({
  components: { SystemDetail, HoldButton },
  provide() { return { notify: this.notify }; },
  data: () => ({
    systems: [],
    loading: true,
    view: "menu",
    selected: null,
    showArchived: false,
    showSystem: false,
    sysForm: null,
    busy: false,
    toast: null,
    palette: PALETTE,
    palettes: PALETTES,
    contrasts: CONTRASTS,
    chartColorKeys: CHART_COLOR_KEYS,
    chartPrefs,
    types: SYSTEM_TYPES,
    latest: {},                // system_id -> { value, datum }
    showChangelog: false,
    /* Sektion A: serverseitige Anwendungsparameter */
    appSettings: null,
    appSettingsDraft: null,
    settingsErrors: {},
    settingsSaving: false,
    sysInfo: null,
    extStatus: null,
    backupStatus: null,
    backupBusy: false,
    mqttStatus: null,
    mqttPassword: "",
    assignTarget: {},
    settingsTab: "app",
    /* Pre-Export-Dialog */
    showExportCfg: false,
    expCfg: null,
    appVersion: APP_VERSION,
    changelog: APP_CHANGELOG,
    /* Sidebar: navExpanded = Desktop (Rail <-> Drawer), navDrawer = Mobile-Overlay */
    navExpanded: localStorage.getItem("zw_nav_expanded") === "1",
    navDrawer: false,
    navItems: NAV_ITEMS,
    navSubOpen: localStorage.getItem("zw_nav_sub") === "1",
    showSysSheet: false,
    auth: authStore,
    authForm: { username: "", display_name: "", password: "", password2: "" },
    authError: null,
    authBusy: false,
    users: [],
    adminDiag: null,
    adminSchema: [],
    adminLogs: [],
    adminTab: "diag",
    logLevel: "INFO",
    sqlText: "SELECT name, typ, einheit FROM systems ORDER BY name",
    sqlResult: null,
    sqlError: null,
    sqlBusy: false,
  }),
  computed: {
    visibleSystems() { return this.systems.filter((s) => this.showArchived || s.aktiv); },
    selectedSystem() { return this.systems.find((s) => s.id === this.selected) || null; },
    formExtra() { return this.sysForm ? [...(EXTRA_FIELDS[this.sysForm.typ] || []), ...COMMON_FIELDS] : []; },
    themeMode() { return themeStore.mode; },
    themePalette() { return themeStore.palette; },
    themeContrast() { return themeStore.contrast; },
    /* aktiver Navigationspunkt (Einstellungen als Modal hat Vorrang vor der Ansicht) */
    activeNav() {
      if (this.view === "settings") return "einstellungen";
      if (this.view === "admin") return "admin";
      return "zaehlwerk";
    },
    navMenuIcon() { return SVG.menu; },
    chevronIcon() { return SVG.chevron; },
    navHomeIcon() { return SVG.home; },
    /* Maske nur zeigen, wenn der Status bekannt UND die Anmeldung nötig ist.
       Vor der ersten Antwort würde sie sonst kurz aufblitzen. */
    authNeeded() {
      const s = this.auth.status;
      return !!(this.auth.checked && s && !s.authenticated);
    },
    currentUser() { return (this.auth.status || {}).user || null; },
    authRoles() { return (this.auth.status || {}).roles || []; },
    /* Einzige Quelle für die Sichtbarkeit im UI. Sie kommt vom Server, damit
       Oberfläche und Middleware nicht auseinanderlaufen können. Das Ausblenden
       ist Bequemlichkeit – durchgesetzt werden die Rechte im Backend. */
    perms() { return perms(); },
    canWrite() { return !!this.perms.write; },
    isAdmin() { return !!this.perms.admin; },
    canExport() { return !!this.perms.export; },
    setupValid() {
      const f = this.authForm;
      return f.username.trim().length >= 3 && f.password.length >= 12
             && f.password === f.password2;
    },
    /* Unterpunkte = aktive Systeme in der Reihenfolge der Übersicht.
       Archivierte bleiben draußen: die Sidebar ist ein Sprungziel für den
       Alltag, nicht der Ort, an dem Altbestand verwaltet wird. */
    navSubItems() { return this.systems.filter((s) => s.aktiv); },
    fabLabel() {
      if (this.view === "menu") return "System";
      const d = this.$refs.detail;
      return d && d.tab === "meters" ? "Zähler" : "Wert";
    },
    visibleNavItems() {
      return this.navItems.filter((i) => {
        if (i.needsSystems && !this.systems.length) return false;
        if (i.key === "einstellungen" && !this.isAdmin) return false;
        if (i.adminOnly && !this.isAdmin) return false;
        if (i.key === "bericht" && !this.canExport) return false;
        return true;
      });
    },
  },
  async mounted() {
    // Rückruf des Interceptors: bei 401 wird der Status neu geholt, wodurch
    // die Maske erscheint – ohne dass jede Aufrufstelle das selbst behandeln muss.
    onUnauthorized = () => { this.auth.checked = true; };
    this.applyNavClass();
    window.addEventListener("keydown", this.onNavKey);
    window.addEventListener("resize", this.onNavResize);
    if (await this.checkAuth()) await this.load();
  },
  unmounted() {
    window.removeEventListener("keydown", this.onNavKey);
    window.removeEventListener("resize", this.onNavResize);
  },
  methods: {
    fmt, typeIcon, fmtDate,

    /* ---------- Sidebar ---------- */
    isCompact() { return window.innerWidth <= NAV_BREAKPOINT; },
    applyNavClass() { document.body.classList.toggle("nav-expanded", this.navExpanded); },
    toggleNav() {
      // Unterhalb des Breakpoints gibt es ausschliesslich die Bottom-Bar; der
      // Menue-Button ist dort per CSS ausgeblendet. Der Guard bleibt als
      // Absicherung, falls der Klick auf anderem Weg ausgeloest wird.
      if (this.isCompact()) return;
      this.navExpanded = !this.navExpanded;
      localStorage.setItem("zw_nav_expanded", this.navExpanded ? "1" : "0");
      // navSubOpen bleibt gespeichert: klappt die Rail wieder auf, steht die
      // Unterliste so, wie der Nutzer sie zuletzt verlassen hat.
      this.applyNavClass();
    },
    closeDrawer() { this.navDrawer = false; },
    toggleNavSub() {
      this.navSubOpen = !this.navSubOpen;
      localStorage.setItem("zw_nav_sub", this.navSubOpen ? "1" : "0");
    },
    goSystem(s) {
      this.closeDrawer();
      this.open(s);
    },

    /* ---------- Anmeldung ---------- */
    async checkAuth() {
      try {
        this.auth.status = await api("/api/auth/status");
      } catch (_) {
        this.auth.status = { authenticated: false, setup_required: false,
                             mode: "lokal", crypto_available: true };
      } finally {
        this.auth.checked = true;
      }
      return this.auth.status.authenticated;
    },
    async doLogin() {
      this.authBusy = true; this.authError = null;
      try {
        await api("/api/auth/login", {
          method: "POST",
          body: JSON.stringify({ username: this.authForm.username.trim(),
                                 password: this.authForm.password }),
        });
        this.authForm = { username: "", display_name: "", password: "", password2: "" };
        await this.checkAuth();
        await this.load();
      } catch (e) { this.authError = e.message; }
      finally { this.authBusy = false; }
    },
    async doSetup() {
      if (!this.setupValid) return;
      this.authBusy = true; this.authError = null;
      try {
        await api("/api/auth/setup", {
          method: "POST",
          body: JSON.stringify({ username: this.authForm.username.trim(),
                                 display_name: this.authForm.display_name || null,
                                 password: this.authForm.password }),
        });
        this.authForm = { username: "", display_name: "", password: "", password2: "" };
        await this.checkAuth();
        await this.load();
      } catch (e) { this.authError = e.message; }
      finally { this.authBusy = false; }
    },
    async doLogout() {
      try { await api("/api/auth/logout", { method: "POST" }); } catch (_) {}
      await this.checkAuth();
    },

    /* ---------- Mobile Bottom Sheet ---------- */
    /* M3: die Primäraktion eines Navigationsziels muss immer zuerst greifen.
       Der erste Tipp führt daher zur Übersicht; erst ein Tipp auf das BEREITS
       aktive Ziel öffnet die Systemauswahl. So ist die Übersicht nie hinter
       einem Overlay versteckt, und der Pfeil am aktiven Eintrag zeigt an,
       dass dort noch etwas liegt. */
    goNavMobile(item) {
      if (item.expandable && this.navSubItems.length && this.activeNav === item.key) {
        this.showSysSheet = true;
        return;
      }
      this.goNav(item);
    },
    sheetGoOverview() {
      this.showSysSheet = false;
      this.back();
    },
    sheetGoSystem(s) {
      this.showSysSheet = false;
      this.open(s);
    },
    sheetNewSystem() {
      this.showSysSheet = false;
      this.newSystem();
    },
    onNavKey(ev) {
      if (ev.key !== "Escape") return;
      if (this.showSysSheet) { this.showSysSheet = false; return; }
      if (this.navDrawer) this.navDrawer = false;
    },
    /* Beim Wechsel auf einen schmalen Viewport darf kein Drawer offen bleiben,
       sonst laege er unsichtbar ueber der Bottom-Bar und blockierte Klicks. */
    onNavResize() {
      if (this.isCompact() && this.navDrawer) this.navDrawer = false;
      if (!this.isCompact() && this.showSysSheet) this.showSysSheet = false;
    },
    openAdmin() {
      this.view = "admin";
      window.scrollTo(0, 0);
      this.loadAdmin();
    },
    async loadAdmin() {
      try {
        const [d, s] = await Promise.all([
          api("/api/admin/diagnostics"), api("/api/admin/schema"),
        ]);
        this.adminDiag = d;
        this.adminSchema = s.tables;
      } catch (e) { this.notify(e.message, "err"); }
      this.loadAdminLogs();
    },
    async loadAdminLogs() {
      try {
        const r = await api(`/api/admin/logs?lines=200&level=${this.logLevel}`);
        this.adminLogs = r.entries;
      } catch (_) { this.adminLogs = []; }
    },
    async runQuery() {
      if (!this.sqlText.trim()) return;
      this.sqlBusy = true; this.sqlError = null;
      try {
        this.sqlResult = await api("/api/admin/query", {
          method: "POST", body: JSON.stringify({ sql: this.sqlText }),
        });
      } catch (e) { this.sqlError = e.message; this.sqlResult = null; }
      finally { this.sqlBusy = false; }
    },
    useSample(sql) { this.sqlText = sql; this.runQuery(); },

    openSettings() {
      this.view = "settings";
      window.scrollTo(0, 0);
      this.loadSettings();
    },
    goNav(item) {
      if (item.disabled || !item.action) return;
      this.closeDrawer();
      this[item.action]();
    },
    notify(msg, type = "ok") { this.toast = { msg, type }; setTimeout(() => (this.toast = null), 3200); },
    async load() {
      this.loading = true;
      try {
        this.systems = await api("/api/systems?include_archived=true");
        try { this.latest = await api("/api/overview"); } catch (_) { this.latest = {}; }
      } catch (e) { this.notify(e.message, "err"); }
      finally { this.loading = false; }
    },
    open(s) {
      this.selected = s.id;
      this.view = "detail";
      // Kontext zeigen: wer in ein System springt, sieht in der Sidebar, wo er ist
      if (this.navExpanded && !this.navSubOpen) this.toggleNavSub();
      window.scrollTo(0, 0);
    },
    back() { this.view = "menu"; this.selected = null; this.load(); },
    exportAll() {
      fetchBlobDownload("api/export.zip", "zaehlwerk-backup.zip")
        .then(() => this.notify("Backup erstellt (alle Systeme + Konfiguration)", "ok"))
        .catch((e) => this.notify("Export fehlgeschlagen: " + e.message, "err"));
    },
    /* Sammelt die Theme-Farben aus dem lebenden CSS – so spiegelt der Export
       exakt die aktive Palette samt Kontraststufe und Nutzer-Chartfarben.
       Der Export ist ein Dokument auf weißem Papier: im Dunkelmodus wären die
       hellen Rollen unbrauchbar, deshalb wird dort auf die Hell-Werte gemappt. */
    exportTheme() {
      const dark = themeStore.dark;
      const v = (n, fb) => cssVar(n) || fb;
      return {
        accent:   dark ? v("--md-primary-container", "#0e7c86") : v("--md-primary", "#0e7c86"),
        ink:      dark ? "#172533" : v("--md-on-surface", "#172533"),
        ink_soft: dark ? "#5b6b7b" : v("--md-on-surface-variant", "#5b6b7b"),
        line:     dark ? "#cfd8e1" : v("--md-outline-variant", "#cfd8e1"),
        warn:     chartColor("outlier", "#d9820a"),
      };
    },
    openExportConfig() {
      const t = this.exportTheme();
      this.expCfg = {
        format: "pdf",
        preset: "all",
        from: "", to: "",
        systemIds: this.systems.filter((s) => s.aktiv).map((s) => s.id),
        includeInactive: false,
        useTheme: true,
        systemColors: true,
        includeChart: true,
        includeTable: true,
        dialect: "de",
        includeDerived: true,
        includeMeta: true,
        theme: t,
      };
      this.showExportCfg = true;
    },
    expApplyPreset(p) {
      const c = this.expCfg;
      c.preset = p;
      const today = new Date();
      const iso = (d) => d.toISOString().slice(0, 10);
      if (p === "all") { c.from = ""; c.to = ""; return; }
      if (p === "ytd") { c.from = `${today.getFullYear()}-01-01`; c.to = iso(today); return; }
      if (p === "12m") {
        const d = new Date(today); d.setFullYear(d.getFullYear() - 1);
        c.from = iso(d); c.to = iso(today); return;
      }
      if (p === "lastyear") {
        const y = today.getFullYear() - 1;
        c.from = `${y}-01-01`; c.to = `${y}-12-31`;
      }
    },
    expToggleSystem(id) {
      const a = this.expCfg.systemIds;
      const i = a.indexOf(id);
      if (i >= 0) a.splice(i, 1); else a.push(id);
    },
    expSelectAll(on) {
      this.expCfg.systemIds = on
        ? this.systems.filter((s) => this.expCfg.includeInactive || s.aktiv).map((s) => s.id)
        : [];
    },
    expQuery() {
      const c = this.expCfg;
      const p = new URLSearchParams();
      if (c.from) p.set("from", c.from);
      if (c.to) p.set("to", c.to);
      // Nur einschraenken, wenn nicht ohnehin alles gewaehlt ist – kuerzere URL
      const all = this.systems.filter((s) => c.includeInactive || s.aktiv);
      if (c.systemIds.length && c.systemIds.length < all.length) {
        p.set("systems", c.systemIds.join(","));
      }
      if (c.includeInactive) p.set("include_inactive", "true");
      if (c.useTheme) Object.entries(c.theme).forEach(([k, v]) => v && p.set(k, v));
      if (c.systemColors) p.set("system_colors", "true");
      if (!c.includeChart) p.set("include_chart", "false");
      if (!c.includeTable) p.set("include_table", "false");
      return p.toString() ? "?" + p.toString() : "";
    },
    expCount() { return this.expCfg ? this.expCfg.systemIds.length : 0; },
    /* Rohdaten-Export braucht nur Zeitraum und Auswahl - Farben und
       Diagrammoptionen gelten ausschliesslich fuer das PDF. */
    expDataQuery() {
      const c = this.expCfg;
      const p = new URLSearchParams();
      if (c.from) p.set("from", c.from);
      if (c.to) p.set("to", c.to);
      const all = this.systems.filter((s) => c.includeInactive || s.aktiv);
      if (c.systemIds.length && c.systemIds.length < all.length) {
        p.set("systems", c.systemIds.join(","));
      }
      if (c.includeInactive) p.set("include_inactive", "true");
      return p;
    },
    runExport() {
      const c = this.expCfg;
      if (!c.systemIds.length) { this.notify("Kein System ausgewählt", "err"); return; }
      this.showExportCfg = false;
      const stamp = today();
      const fail = (e) => this.notify(e.message, "err");

      if (c.format === "zip") {
        fetchBlobDownload("api/export.zip", "zaehlwerk-export.zip").catch(fail);
        return;
      }
      if (c.format === "csv") {
        const p = this.expDataQuery();
        p.set("dialect", c.dialect);
        fetchBlobDownload(`api/export/data.csv?${p}`, `zaehlwerk-daten_${stamp}.csv`).catch(fail);
        return;
      }
      if (c.format === "json") {
        const p = this.expDataQuery();
        if (!c.includeDerived) p.set("include_derived", "false");
        if (!c.includeMeta) p.set("include_meta", "false");
        fetchBlobDownload(`api/export/data.json?${p}`, `zaehlwerk-daten_${stamp}.json`).catch(fail);
        return;
      }
      fetchBlobDownload(`api/report.pdf${this.expQuery()}`, "zaehlwerk-gesamtbericht.pdf").catch(fail);
    },
    openCombinedReport() {
      this.openExportConfig();
    },
    _legacyCombinedReport() {
      fetchBlobDownload("api/report.pdf", "zaehlwerk-gesamtbericht.pdf")
        .catch((e) => this.notify("PDF fehlgeschlagen: " + e.message, "err"));
    },
    pickTheme(mode) { setTheme(mode); },
    pickPalette(key) { setPalette(key); },
    pickContrast(key) { setContrast(key); },

    /* ---------- Chart-Farben ---------- */
    chartColorValue(key) { return chartColor(key, "#000000"); },
    isChartColorCustom(key) { return !!this.chartPrefs[key]; },
    onChartColor(key, ev) { setChartColor(key, ev.target.value); },
    clearChartColor(key) { setChartColor(key, null); },
    resetChartColors() { resetChartColors(); this.notify("Chart-Farben zurückgesetzt", "ok"); },
    /* Warnt, wenn eine Farbe auf der Chart-Fläche zu schwach kontrastiert */
    colorWarning(hex) {
      const r = contrastToSurface(hex);
      return r !== null && r < 3 ? `Kontrast ${r.toFixed(1)}:1 – auf dieser Fläche schwer erkennbar` : null;
    },
    fabAction() {
      if (!this.canWrite || this.view === "settings" || this.view === "admin") return;
      const d = this.$refs.detail;
      if (this.view === "detail" && d) {
        // Kontextbezogen: im Zähler-Tab legt der FAB einen Zähler an
        if (d.tab === "meters") d.openMeter(null);
        else d.openReading();
        return;
      }
      this.newSystem();
    },
    async confirmDeleteSystem() {
      // Bestaetigung liefert bereits das 3-Sekunden-Halten des HoldButton -
      // kein zusaetzliches confirm(), das im HA-WebView ohnehin unterdrueckt
      // werden kann.
      const sys = this.sysForm;
      if (!sys || !sys.id) return;
      try {
        await api(`/api/systems/${sys.id}`, { method: "DELETE" });
        this.showSystem = false;
        this.notify("System gelöscht", "ok");
        this.view = "menu"; this.selected = null;
        await this.load();
      } catch (e) { this.notify(e.message, "err"); }
    },
    /* ---------- Sektion A: Anwendungsparameter ---------- */
    async loadSettings() {
      try {
        if (!this.isAdmin) { this.settingsTab = "ui"; return; }
        const [s, i, x, b] = await Promise.all([
          api("/api/settings"), api("/api/system/info"), api("/api/external/status"),
          api("/api/backup"),
        ]);
        this.backupStatus = b;
        this.loadMqtt();
        if (this.isAdmin) this.loadUsers();
        this.appSettings = s;
        this.appSettingsDraft = { ...s };
        this.sysInfo = i;
        this.extStatus = x;
        this.settingsErrors = {};
      } catch (e) { this.notify("Einstellungen nicht ladbar: " + e.message, "err"); }
    },
    /* Clientseitige Vorpruefung – spiegelt die Grenzen der Pydantic-Schemas.
       Der Server prueft unabhaengig davon nochmal; das hier spart nur den Roundtrip. */
    validateSettings() {
      const d = this.appSettingsDraft || {};
      const err = {};
      const num = (v) => (v === "" || v === null ? NaN : Number(v));
      const h = num(d.notify_interval_hours);
      if (!Number.isInteger(h) || h < 1 || h > 168) err.notify_interval_hours = "Ganzzahl zwischen 1 und 168 Stunden";
      const iv = num(d.default_interval_days);
      if (!Number.isInteger(iv) || iv < 0 || iv > 3650) err.default_interval_days = "Ganzzahl zwischen 0 und 3650 Tagen";
      const sg = num(d.outlier_sigma);
      if (!(sg >= 1 && sg <= 5)) err.outlier_sigma = "Wert zwischen 1,0 und 5,0";
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(d.backup_time || ""))) {
        err.backup_time = "Uhrzeit im Format HH:MM";
      }
      const bk = num(d.backup_keep_days);
      if (!Number.isInteger(bk) || bk < 1 || bk > 365) err.backup_keep_days = "1 bis 365 Tage";
      this.settingsErrors = err;
      return Object.keys(err).length === 0;
    },
    settingsChangedKeys() {
      if (!this.appSettings || !this.appSettingsDraft) return [];
      return Object.keys(this.appSettings).filter(
        (k) => String(this.appSettings[k]) !== String(this.appSettingsDraft[k]));
    },
    settingsChangeCount() {
      // Das Passwort steckt nicht in appSettings – es wird nie zurückgegeben –
      // zählt aber als Änderung, sobald etwas eingetippt wurde.
      return this.settingsChangedKeys().length + (this.mqttPassword ? 1 : 0);
    },
    settingsDirty() { return this.settingsChangeCount() > 0; },
    settingsErrorCount() { return Object.keys(this.settingsErrors || {}).length; },
    async saveSettings() {
      if (!this.validateSettings()) { this.notify("Bitte Eingaben prüfen", "err"); return; }
      this.settingsSaving = true;
      const d = this.appSettingsDraft;
      try {
        const saved = await api("/api/settings", {
          method: "PUT",
          body: JSON.stringify({
            offline_mode: !!d.offline_mode,
            notify_enabled: !!d.notify_enabled,
            notify_interval_hours: Number(d.notify_interval_hours),
            default_interval_days: Number(d.default_interval_days),
            outlier_sigma: Number(d.outlier_sigma),
            backup_enabled: !!d.backup_enabled,
            backup_time: d.backup_time,
            backup_keep_days: Number(d.backup_keep_days),
            mqtt_enabled: !!d.mqtt_enabled,
            mqtt_use_supervisor: !!d.mqtt_use_supervisor,
            mqtt_host: d.mqtt_host || "",
            mqtt_port: Number(d.mqtt_port || 1883),
            mqtt_username: d.mqtt_username || "",
            mqtt_base_topic: d.mqtt_base_topic || "tele",
            mqtt_tasmota_discovery: !!d.mqtt_tasmota_discovery,
            mqtt_interval: d.mqtt_interval || "daily",
            // Leeres Feld = unveraendert lassen, nicht loeschen
            ...(this.mqttPassword ? { mqtt_password: this.mqttPassword } : {}),
          }),
        });
        this.appSettings = saved;
        this.appSettingsDraft = { ...saved };
        this.mqttPassword = "";
        this.loadMqtt();
        this.notify(saved.offline_mode
          ? "Gespeichert – Internetzugriff gesperrt"
          : "Gespeichert – Internetzugriff freigegeben", "ok");
        try { this.extStatus = await api("/api/external/status"); } catch (_) {}
      } catch (e) {
        // 422 vom Server: Feldfehler sichtbar machen statt nur zu toasten
        this.notify("Nicht gespeichert: " + e.message, "err");
      } finally { this.settingsSaving = false; }
    },
    async loadUsers() {
      try { this.users = await api("/api/auth/users"); }
      catch (_) { this.users = []; }
    },
    async setUserRole(user, role) {
      if (role === user.role) return;
      try {
        const updated = await api(`/api/auth/users/${user.id}`, {
          method: "PATCH", body: JSON.stringify({ role }),
        });
        this.notify(`${updated.display_name}: ${updated.role}`, "ok");
        await this.loadUsers();
        // Eigene Rolle geändert? Dann Rechte neu holen, sonst zeigt die
        // Oberfläche weiter, was der Server bereits ablehnt.
        if (this.currentUser && user.id === this.currentUser.id) await this.checkAuth();
      } catch (e) { this.notify(e.message, "err"); await this.loadUsers(); }
    },
    async loadMqtt() {
      try { this.mqttStatus = await api("/api/mqtt/status"); }
      catch (_) { this.mqttStatus = null; }
    },
    async assignDevice(d) {
      const systemId = this.assignTarget[d.device];
      if (!systemId) return;
      try {
        const r = await api("/api/mqtt/assign", {
          method: "POST",
          body: JSON.stringify({ system_id: systemId, topic: d.topic }),
        });
        this.notify(`${r.topic} → ${r.system}`, "ok");
        this.assignTarget[d.device] = null;
        await this.load();          // zusatzfelder neu laden
        await this.loadMqtt();
      } catch (e) { this.notify(e.message, "err"); }
    },
    async forgetDevices() {
      try { await api("/api/mqtt/devices/forget", { method: "POST" }); await this.loadMqtt(); }
      catch (e) { this.notify(e.message, "err"); }
    },
    async restartMqtt() {
      try {
        await api("/api/mqtt/restart", { method: "POST" });
        await this.loadMqtt();
        this.notify(this.mqttStatus && this.mqttStatus.connected
          ? "MQTT verbunden" : "Nicht verbunden – siehe Status", 
          this.mqttStatus && this.mqttStatus.connected ? "ok" : "err");
      } catch (e) { this.notify(e.message, "err"); }
    },
    async runBackup() {
      this.backupBusy = true;
      try {
        const r = await api("/api/backup/run", { method: "POST" });
        this.backupStatus = await api("/api/backup");
        const pruned = r.pruned && r.pruned.length ? `, ${r.pruned.length} alte entfernt` : "";
        this.notify(`Gesichert: ${this.fmtBytes(r.size_bytes)} in ${r.duration_ms} ms${pruned}`, "ok");
      } catch (e) { this.notify(e.message, "err"); }
      finally { this.backupBusy = false; }
    },
    async clearExtCache() {
      try {
        const r = await api("/api/external/cache/clear", { method: "POST" });
        this.extStatus = await api("/api/external/status");
        this.notify(`Zwischenspeicher geleert (${r.cleared})`, "ok");
      } catch (e) { this.notify(e.message, "err"); }
    },
    revertSettings() { this.appSettingsDraft = { ...this.appSettings }; this.settingsErrors = {}; },
    fmtBytes(n) {
      if (!n) return "0 B";
      const u = ["B", "KB", "MB", "GB"];
      const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), u.length - 1);
      return (n / Math.pow(1024, i)).toFixed(i ? 1 : 0) + " " + u[i];
    },
    dueInfo(id) {
      const l = this.latest[id];
      if (!l || l.overdue_days === undefined || l.overdue_days === null) return null;
      const od = l.overdue_days;
      const span = (n) => (n >= 60 ? `${Math.round(n / 30)} Mon.` : `${n} T`);
      if (od > 0) return { level: "over", text: `Ablesung überfällig · seit ${span(od)}` };
      if (od >= -30) return { level: "soon", text: `Ablesung bald fällig · in ${-od} T` };
      return null;
    },

    /* System anlegen / bearbeiten */
    newSystem() {
      this.sysForm = { name: "", typ: "Strom", einheit: "kWh", farbe: PALETTE[0], icon: "⚡", zusatzfelder: {}, aktiv: true };
      this.showSystem = true;
    },
    editSystem(s) {
      this.sysForm = { id: s.id, name: s.name, typ: s.typ, einheit: s.einheit, farbe: s.farbe, icon: s.icon, zusatzfelder: { ...s.zusatzfelder }, aktiv: s.aktiv };
      this.showSystem = true;
    },
    onTypeChange() {
      const t = SYSTEM_TYPES.find((x) => x.v === this.sysForm.typ);
      if (t) { if (t.unit) this.sysForm.einheit = t.unit; this.sysForm.icon = t.icon; }
    },
    async saveSystem() {
      if (!this.sysForm.name.trim()) { this.notify("Name fehlt", "err"); return; }
      this.busy = true;
      const body = {
        name: this.sysForm.name, typ: this.sysForm.typ, einheit: this.sysForm.einheit,
        farbe: this.sysForm.farbe, icon: this.sysForm.icon, zusatzfelder: this.sysForm.zusatzfelder,
      };
      try {
        if (this.sysForm.id) {
          await api(`/api/systems/${this.sysForm.id}`, { method: "PATCH", body: JSON.stringify({ ...body, aktiv: this.sysForm.aktiv }) });
          this.notify("System aktualisiert", "ok");
        } else {
          await api("/api/systems", { method: "POST", body: JSON.stringify(body) });
          this.notify("System angelegt", "ok");
        }
        this.showSystem = false;
        await this.load();
      } catch (e) { this.notify(e.message, "err"); }
      finally { this.busy = false; }
    },
  },
  template: `
  <div class="topbar">
    <div class="topbar-inner">
      <button class="iconbtn nav-toggle" @click="toggleNav"
              :aria-expanded="String(navExpanded || navDrawer)" aria-controls="zw-nav"
              aria-label="Navigation ein-/ausklappen" title="Navigation ein-/ausklappen"
              v-html="navMenuIcon"></button>
      <div class="brand">
        <span class="logo"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 19a9 9 0 1 1 14 0"/><path d="M12 5v2"/><path d="M5.6 8.5l1.5 1.2"/><path d="M18.4 8.5l-1.5 1.2"/><path d="M12 15l3.5-4.5"/><circle cx="12" cy="16" r="1.6" fill="currentColor" stroke="none"/></svg></span>
        <h1>{{ view==='admin' ? 'Admin-Tools' : view==='settings' ? 'Einstellungen' : (view==='detail' && selectedSystem ? selectedSystem.name : 'Zählwerk') }}</h1>
      </div>
      <div class="spacer"></div>
    </div>
  </div>

  <!-- Sidebar: Navigation Rail (Desktop) / modaler Drawer (Mobile) -->
  <nav id="zw-nav" class="nav-rail" :class="{ expanded: navExpanded, drawer: navDrawer }" aria-label="Hauptnavigation">
    <button class="fab rail-fab" v-if="canWrite" @click="fabAction" :title="'Neu: ' + fabLabel">
      <span class="fab-plus">＋</span><span class="fab-text">{{ fabLabel }}</span>
    </button>
    <template v-for="it in visibleNavItems" :key="it.key">
      <div class="nav-row">
        <button class="nav-item"
                :class="{ active: activeNav===it.key, disabled: it.disabled }"
                :disabled="it.disabled"
                :title="it.disabled ? it.label + ' (noch nicht verfügbar)' : it.label"
                @click="goNav(it)">
          <span class="nav-pill" v-html="it.icon"></span>
          <span class="nav-label">{{ it.label }}</span>
          <span v-if="it.badge" class="nav-badge">{{ it.badge }}</span>
        </button>
        <!-- Getrennte Schaltfläche: der Pfeil klappt auf, der Eintrag navigiert.
             M3 trennt diese beiden Aktionen bewusst - ein Klick auf den Eintrag
             darf nie nur ein Menü öffnen, wenn er auch ein Ziel hat. -->
        <button v-if="it.expandable && navExpanded && navSubItems.length"
                class="nav-expander" :class="{ open: navSubOpen }"
                :aria-expanded="String(navSubOpen)" :aria-controls="'zw-sub-' + it.key"
                :title="navSubOpen ? 'Systeme einklappen' : 'Systeme aufklappen'"
                @click.stop="toggleNavSub" v-html="chevronIcon"></button>
      </div>

      <div v-if="it.expandable && navExpanded && navSubOpen" class="nav-sub"
           :id="'zw-sub-' + it.key" role="group" :aria-label="it.label + ' – Systeme'">
        <button v-for="s in navSubItems" :key="s.id"
                class="nav-subitem" :class="{ active: view==='detail' && selected===s.id }"
                :title="s.name" @click="goSystem(s)">
          <span class="dot" :style="{background: s.farbe}"></span>
          <span class="ns-label">{{ s.name }}</span>
          <span class="ns-unit">{{ s.einheit }}</span>
        </button>
      </div>
    </template>
    <div class="nav-foot">v{{ appVersion }}</div>
  </nav>
  <div class="nav-scrim" v-if="navDrawer" @click="closeDrawer"></div>

  <!-- Bottom Navigation (Mobile) -->
  <nav class="nav-bottom" aria-label="Schnellzugriff">
    <button v-for="it in visibleNavItems.filter(i => i.primary)" :key="it.key"
            class="nav-item" :class="{ active: activeNav===it.key, 'has-sub': it.expandable && navSubItems.length }"
            :aria-haspopup="it.expandable && navSubItems.length ? 'dialog' : null"
            :aria-expanded="it.expandable ? String(showSysSheet) : null"
            @click="goNavMobile(it)">
      <span class="nav-pill" v-html="it.icon"></span>
      {{ it.label }}
      <!-- Hinweis, dass hinter dem aktiven Eintrag mehr steckt -->
      <span v-if="it.expandable && navSubItems.length && activeNav===it.key"
            class="nav-caret" v-html="chevronIcon" aria-hidden="true"></span>
    </button>
  </nav>

  <!-- Modal Bottom Sheet: Systemauswahl (Mobile) -->
  <div class="sheet-scrim" v-if="showSysSheet" @click="showSysSheet=false"></div>
  <div class="sys-sheet" v-if="showSysSheet" role="dialog" aria-modal="true"
       aria-label="System wählen">
    <div class="sheet-handle" @click="showSysSheet=false"></div>
    <div class="sheet-head">
      <h3>System wählen</h3>
      <span class="sheet-count">{{ navSubItems.length }}</span>
    </div>
    <div class="sheet-list">
      <button class="sheet-item" :class="{ active: view==='menu' }" @click="sheetGoOverview">
        <span class="si-icon" v-html="navHomeIcon"></span>
        <span class="si-label">Übersicht</span>
        <span class="si-meta">alle Systeme</span>
      </button>
      <div class="sheet-sep"></div>
      <button v-for="s in navSubItems" :key="s.id" class="sheet-item"
              :class="{ active: view==='detail' && selected===s.id }" @click="sheetGoSystem(s)">
        <span class="si-dot" :style="{background: s.farbe}"></span>
        <span class="si-label">{{ typeIcon(s.typ) }} {{ s.name }}</span>
        <span class="si-meta">{{ s.einheit }}</span>
      </button>
    </div>
    <div class="sheet-foot">
      <button class="btn" @click="showSysSheet=false">Schließen</button>
      <button class="btn btn-primary" v-if="canWrite" @click="sheetNewSystem">＋ System anlegen</button>
    </div>
  </div>

  <!-- FAB (Mobile) -->
  <div class="fab-screen" v-if="canWrite"><button class="fab" @click="fabAction" :title="'Neu: ' + fabLabel">＋</button></div>

  <div class="wrap">
    <div v-if="loading" class="center-load"><span class="spin"></span></div>

    <!-- MENÜ -->
    <template v-else-if="view==='menu'">
      <div class="eyebrow">
        Systeme
        <label class="check" style="font-family:var(--sans);text-transform:none;letter-spacing:0"><input type="checkbox" v-model="showArchived" /> archivierte zeigen</label>
      </div>

      <div v-if="!visibleSystems.length" class="empty">
        <h3>Noch kein System angelegt</h3>
        <p>Lege Strom, Gas, Wasser, PV o. Ä. an, um Ablesungen zu erfassen.</p>
        <button class="btn btn-primary" @click="newSystem">Erstes System anlegen</button>
      </div>

      <div class="tiles" v-else>
        <div v-for="s in visibleSystems" :key="s.id" class="tile" :class="{archived: !s.aktiv, 'due-over': dueInfo(s.id) && dueInfo(s.id).level==='over', 'due-soon': dueInfo(s.id) && dueInfo(s.id).level==='soon'}" @click="open(s)">
          <span class="swatch" :style="{background: s.farbe}"></span>
          <div class="t-type">{{ typeIcon(s.typ) }} {{ s.typ }}</div>
          <div class="t-name">{{ s.name }}</div>
          <div class="readout" v-if="latest[s.id]">
            <span class="val num">{{ fmt(latest[s.id].value, 1) }}</span>
            <span class="unit">{{ s.einheit }}</span>
          </div>
          <div class="t-meta">
            <template v-if="latest[s.id]">Stand: {{ fmtDate(latest[s.id].datum) }}</template>
            <template v-else>Einheit: {{ s.einheit }} · noch keine Werte</template>
            <span v-if="!s.aktiv"> · archiviert</span>
          </div>
          <div v-if="dueInfo(s.id)" class="due-badge" :class="dueInfo(s.id).level">⚠ {{ dueInfo(s.id).text }}</div>
        </div>
      </div>
    </template>

    <!-- ADMIN-TOOLS -->
    <template v-else-if="view==='admin'">
      <div class="eyebrow">Admin-Tools</div>
      <div class="seg settings-seg">
        <button :class="{active: adminTab==='diag'}"  @click="adminTab='diag'">Diagnose</button>
        <button :class="{active: adminTab==='sql'}"   @click="adminTab='sql'">Abfrage</button>
        <button :class="{active: adminTab==='logs'}"  @click="adminTab='logs'; loadAdminLogs()">Protokoll</button>
      </div>

      <!-- Diagnose -->
      <template v-if="adminTab==='diag'">
        <div class="card set-card" v-if="adminDiag">
          <h3>Datenbank</h3>
          <table class="info-table">
            <tr><td>Pfad</td><td class="num">{{ adminDiag.database.path }}</td></tr>
            <tr><td>Version / Schema</td><td class="num">{{ adminDiag.app_version }} · Schema {{ adminDiag.schema_version }}</td></tr>
            <tr><td>Integritätsprüfung</td>
                <td :class="adminDiag.database.integrity_check === 'ok' ? '' : 'sb-err'">
                  {{ adminDiag.database.integrity_check }}</td></tr>
            <tr><td>Fremdschlüsselfehler</td>
                <td :class="adminDiag.database.foreign_key_errors ? 'sb-err' : ''">
                  {{ adminDiag.database.foreign_key_errors }}</td></tr>
            <tr><td>Journal</td><td class="num">{{ adminDiag.database.journal_mode }}</td></tr>
            <tr><td>Größe</td><td class="num">
              {{ fmtBytes(adminDiag.database.sizes_bytes.db) }}
              <small class="bk-age"> + WAL {{ fmtBytes(adminDiag.database.sizes_bytes.wal) }}</small></td></tr>
            <tr><td>Fragmentierung</td><td class="num">{{ adminDiag.database.fragmentation_pct }} %
              <small class="bk-age" v-if="adminDiag.database.fragmentation_pct > 25"> · VACUUM sinnvoll</small></td></tr>
          </table>
        </div>
        <div class="card set-card" v-if="adminDiag">
          <h3>Dienste</h3>
          <table class="info-table">
            <tr><td>Offline-Modus</td><td>{{ adminDiag.outbound.offline_mode ? 'aktiv' : 'aus' }}</td></tr>
            <tr><td>Socket-Sperre</td><td>{{ adminDiag.outbound.socket_guard ? 'installiert' : 'nicht aktiv' }}</td></tr>
            <tr><td>MQTT</td><td class="num">
              {{ adminDiag.mqtt.connected ? 'verbunden' : 'getrennt' }}
              <span v-if="adminDiag.mqtt.broker"> · {{ adminDiag.mqtt.broker }}</span></td></tr>
            <tr v-if="adminDiag.mqtt.last_error"><td>MQTT-Fehler</td><td class="sb-err">{{ adminDiag.mqtt.last_error }}</td></tr>
            <tr><td>Nachrichten</td><td class="num">{{ adminDiag.mqtt.messages }} empfangen · {{ adminDiag.mqtt.written }} geschrieben</td></tr>
            <tr><td>Sicherungen</td><td class="num">{{ adminDiag.backup.entries }} in {{ adminDiag.backup.directory }}</td></tr>
          </table>
          <div class="settings-actions"><button class="btn btn-sm" @click="loadAdmin">↻ Aktualisieren</button></div>
        </div>
      </template>

      <!-- Abfrage -->
      <template v-else-if="adminTab==='sql'">
        <div class="card set-card">
          <h3>Datenbankabfrage</h3>
          <p class="hint">Nur lesend. Die Verbindung wird schreibgeschützt geöffnet,
            zugelassen sind ausschließlich <code>SELECT</code> und <code>WITH</code>,
            höchstens 500 Zeilen je Abfrage. Jede Abfrage wird mit Konto protokolliert.</p>
          <textarea class="input sql-input" rows="4" v-model="sqlText"
                    spellcheck="false" @keydown.ctrl.enter="runQuery"></textarea>
          <div class="settings-actions">
            <button class="btn btn-primary" :disabled="sqlBusy" @click="runQuery">
              {{ sqlBusy ? 'Läuft …' : 'Ausführen' }}</button>
            <span class="hint sql-hint">Strg + Eingabe</span>
          </div>
          <div class="err-inline" v-if="sqlError">{{ sqlError }}</div>

          <div class="sql-samples">
            <button class="crumb" @click="useSample('SELECT name, typ, einheit FROM systems ORDER BY name')">Systeme</button>
            <button class="crumb" @click="useSample('SELECT s.name, COUNT(r.id) AS werte, MAX(r.datum) AS letzte FROM systems s LEFT JOIN readings r ON r.system_id = s.id GROUP BY s.name')">Werte je System</button>
            <button class="crumb" @click="useSample('SELECT datum, value, note FROM readings ORDER BY datum DESC LIMIT 20')">Letzte Ablesungen</button>
            <button class="crumb" @click="useSample('SELECT username, role, aktiv, letzter_login FROM users')">Konten</button>
          </div>
        </div>

        <div class="card set-card" v-if="sqlResult">
          <h3>{{ sqlResult.row_count }} Zeile{{ sqlResult.row_count===1 ? '' : 'n' }}
            <small class="bk-age">· {{ sqlResult.duration_ms }} ms{{ sqlResult.truncated ? ' · gekürzt auf 500' : '' }}</small></h3>
          <div class="sql-scroll">
            <table class="sql-table">
              <thead><tr><th v-for="c in sqlResult.columns" :key="c">{{ c }}</th></tr></thead>
              <tbody>
                <tr v-for="(row,i) in sqlResult.rows" :key="i">
                  <td v-for="(v,j) in row" :key="j">{{ v === null ? '—' : v }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="card set-card" v-if="adminSchema.length">
          <h3>Tabellen</h3>
          <div v-for="t in adminSchema" :key="t.table" class="sql-schema">
            <button class="crumb" @click="useSample('SELECT * FROM ' + t.table + ' LIMIT 20')">{{ t.table }}</button>
            <small>{{ t.rows }} Zeilen · {{ t.columns.map(c => c.name).join(', ') }}</small>
          </div>
        </div>
      </template>

      <!-- Protokoll -->
      <template v-else>
        <div class="card set-card">
          <h3>Anwendungsprotokoll</h3>
          <div class="settings-actions">
            <div class="seg">
              <button v-for="l in ['INFO','WARNING','ERROR']" :key="l"
                      :class="{active: logLevel===l}" @click="logLevel=l; loadAdminLogs()">{{ l }}</button>
            </div>
            <button class="btn btn-sm" @click="loadAdminLogs">↻ Aktualisieren</button>
          </div>
          <div class="mqtt-log" v-if="adminLogs.length">
            <div v-for="(e,i) in adminLogs" :key="i" class="mq-row"
                 :class="{ warn: e.level === 'WARNING' || e.level === 'ERROR' }">
              <span class="mq-ts">{{ e.ts.slice(11,19) }}</span>
              <span class="log-src">{{ e.logger.replace('zaehlwerk.','') }}</span>
              <span>{{ e.message }}</span>
            </div>
          </div>
          <div class="hint" v-else>Keine Meldungen auf dieser Stufe.</div>
        </div>
      </template>
    </template>

    <!-- EINSTELLUNGEN -->
    <template v-else-if="view==='settings'">
      <div class="eyebrow">Einstellungen</div>
      <div class="seg settings-seg">
        <button v-if="isAdmin" :class="{active: settingsTab==='app'}" @click="settingsTab='app'">A · System</button>
        <button :class="{active: settingsTab==='ui'}"  @click="settingsTab='ui'">B · Web-App</button>
      </div>

      <!-- ================= SEKTION A: System ================= -->
      <template v-if="settingsTab==='app'">
        <div class="card set-card killswitch" :class="{armed: appSettingsDraft && appSettingsDraft.offline_mode}">
          <h3>Internetzugriff</h3>
          <p class="hint">Zählwerk funktioniert vollständig ohne Internet. Externe Abrufe sind
            im Auslieferungszustand gesperrt und müssen bewusst freigegeben werden.</p>
          <div class="field" v-if="appSettingsDraft">
            <label class="check ks-toggle">
              <input type="checkbox" v-model="appSettingsDraft.offline_mode" @change="validateSettings" />
              <span>
                <strong>Offline-Modus (Kill-Switch)</strong>
                <small>{{ appSettingsDraft.offline_mode
                  ? 'Aktiv – alle ausgehenden Verbindungen ins Internet werden blockiert.'
                  : 'Aus – Abrufe bei Wetter- und Tarifdienst sind erlaubt.' }}</small>
              </span>
            </label>
          </div>
          <table class="info-table" v-if="extStatus">
            <tr><td>Zustand</td><td>{{ extStatus.offline_mode ? 'gesperrt' : 'freigegeben' }}</td></tr>
            <tr><td>Socket-Sperre</td><td>{{ extStatus.socket_guard_active ? 'installiert' : 'nicht aktiv' }}</td></tr>
            <tr v-for="p in extStatus.providers" :key="p.key">
              <td>{{ p.label }}</td><td class="num">{{ p.host }}</td>
            </tr>
          </table>
          <div class="hint ks-note">
            Die Sperre gilt für das Backend. Die Oberfläche lädt Vue, Chart.js und die
            Schriftart weiterhin per CDN – für vollständige Datensouveränität müssen diese
            Dateien lokal ausgeliefert werden.
          </div>
          <div class="settings-actions" v-if="extStatus && extStatus.cache.length">
            <button class="btn btn-sm" @click="clearExtCache">↺ Zwischenspeicher leeren ({{ extStatus.cache.length }})</button>
          </div>
        </div>

        <div class="card set-card">
          <h3>Anwendungsparameter</h3>
          <p class="hint">Serverseitig in SQLite gespeichert, gilt für alle Geräte. Wird vor dem Speichern validiert.</p>

          <div class="field">
            <label class="check"><input type="checkbox" v-model="appSettingsDraft.notify_enabled" v-if="appSettingsDraft" />
              Benachrichtigung bei überfälliger Ablesung</label>
          </div>
          <div class="field" v-if="appSettingsDraft">
            <label>Prüfintervall (Stunden)</label>
            <input class="input" type="number" min="1" max="168" step="1"
                   v-model="appSettingsDraft.notify_interval_hours"
                   :class="{invalid: settingsErrors.notify_interval_hours}" @input="validateSettings" />
            <div class="err-inline" v-if="settingsErrors.notify_interval_hours">{{ settingsErrors.notify_interval_hours }}</div>
            <div class="hint" v-else>Wie oft der Hintergrunddienst auf Fälligkeiten prüft. Greift ohne Neustart.</div>
          </div>
          <div class="field" v-if="appSettingsDraft">
            <label>Standard-Ableseintervall (Tage)</label>
            <input class="input" type="number" min="0" max="3650" step="1"
                   v-model="appSettingsDraft.default_interval_days"
                   :class="{invalid: settingsErrors.default_interval_days}" @input="validateSettings" />
            <div class="err-inline" v-if="settingsErrors.default_interval_days">{{ settingsErrors.default_interval_days }}</div>
            <div class="hint" v-else>0 = Fälligkeit aus dem Median der bisherigen Intervalle schätzen.</div>
          </div>
          <div class="field" v-if="appSettingsDraft">
            <label>Ausreißer-Schwelle (σ)</label>
            <input class="input" type="number" min="1" max="5" step="0.1"
                   v-model="appSettingsDraft.outlier_sigma"
                   :class="{invalid: settingsErrors.outlier_sigma}" @input="validateSettings" />
            <div class="err-inline" v-if="settingsErrors.outlier_sigma">{{ settingsErrors.outlier_sigma }}</div>
            <div class="hint" v-else>Ø + n·σ gilt als Ausreißer. Kleiner = empfindlicher. Standard 2,0.</div>
          </div>

        </div>

        <div class="card set-card" v-if="currentUser">
          <h3>Konto</h3>
          <table class="info-table">
            <tr><td>Angemeldet als</td><td>{{ currentUser.display_name }}</td></tr>
            <tr><td>Benutzername</td><td class="num">{{ currentUser.username }}</td></tr>
            <tr><td>Herkunft</td><td>{{ currentUser.source === 'homeassistant'
              ? 'Home Assistant (Ingress)' : 'lokales Konto' }}</td></tr>
          </table>
          <p class="hint" v-if="currentUser.source === 'homeassistant'">
            Die Anmeldung erfolgt bereits in Home Assistant. Zählwerk übernimmt sie und
            speichert kein Passwort.
          </p>
          <div class="settings-actions" v-else>
            <button class="btn" @click="doLogout">Abmelden</button>
          </div>
        </div>

        <div class="card set-card" v-if="isAdmin">
          <h3>Konten &amp; Rollen</h3>
          <p class="hint">Änderungen greifen beim nächsten Aufruf des jeweiligen Kontos.
            Die Rechte werden serverseitig durchgesetzt, das Ausblenden in der Oberfläche
            ist nur Beiwerk.</p>
          <div class="field">
            <label>Rolle für neu übernommene Home-Assistant-Konten</label>
            <select class="select" v-model="appSettingsDraft.default_role" @change="validateSettings">
              <option v-for="r in authRoles" :key="r.key" :value="r.key">{{ r.label }} – {{ r.hint }}</option>
            </select>
          </div>
          <table class="info-table" v-if="users.length">
            <tr v-for="u in users" :key="u.id">
              <td>
                {{ u.display_name }}
                <small class="bk-age"> · {{ u.username }}{{ u.source === 'homeassistant' ? ' · HA' : '' }}</small>
              </td>
              <td class="num">
                <select class="select role-select" :value="u.role" @change="setUserRole(u, $event.target.value)">
                  <option v-for="r in authRoles" :key="r.key" :value="r.key">{{ r.label }}</option>
                </select>
              </td>
            </tr>
          </table>
          <div class="hint" v-else>Konten erscheinen, sobald sie sich erstmals angemeldet haben.</div>
        </div>

        <div class="card set-card" v-if="sysInfo">
          <h3>Laufzeit &amp; Datenbank</h3>
          <p class="hint">Read-only. Container, Port und DB-Pfad gehören dem Supervisor und werden über
            <code>config.yaml</code> bzw. das Add-on-Panel gesteuert, nicht hier.</p>
          <table class="info-table">
            <tr><td>Betriebsart</td><td>{{ sysInfo.runtime }}</td></tr>
            <tr><td>App-Version</td><td class="num">{{ appVersion }}</td></tr>
            <tr><td>Schema-Version</td><td class="num">{{ sysInfo.schema_version }}</td></tr>
            <tr><td>Python</td><td class="num">{{ sysInfo.python_version }} · {{ sysInfo.platform }}</td></tr>
            <tr><td>Supervisor-API</td><td>{{ sysInfo.supervisor_available ? 'verbunden' : 'nicht verfügbar' }}</td></tr>
            <tr><td>DB-Pfad</td><td class="num">{{ sysInfo.db_path }}</td></tr>
            <tr><td>DB-Größe</td><td class="num">{{ fmtBytes(sysInfo.db_size_bytes) }}</td></tr>
            <tr><td>Journal-Modus</td><td class="num">{{ sysInfo.journal_mode }}</td></tr>
            <tr><td>Foreign Keys</td><td>{{ sysInfo.foreign_keys ? 'aktiv' : 'inaktiv' }}</td></tr>
            <tr><td>Datenbestand</td><td class="num">{{ sysInfo.system_count }} Systeme · {{ sysInfo.reading_count }} Ablesungen</td></tr>
          </table>
        </div>

        <div class="card set-card" v-if="appSettingsDraft">
          <h3>MQTT-Ingestion</h3>
          <p class="hint">Übernimmt Zählerstände aus Broker-Nachrichten. Je System und Tag
            wird höchstens eine Ablesung geschrieben – der Wert des laufenden Tages wird
            aktualisiert statt angehängt.</p>

          <div class="hint ks-note" v-if="mqttStatus && !mqttStatus.available">
            <code>paho-mqtt</code> fehlt im Image. Das Add-on nach dem Update neu bauen lassen.
          </div>

          <div class="field">
            <label class="check"><input type="checkbox" v-model="appSettingsDraft.mqtt_enabled" @change="validateSettings" />
              <span>MQTT aktiv</span></label>
          </div>

          <template v-if="appSettingsDraft.mqtt_enabled">
            <div class="field">
              <label class="check"><input type="checkbox" v-model="appSettingsDraft.mqtt_use_supervisor" />
                <span>Zugangsdaten von Home Assistant beziehen
                  <small>{{ mqttStatus && mqttStatus.supervisor_offer
                    ? 'Mosquitto-Add-on erkannt – kein Passwort nötig'
                    : 'Kein MQTT-Dienst gemeldet; unten manuell eintragen' }}</small></span></label>
            </div>

            <template v-if="!appSettingsDraft.mqtt_use_supervisor || (mqttStatus && !mqttStatus.supervisor_offer)">
              <div class="field-row">
                <div class="field"><label>Broker-Host</label>
                  <input class="input" v-model="appSettingsDraft.mqtt_host" placeholder="192.168.1.10" /></div>
                <div class="field"><label>Port</label>
                  <input class="input" type="number" min="1" max="65535" v-model="appSettingsDraft.mqtt_port" /></div>
              </div>
              <div class="field-row">
                <div class="field"><label>Benutzer</label>
                  <input class="input" v-model="appSettingsDraft.mqtt_username" autocomplete="off" /></div>
                <div class="field"><label>Passwort</label>
                  <input class="input" type="password" v-model="mqttPassword" autocomplete="new-password"
                         :placeholder="appSettings && appSettings.mqtt_password_set ? '•••••••• (hinterlegt)' : ''" />
                  <div class="hint">Nur ausfüllen, um es zu ändern.</div></div>
              </div>
              <div class="hint ks-note">
                Manuell eingetragene Zugangsdaten liegen unverschlüsselt in der SQLite-Datei.
                Über das Mosquitto-Add-on entfällt das.
              </div>
            </template>

            <div class="field">
              <label class="check"><input type="checkbox" v-model="appSettingsDraft.mqtt_tasmota_discovery" />
                <span>Tasmota Auto-Discovery aktivieren
                  <small>Hört auf <code>{{ (appSettingsDraft.mqtt_base_topic || 'tele') }}/+/SENSOR</code> und
                    <code>/+/LWT</code> und listet gefundene Geräte. Es wird nichts gespeichert,
                    solange kein Topic zugeordnet ist.</small></span></label>
            </div>
            <div class="field">
              <label>Speicherintervall (Vorgabe)</label>
              <select class="select" v-model="appSettingsDraft.mqtt_interval" @change="validateSettings">
                <option value="daily">Täglich – ein Wert je Tag</option>
                <option value="weekly">Wöchentlich – ein Wert je Kalenderwoche</option>
                <option value="monthly">Monatlich – ein Wert je Kalendermonat</option>
                <option value="quarterly">Quartalsweise – ein Wert je Quartal</option>
                <option value="yearly">Jährlich – ein Wert je Kalenderjahr</option>
              </select>
              <div class="hint">
                Je Periode wird ein Datensatz geführt und innerhalb der laufenden Periode
                fortgeschrieben. Einzelne Systeme lassen sich unter „✎ Bearbeiten“ abweichend
                einstellen. Von Hand erfasste Ablesungen werden nie überschrieben.
              </div>
            </div>

            <div class="field" v-if="appSettingsDraft.mqtt_tasmota_discovery">
              <label>Telemetrie-Präfix</label>
              <input class="input" v-model="appSettingsDraft.mqtt_base_topic" placeholder="tele" />
              <div class="hint">Tasmota-Standard ist <code>tele</code>. Nur ändern, wenn im Gerät angepasst.</div>
            </div>

            <div class="settings-actions">
              <button class="btn" @click="restartMqtt">↻ Neu verbinden</button>
              <button class="btn btn-sm" @click="loadMqtt">Status aktualisieren</button>
              <button class="btn btn-sm" v-if="mqttStatus && mqttStatus.devices && mqttStatus.devices.length"
                      @click="forgetDevices">Geräteliste leeren</button>
            </div>

            <div class="mqtt-devices" v-if="mqttStatus && mqttStatus.devices && mqttStatus.devices.length">
              <div class="hw-head">Erkannte Geräte ({{ mqttStatus.devices.length }})</div>
              <div v-for="d in mqttStatus.devices" :key="d.device" class="mq-dev" :class="{unusable: !d.usable}">
                <div class="mq-dev-head">
                  <span class="mq-dot" :class="d.online===true ? 'on' : (d.online===false ? 'off' : 'unknown')"
                        :title="d.online===true ? 'Online' : (d.online===false ? 'Offline (LWT)' : 'Status unbekannt')"></span>
                  <strong>{{ d.device }}</strong>
                  <span class="mq-assigned" v-if="d.assigned">→ {{ d.system }}</span>
                </div>
                <div class="mq-dev-sub">
                  <code>{{ d.topic }}</code>
                  <span v-if="d.usable">{{ fmt(d.value, 3) }} {{ d.unit }} · {{ d.path }}</span>
                  <span v-else>kein Zählerstand im Telegramm</span>
                  <span v-if="d.power !== null && d.power !== undefined">{{ d.power }} W</span>
                </div>
                <!-- Diagnose: bei nicht erkanntem Telegramm die rohe Nutzlast und
                     alle Zahlenpfade zeigen – damit lässt sich der Pfad ablesen. -->
                <details class="mq-raw" v-if="!d.usable && d.raw">
                  <summary>Rohdaten anzeigen ({{ (d.numeric_paths || []).length }} Zahlenfelder)</summary>
                  <div class="mq-paths" v-if="d.numeric_paths && d.numeric_paths.length">
                    <div v-for="p in d.numeric_paths" :key="p.path" class="mq-path">
                      <code>{{ p.path }}</code><span>{{ p.value }}</span>
                    </div>
                  </div>
                  <pre class="mq-json">{{ d.raw }}</pre>
                  <div class="hint">
                    Den passenden Pfad im System unter „✎ Bearbeiten“ → <strong>MQTT JSON-Pfad</strong>
                    eintragen. Er hat dann Vorrang vor der automatischen Erkennung.
                  </div>
                </details>
                <details class="mq-raw" v-else-if="d.candidates && d.candidates.length > 1">
                  <summary>{{ d.candidates.length }} mögliche Felder – Zuordnung prüfen</summary>
                  <div class="mq-paths">
                    <div v-for="c in d.candidates" :key="c.path" class="mq-path"
                         :class="{sel: c.path === d.path}">
                      <code>{{ c.path }}</code><span>{{ c.value }}</span>
                    </div>
                  </div>
                </details>

                <div class="mq-dev-act" v-if="d.usable && !d.assigned">
                  <select class="select" v-model="assignTarget[d.device]">
                    <option :value="null">System wählen …</option>
                    <option v-for="s in systems.filter(x => x.aktiv)" :key="s.id" :value="s.id">{{ s.name }}</option>
                  </select>
                  <button class="btn btn-sm" :disabled="!assignTarget[d.device]" @click="assignDevice(d)">Zuordnen</button>
                </div>
              </div>
            </div>

            <table class="info-table" v-if="mqttStatus">
              <tr><td>Verbindung</td><td>{{ mqttStatus.connected ? 'verbunden' : 'getrennt' }}</td></tr>
              <tr v-if="mqttStatus.broker"><td>Broker</td><td class="num">{{ mqttStatus.broker }} · {{ mqttStatus.source }}</td></tr>
              <tr v-if="mqttStatus.last_error"><td>Letzter Fehler</td><td>{{ mqttStatus.last_error }}</td></tr>
              <tr><td>Nachrichten</td><td class="num">{{ mqttStatus.messages }} empfangen · {{ mqttStatus.written }} geschrieben</td></tr>
              <tr v-for="m in mqttStatus.mapped" :key="m.topic">
                <td>{{ m.system }}<small class="bk-age"> · {{ m.interval_label }}{{ m.own_interval ? ' (eigen)' : '' }}</small></td>
                <td class="num">{{ m.topic }}</td>
              </tr>
            </table>
            <div class="hint" v-if="mqttStatus && !mqttStatus.mapped.length">
              Noch kein Topic zugeordnet. Trag es je System unter „✎ Bearbeiten“ im Feld
              <strong>MQTT-Topic</strong> ein.
            </div>

            <div class="mqtt-log" v-if="mqttStatus && mqttStatus.events.length">
              <div class="hw-head">Letzte Ereignisse</div>
              <div v-for="(e,i) in mqttStatus.events" :key="i" class="mq-row" :class="e.level">
                <span class="mq-ts">{{ e.ts.slice(11,19) }}</span><span>{{ e.text }}</span>
              </div>
            </div>
          </template>
        </div>

        <div class="card set-card" v-if="appSettingsDraft">
          <h3>Automatische Sicherung</h3>
          <p class="hint">Legt eine konsistente Kopie der Datenbank in
            <code>{{ backupStatus ? backupStatus.directory : '/backup' }}</code> ab.
            Home Assistant nimmt dieses Verzeichnis in seine eigenen Voll-Sicherungen auf.</p>

          <div class="hint ks-note" v-if="backupStatus && !backupStatus.supervisor_backup_dir">
            <code>/backup</code> ist nicht gemappt – es wird nach <code>/share</code> gesichert.
            Diese Dateien landen NICHT im Home-Assistant-Backup. Ergänze
            <code>backup:rw</code> unter <code>map:</code> in der <code>config.yaml</code>.
          </div>

          <div class="field">
            <label class="check"><input type="checkbox" v-model="appSettingsDraft.backup_enabled" @change="validateSettings" />
              <span>Tägliche Sicherung aktiv</span></label>
          </div>
          <div class="field-row">
            <div class="field"><label>Uhrzeit</label>
              <input class="input" type="time" v-model="appSettingsDraft.backup_time"
                     :class="{invalid: settingsErrors.backup_time}" @input="validateSettings" />
              <div class="err-inline" v-if="settingsErrors.backup_time">{{ settingsErrors.backup_time }}</div>
            </div>
            <div class="field"><label>Aufbewahrung (Tage)</label>
              <input class="input" type="number" min="1" max="365" step="1"
                     v-model="appSettingsDraft.backup_keep_days"
                     :class="{invalid: settingsErrors.backup_keep_days}" @input="validateSettings" />
              <div class="err-inline" v-if="settingsErrors.backup_keep_days">{{ settingsErrors.backup_keep_days }}</div>
              <div class="hint" v-else>Die drei neuesten bleiben immer erhalten.</div>
            </div>
          </div>

          <div class="settings-actions">
            <button class="btn btn-primary" :disabled="backupBusy" @click="runBackup">
              {{ backupBusy ? 'Sichere …' : '⇩ Jetzt sichern' }}</button>
            <button class="btn" @click="exportAll">⇩ Sicherung (ZIP)</button>
            <button class="btn" @click="openExportConfig">⇩ Rohdaten (CSV / JSON) …</button>
          </div>

          <table class="info-table" v-if="backupStatus && backupStatus.entries.length">
            <tr v-for="b in backupStatus.entries" :key="b.file">
              <td>{{ fmtDate(b.created.slice(0,10)) }}<small class="bk-age"> · {{ b.age_days }} T</small></td>
              <td class="num">
                {{ fmtBytes(b.size_bytes) }}
                <a class="crumb" :href="'api/backup/' + b.file" download>⇩</a>
              </td>
            </tr>
          </table>
          <div class="hint" v-else-if="backupStatus">Noch keine Sicherung vorhanden.</div>
        </div>

        <!-- Speichern gilt für ALLE Felder der Sektion A, nicht nur für die
             Karte, in der der Button bisher stand. Deshalb eigene Leiste am
             Ende, die beim Scrollen am unteren Rand haften bleibt. -->
        <div class="save-bar" :class="{ dirty: settingsDirty(), invalid: settingsErrorCount() > 0 }"
             v-if="appSettingsDraft">
          <div class="sb-info">
            <span v-if="settingsSaving">Speichert …</span>
            <span v-else-if="settingsErrorCount()" class="sb-err">
              ⚠ {{ settingsErrorCount() }} {{ settingsErrorCount()===1 ? 'Feld' : 'Felder' }} prüfen
            </span>
            <span v-else-if="settingsDirty()">
              {{ settingsChangeCount() }} ungespeicherte Änderung{{ settingsChangeCount()===1 ? '' : 'en' }}
            </span>
            <span v-else class="sb-clean">✓ Alles gespeichert</span>
          </div>
          <button class="btn" :disabled="!settingsDirty() || settingsSaving" @click="revertSettings">Verwerfen</button>
          <button class="btn btn-primary"
                  :disabled="settingsSaving || !settingsDirty() || settingsErrorCount() > 0"
                  @click="saveSettings">Speichern</button>
        </div>
      </template>

      <!-- ================= SEKTION B: Web-App ================= -->
      <template v-else>
        <div class="card set-card">
          <h3>Darstellung</h3>
          <p class="hint">Gerätelokal in diesem Browser gespeichert, kein Serverzugriff.</p>
          <div class="field">
            <label>Modus</label>
            <div class="theme-opts">
              <button class="theme-opt" :class="{sel: themeMode==='auto'}" @click="pickTheme('auto')"><span class="ic">🖥️</span> Automatisch (System)</button>
              <button class="theme-opt" :class="{sel: themeMode==='light'}" @click="pickTheme('light')"><span class="ic">☀️</span> Hell</button>
              <button class="theme-opt" :class="{sel: themeMode==='dark'}" @click="pickTheme('dark')"><span class="ic">🌙</span> Dunkel</button>
            </div>
          </div>
          <div class="field">
            <label>Farbpalette</label>
            <div class="theme-opts">
              <button v-for="p in palettes" :key="p.key" class="theme-opt"
                      :class="{sel: themePalette===p.key}" @click="pickPalette(p.key)">
                <span class="ic pal-dot" :style="{background: p.swatch}"></span> {{ p.label }}
              </button>
            </div>
          </div>
          <div class="field">
            <label>Kontrast</label>
            <div class="theme-opts">
              <button v-for="c in contrasts" :key="c.key" class="theme-opt"
                      :class="{sel: themeContrast===c.key}" @click="pickContrast(c.key)">
                <span class="ic">{{ c.key==='high' ? '◐' : '◔' }}</span> {{ c.label }}
              </button>
            </div>
            <div class="hint">Meldet dein System bereits eine Kontrastpräferenz, greift sie automatisch.</div>
          </div>
        </div>

        <div class="card set-card">
          <h3>Diagrammfarben</h3>
          <div class="chart-colors">
            <div v-for="c in chartColorKeys" :key="c.key" class="cc-row">
              <label class="cc-swatch" :style="{background: chartColorValue(c.key)}" :title="c.label">
                <input type="color" :value="chartColorValue(c.key)" @input="onChartColor(c.key, $event)" />
              </label>
              <span class="cc-label">
                {{ c.label }}
                <small>{{ isChartColorCustom(c.key) ? chartColorValue(c.key) : 'Theme-Standard' }}</small>
              </span>
              <button v-if="isChartColorCustom(c.key)" class="crumb cc-reset"
                      @click="clearChartColor(c.key)" title="Auf Theme-Standard zurücksetzen">↺</button>
            </div>
          </div>
          <div class="hint">Die <strong>Kurvenfarbe</strong> gehört zum jeweiligen System und wird dort bearbeitet.</div>
          <div class="settings-actions">
            <button class="btn btn-sm" @click="resetChartColors">↺ Alle auf Theme-Standard</button>
          </div>
        </div>

        <div class="card set-card">
          <h3>Über</h3>
          <div class="settings-actions">
            <button class="btn" @click="showChangelog=true">Zählwerk v{{ appVersion }} · Versionsverlauf</button>
          </div>
        </div>
      </template>
    </template>

    <!-- DETAIL -->
    <system-detail
      ref="detail"
      v-else-if="selectedSystem && view==='detail'"
      :key="selectedSystem.id"
      :system="selectedSystem"
      @back="back"
      @edit="editSystem"
      @changed="load" />
  </div>

  <!-- MODAL: System -->
  <div class="overlay" v-if="showSystem" @click.self="showSystem=false">
    <div class="modal">
      <div class="modal-head"><h3>{{ sysForm.id ? 'System bearbeiten' : 'Neues System' }}</h3></div>
      <div class="modal-body">
        <label class="tf"><input class="tf-input" v-model="sysForm.name" placeholder=" " /><span class="tf-label">Name (z. B. Strom Hauptzähler)</span></label>
        <div class="field-row">
          <div class="field"><label>Typ</label>
            <select class="select" v-model="sysForm.typ" @change="onTypeChange">
              <option v-for="t in types" :key="t.v" :value="t.v">{{ t.v }}</option>
            </select>
          </div>
          <div class="field"><label>Einheit</label><input class="input" v-model="sysForm.einheit" placeholder="kWh, m³ …" /></div>
        </div>
        <div class="field">
          <label>Farbe</label>
          <div class="swatch-row">
            <span v-for="c in palette" :key="c" class="swatch-pick" :class="{sel: sysForm.farbe===c}" :style="{background:c}" @click="sysForm.farbe=c"></span>
            <label class="swatch-pick swatch-custom" :class="{sel: !palette.includes(sysForm.farbe)}"
                   :style="{background: sysForm.farbe}" title="Eigene Farbe wählen">
              <input type="color" v-model="sysForm.farbe" />
            </label>
          </div>
          <div class="hint">{{ sysForm.farbe }}<span v-if="colorWarning(sysForm.farbe)" class="warn-inline"> · {{ colorWarning(sysForm.farbe) }}</span></div>
        </div>
        <div class="field" v-for="f in formExtra" :key="f.key">
          <label>{{ f.label }}</label>
          <select v-if="f.type==='select'" class="select" style="width:100%" v-model="sysForm.zusatzfelder[f.key]">
            <!-- f.labels erlaubt lesbare Beschriftungen; ohne sie bleibt der Wert selbst stehen. -->
            <option v-for="o in f.options" :key="o" :value="o">{{
              (f.labels && f.labels[o]) || (o === '' ? '– automatisch –' : o) }}</option>
          </select>
          <input v-else class="input" :type="f.type" v-model="sysForm.zusatzfelder[f.key]" />
        </div>
        <div class="field" v-if="sysForm.id">
          <label class="check"><input type="checkbox" v-model="sysForm.aktiv" /> aktiv (deaktivieren = archivieren, Werte bleiben erhalten)</label>
        </div>
      </div>
      <div class="modal-foot" :class="{'has-danger': sysForm.id}">
        <hold-button v-if="sysForm.id" @held="confirmDeleteSystem">✕ Löschen (halten)</hold-button>
        <span class="foot-spacer"></span>
        <button class="btn" @click="showSystem=false">Abbrechen</button>
        <button class="btn btn-primary" :disabled="busy" @click="saveSystem">Speichern</button>
      </div>
    </div>
  </div>

  <!-- ANMELDUNG / ERSTEINRICHTUNG -->
  <div class="auth-gate" v-if="authNeeded">
    <div class="auth-card">
      <div class="auth-brand">◷ Zählwerk</div>

      <template v-if="auth.status && auth.status.setup_required">
        <h2>Erstes Konto anlegen</h2>
        <p class="hint">Zählwerk läuft ohne Home Assistant. Lege ein Konto an –
          danach ist die Anwendung nur noch angemeldet erreichbar.</p>
        <div class="field"><label>Benutzername</label>
          <input class="input" v-model="authForm.username" autocomplete="username"
                 @keyup.enter="doSetup" /></div>
        <div class="field"><label>Anzeigename (optional)</label>
          <input class="input" v-model="authForm.display_name" /></div>
        <div class="field"><label>Passwort</label>
          <input class="input" type="password" v-model="authForm.password"
                 autocomplete="new-password" @keyup.enter="doSetup" />
          <div class="err-inline" v-if="authForm.password && authForm.password.length < 12">
            Mindestens 12 Zeichen
          </div>
          <div class="hint" v-else>Mindestens 12 Zeichen. Länge wirkt stärker als Sonderzeichen.</div>
        </div>
        <div class="field"><label>Passwort wiederholen</label>
          <input class="input" type="password" v-model="authForm.password2"
                 autocomplete="new-password" @keyup.enter="doSetup" />
          <div class="err-inline" v-if="authForm.password2 && authForm.password2 !== authForm.password">
            Stimmt nicht überein
          </div>
        </div>
        <button class="btn btn-primary auth-submit" :disabled="!setupValid || authBusy" @click="doSetup">
          {{ authBusy ? 'Legt an …' : 'Konto anlegen' }}
        </button>
      </template>

      <template v-else>
        <h2>Anmelden</h2>
        <div class="hint ks-note" v-if="auth.status && !auth.status.crypto_available">
          <code>bcrypt</code> oder <code>PyJWT</code> fehlen im Image. Das Add-on
          nach dem Update neu bauen lassen.
        </div>
        <div class="field"><label>Benutzername</label>
          <input class="input" v-model="authForm.username" autocomplete="username"
                 @keyup.enter="doLogin" /></div>
        <div class="field"><label>Passwort</label>
          <input class="input" type="password" v-model="authForm.password"
                 autocomplete="current-password" @keyup.enter="doLogin" /></div>
        <div class="err-inline auth-err" v-if="authError">{{ authError }}</div>
        <button class="btn btn-primary auth-submit"
                :disabled="!authForm.username || !authForm.password || authBusy" @click="doLogin">
          {{ authBusy ? 'Prüft …' : 'Anmelden' }}
        </button>
      </template>
    </div>
  </div>

  <!-- MODAL: Bericht konfigurieren (Pre-Export) -->
  <div class="overlay" v-if="showExportCfg" @click.self="showExportCfg=false">
    <div class="modal modal-wide" v-if="expCfg">
      <div class="modal-head"><h3>Bericht erstellen</h3></div>
      <div class="modal-body">

        <div class="field">
          <label>Zeitraum</label>
          <div class="seg exp-seg">
            <button :class="{active: expCfg.preset==='all'}"      @click="expApplyPreset('all')">Gesamt</button>
            <button :class="{active: expCfg.preset==='ytd'}"      @click="expApplyPreset('ytd')">Lfd. Jahr</button>
            <button :class="{active: expCfg.preset==='12m'}"      @click="expApplyPreset('12m')">12 Monate</button>
            <button :class="{active: expCfg.preset==='lastyear'}" @click="expApplyPreset('lastyear')">Vorjahr</button>
          </div>
          <div class="field-row exp-dates">
            <div class="field"><label>Von</label>
              <input class="input" type="date" v-model="expCfg.from" @change="expCfg.preset='custom'" /></div>
            <div class="field"><label>Bis</label>
              <input class="input" type="date" v-model="expCfg.to" @change="expCfg.preset='custom'" /></div>
          </div>
          <div class="hint" v-if="!expCfg.from && !expCfg.to">Ohne Angabe wird der gesamte Bestand ausgewertet.</div>
        </div>

        <div class="field">
          <label>Systeme ({{ expCount() }} ausgewählt)</label>
          <div class="exp-actions">
            <button class="btn btn-sm" @click="expSelectAll(true)">Alle</button>
            <button class="btn btn-sm" @click="expSelectAll(false)">Keins</button>
            <label class="check exp-inactive">
              <input type="checkbox" v-model="expCfg.includeInactive" />
              <span>Archivierte einbeziehen</span>
            </label>
          </div>
          <div class="exp-systems">
            <label v-for="s in systems.filter(x => expCfg.includeInactive || x.aktiv)" :key="s.id"
                   class="exp-sys" :class="{sel: expCfg.systemIds.includes(s.id)}">
              <input type="checkbox" :checked="expCfg.systemIds.includes(s.id)" @change="expToggleSystem(s.id)" />
              <span class="dot" :style="{background: s.farbe}"></span>
              <span class="exp-name">{{ typeIcon(s.typ) }} {{ s.name }}</span>
              <small v-if="!s.aktiv">archiviert</small>
            </label>
          </div>
        </div>

        <div class="field">
          <label>Darstellung</label>
          <label class="check">
            <input type="checkbox" v-model="expCfg.useTheme" />
            <span>App-Farben übernehmen
              <small>Akzent, Text und Linien aus der aktiven Palette</small></span>
          </label>
          <div class="exp-swatches" v-if="expCfg.useTheme">
            <span v-for="(v,k) in expCfg.theme" :key="k" class="exp-sw" :title="k">
              <i :style="{background: v}"></i>{{ k }}
            </span>
          </div>
          <label class="check">
            <input type="checkbox" v-model="expCfg.systemColors" />
            <span>Diagramm je System in dessen Farbe
              <small>Sonst durchgehend Akzentfarbe</small></span>
          </label>
          <label class="check"><input type="checkbox" v-model="expCfg.includeChart" /><span>Diagramm einschließen</span></label>
          <label class="check"><input type="checkbox" v-model="expCfg.includeTable" /><span>Ablesungstabelle einschließen</span></label>
        </div>

        <div class="field">
          <label>Format</label>
          <div class="seg exp-seg">
            <button :class="{active: expCfg.format==='pdf'}"  @click="expCfg.format='pdf'">PDF-Bericht</button>
            <button :class="{active: expCfg.format==='csv'}"  @click="expCfg.format='csv'">CSV (Rohdaten)</button>
            <button :class="{active: expCfg.format==='json'}" @click="expCfg.format='json'">JSON (Rohdaten)</button>
            <button :class="{active: expCfg.format==='zip'}"  @click="expCfg.format='zip'">ZIP (Sicherung)</button>
          </div>

          <div class="hint ks-note" v-if="expCfg.format==='zip'">
            Sicherungsformat. Enthält immer den <strong>vollständigen</strong> Bestand –
            Zeitraum, Systemauswahl und Farben gelten dafür nicht. Nur dieses Format und
            die systemweise CSV lassen sich wieder <strong>einlesen</strong>.
          </div>
          <div class="hint ks-note" v-else-if="expCfg.format==='csv' || expCfg.format==='json'">
            Ausgabeformat für externe Auswertung, mit Verbrauch, Tagesverbrauch und Kosten.
            <strong>Nicht</strong> nach Zählwerk zurück importierbar – dafür ZIP verwenden.
          </div>

          <div class="field-row" v-if="expCfg.format==='csv'">
            <div class="field">
              <label>CSV-Variante</label>
              <div class="seg">
                <button :class="{active: expCfg.dialect==='de'}" @click="expCfg.dialect='de'">Excel (DE)</button>
                <button :class="{active: expCfg.dialect==='international'}" @click="expCfg.dialect='international'">pandas / R</button>
              </div>
              <div class="hint">
                {{ expCfg.dialect==='de'
                  ? 'Semikolon, Dezimalkomma, UTF-8 mit BOM – öffnet in Excel direkt korrekt.'
                  : 'Komma, Dezimalpunkt, ohne BOM.' }}
              </div>
            </div>
          </div>
          <div class="field" v-if="expCfg.format==='json'">
            <label class="check"><input type="checkbox" v-model="expCfg.includeDerived" />
              <span>Abgeleitete Werte einschließen
                <small>Verbrauch, Tagesverbrauch, Ausreißer, Kosten</small></span></label>
            <label class="check"><input type="checkbox" v-model="expCfg.includeMeta" />
              <span>Zähler-Metadaten und Tarife einschließen</span></label>
          </div>
        </div>

      </div>
      <div class="modal-foot">
        <button class="btn" @click="showExportCfg=false">Abbrechen</button>
        <button class="btn btn-primary" :disabled="!expCount()" @click="runExport">
          {{ expCfg.format==='zip' ? 'ZIP herunterladen' : 'PDF erstellen' }}
        </button>
      </div>
    </div>
  </div>

  <!-- MODAL: Versionsverlauf -->
  <div class="overlay" v-if="showChangelog" @click.self="showChangelog=false">
    <div class="modal">
      <div class="modal-head"><h3>Versionsverlauf</h3></div>
      <div class="modal-body">
        <div v-for="rel in changelog" :key="rel.v" class="rel">
          <div class="rel-head"><span class="rel-v num">v{{ rel.v }}</span><span class="rel-d">{{ rel.d }}</span></div>
          <ul class="rel-items"><li v-for="(it, i) in rel.items" :key="i">{{ it }}</li></ul>
        </div>
      </div>
      <div class="modal-foot"><button class="btn btn-primary" @click="showChangelog=false">Schließen</button></div>
    </div>
  </div>

  <!-- TOAST -->
  <div v-if="toast" class="toast" :class="toast.type">{{ toast.msg }}</div>
  `,
}).mount("#app");

/* ---------- M3 Ink-Ripple: geht physikalisch vom Beruehrungspunkt aus ---------- */
document.addEventListener("pointerdown", (ev) => {
  const host = ev.target.closest(".btn, .tab, .tile, .nav-item .nav-pill, .seg button, .fab, .iconbtn, .theme-opt");
  if (!host) return;
  const rect = host.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  const ink = document.createElement("span");
  ink.className = "ripple-ink";
  ink.style.width = ink.style.height = size + "px";
  ink.style.left = (ev.clientX - rect.left - size / 2) + "px";
  ink.style.top = (ev.clientY - rect.top - size / 2) + "px";
  host.appendChild(ink);
  setTimeout(() => ink.remove(), 550);
}, { passive: true });
