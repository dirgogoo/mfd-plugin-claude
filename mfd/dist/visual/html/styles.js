/**
 * MFD Scope — Complete CSS Design System
 * "Terminal Command Center" — monospace, hard edges, fosforescente neon, HUD feel
 */
export function getStyles() {
    return `
:root {
  /* Surfaces — absolute black */
  --scope-void: #000000;
  --scope-surface: #000000;
  --scope-elevated: #000000;
  --scope-overlay: #000000;
  --scope-border: #FFFFFF;
  --scope-border-bold: #FFFFFF;

  /* Text — absolute white */
  --scope-text-primary: #FFFFFF;
  --scope-text-secondary: #FFFFFF;
  --scope-text-tertiary: #FFFFFF;
  --scope-text-inverse: #000000;

  /* Accent — white */
  --scope-accent: #FFFFFF;
  --scope-accent-hover: #FFFFFF;
  --scope-accent-muted: rgba(255, 255, 255, 0.08);
  --scope-accent-glow: rgba(255, 255, 255, 0.2);

  /* Status — black and white */
  --scope-done: #FFFFFF;
  --scope-done-bg: rgba(255, 255, 255, 0.06);
  --scope-done-border: #FFFFFF;
  --scope-wip: #FFFFFF;
  --scope-wip-bg: rgba(255, 255, 255, 0.06);
  --scope-wip-border: #FFFFFF;
  --scope-pending: #FFFFFF;
  --scope-pending-bg: rgba(255, 255, 255, 0.06);
  --scope-pending-border: #FFFFFF;
  --scope-error: #FFFFFF;
  --scope-error-bg: rgba(255, 255, 255, 0.06);
  --scope-error-border: #FFFFFF;

  /* Diagram type colors — white */
  --scope-diagram-component: #FFFFFF;
  --scope-diagram-entity: #FFFFFF;
  --scope-diagram-state: #FFFFFF;
  --scope-diagram-flow: #FFFFFF;
  --scope-diagram-screen: #FFFFFF;
  --scope-diagram-journey: #FFFFFF;

  /* Overview node type colors */
  --scope-type-screen: #F472B6;
  --scope-type-flow: #34D399;
  --scope-type-state: #FBBF24;
  --scope-type-api: #60A5FA;
  --scope-type-entity: #00FFFF;
  --scope-type-event: #A78BFA;
  --scope-type-signal: #FB923C;
  --scope-type-operation: #E879F9;
  --scope-type-rule: #F87171;
  --scope-type-journey: #2DD4BF;
  --scope-type-enum: #94A3B8;
  --scope-type-element: #C084FC;
  --scope-type-action: #FCD34D;

  /* Typography — system monospace */
  --scope-font-display: monospace;
  --scope-font-mono: monospace;
  --scope-text-xs: 0.694rem;
  --scope-text-sm: 0.833rem;
  --scope-text-base: 1rem;
  --scope-text-md: 1.2rem;
  --scope-text-lg: 1.44rem;
  --scope-text-xl: 1.728rem;
  --scope-text-2xl: 2.074rem;
  --scope-weight-normal: 400;
  --scope-weight-medium: 500;
  --scope-weight-semibold: 600;
  --scope-weight-bold: 700;
  --scope-leading-tight: 1.25;
  --scope-leading-normal: 1.5;

  /* Spacing (4px base) */
  --scope-space-1: 4px;
  --scope-space-2: 8px;
  --scope-space-3: 12px;
  --scope-space-4: 16px;
  --scope-space-5: 20px;
  --scope-space-6: 24px;
  --scope-space-8: 32px;
  --scope-space-10: 40px;
  --scope-space-12: 48px;
  --scope-space-16: 64px;

  /* Radii — ZERO */
  --scope-radius-sm: 0;
  --scope-radius-md: 0;
  --scope-radius-lg: 0;

  /* Transitions */
  --scope-transition-fast: 0.15s ease;
  --scope-transition-normal: 0.2s ease;
}

/* Light mode — terminal on paper */
[data-theme="light"] {
  --scope-void: #E0E0E0;
  --scope-surface: #E8E8E8;
  --scope-elevated: #D5D5D5;
  --scope-overlay: #C8C8C8;
  --scope-border: #A0A0A0;
  --scope-border-bold: #888888;
  --scope-text-primary: #1A1A1A;
  --scope-text-secondary: #3D3D3D;
  --scope-text-tertiary: #6B6B6B;
  --scope-accent: #006064;
  --scope-accent-hover: #00838F;
  --scope-accent-muted: rgba(0, 96, 100, 0.08);
  --scope-accent-glow: rgba(0, 96, 100, 0.15);
  --scope-done: #1B5E20;
  --scope-done-bg: rgba(27, 94, 32, 0.08);
  --scope-done-border: rgba(27, 94, 32, 0.25);
  --scope-wip: #E65100;
  --scope-wip-bg: rgba(230, 81, 0, 0.08);
  --scope-wip-border: rgba(230, 81, 0, 0.25);
  --scope-pending: #9E9E9E;
  --scope-pending-bg: rgba(158, 158, 158, 0.08);
  --scope-pending-border: rgba(158, 158, 158, 0.25);
  --scope-error: #C62828;
  --scope-error-bg: rgba(198, 40, 40, 0.08);
  --scope-error-border: rgba(198, 40, 40, 0.25);
  --scope-diagram-component: #6A1B9A;
  --scope-diagram-entity: #006064;
  --scope-diagram-state: #E65100;
  --scope-diagram-flow: #1B5E20;
  --scope-diagram-screen: #AD1457;
  --scope-diagram-journey: #F57F17;
}

/* Reset + Base */
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html {
  font-size: 14px;
  font-family: var(--scope-font-mono);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
}

body {
  background: var(--scope-void);
  color: var(--scope-text-primary);
  line-height: var(--scope-leading-normal);
  overflow: hidden;
  font-family: var(--scope-font-mono);
}

/* ===== TUI FRAME ===== */
.scope-frame {
  position: fixed;
  inset: 24px;
  border: 1px solid #FFFFFF;
  border-radius: 16px 16px 0 0;
  pointer-events: none;
  z-index: 9000;
}

.scope-frame-label {
  position: absolute;
  top: -1px;
  left: 32px;
  transform: translateY(-50%);
  background: #000000;
  padding: 0 8px;
  font-family: var(--scope-font-mono);
  font-size: var(--scope-text-sm);
  color: #FFFFFF;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  font-weight: var(--scope-weight-bold);
}

.scope-frame-nav {
  position: absolute;
  bottom: -1px;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  gap: 0;
  pointer-events: auto;
  background: #000000;
  border-top: 1px solid #FFFFFF;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
}

.scope-frame-nav::-webkit-scrollbar {
  display: none;
}

.scope-frame-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 16px;
  font-family: var(--scope-font-mono);
  font-size: var(--scope-text-sm);
  color: #666666;
  text-decoration: none;
  cursor: pointer;
  transition: background 0.1s, color 0.1s;
  white-space: nowrap;
  border-right: 1px solid #333333;
}

.scope-frame-tab:last-child {
  border-right: none;
}

.scope-frame-tab[data-nav="search"] {
  margin-left: auto;
}

.scope-frame-tab.active {
  color: #000000;
  background: #FFFFFF;
}

.scope-frame-tab:hover:not(.active) {
  color: #FFFFFF;
  background: #222222;
}

.scope-frame-tab-key {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border: 1px solid currentColor;
  font-size: 10px;
  line-height: 1;
}

.scope-frame-tab-count {
  font-family: var(--scope-font-mono);
  font-size: 10px;
  opacity: 0.5;
}

/* Scanline overlay — CRT feel */
body::after {
  content: '';
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 9999;
  background: repeating-linear-gradient(
    0deg,
    transparent,
    transparent 2px,
    rgba(255, 255, 255, 0.008) 2px,
    rgba(255, 255, 255, 0.008) 4px
  );
}

/* All inputs monospace */
input, button, select, textarea {
  font-family: var(--scope-font-mono);
}

/* CLI hover — invert */
a:hover, .scope-construct-link:hover {
  background: #FFFFFF;
  color: #000000;
  text-shadow: none;
}

.scope-mono {
  font-family: var(--scope-font-mono);
  font-size: 0.92em;
  letter-spacing: -0.01em;
}

.scope-data {
  font-variant-numeric: tabular-nums;
}

/* ===== ANIMATIONS ===== */
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

@keyframes flash {
  0% { opacity: 1; transform: scale(1.5); }
  100% { opacity: 1; transform: scale(1); }
}

@keyframes glowPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

@keyframes bootUp {
  0% { opacity: 0; filter: brightness(2); }
  100% { opacity: 1; filter: brightness(1); }
}

@keyframes cursorBlink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

@keyframes toastIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes toastOut {
  from { opacity: 1; }
  to { opacity: 0; }
}

/* ===== SCOPE BAR (top bar, 48px) ===== */
.scope-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 48px;
  background: var(--scope-void);
  border-bottom: 1px solid var(--scope-border);
  display: flex;
  align-items: center;
  padding: 0 var(--scope-space-4);
  gap: var(--scope-space-4);
  z-index: 200;
}

.scope-bar-brand {
  display: flex;
  align-items: center;
  gap: var(--scope-space-2);
  min-width: 180px;
}

.scope-bar-logo {
  width: 24px;
  height: 24px;
  color: var(--scope-done);
  flex-shrink: 0;
}

.scope-bar-system-name {
  font-size: var(--scope-text-md);
  font-weight: var(--scope-weight-bold);
  color: var(--scope-text-primary);
  text-transform: uppercase;
  letter-spacing: 0.15em;
}

.scope-bar-version {
  font-family: var(--scope-font-mono);
  font-size: var(--scope-text-xs);
  color: var(--scope-done);
  background: transparent;
  padding: 2px 8px;
  border: 1px solid var(--scope-done-border);
}

.scope-bar-breadcrumb {
  font-size: var(--scope-text-sm);
  color: var(--scope-text-secondary);
  display: flex;
  align-items: center;
  gap: var(--scope-space-1);
}

.scope-bar-breadcrumb a {
  color: var(--scope-text-secondary);
  text-decoration: none;
  transition: color var(--scope-transition-fast);
}

.scope-bar-breadcrumb a:hover {
  color: var(--scope-accent);
}

.scope-bar-breadcrumb .separator {
  color: var(--scope-done);
}

.scope-bar-spacer {
  flex: 1;
}

/* The Pulse — live indicator */
.scope-pulse {
  display: flex;
  align-items: center;
  gap: var(--scope-space-2);
  font-size: var(--scope-text-sm);
  color: var(--scope-done);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.scope-pulse-dot {
  width: 8px;
  height: 8px;
  background: var(--scope-done);
  animation: pulse 2s ease-in-out infinite;
}

.scope-pulse.disconnected {
  color: var(--scope-text-tertiary);
}

.scope-pulse.disconnected .scope-pulse-dot {
  background: var(--scope-text-tertiary);
  animation: none;
  box-shadow: none;
}

.scope-pulse.error .scope-pulse-dot {
  background: var(--scope-error);
  animation: none;
}

/* Theme toggle */
.scope-theme-toggle {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--scope-border);
  background: transparent;
  color: var(--scope-text-secondary);
  cursor: pointer;
  transition: all var(--scope-transition-fast);
}

.scope-theme-toggle:hover {
  border-color: var(--scope-accent);
  color: var(--scope-accent);
}

/* ===== NAV RAIL (left, 56px) ===== */
.scope-rail {
  position: fixed;
  left: 0;
  top: 48px;
  bottom: 0;
  width: 56px;
  background: var(--scope-surface);
  border-right: 1px solid var(--scope-border);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--scope-space-3) 0;
  gap: var(--scope-space-1);
  z-index: 100;
  overflow-y: auto;
  overflow-x: hidden;
}

.scope-rail-item {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--scope-text-secondary);
  transition: all var(--scope-transition-fast);
  position: relative;
  cursor: pointer;
  text-decoration: none;
}

.scope-rail-item:hover {
  background: rgba(255, 255, 255, 0.04);
  color: var(--scope-text-primary);
}

.scope-rail-item.active {
  background: rgba(255, 255, 255, 0.04);
  color: var(--scope-accent);
}

.scope-rail-item.active::before {
  content: '';
  position: absolute;
  left: -6px;
  top: 8px;
  bottom: 8px;
  width: 3px;
  background: var(--scope-accent);
}

.scope-rail-item::after {
  display: none;
}

.scope-rail-separator {
  width: 28px;
  height: 1px;
  background: var(--scope-border);
  margin: var(--scope-space-2) 0;
}

.scope-rail-spacer {
  flex: 1;
}

.scope-rail-icon {
  width: 20px;
  height: 20px;
}

/* ===== MAIN CANVAS ===== */
.scope-canvas {
  position: fixed;
  top: 25px;
  left: 25px;
  right: 25px;
  bottom: 25px;
  padding: 20px 20px 40px 20px;
  overflow-y: auto;
  overflow-x: hidden;
  animation: bootUp 0.4s ease-out;
  background: var(--scope-void);
  border-radius: 16px 16px 0 0;
}

/* ===== OVERVIEW PAGE ===== */

.scope-type-sidebar {
  width: 180px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: var(--scope-space-1);
  padding-top: var(--scope-space-2);
}

.scope-type-item {
  display: flex;
  align-items: center;
  gap: var(--scope-space-3);
  padding: var(--scope-space-2) var(--scope-space-3);
  cursor: pointer;
  transition: all var(--scope-transition-fast);
  color: var(--scope-text-secondary);
  text-decoration: none;
  font-size: var(--scope-text-sm);
  font-weight: var(--scope-weight-medium);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-left: 2px solid transparent;
}

.scope-type-item:hover {
  background: rgba(255, 255, 255, 0.04);
  color: var(--scope-text-primary);
  border-left-color: var(--scope-text-tertiary);
}

.scope-type-item.active {
  background: var(--scope-accent-muted);
  color: var(--scope-accent);
  border-left-color: var(--scope-accent);
}

.scope-type-item .dot {
  width: 8px;
  height: 8px;
  flex-shrink: 0;
}

.scope-type-item .badge {
  margin-left: auto;
  font-family: var(--scope-font-mono);
  font-size: var(--scope-text-xs);
  color: var(--scope-text-tertiary);
}

.scope-type-item.disabled {
  opacity: 0.3;
  cursor: default;
}

.scope-diagram-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--scope-space-4);
  min-width: 0;
}

.scope-diagram-container {
  flex: 1;
  background: var(--scope-void);
  border: none;
  overflow: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  position: relative;
}

.scope-diagram-container .mermaid {
  width: 100%;
  text-align: center;
}

.scope-diagram-container svg {
  max-width: 100%;
  height: auto;
}

/* Stats footer */
.scope-stats-footer {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--scope-space-3);
}

.scope-stat-card {
  background: var(--scope-elevated);
  border: 1px solid var(--scope-border);
  padding: var(--scope-space-3) var(--scope-space-4);
  display: flex;
  flex-direction: column;
  gap: var(--scope-space-1);
  cursor: pointer;
  transition: all var(--scope-transition-fast);
}

.scope-stat-card:hover {
  background: #FFFFFF;
  color: #000000;
}

.scope-stat-label {
  font-size: var(--scope-text-xs);
  color: var(--scope-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: var(--scope-weight-medium);
}

.scope-stat-value {
  font-size: var(--scope-text-lg);
  font-weight: var(--scope-weight-bold);
  font-variant-numeric: tabular-nums;
  font-family: var(--scope-font-mono);
}

.scope-stat-value.done { color: var(--scope-done); }
.scope-stat-value.wip { color: var(--scope-wip); }
.scope-stat-value.pending { color: var(--scope-text-secondary); }
.scope-stat-value.error { color: var(--scope-error); }

/* ===== SYSTEM INFO ===== */
.sys-cli {
  font-family: var(--scope-font-mono);
  font-size: 13px;
  line-height: 1.6;
  padding: var(--scope-space-4) var(--scope-space-6);
  color: var(--scope-text-primary);
}

.sys-two-col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 var(--scope-space-8);
  align-items: start;
}

@media (max-width: 900px) {
  .sys-two-col { grid-template-columns: 1fr; }
}

.sys-col {
  min-width: 0;
}

.sys-section-line {
  color: #444444;
  margin: 12px 0 4px 0;
  white-space: pre;
  user-select: none;
  overflow: hidden;
}

.sys-col > .sys-section-line:first-child {
  margin-top: 0;
}

.sys-kv {
  white-space: pre;
  padding: 0 var(--scope-space-2);
}

.sys-label {
  color: #888888;
}

.sys-value {
  color: var(--scope-text-primary);
}

.sys-file {
  font-size: 11px;
  opacity: 0.7;
}

/* Construct count grid */
.sys-count-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 0;
  padding: 0 var(--scope-space-2);
}

.sys-count-row {
  display: flex;
  justify-content: space-between;
  padding: 0 var(--scope-space-2) 0 0;
}

.sys-count-label {
  color: #888888;
}

.sys-count-val {
  color: var(--scope-text-primary);
  text-align: right;
  min-width: 3ch;
}

.sys-count-total {
  padding: 2px var(--scope-space-2);
  color: var(--scope-text-primary);
  border-top: 1px solid #333333;
  margin-top: 2px;
  text-align: right;
  padding-right: var(--scope-space-4);
}

/* Description */
.sys-description {
  padding: 2px var(--scope-space-2);
  color: var(--scope-text-primary);
  opacity: 0.8;
}

/* Component summary list */
.sys-comp-list {
  padding: 0 var(--scope-space-2);
}

.sys-comp-row {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0 var(--scope-space-3);
  padding: 3px var(--scope-space-2);
  text-decoration: none;
  color: inherit;
  cursor: pointer;
}

.sys-comp-row:hover {
  background: #FFFFFF;
  color: #000000;
}

.sys-comp-name {
  color: var(--scope-text-primary);
  min-width: 14ch;
  font-weight: 500;
}

.sys-comp-row:hover .sys-comp-name {
  color: #000000;
}

.sys-comp-status {
  font-size: 11px;
  min-width: 10ch;
}

.sys-status-prod { color: #34D399; }
.sys-status-impl { color: #FBBF24; }
.sys-status-model { color: #60A5FA; }
.sys-status-default { color: #888888; }

.sys-comp-row:hover .sys-comp-status { opacity: 0.7; }

.sys-comp-desc {
  color: #888888;
  font-size: 12px;
  flex-basis: 100%;
  padding-left: 2ch;
}

.sys-comp-row:hover .sys-comp-desc {
  color: #444444;
}

/* Imports */
.sys-import-list {
  padding: 0 var(--scope-space-2);
}

.sys-import-row {
  white-space: pre;
  color: var(--scope-text-primary);
}

/* Detail grid */
.sys-detail-grid {
  padding: 0 var(--scope-space-2);
}

.sys-detail-row {
  white-space: pre;
}

.sys-detail-label {
  color: #888888;
}

.sys-detail-val {
  color: var(--scope-text-primary);
}

/* Deps & Secrets */
.sys-deps, .sys-secrets {
  padding: 0 var(--scope-space-2);
}

.sys-dep-row, .sys-secret-row {
  white-space: pre;
  padding: 1px 0;
}

.sys-dep-from, .sys-secret-comp {
  color: var(--scope-text-primary);
}

.sys-dep-arrow {
  color: #888888;
}

.sys-dep-to {
  color: var(--scope-text-primary);
}

.sys-dep-type, .sys-secret-meta {
  color: #888888;
}

.sys-secret-name {
  color: var(--scope-text-primary);
}

/* Validation */
.sys-val-summary {
  padding: 0 var(--scope-space-2);
  white-space: pre;
  color: var(--scope-text-primary);
}

.sys-val-list {
  padding: 2px var(--scope-space-2);
}

.sys-val-item {
  padding: 1px 0;
  white-space: pre-wrap;
  word-break: break-word;
}

.sys-val-error {
  color: #FF6B6B;
}

.sys-val-warn {
  color: #FBBF24;
}

/* ===== DASHBOARD ===== */
/* ===== CLI DASHBOARD ===== */
.dash-cli {
  font-family: var(--scope-font-mono);
  font-size: 13px;
  line-height: 1.6;
  color: #FFFFFF;
  max-height: calc(100vh - 80px);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.dash-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding-bottom: 4px;
}

.dash-title {
  font-weight: bold;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.dash-summary {
  color: #888888;
  font-size: 12px;
}

.dash-global-bars {
  display: flex;
  flex-direction: column;
  gap: 0;
  margin-bottom: 4px;
}

.dash-global-row {
  display: flex;
  align-items: center;
  gap: 4px;
}

.dash-global-label {
  width: 50px;
  color: #888888;
}

.dash-section-line {
  color: #444444;
  margin: 4px 0 2px 0;
  white-space: nowrap;
  overflow: hidden;
}

.dash-comp-header {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #555555;
  font-size: 11px;
  padding: 0 4px;
}

.dash-comp-list {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.dash-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 1px 4px;
  text-decoration: none;
  color: #FFFFFF;
  cursor: pointer;
}

.dash-row:hover {
  background: #FFFFFF;
  color: #000000;
}

.dash-name {
  min-width: 130px;
  white-space: pre;
  font-weight: bold;
}

.dash-status {
  min-width: 60px;
  white-space: pre;
  color: #888888;
  font-size: 11px;
}

.dash-row:hover .dash-status {
  color: #000000;
}

.dash-bar {
  white-space: pre;
  letter-spacing: -0.5px;
}

.dash-bar-label {
  white-space: pre;
}

.dash-pct {
  white-space: pre;
  min-width: 35px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.dash-sep {
  color: #333333;
}

.dash-row:hover .dash-sep {
  color: #666666;
}

.dash-count {
  white-space: pre;
  color: #666666;
  font-size: 11px;
}

.dash-row:hover .dash-count {
  color: #000000;
}

/* Heatmap */
.dash-heatmap {
  display: flex;
  flex-direction: column;
  gap: 0;
  font-size: 12px;
}

.heat-header {
  display: flex;
  align-items: center;
  color: #555555;
}

.heat-row {
  display: flex;
  align-items: center;
}

.heat-name {
  min-width: 130px;
  white-space: pre;
}

.heat-th {
  min-width: 50px;
  white-space: pre;
  text-align: center;
}

.heat-cell {
  min-width: 50px;
  white-space: pre;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

.heat-done { color: #FFFFFF; }
.heat-wip { color: #888888; }
.heat-pending { color: #555555; }
.heat-na { color: #333333; }

/* Types summary */
.dash-types {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.type-chip {
  color: #888888;
  font-size: 12px;
}

/* Status chip — outline only, no fill */
.scope-chip {
  display: inline-flex;
  align-items: center;
  gap: var(--scope-space-1);
  padding: 2px 8px;
  font-size: var(--scope-text-xs);
  font-family: var(--scope-font-mono);
  font-weight: var(--scope-weight-bold);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  background: transparent;
}

.scope-chip.done {
  color: var(--scope-done);
  border: 1px solid var(--scope-done-border);
}

.scope-chip.wip {
  color: var(--scope-wip);
  border: 1px solid var(--scope-wip-border);
}

.scope-chip.pending {
  color: var(--scope-pending);
  border: 1px solid var(--scope-pending-border);
}

.scope-chip.error {
  color: var(--scope-error);
  border: 1px solid var(--scope-error-border);
}

/* ===== INHERITANCE BADGES ===== */
.scope-badge-abstract {
  background: #9370DB;
  color: white;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  margin-right: 4px;
}

.scope-badge-interface {
  background: #DDA0DD;
  color: #333;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  margin-right: 4px;
}

/* ===== FULL-PAGE DIAGRAM ===== */
.scope-fullpage-diagram {
  position: relative;
  height: calc(100vh - 130px);
  overflow: hidden;
}

.scope-fullpage-diagram .scope-diagram-container {
  height: 100%;
}

.scope-diagram-controls {
  position: absolute;
  bottom: var(--scope-space-4);
  right: var(--scope-space-4);
  display: flex;
  gap: var(--scope-space-2);
  background: var(--scope-surface);
  border: 1px solid var(--scope-border);
  padding: var(--scope-space-1);
}

.scope-diagram-controls button {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid transparent;
  background: transparent;
  color: var(--scope-text-secondary);
  cursor: pointer;
  transition: all var(--scope-transition-fast);
  font-size: var(--scope-text-sm);
}

.scope-diagram-controls button:hover {
  border-color: var(--scope-accent);
  color: var(--scope-accent);
}

/* ===== COMPONENT DETAIL ===== */
.scope-component-detail {
  display: flex;
  flex-direction: column;
  gap: var(--scope-space-3);
  height: calc(100vh - 130px);
  overflow: hidden;
}

.scope-component-header {
  display: flex;
  align-items: center;
  gap: var(--scope-space-4);
}

.scope-component-name {
  font-size: var(--scope-text-xl);
  font-weight: var(--scope-weight-bold);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.scope-detail-section {
  background: var(--scope-elevated);
  border: 1px solid var(--scope-border);
  overflow: hidden;
}

.scope-detail-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--scope-space-3) var(--scope-space-4);
  border-bottom: 1px solid var(--scope-border);
  cursor: pointer;
  user-select: none;
}

.scope-detail-section-title {
  font-size: var(--scope-text-sm);
  font-weight: var(--scope-weight-bold);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  display: flex;
  align-items: center;
  gap: var(--scope-space-2);
}

.scope-detail-section-badge {
  font-family: var(--scope-font-mono);
  font-size: var(--scope-text-xs);
  color: var(--scope-text-tertiary);
}

.scope-detail-section-body {
  padding: var(--scope-space-4);
}

.scope-detail-section-body.empty {
  color: var(--scope-text-tertiary);
  font-style: italic;
  font-size: var(--scope-text-sm);
}

/* Entity cards */
.scope-entity-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--scope-space-3);
}

.scope-entity-card {
  background: var(--scope-surface);
  border: 1px solid var(--scope-border);
  padding: var(--scope-space-3);
  transition: border-color var(--scope-transition-fast);
}

.scope-entity-card:hover {
  background: #FFFFFF;
  color: #000000;
  cursor: pointer;
}

.scope-entity-card-name {
  font-weight: var(--scope-weight-semibold);
  font-size: var(--scope-text-sm);
  margin-bottom: var(--scope-space-2);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.scope-entity-fields {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.scope-entity-field {
  display: flex;
  justify-content: space-between;
  font-size: var(--scope-text-xs);
  padding: 2px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.scope-entity-field:last-child {
  border-bottom: none;
}

.scope-entity-field-name {
  color: var(--scope-text-primary);
}

.scope-entity-field-type {
  font-family: var(--scope-font-mono);
  color: var(--scope-text-secondary);
}

/* Deps list */
.scope-deps-list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--scope-space-2);
}

.scope-dep-link {
  display: inline-flex;
  align-items: center;
  gap: var(--scope-space-1);
  padding: var(--scope-space-1) var(--scope-space-3);
  background: transparent;
  border: 1px solid var(--scope-border);
  color: var(--scope-accent);
  text-decoration: none;
  font-size: var(--scope-text-sm);
  transition: all var(--scope-transition-fast);
}

.scope-dep-link:hover {
  background: #FFFFFF;
  color: #000000;
}

/* ===== COMMAND PALETTE ===== */
.scope-command-palette-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  z-index: 1000;
  display: none;
  align-items: flex-start;
  justify-content: center;
  padding-top: 120px;
}

.scope-command-palette-overlay.open {
  display: flex;
}

.scope-command-palette {
  width: 560px;
  background: var(--scope-surface);
  border: 1px solid var(--scope-accent);
  border: 1px solid #FFFFFF;
  overflow: hidden;
}

.scope-command-input-wrapper {
  display: flex;
  align-items: center;
  border-bottom: 1px solid var(--scope-border);
}

.scope-command-prompt {
  padding-left: var(--scope-space-4);
  color: var(--scope-done);
  font-family: var(--scope-font-mono);
  font-size: var(--scope-text-md);
  font-weight: var(--scope-weight-bold);
}

.scope-command-input {
  width: 100%;
  padding: var(--scope-space-4);
  background: transparent;
  border: none;
  border-bottom: 1px solid var(--scope-border);
  color: var(--scope-text-primary);
  font-size: var(--scope-text-md);
  font-family: var(--scope-font-mono);
  outline: none;
  caret-color: var(--scope-done);
}

.scope-command-input::placeholder {
  color: var(--scope-text-tertiary);
}

.scope-command-results {
  max-height: 400px;
  overflow-y: auto;
  padding: var(--scope-space-2);
}

.scope-command-item {
  display: flex;
  align-items: center;
  gap: var(--scope-space-2);
  padding: var(--scope-space-2) var(--scope-space-3);
  cursor: pointer;
  font-size: var(--scope-text-sm);
  color: var(--scope-text-secondary);
  border-left: 2px solid transparent;
  transition: all var(--scope-transition-fast);
}

.scope-command-item:hover,
.scope-command-item.selected {
  background: #FFFFFF;
  color: #000000;
  border-left-color: #000000;
}

.scope-command-item-type {
  font-family: var(--scope-font-mono);
  font-size: var(--scope-text-xs);
  font-weight: var(--scope-weight-bold);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  min-width: 80px;
}

/* ===== ERROR BANNER ===== */
.scope-error-banner {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  background: var(--scope-error-bg);
  border-bottom: 2px solid var(--scope-error);
  padding: var(--scope-space-2) var(--scope-space-4);
  color: var(--scope-error);
  font-size: var(--scope-text-sm);
  display: none;
  z-index: 150;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.scope-error-banner.visible {
  display: block;
}

/* ===== TOAST ===== */
.scope-toast-container {
  position: fixed;
  bottom: var(--scope-space-4);
  left: var(--scope-space-4);
  z-index: 500;
  display: flex;
  flex-direction: column;
  gap: var(--scope-space-2);
}

.scope-toast {
  background: var(--scope-surface);
  border: 1px solid var(--scope-done-border);
  padding: var(--scope-space-2) var(--scope-space-4);
  font-size: var(--scope-text-sm);
  color: var(--scope-done);
  animation: toastIn 0.3s ease, toastOut 0.3s ease 2.7s forwards;
}

/* ===== KEYBOARD SHORTCUTS PANEL ===== */
.scope-shortcuts-panel {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  z-index: 1000;
  display: none;
  align-items: center;
  justify-content: center;
}

.scope-shortcuts-panel.open {
  display: flex;
}

.scope-shortcuts-content {
  background: var(--scope-surface);
  border: 1px solid var(--scope-border);
  padding: var(--scope-space-6);
  max-width: 400px;
  width: 100%;
}

.scope-shortcuts-content h3 {
  font-size: var(--scope-text-lg);
  font-weight: var(--scope-weight-bold);
  margin-bottom: var(--scope-space-4);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--scope-done);
}

.scope-shortcut-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--scope-space-1) 0;
  font-size: var(--scope-text-sm);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.scope-shortcut-row:last-child {
  border-bottom: none;
}

.scope-shortcut-key {
  font-family: var(--scope-font-mono);
  font-size: var(--scope-text-xs);
  background: transparent;
  border: 1px solid var(--scope-done-border);
  padding: 2px 8px;
  color: var(--scope-done);
}

/* ===== NODE FILTER PANEL ===== */
.scope-node-filter-panel {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  z-index: 1000;
  display: none;
  align-items: center;
  justify-content: center;
}

.scope-node-filter-panel.open {
  display: flex;
}

.scope-node-filter-content {
  background: var(--scope-surface);
  border: 1px solid var(--scope-border);
  padding: var(--scope-space-6);
  max-width: 460px;
  width: 100%;
}

.scope-node-filter-content h3 {
  font-size: var(--scope-text-lg);
  font-weight: var(--scope-weight-bold);
  margin-bottom: var(--scope-space-4);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--scope-done);
}

.scope-node-filter-list {
  display: flex;
  flex-direction: column;
  gap: var(--scope-space-2);
  max-height: 60vh;
  overflow-y: auto;
}

.scope-node-filter-row {
  display: flex;
  align-items: center;
  gap: var(--scope-space-3);
  padding: var(--scope-space-2) var(--scope-space-2);
  cursor: pointer;
  transition: background 0.1s;
}

.scope-node-filter-row:hover {
  background: rgba(255, 255, 255, 0.06);
}

.scope-node-filter-row input[type="checkbox"] {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
  pointer-events: none;
}

.scope-node-filter-row .scope-node-filter-check {
  font-family: monospace;
  font-size: var(--scope-text-sm);
  color: rgba(255, 255, 255, 0.3);
  flex-shrink: 0;
  width: 1.8em;
  text-align: center;
  letter-spacing: -0.05em;
}

.scope-node-filter-row input:checked + span .scope-node-filter-check {
  color: var(--scope-filter-type-color, #FFFFFF);
}

.scope-node-filter-row > span {
  flex: 1;
  display: flex;
  align-items: center;
  gap: var(--scope-space-2);
}

.scope-node-filter-row .scope-node-filter-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--scope-filter-type-color, #FFFFFF);
  opacity: 0.25;
  flex-shrink: 0;
  transition: opacity 0.15s;
}

.scope-node-filter-row input:checked + span .scope-node-filter-dot {
  opacity: 1;
}

.scope-node-filter-row .scope-node-filter-type {
  color: rgba(255, 255, 255, 0.5);
  font-size: var(--scope-text-sm);
  flex: 1;
  transition: color 0.15s;
}

.scope-node-filter-row input:checked + span .scope-node-filter-type {
  color: #FFFFFF;
}

.scope-node-filter-row .scope-node-filter-count {
  font-size: var(--scope-text-xs);
  color: rgba(255, 255, 255, 0.25);
  min-width: 2em;
  text-align: right;
}

.scope-node-filter-empty {
  color: var(--scope-text-tertiary);
  font-size: var(--scope-text-sm);
  text-align: center;
  padding: var(--scope-space-4) 0;
}

/* ===== EMPTY STATE ===== */
.scope-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--scope-space-3);
  padding: var(--scope-space-16);
  color: var(--scope-text-tertiary);
  text-align: center;
}

.scope-empty-state-icon {
  width: 48px;
  height: 48px;
  opacity: 0.3;
}

/* ===== SCROLLBAR ===== */
* {
  scrollbar-width: thin;
  scrollbar-color: var(--scope-border) transparent;
}

::-webkit-scrollbar {
  width: 5px;
  height: 5px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: var(--scope-border);
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--scope-text-tertiary);
}

::-webkit-scrollbar-corner {
  background: transparent;
}

/* ===== FILTER BAR (above table) ===== */
.scope-filter-bar {
  display: flex;
  gap: var(--scope-space-2);
  padding: var(--scope-space-3) var(--scope-space-4);
  border-bottom: 1px solid var(--scope-border);
}

.scope-filter-btn {
  padding: var(--scope-space-1) var(--scope-space-3);
  border: 1px solid var(--scope-border);
  background: transparent;
  color: var(--scope-text-secondary);
  font-size: var(--scope-text-xs);
  font-family: var(--scope-font-mono);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  cursor: pointer;
  transition: all var(--scope-transition-fast);
}

.scope-filter-btn:hover {
  border-color: var(--scope-accent);
  color: var(--scope-accent);
}

.scope-filter-btn.active {
  background: transparent;
  border-color: var(--scope-accent);
  color: var(--scope-accent);
}

/* ===== NAV RAIL — Component Items ===== */
.scope-rail-letter {
  font-family: var(--scope-font-mono);
  font-size: var(--scope-text-sm);
  font-weight: var(--scope-weight-bold);
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--scope-elevated);
  border: 1px solid var(--scope-border);
  color: var(--scope-text-secondary);
  transition: all var(--scope-transition-fast);
}

.scope-rail-component:hover .scope-rail-letter {
  border-color: var(--status-color, var(--scope-border-bold));
  color: var(--scope-text-primary);
}

.scope-rail-component.active .scope-rail-letter {
  background: rgba(255, 255, 255, 0.04);
  border-color: var(--scope-accent);
  color: var(--scope-accent);
}

.scope-rail-component::before {
  content: '';
  position: absolute;
  left: -6px;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 0;
  background: var(--status-color, var(--scope-border));
  transition: height var(--scope-transition-fast);
}

.scope-rail-component:hover::before {
  height: 16px;
}

.scope-rail-component.active::before {
  height: 28px;
  background: var(--scope-accent);
}

.scope-rail-more .scope-rail-letter {
  font-size: var(--scope-text-xs);
  background: transparent;
  border: 1px dashed var(--scope-border);
}

/* ===== OVERVIEW — Component Cards Grid ===== */
.scope-overview {
  display: flex;
  gap: var(--scope-space-4);
  min-height: calc(100vh - var(--scope-space-12));
}

.scope-component-cards-section {
  flex-shrink: 0;
}

.scope-component-cards-header {
  display: flex;
  align-items: center;
  gap: var(--scope-space-2);
  font-size: var(--scope-text-xs);
  color: var(--scope-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: var(--scope-weight-medium);
  margin-bottom: var(--scope-space-3);
}

.scope-component-cards-count {
  font-family: var(--scope-font-mono);
}

.scope-component-cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: var(--scope-space-3);
}

.scope-component-card {
  background: var(--scope-elevated);
  border: 1px solid var(--scope-border);
  padding: var(--scope-space-3) var(--scope-space-4);
  text-decoration: none;
  color: inherit;
  display: flex;
  flex-direction: column;
  gap: var(--scope-space-2);
  transition: all var(--scope-transition-fast);
  cursor: pointer;
}

.scope-component-card:hover {
  background: #FFFFFF;
  color: #000000;
}

.scope-component-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.scope-component-card-name {
  font-weight: var(--scope-weight-bold);
  font-size: var(--scope-text-sm);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.scope-component-card-counts {
  font-size: var(--scope-text-xs);
  color: var(--scope-text-secondary);
  font-family: var(--scope-font-mono);
}

.scope-component-card-progress {
  display: flex;
  align-items: center;
  gap: var(--scope-space-2);
}

.scope-component-card-progress .scope-progress-bar {
  flex: 1;
  height: 6px;
}

.scope-component-card-pct {
  font-family: var(--scope-font-mono);
  font-size: var(--scope-text-xs);
  color: var(--scope-text-tertiary);
  min-width: 32px;
  text-align: right;
}

/* ===== Status Bar (bottom of overview) ===== */
.scope-status-bar {
  display: flex;
  align-items: center;
  gap: var(--scope-space-3);
  padding: var(--scope-space-2) var(--scope-space-4);
  background: var(--scope-elevated);
  border: 1px solid var(--scope-border);
  font-size: var(--scope-text-xs);
  font-family: var(--scope-font-mono);
  color: var(--scope-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.scope-status-bar strong {
  font-weight: var(--scope-weight-bold);
}

.scope-status-bar strong.done { color: var(--scope-done); }
.scope-status-bar strong.wip { color: var(--scope-wip); }
.scope-status-bar strong.pending { color: var(--scope-text-secondary); }
.scope-status-bar strong.error { color: var(--scope-error); }

.scope-status-sep {
  color: var(--scope-border-bold);
}

/* ===== Component Detail — Meta Row ===== */
.scope-component-meta {
  display: flex;
  gap: var(--scope-space-4);
  margin-top: calc(-1 * var(--scope-space-2));
}

/* ===== Construct Links ===== */
.scope-construct-link {
  color: var(--scope-accent);
  text-decoration: none;
  transition: all var(--scope-transition-fast);
}

.scope-construct-link:hover {
  color: var(--scope-accent-hover);
}

/* ===== Section Collapsible ===== */
.scope-detail-section.collapsed .scope-detail-section-body {
  display: none;
}

.scope-detail-section-header::after {
  content: '';
  width: 0;
  height: 0;
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-top: 5px solid var(--scope-text-tertiary);
  transition: transform var(--scope-transition-fast);
}

.scope-detail-section.collapsed .scope-detail-section-header::after {
  transform: rotate(-90deg);
}

/* ===== CONSTRUCT DETAIL (Level 3) ===== */
.scope-construct-detail {
  display: grid;
  grid-template-columns: 1fr 340px;
  grid-template-rows: auto auto 1fr;
  gap: var(--scope-space-4);
}

.scope-construct-header {
  grid-column: 1 / -1;
  grid-row: 1;
  background: var(--scope-elevated);
  border: 1px solid var(--scope-border);
  padding: var(--scope-space-4) var(--scope-space-5);
}

/* Relationship diagram — full width, between header and content */
.scope-construct-detail > .scope-diagram-container {
  grid-column: 1 / -1;
  grid-row: 2;
}

.scope-construct-sidebar {
  grid-column: 2;
  grid-row: 3;
  display: flex;
  flex-direction: column;
  gap: var(--scope-space-4);
  min-width: 0;
  position: sticky;
  top: var(--scope-space-4);
  align-self: start;
}

@media (max-width: 900px) {
  .scope-construct-detail {
    grid-template-columns: 1fr;
  }
  .scope-construct-header,
  .scope-construct-detail > .scope-diagram-container {
    grid-column: 1;
  }
}

.scope-construct-header-top {
  display: flex;
  align-items: center;
  gap: var(--scope-space-3);
  margin-bottom: var(--scope-space-2);
}

.scope-construct-type-badge {
  font-family: var(--scope-font-mono);
  font-size: var(--scope-text-xs);
  font-weight: var(--scope-weight-bold);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--scope-accent);
  background: transparent;
  padding: 2px 8px;
  border: 1px solid var(--scope-accent);
}

.scope-construct-title {
  font-size: var(--scope-text-xl);
  font-weight: var(--scope-weight-bold);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.scope-construct-header-meta {
  display: flex;
  align-items: center;
  gap: var(--scope-space-3);
  font-size: var(--scope-text-sm);
  color: var(--scope-text-secondary);
}

.scope-construct-body {
  grid-column: 1;
  grid-row: 3;
  display: flex;
  flex-direction: column;
  gap: var(--scope-space-4);
  min-width: 0;
}

.scope-construct-section {
  background: var(--scope-elevated);
  border: 1px solid var(--scope-border);
  padding: var(--scope-space-4);
}

.scope-construct-section-title {
  font-size: var(--scope-text-xs);
  font-weight: var(--scope-weight-bold);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--scope-text-tertiary);
  margin-bottom: var(--scope-space-3);
  padding-bottom: var(--scope-space-2);
  border-bottom: 1px solid var(--scope-border);
}

.scope-construct-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--scope-text-sm);
}

.scope-construct-table th {
  text-align: left;
  padding: var(--scope-space-2) var(--scope-space-3);
  font-size: var(--scope-text-xs);
  font-weight: var(--scope-weight-medium);
  color: var(--scope-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  border-bottom: 1px solid var(--scope-border);
}

.scope-construct-table td {
  padding: var(--scope-space-2) var(--scope-space-3);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.scope-construct-table tr:last-child td {
  border-bottom: none;
}

/* ===== RELATIONSHIP PANEL ===== */
.scope-relationships-panel {
  background: var(--scope-elevated);
  border: 1px solid var(--scope-border);
  padding: var(--scope-space-4);
}

.scope-relationships-title {
  font-size: var(--scope-text-xs);
  font-weight: var(--scope-weight-bold);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--scope-done);
  margin-bottom: var(--scope-space-4);
  padding-bottom: var(--scope-space-2);
  border-bottom: 1px solid var(--scope-border);
}

.scope-relationships-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: var(--scope-space-4);
}

.scope-rel-section {
  display: flex;
  flex-direction: column;
  gap: var(--scope-space-2);
  padding: var(--scope-space-2);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.scope-rel-title {
  font-size: var(--scope-text-xs);
  font-weight: var(--scope-weight-medium);
  color: var(--scope-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.scope-rel-items {
  font-size: var(--scope-text-sm);
  line-height: 1.8;
}

/* ===== FLOW STEPS ===== */
.scope-flow-steps {
  display: flex;
  flex-direction: column;
  gap: var(--scope-space-1);
}

.scope-flow-step {
  display: flex;
  align-items: flex-start;
  gap: var(--scope-space-2);
  padding: var(--scope-space-1) 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}

.scope-flow-step:last-child {
  border-bottom: none;
}

.scope-flow-step-num {
  font-family: var(--scope-font-mono);
  font-size: var(--scope-text-xs);
  color: var(--scope-text-tertiary);
  min-width: 24px;
  text-align: right;
}

.scope-flow-branch {
  color: var(--scope-wip);
}

.scope-flow-return {
  color: var(--scope-done);
}

.scope-flow-comment {
  opacity: 0.7;
}

/* ===== RULE CLAUSES ===== */
.scope-rule-clauses {
  display: flex;
  flex-direction: column;
  gap: var(--scope-space-2);
}

.scope-rule-clause {
  font-family: var(--scope-font-mono);
  font-size: var(--scope-text-sm);
  padding: var(--scope-space-2) var(--scope-space-3);
  background: var(--scope-surface);
  border: 1px solid var(--scope-border);
}

.scope-rule-keyword {
  color: var(--scope-accent);
  font-weight: var(--scope-weight-bold);
}

/* ===== INTERACTIVE DIAGRAM CANVAS ===== */
.scope-diagram-container {
  overflow: hidden;
  cursor: grab;
  user-select: none;
  position: relative;
}

.scope-diagram-container.panning {
  cursor: grabbing;
}

.scope-diagram-container svg {
  max-width: none !important;
  max-height: none !important;
  width: auto !important;
  height: auto !important;
  transition: none;
}

.scope-zoom-indicator {
  position: absolute;
  bottom: var(--scope-space-2);
  left: var(--scope-space-2);
  font-family: var(--scope-font-mono);
  font-size: var(--scope-text-xs);
  color: var(--scope-text-tertiary);
  background: var(--scope-surface);
  border: 1px solid var(--scope-border);
  padding: 2px 6px;
  pointer-events: none;
  z-index: 5;
}

.scope-diagram-controls-float {
  position: absolute;
  bottom: var(--scope-space-3);
  right: var(--scope-space-3);
  display: flex;
  gap: var(--scope-space-1);
  background: var(--scope-surface);
  border: 1px solid var(--scope-border);
  padding: var(--scope-space-1);
  z-index: 5;
}

.scope-diagram-controls-float button {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid transparent;
  background: transparent;
  color: var(--scope-text-secondary);
  cursor: pointer;
  transition: all var(--scope-transition-fast);
  font-size: var(--scope-text-sm);
}

.scope-diagram-controls-float button:hover {
  border-color: var(--scope-accent);
  color: var(--scope-accent);
}

/* ===== CLICKABLE NODES ===== */
.scope-interactive-node {
  cursor: pointer !important;
  transition: filter 0.15s ease;
}

.scope-interactive-node:hover {
  filter: invert(1);
}

.scope-node-tooltip {
  display: none;
  position: fixed;
  z-index: 9000;
  white-space: nowrap;
  background: var(--scope-surface);
  border: 1px solid var(--scope-border);
  padding: 4px 10px;
  font-family: var(--scope-font-mono);
  font-size: var(--scope-text-xs);
  color: var(--scope-text-primary);
  pointer-events: none;
}

.scope-node-tooltip-type {
  color: var(--scope-accent);
  text-transform: uppercase;
  font-weight: var(--scope-weight-bold);
  letter-spacing: 0.05em;
  margin-right: var(--scope-space-2);
}

/* ===== COMPONENT TABS ===== */
.scope-component-tabs {
  display: flex;
  gap: 0;
  border-bottom: 1px solid var(--scope-border);
  overflow-x: auto;
  flex-shrink: 0;
}

.scope-tab {
  padding: var(--scope-space-2) var(--scope-space-4);
  border: none;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--scope-text-secondary);
  font-family: var(--scope-font-mono);
  font-size: var(--scope-text-xs);
  font-weight: var(--scope-weight-medium);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  cursor: pointer;
  transition: all var(--scope-transition-fast);
  display: flex;
  align-items: center;
  gap: var(--scope-space-2);
  white-space: nowrap;
}

.scope-tab:hover:not(.disabled) {
  color: var(--scope-text-primary);
  background: rgba(255, 255, 255, 0.03);
}

.scope-tab.active {
  color: var(--scope-accent);
  border-bottom-color: var(--scope-accent);
}

.scope-tab.disabled {
  opacity: 0.3;
  cursor: default;
}

.scope-tab-count {
  font-family: var(--scope-font-mono);
  font-size: var(--scope-text-xs);
  color: var(--scope-text-tertiary);
}

.scope-tab.active .scope-tab-count {
  color: var(--scope-accent);
}

.scope-tab-panel {
  display: none;
}

.scope-tab-panel.active {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.scope-tab-panel-content {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  gap: var(--scope-space-3);
  padding-top: var(--scope-space-2);
  overflow-y: auto;
  overflow-x: hidden;
}

.scope-mini-diagram {
  height: 45vh;
  min-height: 250px;
  resize: vertical;
  overflow: hidden;
  background: var(--scope-elevated);
  border: 1px solid var(--scope-border);
  position: relative;
}

/* ===== OVERVIEW HEADER + DIAGRAM ===== */
.scope-overview-header {
  padding: 4px 0;
  border-bottom: 1px solid var(--scope-border);
  font-family: var(--scope-font-mono);
  font-size: 13px;
}

.scope-overview-header .dash-global-bars {
  margin-bottom: 0;
}

.scope-overview-diagram {
  flex: 1;
  min-height: 300px;
  resize: vertical;
  overflow: hidden;
  background: var(--scope-elevated);
  border: 1px solid var(--scope-border);
  position: relative;
}

/* ===== RELATIONSHIP MINI-GRAPH ===== */
.scope-rel-diagram {
  height: 280px;
  min-height: 180px;
  resize: vertical;
  overflow: hidden;
  background: var(--scope-elevated);
  border: 1px solid var(--scope-border);
  position: relative;
  margin-bottom: var(--scope-space-4);
}

/* ===== OVERVIEW REDESIGN ===== */
.scope-overview-redesign {
  display: flex;
  gap: var(--scope-space-4);
  min-height: calc(100vh - var(--scope-space-12));
}

.scope-diagram-primary {
  flex: 1;
  position: relative;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.scope-diagram-primary .scope-diagram-container {
  flex: 1;
  height: calc(100vh - 130px);
}

.scope-components-toggle {
  position: absolute;
  top: var(--scope-space-3);
  right: var(--scope-space-3);
  z-index: 10;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--scope-border);
  background: var(--scope-surface);
  color: var(--scope-text-secondary);
  cursor: pointer;
  transition: all var(--scope-transition-fast);
  font-size: var(--scope-text-sm);
}

.scope-components-toggle:hover {
  border-color: var(--scope-accent);
  color: var(--scope-accent);
}

.scope-components-panel {
  width: 300px;
  flex-shrink: 0;
  background: var(--scope-surface);
  border-left: 1px solid var(--scope-border);
  overflow-y: auto;
  padding: var(--scope-space-4);
}

.scope-components-panel.open {
  display: block;
}

.scope-components-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--scope-space-4);
}

.scope-components-panel-title {
  font-size: var(--scope-text-xs);
  font-weight: var(--scope-weight-bold);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--scope-text-secondary);
}

.scope-components-panel-close {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--scope-border);
  background: transparent;
  color: var(--scope-text-secondary);
  cursor: pointer;
  font-size: var(--scope-text-sm);
}

.scope-components-panel-close:hover {
  border-color: var(--scope-accent);
  color: var(--scope-accent);
}

.scope-components-panel .scope-component-cards-grid {
  grid-template-columns: 1fr;
}

/* ===== ZOOM TRANSITION ===== */
@keyframes zoomIn {
  from { opacity: 0; transform: scale(0.85); }
  to { opacity: 1; transform: scale(1); }
}

@keyframes zoomOverlay {
  from { opacity: 0; }
  to { opacity: 1; background: var(--scope-void); }
}

.scope-zoom-overlay {
  position: fixed;
  inset: 0;
  z-index: 5000;
  background: transparent;
  opacity: 0;
  transition: opacity 0.2s ease;
  pointer-events: none;
}

.scope-zoom-overlay.active {
  opacity: 1;
  background: var(--scope-void);
}

.scope-canvas.entering {
  animation: zoomIn 0.3s ease-out;
}

.scope-canvas.transitioning {
  opacity: 0.5;
  transition: opacity 0.15s ease;
}

/* ===== KEYBOARD NAVIGATION ===== */
.scope-focused {
  background: #FFFFFF !important;
  color: #000000 !important;
  outline: none !important;
  position: relative;
}

.scope-focused::before {
  content: '>';
  position: absolute;
  left: -16px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--scope-accent);
  font-family: var(--scope-font-mono);
  font-weight: var(--scope-weight-bold);
  font-size: var(--scope-text-sm);
  animation: cursorBlink 1s ease-in-out infinite;
}

/* ===== DIAGRAM SKELETON ===== */
.scope-diagram-skeleton {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  min-height: 200px;
  background: linear-gradient(
    90deg,
    var(--scope-elevated) 25%,
    var(--scope-overlay) 50%,
    var(--scope-elevated) 75%
  );
  background-size: 200% 100%;
  animation: skeletonPulse 1.5s ease-in-out infinite;
}

.scope-diagram-skeleton span {
  color: var(--scope-text-tertiary);
  font-size: var(--scope-text-xs);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

@keyframes skeletonPulse {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* ===== FOCUS STATES ===== */
a:focus-visible,
button:focus-visible,
.scope-tab:focus-visible,
.scope-type-item:focus-visible,
.scope-rail-item:focus-visible {
  background: #FFFFFF;
  color: #000000;
  outline: none;
}

/* ===== GHOST NODE (external entity reference) ===== */
.scope-ghost-node {
  opacity: 0.5;
  stroke-dasharray: 5, 5;
}

/* External API — ghost style */
.scope-api-external {
  opacity: 0.5;
  border-style: dashed;
}
.scope-external-badge {
  font-size: var(--scope-text-xs);
  color: var(--scope-text-tertiary);
  font-style: italic;
  display: inline-block;
  border: 1px dashed var(--scope-border);
  padding: 0 4px;
  margin-left: 8px;
}

/* ===== ENTITY GRAPH (interactive canvas) ===== */
.scope-entity-graph {
  position: relative;
  width: 100%;
  flex: 1;
  min-height: 300px;
  overflow: hidden;
  border: 1px solid var(--scope-border);
  background: var(--scope-void);
}

.scope-entity-graph-world {
  position: absolute;
  top: 0;
  left: 0;
  transform-origin: 0 0;
}

.scope-entity-graph-edges {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  overflow: visible;
}

/* ===== UNIVERSAL NODE BASE (BaseGraph) ===== */
.scope-graph-node {
  position: absolute;
  background: var(--scope-surface);
  border: 1px solid var(--scope-border);
  font-family: var(--scope-font-mono);
  font-size: var(--scope-text-sm);
  cursor: pointer;
  user-select: none;
  transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
  --node-color: var(--scope-border);
}

.scope-graph-node:hover {
  background: #FFFFFF;
  color: #000000;
  border-color: #FFFFFF;
}
.scope-graph-node:hover * { color: #000000; }
.scope-graph-node:hover a { color: #000000; }
.scope-graph-node:hover .scope-impl-chip { color: #000000; border-color: #000000; }

.scope-graph-node.dragging:hover {
  background: var(--scope-surface);
  color: var(--scope-text-primary);
  border-color: var(--node-color, var(--scope-border));
}
.scope-graph-node.dragging:hover * { color: inherit; }
.scope-graph-node.dragging:hover a { color: var(--scope-accent); }

.scope-graph-node.dragging {
  cursor: grabbing;
  z-index: 10;
}

.scope-graph-node.ghost {
  opacity: 0.6;
}

/* ===== NODE BUILDING BLOCKS (composable) ===== */

/* Type badge — small uppercase label */
.scope-node-badge {
  font-size: 9px;
  font-family: var(--scope-font-mono);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  padding: 1px 6px;
  margin-bottom: var(--scope-space-1);
  width: fit-content;
  color: var(--scope-text-tertiary);
  border: 1px solid var(--scope-border);
  background: rgba(255, 255, 255, 0.03);
}
.scope-node-badge--flow   { color: var(--scope-diagram-flow);   border-color: var(--scope-diagram-flow); }
.scope-node-badge--entity { color: var(--scope-diagram-entity); border-color: var(--scope-diagram-entity); }
.scope-node-badge--event  { color: #FF00FF; border-color: #FF00FF; }
.scope-node-badge--enum   { color: var(--scope-pending);        border-color: var(--scope-pending); }
.scope-node-badge--screen  { color: var(--scope-diagram-screen);  border-color: var(--scope-diagram-screen); }
.scope-node-badge--journey { color: var(--scope-diagram-journey); border-color: var(--scope-diagram-journey); }

/* Header — name + impl chip, flex row */
.scope-node-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--scope-space-1);
}
.scope-node-header a {
  font-weight: var(--scope-weight-semibold);
  font-size: var(--scope-text-sm);
  color: var(--scope-text-primary);
  text-decoration: none;
}

/* Fields table — rows of name:type */
.scope-node-fields {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.scope-node-field {
  display: flex;
  justify-content: space-between;
  font-size: var(--scope-text-xs);
  padding: 2px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}
.scope-node-field:last-child { border-bottom: none; }
.scope-node-field__name { color: var(--scope-text-primary); }
.scope-node-field__type { font-family: var(--scope-font-mono); color: var(--scope-text-secondary); }

/* Ghost origin label */
.scope-node-ghost-origin {
  font-size: var(--scope-text-xs);
  color: var(--scope-text-tertiary);
  font-style: italic;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: var(--scope-space-1);
}

/* Type label — small subtitle below node name */
.scope-node-type {
  font-size: 10px;
  font-family: var(--scope-font-mono);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--scope-text-tertiary);
  margin-bottom: var(--scope-space-2);
}

/* Hover overrides for building blocks inside graph nodes */
.scope-graph-node:hover .scope-node-badge  { color: #000000; border-color: #000000; }
.scope-graph-node:hover .scope-node-field  { border-bottom-color: rgba(0,0,0,0.15); }
.scope-graph-node:hover .scope-node-header a { color: #000000; }
.scope-graph-node:hover .scope-node-type { color: rgba(0,0,0,0.45); }

.scope-graph-node.dragging:hover .scope-node-badge  { color: inherit; border-color: var(--scope-border); }
.scope-graph-node.dragging:hover .scope-node-field   { border-bottom-color: rgba(255,255,255,0.08); }
.scope-graph-node.dragging:hover .scope-node-header a { color: var(--scope-text-primary); }
.scope-graph-node.dragging:hover .scope-node-type { color: var(--scope-text-tertiary); }

/* Abstract/Interface — shared across all graph types */
.scope-graph-node.scope-node-abstract { border-style: dashed; opacity: 0.85; }
.scope-graph-node.scope-node-interface { border-style: dotted; opacity: 0.85; }

.scope-node-badge.abstract { color: var(--scope-wip); border-color: var(--scope-wip); }
.scope-node-badge.interface { color: var(--scope-diagram-flow); border-color: var(--scope-diagram-flow); }

.scope-node-inheritance {
  font-size: var(--scope-text-xs);
  font-family: var(--scope-font-mono);
  color: var(--scope-text-tertiary);
  padding: 2px 0 4px;
}
.scope-graph-node:hover .scope-node-inheritance { color: #000000; }
.scope-graph-node.dragging:hover .scope-node-inheritance { color: var(--scope-text-tertiary); }

/* Inheritance/override edges — shared (path. prefix for specificity over base edge classes) */
path.scope-graph-edge-extends {
  stroke: var(--scope-wip);
  stroke-dasharray: 6, 4;
  stroke-width: 1.5;
}
path.scope-graph-edge-implements {
  stroke: var(--scope-diagram-flow);
  stroke-dasharray: 4, 3;
  stroke-width: 1.5;
}
path.scope-graph-edge-override {
  stroke: var(--scope-wip);
  stroke-dasharray: 3, 3;
  stroke-width: 1.5;
}

/* Entity node — extends .scope-graph-node */
.scope-entity-node {
  padding: var(--scope-space-3);
  min-width: 220px;
  max-width: 300px;
  --node-color: var(--scope-type-entity);
  border-color: var(--node-color);
}
.scope-entity-node .scope-node-type { color: var(--node-color); }

.scope-entity-node:hover .scope-entity-node__field { border-bottom-color: rgba(0,0,0,0.15); }
.scope-entity-node.dragging:hover .scope-entity-node__field { border-bottom-color: rgba(255,255,255,0.08); }

.scope-entity-node__name {
  font-weight: var(--scope-weight-semibold);
  font-size: var(--scope-text-sm);
  margin-bottom: var(--scope-space-2);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.scope-entity-node__name a {
  color: var(--scope-text-primary);
  text-decoration: none;
}

.scope-entity-node__origin {
  font-size: var(--scope-text-xs);
  color: var(--scope-text-tertiary);
  font-style: italic;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: var(--scope-space-1);
}

.scope-entity-node__fields {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.scope-entity-node__field {
  display: flex;
  justify-content: space-between;
  font-size: var(--scope-text-xs);
  padding: 2px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.scope-entity-node__field:last-child {
  border-bottom: none;
}

.scope-entity-node__field-name {
  color: var(--scope-text-primary);
}

.scope-entity-node__field-type {
  font-family: var(--scope-font-mono);
  color: var(--scope-text-secondary);
}

/* Enum node — extends .scope-graph-node */
.scope-enum-node {
  padding: var(--scope-space-3);
  min-width: 180px;
  max-width: 280px;
  --node-color: var(--scope-type-enum);
  border-color: var(--node-color);
}
.scope-enum-node .scope-node-type { color: var(--node-color); }

/* Enum values — chip layout */
.scope-node-enum-values {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.scope-node-enum-chip {
  font-size: 10px;
  font-family: var(--scope-font-mono);
  text-transform: uppercase;
  padding: 1px 6px;
  border: 1px solid var(--scope-border);
  color: var(--scope-text-secondary);
}
.scope-graph-node:hover .scope-node-enum-chip {
  color: #000000;
  border-color: rgba(0,0,0,0.25);
}
.scope-graph-node.dragging:hover .scope-node-enum-chip {
  color: var(--scope-text-secondary);
  border-color: var(--scope-border);
}

.scope-entity-graph-edge-label {
  font-size: 11px;
  fill: var(--scope-text-secondary);
  font-family: var(--scope-font-mono);
}

.scope-entity-graph-edge {
  stroke: var(--scope-text-tertiary);
  stroke-width: 1.5;
  fill: none;
}

.scope-entity-graph-edge.hovered {
  stroke: var(--scope-accent);
  stroke-width: 2;
}

.scope-entity-graph-edge-group {
  pointer-events: stroke;
}

.scope-entity-graph-edge-group:hover .scope-entity-graph-edge {
  stroke: var(--scope-accent);
  stroke-width: 2;
}

/* ===== COMPONENT GRAPH (interactive overview) ===== */
.scope-component-graph {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: calc(100vh - var(--scope-space-12));
  overflow: hidden;
  background: var(--scope-void);
}

.scope-component-graph-world {
  position: absolute;
  top: 0;
  left: 0;
  transform-origin: 0 0;
}

.scope-component-graph-edges {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  overflow: visible;
}

/* Component node — extends .scope-graph-node */
.scope-component-node {
  padding: var(--scope-space-4) var(--scope-space-6);
  min-width: 200px;
  text-align: center;
}

.scope-component-node:hover {
  border-color: #FFFFFF !important;
}
.scope-component-node:hover a { color: #000000 !important; }
.scope-component-node.dragging:hover {
  border-color: var(--node-color, var(--scope-border)) !important;
}
.scope-component-node.dragging:hover a { color: var(--scope-text-primary) !important; }

.scope-component-node__name {
  font-size: var(--scope-text-md);
  font-weight: normal;
  margin-bottom: 2px;
}

.scope-component-node__name a {
  color: var(--node-color, var(--scope-text-primary));
  text-decoration: none;
}

.scope-component-node__status {
  font-style: italic;
  font-size: var(--scope-text-base);
  color: var(--scope-text-primary);
  margin-bottom: 2px;
}

.scope-component-node__counts {
  font-size: var(--scope-text-sm);
  color: var(--scope-text-primary);
  margin-bottom: 2px;
}

.scope-component-node__impl {
  font-size: var(--scope-text-sm);
  color: var(--scope-text-primary);
  font-family: var(--scope-font-mono);
}

/* Abstract / Interface component nodes — dashed borders */
.scope-component-node--abstract {
  border-style: dashed !important;
  border-width: 2px !important;
}
.scope-component-node--interface {
  border-style: dotted !important;
  border-width: 2px !important;
}

.scope-component-node__badge {
  font-size: 10px;
  font-family: var(--scope-font-mono);
  padding: 1px 6px;
  border-radius: 2px;
  display: inline-block;
  margin-top: 2px;
  letter-spacing: 0.5px;
}
.scope-component-node__badge--abstract {
  color: var(--scope-wip);
  border: 1px solid var(--scope-wip);
}
.scope-component-node__badge--interface {
  color: var(--scope-diagram-flow);
  border: 1px solid var(--scope-diagram-flow);
}

/* Inheritance line shown on concrete nodes */
.scope-component-node__inherit {
  font-size: 10px;
  font-family: var(--scope-font-mono);
  color: var(--scope-text-secondary);
  margin-top: 2px;
  opacity: 0.8;
}

.scope-component-graph-edge {
  stroke: var(--scope-text-primary);
  stroke-width: 1.5;
  fill: none;
}

.scope-component-graph-edge.optional {
  stroke-dasharray: 6, 3;
  stroke: var(--scope-text-tertiary);
}

.scope-component-graph-edge.scope-graph-edge-extends {
  stroke: var(--scope-wip);
  stroke-width: 1.5;
  stroke-dasharray: 8, 4;
}
.scope-component-graph-edge.scope-graph-edge-implements {
  stroke: var(--scope-diagram-flow);
  stroke-width: 1.5;
  stroke-dasharray: 4, 3;
}
.scope-component-graph-edge-label {
  fill: var(--scope-text-secondary);
  font-size: 10px;
  font-family: var(--scope-font-mono);
}

/* ===== FLOW GRAPH (interactive canvas) ===== */
.scope-flow-graph {
  position: relative;
  width: 100%;
  flex: 1;
  min-height: 300px;
  overflow: hidden;
  border: 1px solid var(--scope-border);
  background: var(--scope-void);
}

.scope-flow-graph-world {
  position: absolute;
  top: 0;
  left: 0;
  transform-origin: 0 0;
}

.scope-flow-graph-edges {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  overflow: visible;
}

/* Flow node — extends .scope-graph-node */
.scope-flow-node {
  padding: var(--scope-space-3);
  min-width: 280px;
  max-width: 400px;
  --node-color: var(--scope-type-flow);
  border-color: var(--node-color);
}
.scope-flow-node .scope-node-type { color: var(--node-color); }

.scope-flow-node .scope-node-header a {
  font-weight: var(--scope-weight-bold);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

/* Flow-specific hover overrides for steps/branches/sig */
.scope-flow-node:hover .scope-flow-graph-step-async { color: #000000; border-color: #000000; }
.scope-flow-node:hover .scope-flow-graph-step { background: rgba(0,0,0,0.05); border-color: rgba(0,0,0,0.1); }
.scope-flow-node:hover .scope-flow-graph-branch { color: #000000; border-left-color: #000000; background: rgba(0,0,0,0.03); border-color: rgba(0,0,0,0.08); }
.scope-flow-node:hover .scope-flow-graph-node-sig { color: #000000; border-bottom-color: rgba(0,0,0,0.15); }

.scope-flow-node.dragging:hover .scope-flow-graph-step-async { color: inherit; border-color: var(--scope-border); }
.scope-flow-node.dragging:hover .scope-flow-graph-step { background: rgba(255, 255, 255, 0.02); border-color: rgba(255, 255, 255, 0.06); }
.scope-flow-node.dragging:hover .scope-flow-graph-branch { color: var(--scope-wip); border-left-color: var(--scope-wip); background: rgba(255, 255, 255, 0.01); border-color: rgba(255, 255, 255, 0.04); }
.scope-flow-node.dragging:hover .scope-flow-graph-node-sig { color: var(--scope-text-secondary); border-bottom-color: rgba(255, 255, 255, 0.08); }


/* Flow IO node — extends .scope-graph-node */
.scope-flow-io-node {
  padding: var(--scope-space-3);
  min-width: 180px;
  max-width: 260px;
}
.scope-flow-io-node.input  { border-left: 3px solid var(--scope-type-entity); }
.scope-flow-io-node.output { border-right: 3px solid var(--scope-done); }
.scope-flow-io-node.error  { border-right: 3px solid var(--scope-error); opacity: 0.7; }

.scope-flow-io-node.ghost.input  { border-left-style: solid; }
.scope-flow-io-node.ghost.output { border-right-style: solid; }
.scope-flow-io-node.ghost.error  { border-right-style: solid; }

/* Flow event node — extends .scope-graph-node */
.scope-flow-event-node {
  padding: var(--scope-space-2) var(--scope-space-3);
  white-space: nowrap;
  border-bottom: 3px solid var(--scope-type-event);
}
.scope-flow-event-node .scope-node-type { color: var(--scope-type-event); }
.scope-flow-event-node:hover { border-bottom-color: #FFFFFF; }
.scope-flow-event-node.dragging:hover { border-bottom-color: var(--scope-type-event); }

.scope-flow-graph-node-sig {
  font-family: var(--scope-font-mono);
  font-size: var(--scope-text-xs);
  color: var(--scope-text-secondary);
  padding-bottom: var(--scope-space-2);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  margin-bottom: var(--scope-space-2);
}

.scope-flow-graph-node-comment {
  font-size: var(--scope-text-xs);
  color: var(--scope-text-tertiary);
  font-style: italic;
  margin-bottom: var(--scope-space-2);
}

.scope-flow-graph-steps {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.scope-flow-graph-step {
  display: flex;
  align-items: flex-start;
  gap: var(--scope-space-2);
  font-family: var(--scope-font-mono);
  font-size: var(--scope-text-xs);
  padding: var(--scope-space-1) var(--scope-space-2);
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.scope-flow-graph-step:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.12);
}

.scope-flow-graph-step-num {
  color: var(--scope-text-tertiary);
  min-width: 18px;
  text-align: right;
  flex-shrink: 0;
}

.scope-flow-graph-step-content {
  color: var(--scope-text-primary);
}

.scope-flow-graph-step.return .scope-flow-graph-step-content {
  color: var(--scope-done);
}

.scope-flow-graph-step.emit .scope-flow-graph-step-content {
  color: var(--scope-diagram-flow);
}

.scope-flow-graph-step-async {
  font-size: 9px;
  padding: 0 4px;
  border: 1px solid var(--scope-border);
  color: var(--scope-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.03em;
  margin-left: var(--scope-space-1);
}

.scope-flow-graph-branch {
  display: flex;
  align-items: flex-start;
  gap: var(--scope-space-2);
  font-family: var(--scope-font-mono);
  font-size: var(--scope-text-xs);
  padding: var(--scope-space-1) var(--scope-space-2) var(--scope-space-1) 28px;
  color: var(--scope-wip);
  background: rgba(255, 255, 255, 0.01);
  border: 1px solid rgba(255, 255, 255, 0.04);
  border-left: 2px solid var(--scope-wip);
}

/* Flow graph edges */
.scope-flow-graph-edge {
  stroke: var(--scope-text-tertiary);
  stroke-width: 1.5;
  fill: none;
}

.scope-flow-graph-edge.emit {
  stroke-dasharray: 4, 3;
}

.scope-flow-graph-edge.error {
  stroke-dasharray: 6, 3;
  stroke: var(--scope-error);
}

.scope-flow-graph-edge-label {
  font-size: 10px;
  fill: var(--scope-text-tertiary);
  font-family: var(--scope-font-mono);
}

.scope-flow-graph-edge-group {
  pointer-events: stroke;
}

.scope-flow-graph-edge-group:hover .scope-flow-graph-edge {
  stroke: var(--scope-accent);
  stroke-width: 2;
}

/* Flow graph — calls/enforces edges */
.scope-flow-graph-edge.calls {
  stroke: var(--scope-text-tertiary);
}
.scope-flow-graph-edge.enforces {
  stroke: var(--scope-pending);
  stroke-dasharray: 4, 3;
}
.scope-flow-graph-step.override .scope-flow-graph-step-content {
  color: var(--scope-wip);
}

/* Operation node — extends .scope-graph-node */
.scope-operation-node {
  padding: var(--scope-space-3);
  min-width: 220px;
  max-width: 340px;
  --node-color: var(--scope-type-operation);
  border-color: var(--node-color);
  border-left: 3px solid var(--node-color);
}
.scope-operation-node .scope-node-type { color: var(--node-color); }
.scope-operation-node .scope-node-header a {
  font-weight: var(--scope-weight-bold);
  letter-spacing: 0.03em;
}
.scope-operation-node-clause {
  font-size: var(--scope-text-xs);
  font-family: var(--scope-font-mono);
  padding: 2px 0;
  color: var(--scope-text-secondary);
}
.scope-operation-node-clause.enforces { color: var(--scope-pending); }
.scope-operation-node-clause.emits { color: var(--scope-diagram-flow); }
.scope-operation-node:hover .scope-operation-node-clause { color: #000000; }
.scope-operation-node.dragging:hover .scope-operation-node-clause.enforces { color: var(--scope-pending); }
.scope-operation-node.dragging:hover .scope-operation-node-clause.emits { color: var(--scope-diagram-flow); }
.scope-operation-node:hover .scope-flow-graph-node-sig { color: #000000; border-bottom-color: rgba(0,0,0,0.15); }
.scope-operation-node.dragging:hover .scope-flow-graph-node-sig { color: var(--scope-text-secondary); border-bottom-color: rgba(255, 255, 255, 0.08); }

/* Rule node — extends .scope-graph-node */
.scope-rule-node {
  padding: var(--scope-space-2) var(--scope-space-3);
  min-width: 200px;
  max-width: 300px;
  --node-color: var(--scope-type-rule);
  border-color: var(--node-color);
  border-left: 3px solid var(--node-color);
}
.scope-rule-node .scope-node-type { color: var(--node-color); }
.scope-rule-node-when {
  font-size: var(--scope-text-xs);
  font-family: var(--scope-font-mono);
  color: var(--scope-text-secondary);
}
.scope-rule-node-then {
  font-size: var(--scope-text-xs);
  font-family: var(--scope-font-mono);
  color: var(--scope-pending);
}
.scope-rule-node:hover .scope-rule-node-when { color: #000000; }
.scope-rule-node:hover .scope-rule-node-then { color: #000000; }
.scope-rule-node.dragging:hover .scope-rule-node-when { color: var(--scope-text-secondary); }
.scope-rule-node.dragging:hover .scope-rule-node-then { color: var(--scope-pending); }

/* Flow endpoint node — extends .scope-graph-node */
.scope-flow-endpoint-node {
  padding: var(--scope-space-2) var(--scope-space-3);
  min-width: 140px;
  max-width: 260px;
  border: 1.5px solid var(--scope-type-api);
  border-radius: var(--scope-radius);
}
.scope-flow-endpoint-node .scope-node-type { color: var(--scope-type-api); }
.scope-flow-endpoint-node.handles { border-left: 3px solid var(--scope-type-api); }
.scope-flow-endpoint-node.calls { border-right: 3px solid var(--scope-type-api); opacity: 0.85; border-style: dashed; }
.scope-flow-endpoint-node:hover {
  border-color: var(--scope-type-api);
  box-shadow: 0 0 0 1px var(--scope-type-api), var(--scope-shadow-md);
}
.scope-flow-endpoint-direction {
  font-size: 10px;
  font-family: var(--scope-font-mono);
  color: var(--scope-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-top: var(--scope-space-1);
}
.scope-flow-graph-edge.handles { stroke: var(--scope-type-api); }
.scope-flow-graph-edge.calls-ext { stroke: var(--scope-type-api); stroke-dasharray: 6, 3; }
.scope-operation-node-clause.handles { color: var(--scope-type-api); }
.scope-operation-node-clause.calls-ext { color: var(--scope-type-api); opacity: 0.8; }
.scope-operation-node:hover .scope-operation-node-clause.handles { color: #000000; }
.scope-operation-node:hover .scope-operation-node-clause.calls-ext { color: #000000; }
.scope-operation-node.dragging:hover .scope-operation-node-clause.handles { color: var(--scope-type-api); }
.scope-operation-node.dragging:hover .scope-operation-node-clause.calls-ext { color: var(--scope-type-api); }


/* ===== EVENT GRAPH (interactive canvas) ===== */
.scope-event-graph {
  position: relative;
  width: 100%;
  flex: 1;
  min-height: 300px;
  overflow: hidden;
  border: 1px solid var(--scope-border);
  background: var(--scope-void);
}

.scope-event-graph-world {
  position: absolute;
  top: 0;
  left: 0;
  transform-origin: 0 0;
}

.scope-event-graph-edges {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  overflow: visible;
}

/* Event node — extends .scope-graph-node */
.scope-event-node {
  padding: var(--scope-space-3);
  min-width: 220px;
  max-width: 300px;
  --node-color: var(--scope-type-event);
  border-color: var(--node-color);
}
.scope-event-node .scope-node-type { color: var(--node-color); }

.scope-event-graph-field-count {
  font-size: var(--scope-text-xs);
  color: var(--scope-text-tertiary);
  margin-bottom: var(--scope-space-2);
}

/* Event context nodes — emitters and consumers */
.scope-event-context-node {
  padding: var(--scope-space-2) var(--scope-space-3);
  min-width: 150px;
  max-width: 240px;
}

.scope-event-operation-node { border-color: var(--scope-type-operation); }
.scope-event-operation-node .scope-node-type { color: var(--scope-type-operation); }
.scope-event-flow-node { border-color: var(--scope-type-flow); }
.scope-event-flow-node .scope-node-type { color: var(--scope-type-flow); }
.scope-event-rule-node { border-color: var(--scope-type-rule); }
.scope-event-rule-node .scope-node-type { color: var(--scope-type-rule); }
.scope-event-state-node { border-color: var(--scope-type-state); }
.scope-event-state-node .scope-node-type { color: var(--scope-type-state); }
.scope-event-state-transition-node { border-color: var(--scope-type-state); }
.scope-event-api-stream-node { border-color: var(--scope-type-api); }
.scope-event-api-stream-node .scope-node-type { color: var(--scope-type-api); }

.scope-event-stream-label {
  font-size: var(--scope-text-xs);
  word-break: break-all;
  cursor: default;
}

.scope-event-transition-label {
  font-size: var(--scope-text-sm);
  font-family: var(--scope-font-mono);
  white-space: nowrap;
}

/* Event graph edges */
.scope-event-graph-edge {
  stroke: var(--scope-text-tertiary);
  stroke-width: 1.5;
  fill: none;
}

.scope-event-graph-edge.emits {
  stroke: var(--scope-text-tertiary);
}

.scope-event-graph-edge.uses {
  stroke-dasharray: 6, 4;
  stroke: var(--scope-text-tertiary);
}

.scope-event-graph-edge.enforces {
  stroke-dasharray: 2, 3;
  stroke: var(--scope-text-tertiary);
}

.scope-event-graph-edge.trigger {
  stroke: var(--scope-text-tertiary);
}

.scope-event-graph-edge.stream {
  stroke-dasharray: 6, 4;
  stroke: var(--scope-text-tertiary);
}

.scope-event-graph-edge-label {
  font-size: 10px;
  fill: var(--scope-text-tertiary);
  font-family: var(--scope-font-mono);
}

.scope-event-graph-edge-group {
  pointer-events: stroke;
}

.scope-event-graph-edge-group:hover .scope-event-graph-edge {
  stroke: var(--scope-accent);
  stroke-width: 2;
}

/* ===== STATE GRAPH (interactive) ===== */

.scope-state-graph {
  position: relative;
  width: 100%;
  flex: 1;
  min-height: 300px;
  overflow: hidden;
  border: 1px solid var(--scope-border);
  background: var(--scope-void);
  margin-bottom: var(--scope-space-3);
}

.scope-state-graph-world {
  position: absolute;
  top: 0;
  left: 0;
  transform-origin: 0 0;
}

.scope-state-graph-edges {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  overflow: visible;
}

/* State node — extends .scope-graph-node */
.scope-state-node {
  padding: var(--scope-space-2) var(--scope-space-3);
  min-width: 120px;
  text-align: center;
  --node-color: var(--scope-type-state);
  border-color: var(--node-color);
}
.scope-state-node .scope-node-type { color: var(--node-color); }

.scope-state-node.initial {
  border-width: 2px;
  border-color: var(--node-color);
}

.scope-state-node.terminal {
  border-style: double;
  border-width: 3px;
}

/* State event node — small linked box */
.scope-state-event-node {
  padding: var(--scope-space-2) var(--scope-space-3);
  min-width: 100px;
  max-width: 220px;
  text-align: center;
  border-color: var(--scope-type-event);
}
.scope-state-event-node .scope-node-type { color: var(--scope-type-event); }

/* State event node name */
.scope-state-event-node-name a {
  font-weight: var(--scope-weight-semibold);
  font-size: var(--scope-text-sm);
  color: var(--scope-text-primary);
  text-decoration: none;
}

/* State enum node — shows enum name + values */
.scope-state-enum-node {
  padding: var(--scope-space-2) var(--scope-space-3);
  min-width: 140px;
  max-width: 260px;
  text-align: center;
  border-color: var(--scope-pending);
}

/* Meta text — type + cycle below node name */
.scope-state-node-meta {
  font-size: 10px;
  font-family: var(--scope-font-mono);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--scope-text-tertiary);
  margin-top: 2px;
}

/* Hover overrides for state graph nodes */
.scope-graph-node:hover .scope-state-node-meta { color: rgba(0,0,0,0.45); }
.scope-graph-node:hover .scope-state-event-node-name a { color: #000000; }
.scope-graph-node.dragging:hover .scope-state-node-meta { color: var(--scope-text-tertiary); }
.scope-graph-node.dragging:hover .scope-state-event-node-name a { color: var(--scope-text-primary); }

/* State graph title — positioned by JS per machine group */
.scope-state-graph-title {
  font-size: var(--scope-text-xs);
  color: var(--scope-text-tertiary);
  padding: var(--scope-space-1) var(--scope-space-2);
  position: absolute;
  z-index: 5;
  pointer-events: auto;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  white-space: nowrap;
}

/* Shared event node highlight */
.scope-state-event-node.shared {
  border-width: 2px;
  border-color: var(--scope-type-event);
  box-shadow: 0 0 8px rgba(167, 139, 250, 0.3);
}

.scope-state-graph-title a {
  color: var(--scope-text-secondary);
}

/* State name inside node */
.scope-state-node-name {
  font-weight: var(--scope-weight-semibold);
  font-size: var(--scope-text-sm);
}

/* Initial state indicator */
.scope-state-initial-marker {
  display: inline-block;
  margin-right: 4px;
  color: var(--scope-diagram-state);
}

/* State graph edges */
.scope-state-graph-edge {
  stroke: var(--scope-text-tertiary);
  stroke-width: 1.5;
  fill: none;
}

/* Edge type variants */
.scope-state-graph-edge.transition {
  stroke: var(--scope-text-tertiary);
  stroke-width: 1.5;
}

.scope-state-graph-edge.trigger {
  stroke: var(--scope-diagram-state);
  stroke-width: 1;
  stroke-dasharray: 6, 4;
  opacity: 0.7;
}

.scope-state-graph-edge.enum-value {
  stroke: var(--scope-pending);
  stroke-width: 1;
  stroke-dasharray: 3, 3;
  opacity: 0.5;
}

.scope-state-graph-edge-label {
  font-size: 10px;
  fill: var(--scope-text-tertiary);
  font-family: var(--scope-font-mono);
}

.scope-state-graph-edge-group {
  pointer-events: stroke;
}

.scope-state-graph-edge-group:hover .scope-state-graph-edge {
  stroke: var(--scope-accent);
  stroke-width: 2;
}

.scope-state-graph-edge-group:hover .scope-state-graph-edge.enum-value {
  opacity: 1;
}

/* ===== HUD OVERLAY (inside diagram container) ===== */
.scope-hud {
  position: absolute;
  bottom: var(--scope-space-3);
  left: var(--scope-space-3);
  z-index: 10;
  pointer-events: auto;
  font-family: var(--scope-font-mono);
  font-size: var(--scope-text-xs);
  background: rgba(0, 0, 0, 0.85);
  border: 1px solid var(--scope-border);
  max-width: 380px;
}

.scope-hud-status {
  display: flex;
  align-items: center;
  gap: var(--scope-space-2);
  padding: var(--scope-space-2) var(--scope-space-3);
  color: var(--scope-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 1px solid var(--scope-border);
}

.scope-hud-status strong.done { color: var(--scope-done); }
.scope-hud-status strong.wip { color: var(--scope-wip); }
.scope-hud-status strong.pending { color: var(--scope-text-secondary); }
.scope-hud-status strong.error { color: var(--scope-error); }

.scope-hud-sep {
  color: var(--scope-text-tertiary);
}

.scope-hud-components {
  display: flex;
  flex-direction: column;
}

.scope-inline-row {
  display: flex;
  align-items: center;
  gap: var(--scope-space-3);
  padding: var(--scope-space-1) var(--scope-space-3);
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  text-decoration: none;
  color: inherit;
  font-size: var(--scope-text-xs);
  font-family: var(--scope-font-mono);
  transition: background var(--scope-transition-fast);
}

.scope-inline-row:last-child {
  border-bottom: none;
}

.scope-inline-row:hover {
  background: #FFFFFF;
  color: #000000;
}

.scope-inline-name {
  color: var(--scope-accent);
  font-weight: var(--scope-weight-medium);
  min-width: 100px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.scope-inline-counts {
  color: var(--scope-text-tertiary);
  font-size: var(--scope-text-xs);
  min-width: 80px;
}

.scope-inline-bar {
  width: 60px;
  height: 3px;
  background: var(--scope-elevated);
  border: 1px solid var(--scope-border);
  overflow: hidden;
  flex-shrink: 0;
}

.scope-inline-bar .scope-progress-fill {
  height: 100%;
}

.scope-inline-pct {
  font-size: var(--scope-text-xs);
  min-width: 28px;
  text-align: right;
  color: var(--scope-text-tertiary);
}

.scope-inline-pct.done { color: var(--scope-done); }
.scope-inline-pct.wip { color: var(--scope-wip); }
.scope-inline-pct.pending { color: var(--scope-text-tertiary); }

/* ===== Screen Graph ===== */

.scope-screen-graph {
  position: relative;
  width: 100%;
  flex: 1;
  min-height: 300px;
  overflow: hidden;
  border: 1px solid var(--scope-border);
  background: var(--scope-void);
}

.scope-screen-graph-world {
  position: absolute;
  top: 0;
  left: 0;
  transform-origin: 0 0;
}

.scope-screen-graph-edges {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  overflow: visible;
}

/* Screen node (lightweight container) */
.scope-screen-node {
  background: var(--scope-surface);
  border: 1.5px solid var(--scope-type-screen);
  border-radius: var(--scope-radius);
  min-width: 150px;
  max-width: 220px;
  --node-color: var(--scope-type-screen);
}
.scope-screen-node .scope-node-type { color: var(--node-color); }

.scope-screen-node:hover {
  border-color: var(--scope-type-screen);
  box-shadow: 0 0 0 1px var(--scope-type-screen), var(--scope-shadow-md);
}

.scope-screen-layout {
  font-size: 10px;
  color: var(--scope-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 2px 6px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 3px;
  display: inline-block;
  margin-top: 4px;
}

.scope-screen-uses-count {
  font-size: 10px;
  color: var(--scope-text-tertiary);
  margin-top: 4px;
  font-style: italic;
}

.scope-screen-forms-list {
  margin-top: 4px;
  font-size: var(--scope-text-xs);
}

.scope-screen-form-item {
  padding: 2px 0;
  color: var(--scope-text-secondary);
  border-left: 2px solid var(--scope-wip);
  padding-left: 6px;
  margin-top: 2px;
}

.scope-screen-form-name {
  color: var(--scope-text-primary);
  font-weight: 500;
}

.scope-screen-form-field {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 10px;
  color: var(--scope-text-tertiary);
}

/* Element node (main building block) */
.scope-screen-element-node {
  background: var(--scope-surface);
  border: 1.5px solid var(--scope-type-element);
  border-radius: var(--scope-radius);
  min-width: 180px;
  max-width: 280px;
}
.scope-screen-element-node .scope-node-type { color: var(--scope-type-element); }

.scope-screen-element-node.scope-node-abstract {
  border-style: dashed;
  opacity: 0.85;
}

.scope-screen-element-node.scope-node-interface {
  border-style: dotted;
  border-width: 2px;
  opacity: 0.85;
}

.scope-screen-element-node:hover {
  border-color: var(--scope-type-element);
  box-shadow: 0 0 0 1px var(--scope-type-element), var(--scope-shadow-md);
}

/* Action node */
.scope-screen-action-node {
  background: var(--scope-surface);
  border: 1.5px solid var(--scope-type-action);
  border-radius: var(--scope-radius);
  min-width: 180px;
  max-width: 280px;
}
.scope-screen-action-node .scope-node-type { color: var(--scope-type-action); }

.scope-screen-action-node:hover {
  border-color: var(--scope-type-action);
  box-shadow: 0 0 0 1px var(--scope-type-action), var(--scope-shadow-md);
}

.scope-action-endpoint {
  font-size: 10px;
  color: var(--scope-text-secondary);
  font-family: var(--scope-font-mono);
  padding: 2px 0;
  margin-top: 4px;
  word-break: break-all;
}

.scope-action-results {
  margin-top: 4px;
  font-size: var(--scope-text-xs);
}

.scope-action-result {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 1px 0;
}

.scope-action-result-outcome {
  color: var(--scope-text-secondary);
}

.scope-action-result-screen {
  color: var(--scope-diagram-screen);
}

.scope-action-result-end {
  color: var(--scope-text-tertiary);
  font-style: italic;
}

/* API endpoint node */
.scope-screen-api-node {
  background: var(--scope-surface);
  border: 1.5px solid var(--scope-type-api);
  border-radius: var(--scope-radius);
  min-width: 160px;
  max-width: 260px;
}
.scope-screen-api-node .scope-node-type { color: var(--scope-type-api); }

.scope-screen-api-node:hover {
  border-color: var(--scope-type-api);
  box-shadow: 0 0 0 1px var(--scope-type-api), var(--scope-shadow-md);
}

.scope-api-method-badge {
  display: inline-block;
  font-size: 10px;
  font-weight: 600;
  font-family: var(--scope-font-mono);
  padding: 1px 6px;
  border-radius: 3px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  background: var(--scope-accent-muted);
  color: var(--scope-accent);
  border: 1px solid var(--scope-border);
}

.scope-api-method--get { color: #4caf50; background: rgba(76, 175, 80, 0.1); }
.scope-api-method--post { color: #2196f3; background: rgba(33, 150, 243, 0.1); }
.scope-api-method--put { color: #ff9800; background: rgba(255, 152, 0, 0.1); }
.scope-api-method--patch { color: #ff9800; background: rgba(255, 152, 0, 0.1); }
.scope-api-method--delete { color: #f44336; background: rgba(244, 67, 54, 0.1); }
.scope-api-method--stream { color: #9c27b0; background: rgba(156, 39, 176, 0.1); }

.scope-api-path {
  font-size: 11px;
  font-family: var(--scope-font-mono);
  color: var(--scope-text-primary);
  margin-top: 4px;
  word-break: break-all;
}

.scope-api-return {
  font-size: 10px;
  font-family: var(--scope-font-mono);
  color: var(--scope-text-tertiary);
  margin-top: 2px;
}

/* Screen graph edges */
.scope-screen-graph-edge {
  fill: none;
  stroke: var(--scope-text-tertiary);
  stroke-width: 1.2;
}

.scope-screen-graph-edge.contains {
  stroke: var(--scope-diagram-screen);
  stroke-dasharray: 8 4;
}

.scope-screen-graph-edge.action {
  stroke: var(--scope-diagram-flow);
}

.scope-screen-graph-edge.calls {
  stroke: var(--scope-accent);
}

.scope-screen-graph-edge.on-stream {
  stroke: var(--scope-wip);
  stroke-dasharray: 6 4;
}

.scope-screen-graph-edge.result {
  stroke: var(--scope-diagram-screen);
  stroke-dasharray: 4 3;
  opacity: 0.7;
}

.scope-screen-graph-edge.extends {
  stroke: var(--scope-wip);
  stroke-dasharray: 8 4;
}

.scope-screen-graph-edge.implements {
  stroke: var(--scope-diagram-flow);
  stroke-dasharray: 4 3;
}

.scope-screen-graph-edge.emits-signal {
  stroke: #A78BFA;
}

.scope-screen-graph-edge.on-signal {
  stroke: #A78BFA;
  stroke-dasharray: 6 4;
}

.scope-screen-graph-edge.returns {
  stroke: var(--scope-diagram-entity);
}

.scope-screen-graph-edge-label {
  fill: var(--scope-text-tertiary);
  font-size: 10px;
  font-family: var(--scope-font-mono);
}

/* Entity node in screen graph */
.scope-screen-entity-node {
  background: var(--scope-surface);
  border: 1.5px solid var(--scope-type-entity);
  border-radius: var(--scope-radius);
  min-width: 160px;
  max-width: 240px;
}
.scope-screen-entity-node .scope-node-type { color: var(--scope-type-entity); }

.scope-screen-entity-node.ghost {
  opacity: 0.7;
}

.scope-screen-entity-node:hover {
  border-color: var(--scope-type-entity);
  box-shadow: 0 0 0 1px var(--scope-type-entity), var(--scope-shadow-md);
}

/* Signal node in screen graph */
.scope-screen-signal-node {
  padding: var(--scope-space-2) var(--scope-space-3);
  white-space: nowrap;
  border-bottom: 3px solid var(--scope-type-signal);
}
.scope-screen-signal-node .scope-node-type { color: var(--scope-type-signal); }
.scope-screen-signal-node:hover { border-bottom-color: #FFFFFF; }
.scope-screen-signal-node.dragging:hover { border-bottom-color: var(--scope-type-signal); }

/* Action signal text */
.scope-action-signal {
  font-size: var(--scope-text-xs);
  font-family: var(--scope-font-mono);
  color: var(--scope-type-signal);
  margin-top: var(--scope-space-1);
}

/* ===== API Graph (interactive) ===== */

.scope-api-graph {
  position: relative;
  width: 100%;
  flex: 1;
  min-height: 300px;
  overflow: hidden;
  border: 1px solid var(--scope-border);
  background: var(--scope-void);
}

.scope-api-graph-world {
  position: absolute;
  top: 0;
  left: 0;
  transform-origin: 0 0;
}

.scope-api-graph-edges {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  overflow: visible;
}

/* API prefix label inside endpoint node */
.scope-api-prefix-label {
  font-size: 9px;
  font-family: var(--scope-font-mono);
  color: var(--scope-text-tertiary);
  padding: 2px 6px;
  margin: -4px -8px 4px -8px;
  background: color-mix(in srgb, var(--scope-accent) 8%, transparent);
  border-bottom: 1px solid color-mix(in srgb, var(--scope-accent) 20%, transparent);
  letter-spacing: 0.03em;
}

/* API endpoint node */
.scope-api-endpoint-node {
  background: var(--scope-surface);
  border: 1.5px solid var(--scope-type-api);
  min-width: 180px;
  max-width: 280px;
}
.scope-api-endpoint-node .scope-node-type { color: var(--scope-type-api); }

.scope-api-endpoint-node.external {
  border-style: dashed;
  opacity: 0.85;
}

.scope-api-endpoint-node:hover {
  border-color: var(--scope-type-api);
  box-shadow: 0 0 0 1px var(--scope-type-api), var(--scope-shadow-md);
}

.scope-api-auth-badge {
  display: inline-block;
  font-size: 9px;
  font-family: var(--scope-font-mono);
  padding: 0 4px;
  color: var(--scope-wip);
  border: 1px solid var(--scope-wip);
  margin-left: var(--scope-space-2);
  vertical-align: middle;
}

.scope-api-io {
  font-size: 10px;
  font-family: var(--scope-font-mono);
  color: var(--scope-text-secondary);
  margin-top: 2px;
  word-break: break-all;
}

.scope-api-io-label {
  color: var(--scope-text-tertiary);
  font-weight: var(--scope-weight-semibold);
}

/* API handler node (operation) */
.scope-api-handler-node {
  background: var(--scope-surface);
  border: 1.5px solid var(--scope-type-operation);
  min-width: 180px;
  max-width: 280px;
}
.scope-api-handler-node .scope-node-type { color: var(--scope-type-operation); }

.scope-api-handler-node:hover {
  border-color: var(--scope-type-operation);
  box-shadow: 0 0 0 1px var(--scope-type-operation), var(--scope-shadow-md);
}
.scope-api-handler-node--flow {
  border-color: var(--scope-type-flow);
}
.scope-api-handler-node--flow .scope-node-type { color: var(--scope-type-flow); }
.scope-api-handler-node--flow:hover {
  border-color: var(--scope-type-flow);
  box-shadow: 0 0 0 1px var(--scope-type-flow), var(--scope-shadow-md);
}

.scope-api-handler-sig {
  font-size: 10px;
  font-family: var(--scope-font-mono);
  color: var(--scope-text-secondary);
  margin-top: 2px;
  word-break: break-all;
}

.scope-api-direction {
  display: inline-block;
  font-size: 9px;
  font-family: var(--scope-font-mono);
  padding: 0 4px;
  margin-top: 4px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.scope-api-direction--handles {
  color: #4caf50;
  border: 1px solid #4caf50;
}

.scope-api-direction--calls {
  color: #2196f3;
  border: 1px solid #2196f3;
}

/* API consumer node (action) */
.scope-api-consumer-node {
  background: var(--scope-surface);
  border: 1.5px solid var(--scope-type-action);
  min-width: 180px;
  max-width: 280px;
}
.scope-api-consumer-node .scope-node-type { color: var(--scope-type-action); }

.scope-api-consumer-node:hover {
  border-color: var(--scope-type-action);
  box-shadow: 0 0 0 1px var(--scope-type-action), var(--scope-shadow-md);
}

/* API construct node (entity/event/enum) — default entity color */
.scope-api-construct-node {
  background: var(--scope-surface);
  border: 1.5px solid var(--scope-type-entity);
  min-width: 120px;
  max-width: 220px;
}
.scope-api-construct-node .scope-node-type { color: var(--scope-type-entity); }

.scope-api-construct-node:hover {
  border-color: var(--scope-type-entity);
  box-shadow: 0 0 0 1px var(--scope-type-entity), var(--scope-shadow-md);
}

.scope-api-construct-node--event { border-color: var(--scope-type-event); }
.scope-api-construct-node--event .scope-node-type { color: var(--scope-type-event); }
.scope-api-construct-node--event:hover { border-color: var(--scope-type-event); box-shadow: 0 0 0 1px var(--scope-type-event), var(--scope-shadow-md); }

.scope-api-construct-node--enum { border-color: var(--scope-type-enum); }
.scope-api-construct-node--enum .scope-node-type { color: var(--scope-type-enum); }
.scope-api-construct-node--enum:hover { border-color: var(--scope-type-enum); box-shadow: 0 0 0 1px var(--scope-type-enum), var(--scope-shadow-md); }

/* API graph edges */
.scope-api-graph-edge {
  fill: none;
  stroke: var(--scope-text-tertiary);
  stroke-width: 1.5;
}

.scope-api-graph-edge.handles {
  stroke: #4caf50;
}

.scope-api-graph-edge.calls {
  stroke: #2196f3;
  stroke-dasharray: 6 4;
}

.scope-api-graph-edge.calls-action {
  stroke: var(--scope-accent);
}

.scope-api-graph-edge.on-stream {
  stroke: #9c27b0;
  stroke-dasharray: 6 4;
}

.scope-api-graph-edge.input {
  stroke: var(--scope-diagram-entity);
  stroke-dasharray: 4 3;
  opacity: 0.7;
}

.scope-api-graph-edge.output {
  stroke: var(--scope-diagram-entity);
  opacity: 0.7;
}

.scope-api-graph-edge-label {
  font-size: 10px;
  fill: var(--scope-text-tertiary);
  font-family: var(--scope-font-mono);
}

.scope-api-graph-edge-group {
  pointer-events: stroke;
}

.scope-api-graph-edge-group:hover .scope-api-graph-edge {
  stroke: var(--scope-accent);
  stroke-width: 2;
}

/* ===== Journey Graph ===== */

.scope-journey-graph {
  position: relative;
  width: 100%;
  flex: 1;
  min-height: 300px;
  overflow: hidden;
  border: 1px solid var(--scope-border);
  background: var(--scope-void);
}

.scope-journey-graph-world {
  position: absolute;
  top: 0;
  left: 0;
  transform-origin: 0 0;
}

.scope-journey-graph-edges {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  overflow: visible;
}

/* Journey label inside nodes (like API prefix label) */
.scope-journey-label {
  font-size: 9px;
  font-family: var(--scope-font-mono);
  color: var(--scope-text-tertiary);
  padding: 2px 6px;
  margin: -4px -8px 4px -8px;
  background: color-mix(in srgb, var(--scope-diagram-journey) 8%, transparent);
  border-bottom: 1px solid color-mix(in srgb, var(--scope-diagram-journey) 20%, transparent);
  letter-spacing: 0.03em;
}

.scope-journey-persona {
  color: var(--scope-diagram-journey);
}

/* Journey screen node */
.scope-journey-screen-node {
  background: var(--scope-surface);
  border: 1.5px solid var(--scope-type-screen);
  min-width: 140px;
  max-width: 220px;
}
.scope-journey-screen-node .scope-node-type { color: var(--scope-type-screen); }

.scope-journey-screen-node:hover {
  border-color: var(--scope-type-screen);
  box-shadow: 0 0 0 1px var(--scope-type-screen), var(--scope-shadow-md);
}

/* Journey trigger node (event, signal, or unresolved) */
.scope-journey-trigger-node {
  background: var(--scope-surface);
  border: 1.5px solid var(--scope-type-event);
  min-width: 100px;
  max-width: 180px;
  padding: var(--scope-space-1) var(--scope-space-2) !important;
}
.scope-journey-trigger-node .scope-node-type { color: var(--scope-type-event); }

.scope-journey-trigger--event { border-color: var(--scope-type-event); }
.scope-journey-trigger--event .scope-node-type { color: var(--scope-type-event); }
.scope-journey-trigger--signal { border-color: var(--scope-type-signal); }
.scope-journey-trigger--signal .scope-node-type { color: var(--scope-type-signal); }

.scope-journey-trigger-node:hover {
  box-shadow: 0 0 0 1px currentColor, var(--scope-shadow-md);
}

.scope-journey-trigger-node.unresolved {
  border-style: dashed;
  border-color: var(--scope-text-tertiary);
  opacity: 0.75;
}

.scope-journey-trigger-name {
  font-size: var(--scope-text-xs);
  font-family: var(--scope-font-mono);
  color: var(--scope-text-secondary);
}

/* Journey special nodes (wildcard *, end) */
.scope-journey-special-node {
  background: var(--scope-surface);
  border: 1.5px solid var(--scope-text-tertiary);
  min-width: 60px;
  text-align: center;
}

.scope-journey-special--wildcard {
  border-color: var(--scope-wip);
  border-style: dashed;
}

.scope-journey-special--end {
  border-color: var(--scope-text-tertiary);
  border-radius: 20px;
}

.scope-journey-special-label {
  font-size: var(--scope-text-base);
  font-weight: var(--scope-weight-bold);
  font-family: var(--scope-font-mono);
  color: var(--scope-text-secondary);
}

.scope-journey-special--wildcard .scope-journey-special-label {
  color: var(--scope-wip);
  font-size: var(--scope-text-lg);
}

/* Journey action node */
.scope-journey-action-node {
  background: var(--scope-surface);
  border: 1.5px solid var(--scope-type-action);
  min-width: 110px;
  max-width: 200px;
  padding: var(--scope-space-1) var(--scope-space-2) !important;
}
.scope-journey-action-node .scope-node-type { color: var(--scope-type-action); }

.scope-journey-action-node:hover {
  border-color: var(--scope-type-action);
  box-shadow: 0 0 0 1px var(--scope-type-action), var(--scope-shadow-md);
}

.scope-journey-action-type {
  font-size: 9px;
  font-family: var(--scope-font-mono);
  padding: 1px 5px;
  border: 1px solid var(--scope-border);
  display: inline-block;
  margin-top: 2px;
  letter-spacing: 0.03em;
  text-transform: uppercase;
}

.scope-journey-action-type--pure {
  color: var(--scope-text-tertiary);
  border-color: var(--scope-text-tertiary);
}

.scope-journey-action-type--imperative {
  color: var(--scope-diagram-screen);
  border-color: var(--scope-diagram-screen);
}

.scope-journey-action-type--reactive {
  color: var(--scope-diagram-journey);
  border-color: var(--scope-diagram-journey);
}

.scope-journey-action-endpoint {
  font-size: 9px;
  font-family: var(--scope-font-mono);
  color: var(--scope-text-tertiary);
  margin-top: 2px;
  word-break: break-all;
}

/* Journey edges */
.scope-journey-graph-edge {
  fill: none;
  stroke-width: 1.5;
}

.scope-journey-graph-edge.step {
  stroke: var(--scope-diagram-journey);
}

.scope-journey-graph-edge.wildcard {
  stroke: var(--scope-wip);
  stroke-dasharray: 6 3;
}

.scope-journey-graph-edge.terminal {
  stroke: var(--scope-text-tertiary);
  stroke-dasharray: 4 2;
}

.scope-journey-graph-edge.action-from {
  stroke: var(--scope-diagram-screen);
  stroke-dasharray: 5 3;
  stroke-width: 1;
}

.scope-journey-graph-edge.action-to {
  stroke: var(--scope-diagram-screen);
  stroke-width: 1;
}

.scope-journey-graph-edge-group {
  pointer-events: stroke;
}

.scope-journey-graph-edge-group:hover .scope-journey-graph-edge {
  stroke-width: 2.5;
}

/* ===== Overview Graph (Interactive BaseGraph) ===== */

.scope-overview-graph {
  position: relative;
  width: 100%;
  flex: 1;
  min-height: 400px;
  overflow: hidden;
  border: 1px solid var(--scope-border);
  background: var(--scope-void);
}

.scope-overview-graph-world {
  position: absolute;
  top: 0;
  left: 0;
  transform-origin: 0 0;
}

.scope-overview-graph-edges {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  overflow: visible;
}

/* Overview node — minimal, monochrome */
.scope-overview-node {
  min-width: 120px;
  max-width: 240px;
  background: var(--scope-surface);
  border: 1.5px solid var(--scope-border);
}

.scope-overview-node:hover {
  background: var(--scope-text-primary);
  color: var(--scope-text-inverse);
  border-color: var(--scope-text-primary);
}

.scope-overview-node:hover .scope-construct-link,
.scope-overview-node:hover .scope-node-type,
.scope-overview-node:hover .scope-node-inheritance {
  color: var(--scope-text-inverse);
}

/* Overview node — per-type colors */
.scope-overview-node--screen { border-color: var(--scope-type-screen); }
.scope-overview-node--screen .scope-node-type { color: var(--scope-type-screen); }

.scope-overview-node--flow { border-color: var(--scope-type-flow); }
.scope-overview-node--flow .scope-node-type { color: var(--scope-type-flow); }

.scope-overview-node--state { border-color: var(--scope-type-state); }
.scope-overview-node--state .scope-node-type { color: var(--scope-type-state); }

.scope-overview-node--api { border-color: var(--scope-type-api); }
.scope-overview-node--api .scope-node-type { color: var(--scope-type-api); }

.scope-overview-node--entity { border-color: var(--scope-type-entity); }
.scope-overview-node--entity .scope-node-type { color: var(--scope-type-entity); }

.scope-overview-node--event { border-color: var(--scope-type-event); }
.scope-overview-node--event .scope-node-type { color: var(--scope-type-event); }

.scope-overview-node--signal { border-color: var(--scope-type-signal); }
.scope-overview-node--signal .scope-node-type { color: var(--scope-type-signal); }

.scope-overview-node--operation { border-color: var(--scope-type-operation); }
.scope-overview-node--operation .scope-node-type { color: var(--scope-type-operation); }

.scope-overview-node--rule { border-color: var(--scope-type-rule); }
.scope-overview-node--rule .scope-node-type { color: var(--scope-type-rule); }

.scope-overview-node--journey { border-color: var(--scope-type-journey); }
.scope-overview-node--journey .scope-node-type { color: var(--scope-type-journey); }

.scope-overview-node--enum { border-color: var(--scope-type-enum); }
.scope-overview-node--enum .scope-node-type { color: var(--scope-type-enum); }

.scope-overview-node--element { border-color: var(--scope-type-element); }
.scope-overview-node--element .scope-node-type { color: var(--scope-type-element); }

.scope-overview-node--action { border-color: var(--scope-type-action); }
.scope-overview-node--action .scope-node-type { color: var(--scope-type-action); }

/* Overview edges — monochrome, low opacity */
.scope-overview-graph-edge {
  fill: none;
  stroke: var(--scope-text-tertiary);
  stroke-width: 1;
  opacity: 0.4;
}

.scope-overview-graph-edge.governance {
  stroke-dasharray: 8 4;
}

.scope-overview-graph-edge.composition {
  stroke-dasharray: 3 3;
}

.scope-overview-graph-edge.interaction {
  opacity: 0.6;
}

.scope-overview-graph-edge.extends {
  stroke-dasharray: 6 3;
}

.scope-overview-graph-edge.implements {
  stroke-dasharray: 2 2;
}

.scope-overview-graph-edge-group {
  pointer-events: stroke;
}

.scope-overview-graph-edge-group:hover .scope-overview-graph-edge {
  stroke-width: 2;
  opacity: 0.8;
}

.scope-overview-graph-edge-label {
  font-size: 9px;
  font-family: var(--scope-font-mono);
  fill: var(--scope-text-tertiary);
  opacity: 0.5;
  pointer-events: none;
}

.scope-overview-graph-edge-group:hover .scope-overview-graph-edge-label {
  opacity: 1;
}

/* Category labels */
.scope-overview-category-label {
  position: absolute;
  font-size: 10px;
  font-family: var(--scope-font-mono);
  color: var(--scope-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  opacity: 0.5;
  pointer-events: none;
}

/* ===== Timeline ===== */

.timeline-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 0;
}

.timeline-header {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--scope-border);
  flex-shrink: 0;
}

.timeline-header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.timeline-title {
  font-size: 13px;
  font-family: var(--scope-font-mono);
  font-weight: 700;
  color: var(--scope-text-primary);
  letter-spacing: 0.1em;
  margin: 0;
}

.timeline-summary {
  font-size: 11px;
  font-family: var(--scope-font-mono);
  color: var(--scope-text-tertiary);
}

/* SVG Canvas */
.timeline-canvas-view {
  flex: 1;
  overflow: hidden;
  position: relative;
}

.timeline-canvas-container {
  width: 100%;
  height: 100%;
  overflow: hidden;
  cursor: grab;
  position: relative;
}

.timeline-canvas-container.panning {
  cursor: grabbing;
}

.timeline-canvas-container svg {
  transform-origin: 0 0;
}

.timeline-canvas-container svg text {
  font-family: var(--scope-font-mono);
  fill: var(--scope-text-secondary);
}

.timeline-canvas-container svg .timeline-svg-date {
  fill: var(--scope-text-tertiary);
}

.timeline-canvas-container svg .timeline-node {
  cursor: pointer;
}

.timeline-canvas-container svg .timeline-node:hover circle {
  fill: var(--scope-accent);
}

.timeline-canvas-container svg .timeline-node:hover text {
  fill: var(--scope-text-primary);
}

/* Detail Modal */
.timeline-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.timeline-modal {
  background: var(--scope-bg);
  border: 1px solid var(--scope-border);
  max-width: 520px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
  padding: 16px;
  position: relative;
  font-family: var(--scope-font-mono);
}

.timeline-modal-close {
  position: absolute;
  top: 8px;
  right: 10px;
  background: transparent;
  border: none;
  color: var(--scope-text-tertiary);
  font-size: 18px;
  cursor: pointer;
  padding: 2px 6px;
  line-height: 1;
}

.timeline-modal-close:hover {
  color: var(--scope-text-primary);
}

.timeline-modal-header {
  margin-bottom: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--scope-border);
}

.timeline-modal-hash {
  font-size: 12px;
  color: #FBBF24;
  font-weight: 700;
}

.timeline-modal-author {
  font-size: 11px;
  color: var(--scope-text-tertiary);
  margin-left: 8px;
}

.timeline-modal-date {
  font-size: 11px;
  color: var(--scope-text-tertiary);
  margin-left: 8px;
}

.timeline-modal-message {
  font-size: 12px;
  color: var(--scope-text-secondary);
  margin-bottom: 10px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--scope-border);
  white-space: pre-wrap;
  word-break: break-word;
}

.timeline-modal-stats {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
  flex-wrap: wrap;
}

.timeline-modal-stat {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 2px;
  font-family: var(--scope-font-mono);
}

.timeline-modal-stat.added { color: #34D399; border: 1px solid #34D39966; }
.timeline-modal-stat.removed { color: #F87171; border: 1px solid #F8717166; }
.timeline-modal-stat.modified { color: #FB923C; border: 1px solid #FB923C66; }
.timeline-modal-stat.impl-added { color: #A78BFA; border: 1px solid #A78BFA66; }
.timeline-modal-stat.impl-removed { color: #F472B6; border: 1px solid #F472B666; }

.timeline-modal-events {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 300px;
  overflow-y: auto;
}

.timeline-modal-events-title {
  font-size: 10px;
  color: var(--scope-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: 4px;
}

.timeline-subevent {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 4px 8px;
  border-left: 3px solid var(--scope-border);
  font-size: 11px;
}

.timeline-subevent.construct_added { border-left-color: #34D399; }
.timeline-subevent.construct_removed { border-left-color: #F87171; }
.timeline-subevent.construct_modified { border-left-color: #FB923C; }
.timeline-subevent.impl_added { border-left-color: #A78BFA; }
.timeline-subevent.impl_removed { border-left-color: #F472B6; }
.timeline-subevent.impl_changed { border-left-color: #818CF8; }

.timeline-subevent-type {
  color: var(--scope-text-tertiary);
  font-size: 9px;
  min-width: 70px;
  text-transform: uppercase;
}

.timeline-subevent-name {
  color: var(--scope-text-secondary);
}

.timeline-subevent-detail {
  color: var(--scope-text-tertiary);
  font-size: 10px;
}

.timeline-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  font-family: var(--scope-font-mono);
  font-size: 12px;
  color: var(--scope-text-tertiary);
}
`;
}
//# sourceMappingURL=styles.js.map