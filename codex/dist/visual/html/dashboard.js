/**
 * Dashboard page — CLI-style single-screen overview
 * Compact grid: summary stats, per-component bars, construct heatmap
 */
function escapeHtml(str) {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}
/** ASCII bar: ████████░░░░░░░░ */
function asciiBar(pct, width = 20) {
    const filled = Math.round((pct / 100) * width);
    const empty = width - filled;
    return "█".repeat(filled) + "░".repeat(empty);
}
export function renderDashboard(snapshot) {
    const { stats, model } = snapshot;
    const { completeness, componentCompleteness } = stats;
    // Sort components by impl progress descending
    const comps = [...componentCompleteness].sort((a, b) => {
        const aR = a.implTotal > 0 ? a.implDone / a.implTotal : 0;
        const bR = b.implTotal > 0 ? b.implDone / b.implTotal : 0;
        return bR - aR;
    });
    // --- Summary line ---
    const totalConstructs = completeness.total;
    const implDone = completeness.withImpl;
    const testsDone = completeness.withTests;
    const verifiedDone = completeness.withVerified;
    const implPct = completeness.implPct;
    const testsPct = completeness.testsPct;
    const verifiedPct = completeness.verifiedPct;
    // --- Component rows with ASCII bars ---
    const compRows = comps.map((comp) => {
        const iPct = comp.implTotal > 0 ? Math.round((comp.implDone / comp.implTotal) * 100) : 0;
        const tPct = comp.testsTotal > 0 ? Math.round((comp.testsDone / comp.testsTotal) * 100) : 0;
        const name = escapeHtml(comp.name).padEnd(14).slice(0, 14);
        const status = (comp.status ?? "---").padEnd(6).slice(0, 6);
        // Count constructs by type
        const typeCounts = {};
        for (const c of comp.constructs) {
            typeCounts[c.type] = (typeCounts[c.type] || 0) + 1;
        }
        const total = comp.constructs.length;
        return `<a href="/component/${encodeURIComponent(comp.name)}" class="dash-row">
      <span class="dash-name">${name}</span>
      <span class="dash-status">${escapeHtml(status)}</span>
      <span class="dash-bar">${asciiBar(iPct, 16)}</span>
      <span class="dash-pct">${String(iPct).padStart(3)}%</span>
      <span class="dash-sep">│</span>
      <span class="dash-bar">${asciiBar(tPct, 10)}</span>
      <span class="dash-pct">${String(tPct).padStart(3)}%</span>
      <span class="dash-sep">│</span>
      <span class="dash-count">${String(total).padStart(2)} constructs</span>
    </a>`;
    }).join("\n");
    // --- Heatmap: compact grid of construct types per component ---
    const types = ["Entity", "Flow", "Rule", "State", "Event", "Signal", "Api", "Screen", "Journey", "Operation"];
    const activeTypes = types.filter(t => {
        return comps.some(comp => comp.constructs.some(c => c.type === t));
    });
    const heatHeader = `<span class="heat-name">             </span>` +
        activeTypes.map(t => `<span class="heat-th">${t.slice(0, 5).padStart(5)}</span>`).join("");
    const heatRows = comps.map(comp => {
        const name = escapeHtml(comp.name).padEnd(13).slice(0, 13);
        const cells = activeTypes.map(t => {
            const matching = comp.constructs.filter(c => c.type === t);
            if (matching.length === 0)
                return `<span class="heat-cell heat-na">  ·  </span>`;
            const done = matching.filter(c => c.impl.length > 0).length;
            const total = matching.length;
            const cls = done === total ? "heat-done" : done > 0 ? "heat-wip" : "heat-pending";
            return `<span class="heat-cell ${cls}">${String(done).padStart(2)}/${total} </span>`;
        }).join("");
        return `<div class="heat-row"><span class="heat-name">${name}</span>${cells}</div>`;
    }).join("\n");
    // --- Construct type summary ---
    const typeSummary = activeTypes.map(t => {
        const all = comps.flatMap(c => c.constructs.filter(x => x.type === t));
        const done = all.filter(c => c.impl.length > 0).length;
        return `<span class="type-chip">${t.slice(0, 5)}:${done}/${all.length}</span>`;
    }).join(" ");
    // --- Deployment topology (only if nodes declared) ---
    const getNodeName = (comp) => {
        const deco = comp.decorators?.find((d) => d.name === "node");
        return deco?.params[0] ? String(deco.params[0].value) : null;
    };
    const topologySection = model.nodes.length > 0 ? (() => {
        const rows = model.nodes.map((node) => {
            const nodeComps = model.components.filter((c) => getNodeName(c) === node.name);
            const compList = nodeComps.length > 0 ? nodeComps.map((c) => escapeHtml(c.name)).join(", ") : "—";
            return `<div class="topo-row"><span class="topo-node">⬡ ${escapeHtml(node.name)}</span><span class="topo-comps">${compList}</span></div>`;
        });
        const unassigned = model.components.filter((c) => !getNodeName(c));
        if (unassigned.length > 0) {
            rows.push(`<div class="topo-row"><span class="topo-node" style="opacity:0.5">⬡ (unassigned)</span><span class="topo-comps">${unassigned.map((c) => escapeHtml(c.name)).join(", ")}</span></div>`);
        }
        return `
  <div class="dash-section-line">── DEPLOYMENT ${"─".repeat(60)}</div>
  <div class="dash-topology">
    ${rows.join("\n    ")}
  </div>`;
    })() : "";
    return `
<div class="dash-cli">
  <div class="dash-header">
    <span class="dash-title">PROGRESS</span>
    <span class="dash-summary">${totalConstructs} constructs │ impl ${implDone}/${totalConstructs} (${implPct}%) │ tests ${testsDone}/${totalConstructs} (${testsPct}%) │ verified ${verifiedDone}/${implDone} (${verifiedPct}%)</span>
  </div>

  <div class="dash-global-bars">
    <div class="dash-global-row">
      <span class="dash-global-label">impl </span>
      <span class="dash-bar">${asciiBar(implPct, 30)}</span>
      <span class="dash-pct"> ${implPct}%</span>
    </div>
    <div class="dash-global-row">
      <span class="dash-global-label">tests</span>
      <span class="dash-bar">${asciiBar(testsPct, 30)}</span>
      <span class="dash-pct"> ${testsPct}%</span>
    </div>
    <div class="dash-global-row">
      <span class="dash-global-label">veri </span>
      <span class="dash-bar">${asciiBar(verifiedPct, 30)}</span>
      <span class="dash-pct"> ${verifiedPct}%</span>
    </div>
  </div>

  <div class="dash-section-line">── COMPONENTS ${"─".repeat(60)}</div>

  <div class="dash-comp-header">
    <span class="dash-name">name          </span>
    <span class="dash-status">status</span>
    <span class="dash-bar-label">impl             </span>
    <span class="dash-pct">   </span>
    <span class="dash-sep">│</span>
    <span class="dash-bar-label">tests      </span>
    <span class="dash-pct">   </span>
    <span class="dash-sep">│</span>
    <span class="dash-count">           </span>
  </div>
  <div class="dash-comp-list">
    ${compRows}
  </div>

  <div class="dash-section-line">── HEATMAP ${"─".repeat(63)}</div>

  <div class="dash-heatmap">
    <div class="heat-header">${heatHeader}</div>
    ${heatRows}
  </div>

  <div class="dash-section-line">── TYPES ${"─".repeat(65)}</div>

  <div class="dash-types">
    ${typeSummary}
  </div>
  ${topologySection}
</div>`;
}
//# sourceMappingURL=dashboard.js.map