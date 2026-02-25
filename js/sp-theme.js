/**
 * deeltrack — Dark Obsidian Theme
 * Injected globally via sp-core.js
 * Overrides all default CSS variables and adds design system enhancements.
 */
(function applyTheme() {
  if (typeof document === 'undefined') return;

  // Inject Google Font: Sora (headings/UI) + DM Mono (numbers)
  const fontLink = document.createElement('link');
  fontLink.rel = 'stylesheet';
  fontLink.href = 'https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap';
  document.head.appendChild(fontLink);

  const css = document.createElement('style');
  css.id = 'dt-theme';
  css.textContent = `

/* ── Reset & base ─────────────────────────────────────────── */
:root {
  --primary:       #0d0f14;
  --primary-light: #141720;
  --secondary:     #1c2030;
  --surface:       #181b24;
  --surface-2:     #1f2333;
  --surface-3:     #252a3a;

  --accent:        #6366f1;
  --accent-hover:  #4f46e5;
  --accent-light:  rgba(99,102,241,0.12);
  --accent-glow:   0 0 20px rgba(99,102,241,0.35);

  --cyan:          #06b6d4;
  --cyan-light:    rgba(6,182,212,0.12);

  --success:       #10b981;
  --success-light: rgba(16,185,129,0.12);
  --warning:       #f59e0b;
  --warning-light: rgba(245,158,11,0.12);
  --danger:        #ef4444;
  --danger-light:  rgba(239,68,68,0.12);
  --purple:        #a78bfa;
  --purple-light:  rgba(167,139,250,0.12);

  --text:          #e8eaf0;
  --text-secondary:#94a3b8;
  --text-muted:    #4e5a72;

  --border:        rgba(255,255,255,0.07);
  --border-light:  rgba(255,255,255,0.04);
  --border-glow:   rgba(99,102,241,0.3);

  --bg:            #0d0f14;
  --bg-card:       #141720;
  --bg-sidebar:    #0b0d12;
  --bg-hover:      rgba(255,255,255,0.04);

  --shadow-sm: 0 1px 3px rgba(0,0,0,0.4);
  --shadow:    0 4px 12px rgba(0,0,0,0.5);
  --shadow-md: 0 8px 24px rgba(0,0,0,0.6);
  --shadow-lg: 0 16px 40px rgba(0,0,0,0.7);

  --radius-sm: 6px;
  --radius:    10px;
  --radius-md: 14px;
  --radius-lg: 20px;
}

/* ── Typography ──────────────────────────────────────────── */
body, input, select, textarea, button {
  font-family: 'Sora', 'Inter', -apple-system, sans-serif !important;
  -webkit-font-smoothing: antialiased;
}

.money, .money-val, .irr-val, .irr, .kpi-value, .stat-value,
.val, .metric-value, .deal-metric .val,
[style*="JetBrains Mono"], [style*="monospace"],
.kpi-val, .stat-val {
  font-family: 'DM Mono', 'JetBrains Mono', monospace !important;
  letter-spacing: -0.02em;
}

/* ── Global background ───────────────────────────────────── */
body {
  background: var(--bg) !important;
  color: var(--text) !important;
}

/* ── Sidebar ─────────────────────────────────────────────── */
.sidebar {
  background: var(--bg-sidebar) !important;
  border-right: 1px solid var(--border) !important;
}

.sidebar-header {
  background: transparent !important;
  border-bottom: 1px solid var(--border) !important;
}

.nav-item {
  color: var(--text-secondary) !important;
  border-radius: var(--radius) !important;
  transition: all 0.2s !important;
}
.nav-item:hover {
  background: var(--bg-hover) !important;
  color: var(--text) !important;
}
.nav-item.active {
  background: var(--accent-light) !important;
  color: var(--accent) !important;
  border: 1px solid rgba(99,102,241,0.2) !important;
  box-shadow: inset 0 0 0 1px rgba(99,102,241,0.15) !important;
}
.nav-item.active i { color: var(--accent) !important; }

.nav-section {
  color: var(--text-muted) !important;
  font-size: 0.62rem !important;
  letter-spacing: 0.12em !important;
}

.sidebar-footer {
  border-top: 1px solid var(--border) !important;
  background: transparent !important;
}

.user-avatar {
  background: linear-gradient(135deg, var(--accent), var(--cyan)) !important;
}

.logo-icon {
  background: linear-gradient(135deg, var(--accent), var(--cyan)) !important;
}

/* ── Top bar ─────────────────────────────────────────────── */
.top-bar {
  background: var(--surface) !important;
  border-bottom: 1px solid var(--border) !important;
  backdrop-filter: blur(12px) !important;
}

.breadcrumb-current { color: var(--text) !important; }
.breadcrumb a { color: var(--text-secondary) !important; }
.breadcrumb-sep, .breadcrumb-separator { color: var(--text-muted) !important; }

.btn-icon {
  background: var(--surface-2) !important;
  border: 1px solid var(--border) !important;
  color: var(--text-secondary) !important;
}
.btn-icon:hover {
  border-color: var(--accent) !important;
  color: var(--accent) !important;
  background: var(--accent-light) !important;
}

/* ── Cards ───────────────────────────────────────────────── */
.card, .kpi-card, .stat-card, .kpi, .input-panel, .result-panel,
.deal-slot, .chart-card, .room-card, .qa-card, .deal-card,
.investment-card, .pipeline-card, .stat-card {
  background: var(--bg-card) !important;
  border: 1px solid var(--border) !important;
  border-radius: var(--radius-md) !important;
  transition: box-shadow 0.2s, border-color 0.2s, transform 0.2s !important;
}

.card:hover, .kpi-card:hover, .qa-card:hover,
.pipeline-card:hover, .deal-card:hover, .investment-card:hover,
.room-card:hover {
  border-color: var(--border-glow) !important;
  box-shadow: 0 0 0 1px rgba(99,102,241,0.15), var(--shadow-md) !important;
  transform: translateY(-2px) !important;
}

.card-header {
  border-bottom: 1px solid var(--border) !important;
  background: transparent !important;
}
.card-title { color: var(--text) !important; }
.card-sub, .card-subtitle { color: var(--text-secondary) !important; }
.card-body { background: transparent !important; }

/* ── Buttons ─────────────────────────────────────────────── */
.btn-primary {
  background: linear-gradient(135deg, var(--accent), #818cf8) !important;
  border: none !important;
  color: white !important;
  font-weight: 600 !important;
  box-shadow: 0 4px 15px rgba(99,102,241,0.3) !important;
  transition: all 0.2s !important;
}
.btn-primary:hover {
  background: linear-gradient(135deg, var(--accent-hover), var(--accent)) !important;
  box-shadow: 0 6px 20px rgba(99,102,241,0.45) !important;
  transform: translateY(-1px) !important;
}

.btn-secondary {
  background: var(--surface-2) !important;
  border: 1px solid var(--border) !important;
  color: var(--text-secondary) !important;
}
.btn-secondary:hover {
  border-color: var(--border-glow) !important;
  color: var(--text) !important;
  background: var(--surface-3) !important;
}

.btn-xs {
  background: var(--surface-2) !important;
  border: 1px solid var(--border) !important;
  color: var(--text-secondary) !important;
}
.btn-xs:hover {
  background: var(--accent) !important;
  color: white !important;
  border-color: var(--accent) !important;
}
.btn-xs.danger:hover {
  background: var(--danger) !important;
  border-color: var(--danger) !important;
}

/* ── Inputs ──────────────────────────────────────────────── */
input, select, textarea {
  background: var(--surface-2) !important;
  border: 1px solid var(--border) !important;
  color: var(--text) !important;
  border-radius: var(--radius) !important;
}
input::placeholder, textarea::placeholder {
  color: var(--text-muted) !important;
}
input:focus, select:focus, textarea:focus {
  border-color: var(--accent) !important;
  outline: none !important;
  box-shadow: 0 0 0 3px rgba(99,102,241,0.15) !important;
  background: var(--surface-3) !important;
}
input[readonly], input[disabled] {
  background: var(--surface) !important;
  color: var(--text-secondary) !important;
}
option { background: var(--surface-2); color: var(--text); }

label { color: var(--text-secondary) !important; }

/* ── Tables ──────────────────────────────────────────────── */
table { border-collapse: collapse !important; }
thead, thead tr { background: var(--surface-2) !important; }
th {
  color: var(--text-secondary) !important;
  font-size: 0.7rem !important;
  font-weight: 600 !important;
  letter-spacing: 0.08em !important;
  text-transform: uppercase !important;
  border-bottom: 1px solid var(--border) !important;
}
td { border-bottom: 1px solid var(--border-light) !important; color: var(--text) !important; }
tr:last-child td { border-bottom: none !important; }
tr:hover td { background: var(--bg-hover) !important; }

/* ── KPI / Stat cards ────────────────────────────────────── */
.kpi-label, .stat-lbl, .stat-body .lbl {
  color: var(--text-secondary) !important;
  font-size: 0.7rem !important;
  font-weight: 600 !important;
  text-transform: uppercase !important;
  letter-spacing: 0.08em !important;
}
.kpi-value, .stat-val, .kpi-val, .stat-body .val {
  color: var(--text) !important;
}
.kpi-change.up, .kpi-sub.green { color: var(--success) !important; }
.kpi-change.down { color: var(--danger) !important; }
.kpi-change.neutral { color: var(--text-muted) !important; }

/* Icon boxes */
.kpi-icon.blue, .stat-icon.blue { background: var(--accent-light) !important; }
.kpi-icon.blue i, .stat-icon.blue i { color: var(--accent) !important; }
.kpi-icon.green, .stat-icon.green { background: var(--success-light) !important; }
.kpi-icon.green i, .stat-icon.green i { color: var(--success) !important; }
.kpi-icon.amber, .stat-icon.amber { background: var(--warning-light) !important; }
.kpi-icon.amber i, .stat-icon.amber i { color: var(--warning) !important; }
.kpi-icon.purple, .stat-icon.purple { background: var(--purple-light) !important; }
.kpi-icon.purple i, .stat-icon.purple i { color: var(--purple) !important; }

/* ── Badges ──────────────────────────────────────────────── */
.badge { font-weight: 600 !important; letter-spacing: 0.02em !important; }
.badge-verified, .badge-active, .badge-op, .badge-closed { background: var(--success-light) !important; color: var(--success) !important; }
.badge-pending, .badge-loi, .badge-soon { background: var(--warning-light) !important; color: var(--warning) !important; }
.badge-expired, .badge-danger, .badge-urgent { background: var(--danger-light) !important; color: var(--danger) !important; }
.badge-mf, .badge-dd { background: var(--accent-light) !important; color: var(--accent) !important; }
.badge-ind { background: var(--success-light) !important; color: var(--success) !important; }
.badge-ret { background: var(--warning-light) !important; color: var(--warning) !important; }
.badge-off { background: var(--purple-light) !important; color: var(--purple) !important; }
.badge-sourcing, .badge-src { background: rgba(255,255,255,0.06) !important; color: var(--text-secondary) !important; }
.badge-operating { background: var(--cyan-light) !important; color: var(--cyan) !important; }

/* ── Quick action cards ──────────────────────────────────── */
.qa-card {
  background: var(--bg-card) !important;
  border: 1px solid var(--border) !important;
  color: var(--text) !important;
}
.qa-card:hover {
  border-color: var(--border-glow) !important;
  box-shadow: var(--accent-glow) !important;
}
.qa-icon.blue { background: var(--accent-light) !important; color: var(--accent) !important; }
.qa-icon.green { background: var(--success-light) !important; color: var(--success) !important; }
.qa-icon.amber { background: var(--warning-light) !important; color: var(--warning) !important; }
.qa-icon.purple { background: var(--purple-light) !important; color: var(--purple) !important; }

/* ── Tabs ────────────────────────────────────────────────── */
.tab, .investment-tab {
  background: none !important;
  border: none !important;
  color: var(--text-secondary) !important;
  font-family: 'Sora', sans-serif !important;
  transition: all 0.15s !important;
}
.tab.active, .investment-tab.active {
  color: var(--accent) !important;
  border-bottom: 2px solid var(--accent) !important;
}
.tab:hover, .investment-tab:hover { color: var(--text) !important; }
.tabs { border-bottom: 1px solid var(--border) !important; }

/* ── Pipeline Kanban ─────────────────────────────────────── */
.pipeline-column {
  background: var(--surface) !important;
  border: 1px solid var(--border) !important;
  border-radius: var(--radius-md) !important;
}
.column-header { border-bottom: 1px solid var(--border) !important; }
.column-title { color: var(--text) !important; }
.column-count {
  background: var(--surface-2) !important;
  color: var(--text-secondary) !important;
}
.add-card {
  color: var(--text-muted) !important;
  border: 1px dashed var(--border) !important;
  border-radius: var(--radius) !important;
}
.add-card:hover {
  border-color: var(--accent) !important;
  color: var(--accent) !important;
  background: var(--accent-light) !important;
}

/* ── Deal hero banner ────────────────────────────────────── */
.deal-hero {
  background: linear-gradient(135deg, #0d1424 0%, #131929 50%, #0f1a2e 100%) !important;
  border: 1px solid rgba(99,102,241,0.2) !important;
  position: relative !important;
  overflow: hidden !important;
}
.deal-hero::after {
  content: '';
  position: absolute;
  top: -50%;
  right: -10%;
  width: 400px;
  height: 400px;
  background: radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%);
  pointer-events: none;
}
.deal-metric {
  background: rgba(255,255,255,0.05) !important;
  border: 1px solid rgba(255,255,255,0.06) !important;
  border-radius: var(--radius) !important;
}
.deal-metric .val { color: white !important; }
.deal-metric .lbl { color: rgba(255,255,255,0.45) !important; }

/* ── Modal ───────────────────────────────────────────────── */
.modal-overlay { background: rgba(0,0,0,0.7) !important; backdrop-filter: blur(4px) !important; }
.modal {
  background: var(--surface) !important;
  border: 1px solid var(--border) !important;
  box-shadow: 0 24px 64px rgba(0,0,0,0.8) !important;
}
.modal-header { border-bottom: 1px solid var(--border) !important; }
.modal-title { color: var(--text) !important; }
.modal-footer { border-top: 1px solid var(--border) !important; }
.modal-close {
  background: var(--surface-2) !important;
  color: var(--text-secondary) !important;
}
.modal-close:hover { background: var(--danger-light) !important; color: var(--danger) !important; }

/* ── Notification panel ──────────────────────────────────── */
#sp-notif-panel {
  background: var(--surface) !important;
  border-left: 1px solid var(--border) !important;
}

/* ── Dashboard deal hero banner ──────────────────────────── */
.summary-winner {
  background: linear-gradient(135deg, #0d1424 0%, #131929 100%) !important;
  border: 1px solid rgba(99,102,241,0.2) !important;
}

/* ── Settings nav ────────────────────────────────────────── */
.snav-item { color: var(--text-secondary) !important; }
.snav-item:hover { background: var(--bg-hover) !important; color: var(--text) !important; }
.snav-item.active { background: var(--accent-light) !important; color: var(--accent) !important; }

/* ── GP performance (reports dark bar) ───────────────────── */
.chart-card { background: var(--bg-card) !important; border: 1px solid var(--border) !important; }
.chart-title { color: var(--text) !important; }

/* ── Welcome banner (investor portal) ───────────────────── */
.welcome-banner {
  background: linear-gradient(135deg, #0d1424 0%, #131929 100%) !important;
  border: 1px solid var(--border) !important;
}
.welcome-banner h1 { color: white !important; }
.welcome-banner p { color: rgba(255,255,255,0.6) !important; }

/* ── Empty states ────────────────────────────────────────── */
.empty-state { color: var(--text-muted) !important; }
.empty-state i { opacity: 0.25 !important; }
.empty-state h3 { color: var(--text-secondary) !important; }

/* ── Toolbar / search ────────────────────────────────────── */
.search-input {
  background: var(--surface-2) !important;
  border: 1px solid var(--border) !important;
  color: var(--text) !important;
}
.search-input:focus { border-color: var(--accent) !important; }
.toolbar select, .toolbar .view-btn {
  background: var(--surface-2) !important;
  border: 1px solid var(--border) !important;
  color: var(--text-secondary) !important;
}
.view-btn.active { background: var(--accent) !important; color: white !important; }

/* ── Table footer ────────────────────────────────────────── */
.table-footer { background: var(--surface) !important; border-top: 1px solid var(--border) !important; }
.table-footer-info { color: var(--text-secondary) !important; }

/* ── Stats bar (pipeline) ────────────────────────────────── */
.stats-bar { background: var(--surface) !important; border: 1px solid var(--border) !important; }
.stat-item { border-right: 1px solid var(--border) !important; }
.stat-icon-box { border-radius: var(--radius) !important; }
.stat-icon-box.blue { background: var(--accent-light) !important; color: var(--accent) !important; }
.stat-icon-box.amber { background: var(--warning-light) !important; color: var(--warning) !important; }
.stat-icon-box.green { background: var(--success-light) !important; color: var(--success) !important; }
.stat-icon-box.red { background: var(--danger-light) !important; color: var(--danger) !important; }

/* ── Page headers ────────────────────────────────────────── */
.page-title { color: var(--text) !important; }
.page-description, .page-title-bar p { color: var(--text-secondary) !important; }
.page-title-bar h1 { color: var(--text) !important; }
h1, h2, h3, h4, h5 { color: var(--text) !important; }

/* ── Progress / raise bars ───────────────────────────────── */
.cap-bar { background: var(--surface-2) !important; }

/* ── Alert banners ───────────────────────────────────────── */
.sidebar-overlay { background: rgba(0,0,0,0.6) !important; }

/* ── Legal footer ────────────────────────────────────────── */
#dt-legal-footer {
  background: #080a0e !important;
  border-top: 1px solid var(--border) !important;
}
#dt-notice-banner {
  background: #0d1020 !important;
  border-top: 1px solid rgba(99,102,241,0.3) !important;
}

/* ── Links ───────────────────────────────────────────────── */
a { color: var(--accent) !important; }
a:hover { color: #818cf8 !important; }

/* ── Scrollbar ───────────────────────────────────────────── */
::-webkit-scrollbar { width: 5px; height: 5px; }
::-webkit-scrollbar-track { background: var(--surface); }
::-webkit-scrollbar-thumb { background: var(--surface-3); border-radius: 10px; }
::-webkit-scrollbar-thumb:hover { background: var(--accent); }

/* ── Micro-animations ────────────────────────────────────── */
@keyframes dt-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}
.badge-urgent { animation: dt-pulse 2s ease-in-out infinite; }

/* ── Focus ring ──────────────────────────────────────────── */
:focus-visible {
  outline: 2px solid var(--accent) !important;
  outline-offset: 2px !important;
}

/* ── Selection color ─────────────────────────────────────── */
::selection { background: rgba(99,102,241,0.3); color: white; }

/* ── Chart.js canvases ───────────────────────────────────── */
canvas { border-radius: var(--radius) !important; }

/* ── Document preview (legal docs) ──────────────────────── */
.document-preview, #documentPreview, .notice-preview {
  background: #f8fafc !important;
  color: #0f172a !important;
  border: 1px solid var(--border) !important;
  border-radius: var(--radius) !important;
}

/* ── Investor avatar colors ──────────────────────────────── */
.av-0 { background: linear-gradient(135deg, var(--accent), #818cf8) !important; }
.av-1 { background: linear-gradient(135deg, var(--success), #34d399) !important; }
.av-2 { background: linear-gradient(135deg, var(--purple), #c4b5fd) !important; }
.av-3 { background: linear-gradient(135deg, var(--warning), #fbbf24) !important; }
.av-4 { background: linear-gradient(135deg, var(--danger), #f87171) !important; }
.av-5 { background: linear-gradient(135deg, var(--cyan), #22d3ee) !important; }

/* ── Deal room cards ─────────────────────────────────────── */
.room-card.active {
  border-color: var(--accent) !important;
  background: var(--accent-light) !important;
}
.upload-zone {
  border-color: var(--border) !important;
  background: var(--surface) !important;
}
.upload-zone:hover {
  border-color: var(--accent) !important;
  background: var(--accent-light) !important;
}
.file-icon.pdf { background: var(--danger-light) !important; color: var(--danger) !important; }
.file-icon.doc { background: var(--accent-light) !important; color: var(--accent) !important; }
.file-icon.img { background: var(--success-light) !important; color: var(--success) !important; }
.file-icon.other { background: var(--surface-2) !important; color: var(--text-muted) !important; }

/* ── Investor portal investment cards ────────────────────── */
.investment-card {
  background: var(--bg-card) !important;
  border: 1px solid var(--border) !important;
}
.investment-header { border-bottom: 1px solid var(--border) !important; }
.investment-title { color: var(--text) !important; }
.investment-location { color: var(--text-secondary) !important; }
.investment-footer { border-top: 1px solid var(--border) !important; background: var(--surface) !important; }
.metric-value { color: var(--text) !important; }
.metric-value.positive { color: var(--success) !important; }
.metric-label { color: var(--text-secondary) !important; }
.status-dot.active { background: var(--success) !important; box-shadow: 0 0 6px var(--success) !important; }
.status-dot.pending { background: var(--warning) !important; }

/* ── Profile hero ────────────────────────────────────────── */
.profile-hero {
  background: linear-gradient(135deg, #0d1424 0%, #131929 100%) !important;
  border: 1px solid var(--border) !important;
}

/* ── Deadline badges ─────────────────────────────────────── */
.badge-urgent { background: var(--danger-light) !important; color: var(--danger) !important; }
.badge-soon { background: var(--warning-light) !important; color: var(--warning) !important; }
.badge-ok { background: var(--success-light) !important; color: var(--success) !important; }

/* ── View toggle ─────────────────────────────────────────── */
.view-toggle { border: 1px solid var(--border) !important; background: var(--surface-2) !important; }

/* ── Select element arrow fix for dark bg ────────────────── */
select {
  color-scheme: dark !important;
}

/* ── Loading / skeleton ──────────────────────────────────── */
@keyframes dt-shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

/* ── Custom checkbox/radio styling ──────────────────────── */
input[type="checkbox"], input[type="radio"] {
  accent-color: var(--accent) !important;
}

/* ── Priority indicators (pipeline) ─────────────────────── */
.priority-indicator { border-radius: 2px 0 0 2px !important; }
.priority-indicator.priority-high { background: var(--danger) !important; }
.priority-indicator.priority-medium { background: var(--warning) !important; }
.priority-indicator.priority-low { background: var(--success) !important; }

/* ── Deal chip colors ────────────────────────────────────── */
.chip-0 { background: var(--accent-light) !important; color: var(--accent) !important; }
.chip-1 { background: var(--success-light) !important; color: var(--success) !important; }
.chip-2 { background: var(--warning-light) !important; color: var(--warning) !important; }

/* ── Comparison table best highlight ────────────────────── */
.best { color: var(--success) !important; }

/* ── Map filter for dark theme ───────────────────────────── */
#map { border-radius: var(--radius-md) !important; }
.leaflet-container {
  background: var(--surface) !important;
}
.leaflet-popup-content-wrapper {
  background: var(--surface) !important;
  color: var(--text) !important;
  border: 1px solid var(--border) !important;
  box-shadow: var(--shadow-md) !important;
  border-radius: var(--radius) !important;
}
.leaflet-popup-tip { background: var(--surface) !important; }

`;
  document.head.appendChild(css);
})();

// ── Chart.js dark theme defaults ────────────────────────────────────────────
(function setChartDefaults() {
  if (typeof document === 'undefined') return;
  document.addEventListener('DOMContentLoaded', function() {
    if (typeof Chart === 'undefined') return;
    Chart.defaults.color = '#94a3b8';
    Chart.defaults.borderColor = 'rgba(255,255,255,0.06)';
    Chart.defaults.backgroundColor = 'rgba(99,102,241,0.1)';
    Chart.defaults.plugins.legend.labels.color = '#94a3b8';
    Chart.defaults.plugins.tooltip.backgroundColor = '#1f2333';
    Chart.defaults.plugins.tooltip.borderColor = 'rgba(99,102,241,0.3)';
    Chart.defaults.plugins.tooltip.borderWidth = 1;
    Chart.defaults.plugins.tooltip.titleColor = '#e8eaf0';
    Chart.defaults.plugins.tooltip.bodyColor = '#94a3b8';
    Chart.defaults.scale.grid.color = 'rgba(255,255,255,0.05)';
    Chart.defaults.scale.ticks.color = '#64748b';
  });
})();
