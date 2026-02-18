/**
 * Layout shell: Scope Bar + Dynamic Nav Rail + Canvas + external deps
 * Nav rail shows components from the model, not fixed diagram types.
 */
import { getStyles } from "./styles.js";
import { escapeHtml, componentLink } from "./shared.js";
const RETICLE_LOGO = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
  <circle cx="12" cy="12" r="9"/>
  <line x1="12" y1="3" x2="12" y2="7"/>
  <line x1="12" y1="17" x2="12" y2="21"/>
  <line x1="3" y1="12" x2="7" y2="12"/>
  <line x1="17" y1="12" x2="21" y2="12"/>
  <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none"/>
</svg>`;
const NAV_ICONS = {
    system: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="7" height="7" rx="1"/><rect x="11" y="2" width="7" height="7" rx="1"/><rect x="2" y="11" width="7" height="7" rx="1"/><rect x="11" y="11" width="7" height="7" rx="1"/></svg>`,
    dashboard: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="10" width="4" height="8" rx="1"/><rect x="8" y="5" width="4" height="13" rx="1"/><rect x="14" y="2" width="4" height="16" rx="1"/></svg>`,
    timeline: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="2" y1="10" x2="18" y2="10"/><circle cx="5" cy="10" r="2.5" fill="currentColor" stroke="none"/><circle cx="10" cy="10" r="2" fill="currentColor" stroke="none"/><circle cx="15" cy="10" r="1.5" fill="currentColor" stroke="none"/></svg>`,
};
const THEME_ICONS = {
    dark: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="10" cy="10" r="4"/><line x1="10" y1="2" x2="10" y2="4"/><line x1="10" y1="16" x2="10" y2="18"/><line x1="2" y1="10" x2="4" y2="10"/><line x1="16" y1="10" x2="18" y2="10"/></svg>`,
    light: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 10a6 6 0 11-6-6 4.5 4.5 0 006 6z"/></svg>`,
};
const STATUS_COLORS = {
    active: "var(--scope-done)",
    done: "var(--scope-done)",
    draft: "var(--scope-wip)",
    planned: "var(--scope-pending)",
};
function getNavLevel(options) {
    if (options.constructContext)
        return "construct";
    if (options.activePage === "component" && options.componentTabs?.length)
        return "component";
    return "system";
}
function renderFrameNav(options) {
    const level = getNavLevel(options);
    if (level === "component") {
        const tabs = options.componentTabs ?? [];
        const activeTab = options.activeTab ?? tabs[0]?.id ?? "overview";
        const compName = options.activeComponent ?? "";
        const backTab = `<a href="/components" class="scope-frame-tab" data-nav="back"><span class="scope-frame-tab-key">esc</span> back</a>`;
        const tabItems = tabs.map((tab, i) => {
            const isActive = tab.id === activeTab ? " active" : "";
            const num = i + 1;
            return `<a href="/component/${encodeURIComponent(compName)}?tab=${tab.id}" class="scope-frame-tab${isActive}" data-tab="${tab.id}" data-nav="tab-${tab.id}" onclick="event.preventDefault(); switchTab('${tab.id}')"><span class="scope-frame-tab-key">${num <= 9 ? num : ""}</span> ${escapeHtml(tab.label)} <span class="scope-frame-tab-count">${tab.count}</span></a>`;
        }).join("\n");
        const searchTab = `<span class="scope-frame-tab" data-nav="search" id="frame-search-btn"><span class="scope-frame-tab-key">/</span> search</span>`;
        const filterTab = `<span class="scope-frame-tab" data-nav="filter" id="frame-filter-btn"><span class="scope-frame-tab-key">.</span> filter</span>`;
        const helpTab = `<span class="scope-frame-tab" data-nav="shortcuts" id="frame-help-btn"><span class="scope-frame-tab-key">?</span> help</span>`;
        return `<nav class="scope-frame-nav" id="frame-nav" data-level="component" data-component="${escapeHtml(compName)}">
      ${backTab}
      ${tabItems}
      ${searchTab}
      ${filterTab}
      ${helpTab}
    </nav>`;
    }
    if (level === "construct") {
        const ctx = options.constructContext;
        const compName = ctx.component;
        const backTab = `<a href="/component/${encodeURIComponent(compName)}" class="scope-frame-tab" data-nav="back"><span class="scope-frame-tab-key">esc</span> back</a>`;
        const contextLabel = `<span class="scope-frame-tab active" style="pointer-events:none"><span style="opacity:0.5">${escapeHtml(ctx.type)}:</span>${escapeHtml(ctx.name)}</span>`;
        const searchTab = `<span class="scope-frame-tab" data-nav="search" id="frame-search-btn"><span class="scope-frame-tab-key">/</span> search</span>`;
        const helpTab = `<span class="scope-frame-tab" data-nav="shortcuts" id="frame-help-btn"><span class="scope-frame-tab-key">?</span> help</span>`;
        return `<nav class="scope-frame-nav" id="frame-nav" data-level="construct" data-component="${escapeHtml(compName)}">
      ${backTab}
      ${contextLabel}
      ${searchTab}
      ${helpTab}
    </nav>`;
    }
    // System level (default)
    const { activePage } = options;
    return `<nav class="scope-frame-nav" id="frame-nav" data-level="system">
      <a href="/" class="scope-frame-tab${activePage === "system" ? " active" : ""}" data-nav="system"><span class="scope-frame-tab-key">1</span> system</a>
      <a href="/components" class="scope-frame-tab${activePage === "components" ? " active" : ""}" data-nav="components"><span class="scope-frame-tab-key">2</span> components</a>
      <a href="/dashboard" class="scope-frame-tab${activePage === "dashboard" ? " active" : ""}" data-nav="dashboard"><span class="scope-frame-tab-key">3</span> dashboard</a>
      <a href="/timeline" class="scope-frame-tab${activePage === "timeline" ? " active" : ""}" data-nav="timeline"><span class="scope-frame-tab-key">4</span> timeline</a>
      <span class="scope-frame-tab" data-nav="search" id="frame-search-btn"><span class="scope-frame-tab-key">/</span> search</span>
      <span class="scope-frame-tab" data-nav="shortcuts" id="frame-help-btn"><span class="scope-frame-tab-key">?</span> help</span>
    </nav>`;
}
function renderShortcutsPanel(options) {
    const level = getNavLevel(options);
    const common = `
      <div class="scope-shortcut-row"><span>Command Palette</span><span class="scope-shortcut-key">/</span></div>
      <div class="scope-shortcut-row"><span>Fullscreen Diagram</span><span class="scope-shortcut-key">F</span></div>
      <div class="scope-shortcut-row"><span>Navigate Items Down</span><span class="scope-shortcut-key">j</span></div>
      <div class="scope-shortcut-row"><span>Navigate Items Up</span><span class="scope-shortcut-key">k</span></div>
      <div class="scope-shortcut-row"><span>Open Focused Item</span><span class="scope-shortcut-key">Enter</span></div>
      <div class="scope-shortcut-row"><span>Show Shortcuts</span><span class="scope-shortcut-key">?</span></div>`;
    if (level === "component") {
        return `<div class="scope-shortcuts-panel" id="shortcuts-panel">
    <div class="scope-shortcuts-content">
      <h3>Keyboard Shortcuts</h3>
      <div class="scope-shortcut-row"><span>Back to Components</span><span class="scope-shortcut-key">Esc</span></div>
      <div class="scope-shortcut-row"><span>Filter Node Types</span><span class="scope-shortcut-key">.</span></div>
      <div class="scope-shortcut-row"><span>Switch Tab (1-9)</span><span class="scope-shortcut-key">1-9</span></div>
      <div class="scope-shortcut-row"><span>Cycle Tabs</span><span class="scope-shortcut-key">Tab</span></div>
      ${common}
    </div>
  </div>`;
    }
    if (level === "construct") {
        return `<div class="scope-shortcuts-panel" id="shortcuts-panel">
    <div class="scope-shortcuts-content">
      <h3>Keyboard Shortcuts</h3>
      <div class="scope-shortcut-row"><span>Back to Component</span><span class="scope-shortcut-key">Esc</span></div>
      ${common}
    </div>
  </div>`;
    }
    // System
    return `<div class="scope-shortcuts-panel" id="shortcuts-panel">
    <div class="scope-shortcuts-content">
      <h3>Keyboard Shortcuts</h3>
      <div class="scope-shortcut-row"><span>System Info</span><span class="scope-shortcut-key">1</span></div>
      <div class="scope-shortcut-row"><span>Components</span><span class="scope-shortcut-key">2</span></div>
      <div class="scope-shortcut-row"><span>Progress Dashboard</span><span class="scope-shortcut-key">3</span></div>
      <div class="scope-shortcut-row"><span>Timeline</span><span class="scope-shortcut-key">4</span></div>
      <div class="scope-shortcut-row"><span>Cycle Tabs</span><span class="scope-shortcut-key">Tab</span></div>
      <div class="scope-shortcut-row"><span>Go Up / Close</span><span class="scope-shortcut-key">Esc</span></div>
      ${common}
    </div>
  </div>`;
}
function renderNodeFilterPanel() {
    return `<div class="scope-node-filter-panel" id="node-filter-panel">
    <div class="scope-node-filter-content">
      <h3>Node Filter</h3>
      <div class="scope-node-filter-list" id="node-filter-list"></div>
    </div>
  </div>`;
}
export function renderLayout(content, options) {
    const { systemName, systemVersion, activePage, activeComponent, breadcrumbs, title, components } = options;
    // Build dynamic nav rail
    const railItems = [];
    // System overview
    const systemActive = (activePage === "system" || activePage === "components") ? " active" : "";
    railItems.push(`<a href="/" class="scope-rail-item${systemActive}" data-tooltip="System" data-nav="system">
    <span class="scope-rail-icon">${NAV_ICONS.system}</span>
  </a>`);
    railItems.push(`<div class="scope-rail-separator"></div>`);
    // Dynamic component items
    if (components?.length) {
        const maxVisible = 10;
        const visibleComponents = components.slice(0, maxVisible);
        for (const comp of visibleComponents) {
            const isActive = activeComponent === comp.name ? " active" : "";
            const statusColor = comp.status ? (STATUS_COLORS[comp.status] ?? "var(--scope-pending)") : "var(--scope-text-tertiary)";
            const firstLetter = comp.name.charAt(0).toUpperCase();
            railItems.push(`<a href="${componentLink(comp.name)}" class="scope-rail-item scope-rail-component${isActive}" data-tooltip="${escapeHtml(comp.name)}" data-nav="component-${escapeHtml(comp.name)}" style="--status-color: ${statusColor}">
        <span class="scope-rail-letter">${firstLetter}</span>
      </a>`);
        }
        if (components.length > maxVisible) {
            railItems.push(`<a href="/components" class="scope-rail-item scope-rail-more" data-tooltip="${components.length - maxVisible} more...">
        <span class="scope-rail-letter">+${components.length - maxVisible}</span>
      </a>`);
        }
        railItems.push(`<div class="scope-rail-separator"></div>`);
    }
    // Progress dashboard
    const dashboardActive = activePage === "dashboard" ? " active" : "";
    railItems.push(`<a href="/dashboard" class="scope-rail-item${dashboardActive}" data-tooltip="Progress" data-nav="dashboard">
    <span class="scope-rail-icon">${NAV_ICONS.dashboard}</span>
  </a>`);
    // Timeline
    const timelineActive = activePage === "timeline" ? " active" : "";
    railItems.push(`<a href="/timeline" class="scope-rail-item${timelineActive}" data-tooltip="Timeline" data-nav="timeline">
    <span class="scope-rail-icon">${NAV_ICONS.timeline}</span>
  </a>`);
    const railHtml = railItems.join("\n");
    const versionLabel = systemVersion ? ` v${systemVersion}` : "";
    // Multi-level breadcrumbs
    let breadcrumbHtml = "";
    if (breadcrumbs?.length) {
        const crumbs = breadcrumbs.map((b, i) => {
            const isLast = i === breadcrumbs.length - 1;
            if (isLast || !b.href) {
                return `<span>${escapeHtml(b.label)}</span>`;
            }
            return `<a href="${b.href}">${escapeHtml(b.label)}</a>`;
        }).join(`<span class="separator">&gt;</span>`);
        breadcrumbHtml = `<div class="scope-bar-breadcrumb">${crumbs}</div>`;
    }
    // Build components data for JS command palette
    const componentsJson = JSON.stringify((components ?? []).map((c) => ({ name: c.name, status: c.status })));
    return `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title ? escapeHtml(title) + " — " : ""}${escapeHtml(systemName)}</title>
  <style>${getStyles()}</style>
</head>
<body>
  <!-- TUI Frame -->
  <div class="scope-frame">
    <span class="scope-frame-label">${escapeHtml(systemName)}${escapeHtml(versionLabel)}</span>
    ${renderFrameNav(options)}
  </div>

  <!-- Error Banner -->
  <div class="scope-error-banner" id="error-banner"></div>

  <!-- Main Canvas -->
  <main class="scope-canvas" id="canvas">
    ${content}
  </main>

  <!-- Toast Container -->
  <div class="scope-toast-container" id="toast-container"></div>

  <!-- Command Palette -->
  <div class="scope-command-palette-overlay" id="command-palette">
    <div class="scope-command-palette">
      <input class="scope-command-input" id="command-input" placeholder="Search constructs... (type: or component: to filter)" autocomplete="off">
      <div class="scope-command-results" id="command-results"></div>
    </div>
  </div>

  <!-- Shortcuts Panel -->
  ${renderShortcutsPanel(options)}
  <!-- Node Filter Panel -->
  ${renderNodeFilterPanel()}

  <!-- Inline model components data for command palette -->
  <script type="application/json" id="model-components-data">${componentsJson}</script>

  <!-- Mermaid CDN -->
  <script type="module">
    import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';
    window.mermaid = mermaid;
    mermaid.initialize({
      startOnLoad: false,
      theme: 'base',
      themeVariables: {
        darkMode: true,
        background: '#000000',
        primaryColor: '#000000',
        primaryBorderColor: '#FFFFFF',
        primaryTextColor: '#FFFFFF',
        secondaryColor: '#000000',
        secondaryBorderColor: '#FFFFFF',
        secondaryTextColor: '#FFFFFF',
        tertiaryColor: '#000000',
        lineColor: '#FFFFFF',
        textColor: '#FFFFFF',
        mainBkg: '#000000',
        nodeBorder: '#FFFFFF',
        clusterBkg: '#000000',
        clusterBorder: '#FFFFFF',
        titleColor: '#FFFFFF',
        edgeLabelBackground: '#000000',
        fontFamily: "monospace",
        fontSize: '13px',
      },
      flowchart: { curve: 'basis', htmlLabels: true, useMaxWidth: false },
      er: { useMaxWidth: false },
      sequence: { useMaxWidth: false },
      stateDiagram: { useMaxWidth: false }
    });
    window.dispatchEvent(new Event('mermaid-ready'));
  </script>
  <script src="/static/app.js" type="module"></script>
</body>
</html>`;
}
//# sourceMappingURL=layout.js.map