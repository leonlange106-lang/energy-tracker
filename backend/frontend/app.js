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
    sortKey: "datum",
    sortDir: "desc",
    filter: "",
    onlyOutliers: false,
    page: 1,
    perPage: 15,
    // Modals
    showReading: false,
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
        if (this.sortKey === "datum") { av = new Date(av); bv = new Date(bv); }
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
      const [readings, stats, chartData] = await Promise.all([
        api(`/api/systems/${this.system.id}/readings${q}`),
        api(`/api/systems/${this.system.id}/stats${q}`),
        api(`/api/systems/${this.system.id}/chart-data${q}`),
      ]);
      this.readings = readings; this.stats = stats; this.chartData = chartData;
      this.page = 1;
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
    setSort(k) { if (this.sortKey === k) this.sortDir = this.sortDir === "asc" ? "desc" : "asc"; else { this.sortKey = k; this.sortDir = "desc"; } },
    arrow(k) { return this.sortKey === k ? (this.sortDir === "asc" ? "↑" : "↓") : ""; },

    /* Ablesung */
    openReading() {
      this.reading = { datum: today(), value: null, cost: null, meter_replaced: false, note: "" };
      this.showReading = true;
    },
    async saveReading() {
      if (this.reading.value === null || this.reading.value === "") { this.notify("Zählerwert fehlt", "err"); return; }
      this.busy = true;
      try {
        await api(`/api/systems/${this.system.id}/readings`, {
          method: "POST",
          body: JSON.stringify({
            datum: this.reading.datum,
            value: Number(this.reading.value),
            cost: this.reading.cost === "" || this.reading.cost === null ? null : Number(this.reading.cost),
            meter_replaced: this.reading.meter_replaced,
            note: this.reading.note || null,
          }),
        });
        this.showReading = false;
        this.notify("Ablesung gespeichert", "ok");
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
        <button class="btn btn-primary btn-sm" @click="openReading">＋ Neuer Wert</button>
        <button class="btn btn-sm" @click="openImport">⇪ Import</button>
        <button class="btn btn-sm" @click="openExport">⇩ Export</button>
        <button class="btn btn-sm" @click="openReport">⇩ PDF-Bericht</button>
        <button class="btn btn-sm" @click="$emit('edit', system)">Bearbeiten</button>
      </div>
    </div>

    <div class="tabs">
      <button class="tab" :class="{active: tab==='chart'}" @click="tab='chart'">Auswertung</button>
      <button class="tab" :class="{active: tab==='list'}" @click="tab='list'">Werte ({{ readings.length }})</button>
    </div>

    <div v-if="loading" class="center-load"><span class="spin"></span></div>

    <!-- AUSWERTUNG -->
    <div v-else-if="tab==='chart'">
      <div class="stats" v-if="stats">
        <div class="stat"><div class="s-label">Gesamtverbrauch</div><div class="s-val num">{{ fmt(stats.total_consumption) }}<span class="u">{{ system.einheit }}</span></div></div>
        <div class="stat"><div class="s-label">Ø / Tag</div><div class="s-val num">{{ fmt(stats.avg_per_day, 3) }}<span class="u">{{ system.einheit }}</span></div></div>
        <div class="stat"><div class="s-label">Gesamtkosten</div><div class="s-val num">{{ fmt(stats.total_cost) }}<span class="u">€</span></div></div>
        <div class="stat"><div class="s-label">Kosten / Einheit</div><div class="s-val num">{{ fmt(stats.cost_per_unit, 4) }}<span class="u">€</span></div></div>
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
    <div v-else>
      <div class="table-tools">
        <input class="input" v-model="filter" placeholder="Filtern (Notiz / Datum)…" />
        <label class="check"><input type="checkbox" v-model="onlyOutliers" /> nur Ausreißer</label>
        <div class="spacer" style="flex:1"></div>
        <button class="btn btn-primary btn-sm" @click="openReading">＋ Neuer Wert</button>
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
              <th @click="setSort('cost')" class="r">Kosten <span class="arrow">{{ arrow('cost') }}</span></th>
              <th class="col-note">Notiz</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in paged" :key="r.id">
              <td>{{ fmtDate(r.datum) }}</td>
              <td class="r num">{{ fmt(r.value, 1) }}</td>
              <td class="r num">
                {{ fmt(r.consumption) }}
                <span v-if="r.meter_replaced" class="tag tag-swap">Tausch</span>
                <span v-if="r.is_outlier" class="tag tag-out">Ausreißer</span>
              </td>
              <td class="r num">{{ r.cost === null ? '–' : fmt(r.cost) }}</td>
              <td class="col-note">{{ r.note || '' }}</td>
              <td class="r"><button class="btn btn-ghost btn-sm" @click="deleteReading(r)">✕</button></td>
            </tr>
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

    <!-- MODAL: Ablesung -->
    <div class="overlay" v-if="showReading" @click.self="showReading=false">
      <div class="modal">
        <div class="modal-head"><h3>Neue Ablesung – {{ system.name }}</h3></div>
        <div class="modal-body">
          <div class="field-row">
            <div class="field"><label>Datum</label><input class="input" type="date" v-model="reading.datum" /></div>
            <div class="field"><label>Zählerstand ({{ system.einheit }})</label><input class="input" type="number" step="any" v-model="reading.value" /></div>
          </div>
          <div class="field"><label>Kosten € (optional)</label><input class="input" type="number" step="any" v-model="reading.cost" /></div>
          <div class="field">
            <label class="check"><input type="checkbox" v-model="reading.meter_replaced" /> Zählertausch (neuer Zähler startet bei 0)</label>
            <div class="hint" v-if="latestValue!==null && !reading.meter_replaced">Letzter Stand: {{ fmt(latestValue,1) }} {{ system.einheit }} – neuer Wert muss ≥ sein.</div>
          </div>
          <div class="field"><label>Notiz (optional)</label><input class="input" v-model="reading.note" /></div>
        </div>
        <div class="modal-foot">
          <button class="btn" @click="showReading=false">Abbrechen</button>
          <button class="btn btn-primary" :disabled="busy" @click="saveReading">Speichern</button>
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
    formExtra() { return this.sysForm ? EXTRA_FIELDS[this.sysForm.typ] || [] : []; },
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
      <button v-if="view==='detail'" class="iconbtn" @click="back" title="Alle Systeme (Startseite)">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11 L12 3 L21 11"/><path d="M5 10 V20 H19 V10"/></svg>
      </button>
      <div class="brand">
        <span class="logo"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 18 A8 8 0 0 1 20 18"/><path d="M12 18 L16.5 11.5"/><circle cx="12" cy="18" r="1.3" fill="currentColor" stroke="none"/></svg></span>
        <h1>Zählwerk</h1>
      </div>
      <div class="spacer"></div>
      <button v-if="view==='menu' && systems.length" class="btn btn-sm" @click="openCombinedReport">⇩ Gesamt-PDF</button>
      <button v-if="view==='menu'" class="btn btn-primary btn-sm" @click="newSystem">＋ System</button>
      <button class="iconbtn" @click="showSettings=true" title="Einstellungen">
        <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
      </button>
    </div>
  </div>

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
        <div v-for="s in visibleSystems" :key="s.id" class="tile" :class="{archived: !s.aktiv}" @click="open(s)">
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
        </div>
      </div>
    </template>

    <!-- DETAIL -->
    <system-detail
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
        <div class="field"><label>Name</label><input class="input" v-model="sysForm.name" placeholder="z. B. Strom Hauptzähler" /></div>
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
