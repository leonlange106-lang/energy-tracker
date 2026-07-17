/* =========================================================================
   Zählwerk – Frontend (Vue 3, ohne Build-Step)
   ========================================================================= */
const { createApp, reactive } = Vue;

/* ---------- Theme (Light/Dark, System-follow + manuell) ---------- */
const themeStore = reactive({ mode: localStorage.getItem("zw_theme") || "auto", dark: false });
function applyTheme() {
  const sysDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  themeStore.dark = themeStore.mode === "dark" || (themeStore.mode === "auto" && sysDark);
  document.documentElement.setAttribute("data-theme", themeStore.dark ? "dark" : "light");
}
function setTheme(mode) {
  themeStore.mode = mode;
  localStorage.setItem("zw_theme", mode);
  applyTheme();
}
applyTheme();
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
  if (themeStore.mode === "auto") applyTheme();
});
// aktuelle Theme-Farbe aus CSS lesen (für Chart.js)
const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

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
];
const EXTRA_FIELDS = {
  "Gas":            [{ key: "brennwert", label: "Brennwert (kWh/m³)", type: "number" },
                     { key: "zustandszahl", label: "Zustandszahl (Standard 0,95)", type: "number" }],
  "PV-Erzeugung":   [{ key: "kwp",           label: "Installierte Leistung (kWp)", type: "number" }],
  "PV-Einspeisung": [{ key: "verguetung_ct", label: "Einspeisevergütung (ct/kWh)", type: "number" }],
};
const PALETTE = ["#0e7c86", "#d9820a", "#3b6fb5", "#2f8f5b", "#a4508b", "#c0453b", "#6b7280", "#0891b2"];

/* ---------- Helfer ---------- */
async function api(path, opts = {}) {
  // Führenden Slash entfernen -> relativer Request. Funktioniert direkt (LXC)
  // UND hinter Home-Assistant-Ingress (dynamischer Basis-Pfad).
  const url = path.replace(/^\//, "");
  const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...opts });
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
   Chart-Komponente – reiner Renderer (Datasets kommen fertig vom Parent)
   ========================================================================= */
const EnergyChart = {
  props: { labels: Array, datasets: Array, chartType: String, hasY2: Boolean, y2Label: String },
  template: `<div class="chart-box"><canvas ref="cv"></canvas></div>`,
  mounted() { this.schedule(); },
  beforeUnmount() { this.destroy(); },
  computed: { isDark() { return themeStore.dark; } },
  watch: {
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
      const grid = cssVar("--chart-grid") || "#e2e8ee";
      const tick = cssVar("--ink-soft") || "#5b6b7b";

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
        x: { grid: { color: grid }, ticks: { color: tick, maxRotation: 90, minRotation: 90, autoSkip: false, font: { size: 9 } } },
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
  components: { EnergyChart },
  inject: ["notify"],
  props: { system: Object },
  emits: ["back", "edit", "changed"],
  data: () => ({
    tab: "chart",
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
      const ptColor = labels.map((l) => { const i = idxOf(l); return i >= 0 && this.chartData.outliers[i] ? "#d9820a" : this.chartData.color; });
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
    overlayIds() { this.loadOverlays(); },
  },
  async mounted() {
    await this.loadAll();
    try { this.allSystems = await api("/api/systems"); } catch (_) {}
  },
  methods: {
    fmt, fmtDate, typeIcon,
    async loadAll() { this.loading = true; await this.loadDynamic(); this.loading = false; },
    async loadDynamic() {
      const q = this.fromParam ? `?from=${this.fromParam}` : "";
      // Ein kombinierter Request statt drei (eine Berechnung im Backend)
      const d = await api(`/api/systems/${this.system.id}/dashboard${q}`);
      this.readings = d.readings; this.stats = d.stats; this.chartData = d.chart;
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
    openReading() {
      this.reading = { id: null, datum: today(), value: null, cost: null, meter_replaced: false, note: "" };
      this.showReading = true;
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
      // Hochskalieren + Graustufen + Kontrast-Threshold. Polarität automatisch:
      // helle LCD-Ziffern auf dunklem Grund werden invertiert (Tesseract will dunkel auf hell).
      const scale = Math.max(1, Math.min(3, 1400 / src.width));
      const c = document.createElement("canvas");
      c.width = Math.round(src.width * scale);
      c.height = Math.round(src.height * scale);
      const ctx = c.getContext("2d");
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(src, 0, 0, c.width, c.height);
      const img = ctx.getImageData(0, 0, c.width, c.height);
      const d = img.data;
      // Graustufen + Mittelwert
      let sum = 0;
      const n = d.length / 4;
      for (let i = 0; i < d.length; i += 4) {
        const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        d[i] = d[i + 1] = d[i + 2] = g;
        sum += g;
      }
      const mean = sum / n;
      // Threshold + Polaritätszählung
      let dark = 0;
      for (let i = 0; i < d.length; i += 4) {
        const v = d[i] < mean * 0.92 ? 0 : 255;
        d[i] = d[i + 1] = d[i + 2] = v;
        if (v === 0) dark++;
      }
      // Mehr dunkel als hell -> Ziffern sind vermutlich hell (LCD) -> invertieren
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
        const r1 = await Tesseract.recognize(prepped, "eng", {
          tessedit_char_whitelist: "0123456789., kWhm",
        });
        let best = this.pickOcrCandidate(r1.data.text);

        // Kein Treffer aus der kWh-Zeile? -> LCD vermutlich 7-Segment, Spezial-Modell versuchen
        if (!best || !best.fromKwh) {
          try {
            this.scanStatus = "Digital-Display erkannt – lade 7-Segment-Modell …";
            const r2 = await Tesseract.recognize(prepped, "letsgodigital", {
              langPath: "https://cdn.jsdelivr.net/gh/arturaugusto/display_ocr@master/letsgodigital",
              gzip: false,
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
        <button class="btn btn-tonal btn-sm" @click="openReport">⇩ PDF</button>
      </div>
    </div>

    <div class="tabs">
      <button class="tab" :class="{active: tab==='chart'}" @click="tab='chart'">Auswertung</button>
      <button class="tab" :class="{active: tab==='list'}" @click="tab='list'">Werte ({{ readings.length }})</button>
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
          <span><span class="dot" style="background:#d9820a"></span>Ausreißer (Ø + 2σ)</span>
        </div>
      </div>
    </div>

    <!-- WERTE-TABELLE -->
    <div v-else key="list">
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
                <button class="iconbtn" style="width:32px;height:32px" @click.stop="deleteReading(r)" title="Löschen">✕</button>
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
                    <button class="btn btn-sm btn-danger-outline" @click.stop="deleteReading(r)">✕ Löschen</button>
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

    </transition>

    <!-- MODAL: Ablesung -->
    <div class="overlay" v-if="showReading" @click.self="showReading=false">
      <div class="modal">
        <div class="modal-head"><h3>{{ reading.id ? 'Ablesung bearbeiten' : 'Neue Ablesung' }} – {{ system.name }}</h3></div>
        <div class="modal-body">
          <div class="field-row">
            <div class="field"><label>Datum</label><input class="input" type="date" v-model="reading.datum" /></div>
            <div class="field">
              <div class="input-scan">
                <label class="tf"><input class="tf-input" type="number" step="any" v-model="reading.value" placeholder=" " /><span class="tf-label">Zählerstand ({{ system.einheit }})</span></label>
                <button class="btn btn-sm" @click="openScanner" title="Zählerstand per Kamera scannen">📷</button>
              </div>
            </div>
          </div>
          <label class="tf"><input class="tf-input" type="number" step="any" v-model="reading.cost" placeholder=" " /><span class="tf-label">Kosten € (optional)</span></label>
          <div class="field">
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
        <div class="modal-head"><h3>📷 Zählerstand scannen</h3></div>
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
          <div class="hint">Beta: Erkennung per Tesseract-OCR im Browser. Ergebnis immer prüfen – mechanische Rollen-Zählwerke mit halb gedrehten Ziffern sind fehleranfällig.</div>
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
  components: { SystemDetail },
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
    types: SYSTEM_TYPES,
    latest: {},                // system_id -> { value, datum }
    showSettings: false,
  }),
  computed: {
    visibleSystems() { return this.systems.filter((s) => this.showArchived || s.aktiv); },
    selectedSystem() { return this.systems.find((s) => s.id === this.selected) || null; },
    formExtra() { return this.sysForm ? [...(EXTRA_FIELDS[this.sysForm.typ] || []), ...COMMON_FIELDS] : []; },
    themeMode() { return themeStore.mode; },
  },
  async mounted() { await this.load(); },
  methods: {
    fmt, typeIcon, fmtDate,
    notify(msg, type = "ok") { this.toast = { msg, type }; setTimeout(() => (this.toast = null), 3200); },
    async load() {
      this.loading = true;
      try {
        this.systems = await api("/api/systems?include_archived=true");
        try { this.latest = await api("/api/overview"); } catch (_) { this.latest = {}; }
      } catch (e) { this.notify(e.message, "err"); }
      finally { this.loading = false; }
    },
    open(s) { this.selected = s.id; this.view = "detail"; window.scrollTo(0, 0); },
    back() { this.view = "menu"; this.selected = null; this.load(); },
    openCombinedReport() {
      fetchBlobDownload("api/report.pdf", "zaehlwerk-gesamtbericht.pdf")
        .catch((e) => this.notify("PDF fehlgeschlagen: " + e.message, "err"));
    },
    pickTheme(mode) { setTheme(mode); },
    fabAction() {
      if (this.view === 'detail' && this.$refs.detail) this.$refs.detail.openReading();
      else this.newSystem();
    },
    detailAction(fn) {
      this.showSettings = false;
      if (this.$refs.detail && this.$refs.detail[fn]) this.$refs.detail[fn]();
    },
    dueInfo(id) {
      const l = this.latest[id];
      if (!l || l.overdue_days === undefined || l.overdue_days === null) return null;
      const od = l.overdue_days;
      if (od > 0) return { level: "over", text: `Ablesung überfällig · seit ${od} T` };
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
      <div class="brand">
        <span class="logo"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 19a9 9 0 1 1 14 0"/><path d="M12 5v2"/><path d="M5.6 8.5l1.5 1.2"/><path d="M18.4 8.5l-1.5 1.2"/><path d="M12 15l3.5-4.5"/><circle cx="12" cy="16" r="1.6" fill="currentColor" stroke="none"/></svg></span>
        <h1>{{ view==='detail' && selectedSystem ? selectedSystem.name : 'Zählwerk' }}</h1>
      </div>
      <div class="spacer"></div>
    </div>
  </div>

  <!-- Navigation Rail (Desktop/Tablet) -->
  <nav class="nav-rail">
    <button class="fab rail-fab" @click="fabAction" :title="view==='menu' ? 'System anlegen' : 'Neuer Wert'">＋</button>
    <button class="nav-item" :class="{active: view==='menu'}" @click="back">
      <span class="nav-pill"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11 L12 3 L21 11"/><path d="M5 10 V20 H19 V10"/></svg></span>
      Systeme
    </button>
    <button class="nav-item" v-if="systems.length" @click="openCombinedReport">
      <span class="nav-pill"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M12 18v-6"/><path d="M9 15l3 3 3-3"/></svg></span>
      Bericht
    </button>
    <button class="nav-item" :class="{active: showSettings}" @click="showSettings=true">
      <span class="nav-pill"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg></span>
      Optionen
    </button>
  </nav>

  <!-- Bottom Navigation (Mobile) -->
  <nav class="nav-bottom">
    <button class="nav-item" :class="{active: view==='menu'}" @click="back">
      <span class="nav-pill"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11 L12 3 L21 11"/><path d="M5 10 V20 H19 V10"/></svg></span>
      Systeme
    </button>
    <button class="nav-item" v-if="systems.length" @click="openCombinedReport">
      <span class="nav-pill"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M12 18v-6"/><path d="M9 15l3 3 3-3"/></svg></span>
      Bericht
    </button>
    <button class="nav-item" :class="{active: showSettings}" @click="showSettings=true">
      <span class="nav-pill"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg></span>
      Optionen
    </button>
  </nav>

  <!-- FAB (Mobile) -->
  <div class="fab-screen"><button class="fab" @click="fabAction" :title="view==='menu' ? 'System anlegen' : 'Neuer Wert'">＋</button></div>

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

    <!-- DETAIL -->
    <system-detail
      ref="detail"
      v-else-if="selectedSystem"
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
          </div>
        </div>
        <div class="field" v-for="f in formExtra" :key="f.key">
          <label>{{ f.label }}</label>
          <input class="input" :type="f.type" v-model="sysForm.zusatzfelder[f.key]" />
        </div>
        <div class="field" v-if="sysForm.id">
          <label class="check"><input type="checkbox" v-model="sysForm.aktiv" /> aktiv (deaktivieren = archivieren, Werte bleiben erhalten)</label>
        </div>
      </div>
      <div class="modal-foot">
        <button class="btn" @click="showSystem=false">Abbrechen</button>
        <button class="btn btn-primary" :disabled="busy" @click="saveSystem">Speichern</button>
      </div>
    </div>
  </div>

  <!-- MODAL: Einstellungen -->
  <div class="overlay" v-if="showSettings" @click.self="showSettings=false">
    <div class="modal">
      <div class="modal-head"><h3>Einstellungen</h3></div>
      <div class="modal-body">
        <div class="settings-section" v-if="view==='detail' && selectedSystem">
          <div class="field"><label>System · {{ selectedSystem.name }}</label></div>
          <div class="settings-actions">
            <button class="btn" @click="showSettings=false; editSystem(selectedSystem)">✎ System bearbeiten</button>
            <button class="btn" @click="detailAction('openImport')">⇪ CSV-Import</button>
            <button class="btn" @click="detailAction('openExport')">⇩ CSV-Export (Backup)</button>
            <button class="btn" @click="detailAction('openReport')">⇩ PDF-Bericht</button>
          </div>
        </div>
        <div class="field">
          <label>Darstellung</label>
          <div class="theme-opts">
            <button class="theme-opt" :class="{sel: themeMode==='auto'}" @click="pickTheme('auto')"><span class="ic">🖥️</span> Automatisch (System)</button>
            <button class="theme-opt" :class="{sel: themeMode==='light'}" @click="pickTheme('light')"><span class="ic">☀️</span> Hell</button>
            <button class="theme-opt" :class="{sel: themeMode==='dark'}" @click="pickTheme('dark')"><span class="ic">🌙</span> Dunkel</button>
          </div>
          <div class="hint">„Automatisch" folgt der System-Einstellung deines Geräts.</div>
        </div>
      </div>
      <div class="modal-foot">
        <button class="btn btn-primary" @click="showSettings=false">Fertig</button>
      </div>
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
