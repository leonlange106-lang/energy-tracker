/* =========================================================================
   Energie-Tracker – Frontend (Vue 3, ohne Build-Step)
   ========================================================================= */
const { createApp } = Vue;

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
  props: { labels: Array, datasets: Array, chartType: String },
  template: `<div class="chart-box"><canvas ref="cv"></canvas></div>`,
  data: () => ({ chart: null }),
  mounted() { this.render(); },
  beforeUnmount() { if (this.chart) this.chart.destroy(); },
  watch: { labels: "render", datasets: "render", chartType: "render" },
  methods: {
    render() {
      if (this.chart) this.chart.destroy();
      this.chart = new Chart(this.$refs.cv.getContext("2d"), {
        type: this.chartType || "line",
        data: { labels: this.labels, datasets: this.datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: "index", intersect: false },
          plugins: {
            legend: { display: this.datasets.length > 1, position: "bottom", labels: { boxWidth: 12, font: { size: 12 } } },
            tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${fmt(c.parsed.y)}` } },
          },
          scales: {
            x: { grid: { color: "#e2e8ee" }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 8, font: { size: 11 } } },
            y: { grid: { color: "#e2e8ee" }, ticks: { font: { size: 11 } }, beginAtZero: false },
          },
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
    range: "year",             // week | month | year | all
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

      const datasets = [{
        label: this.system.name, data: primData,
        borderColor: this.chartData.color,
        backgroundColor: this.chartType === "bar" ? this.chartData.color + "cc" : this.chartData.color + "22",
        pointBackgroundColor: ptColor, pointRadius: ptRad, borderWidth: 2, tension: 0.25,
        fill: this.chartType === "line", spanGaps: true,
      }];
      overlays.forEach((cd) => {
        const m = toMap(cd);
        datasets.push({
          label: cd.name, data: labels.map((l) => (l in m ? m[l] : null)),
          borderColor: cd.color, backgroundColor: cd.color + "18",
          pointRadius: this.chartType === "bar" ? 0 : 2, borderWidth: 1.5,
          borderDash: [5, 4], tension: 0.25, fill: false, spanGaps: true,
        });
      });
      return { labels, datasets };
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
          try { this.overlayData[id] = await api(`/api/systems/${id}/chart-data${q}`); } catch (_) {}
        }
      }
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
    downloadTemplate() { window.location.href = "api/import/template"; },
    openReport() {
      const q = this.fromParam ? `?from=${this.fromParam}` : "";
      window.open(`api/systems/${this.system.id}/report.pdf${q}`, "_blank");
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
          <select class="select" multiple v-model="overlayIds" v-if="overlayOptions.length" :size="1" style="min-width:150px" title="Systeme überlagern">
            <option v-for="s in overlayOptions" :key="s.id" :value="s.id">+ {{ s.name }}</option>
          </select>
        </div>
        <energy-chart :labels="chart.labels" :datasets="chart.datasets" :chart-type="chartType" />
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
  }),
  computed: {
    visibleSystems() { return this.systems.filter((s) => this.showArchived || s.aktiv); },
    selectedSystem() { return this.systems.find((s) => s.id === this.selected) || null; },
    formExtra() { return this.sysForm ? EXTRA_FIELDS[this.sysForm.typ] || [] : []; },
  },
  async mounted() { await this.load(); },
  methods: {
    fmt, typeIcon,
    notify(msg, type = "ok") { this.toast = { msg, type }; setTimeout(() => (this.toast = null), 3200); },
    async load() {
      this.loading = true;
      try { this.systems = await api("/api/systems?include_archived=true"); }
      catch (e) { this.notify(e.message, "err"); }
      finally { this.loading = false; }
    },
    open(s) { this.selected = s.id; this.view = "detail"; window.scrollTo(0, 0); },
    back() { this.view = "menu"; this.selected = null; this.load(); },

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
        <span class="logo">kWh</span>
        <h1>Energie-Tracker</h1>
      </div>
      <button v-if="view==='detail'" class="crumb" @click="back">‹ Alle Systeme</button>
      <div class="spacer"></div>
      <button v-if="view==='menu'" class="btn btn-primary btn-sm" @click="newSystem">＋ System</button>
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
          <div class="t-meta">Einheit: {{ s.einheit }}<span v-if="!s.aktiv"> · archiviert</span></div>
        </div>
        <div class="tile tile-add" @click="newSystem">＋ System anlegen</div>
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

  <!-- TOAST -->
  <div v-if="toast" class="toast" :class="toast.type">{{ toast.msg }}</div>
  `,
}).mount("#app");
