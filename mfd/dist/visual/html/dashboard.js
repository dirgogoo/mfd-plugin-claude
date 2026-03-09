/**
 * Dashboard page — CLI-style single-screen overview for v2
 * Compact grid: summary stats, per-domain bars, construct heatmap
 */
import { domainLink, V2_TYPE_COLORS } from "./shared.js";
function escapeHtml(str) {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}
/** ASCII bar */
function asciiBar(pct, width = 20) {
    const filled = Math.round((pct / 100) * width);
    const empty = width - filled;
    return "\u2588".repeat(filled) + "\u2591".repeat(empty);
}
export function renderDashboard(snapshot) {
    const { stats } = snapshot;
    const { completeness, domainCompleteness } = stats;
    // Sort domains by impl progress descending
    const domains = [...domainCompleteness].sort((a, b) => {
        const aR = a.implTotal > 0 ? a.implDone / a.implTotal : 0;
        const bR = b.implTotal > 0 ? b.implDone / b.implTotal : 0;
        return bR - aR;
    });
    // --- Summary line ---
    const totalConstructs = completeness.total;
    const implDone = completeness.withImpl;
    const verifiedDone = completeness.withVerified;
    const implPct = completeness.implPct;
    const verifiedPct = completeness.verifiedPct;
    // --- Domain rows with ASCII bars ---
    const domainRows = domains.map((domain) => {
        const iPct = domain.implTotal > 0 ? Math.round((domain.implDone / domain.implTotal) * 100) : 0;
        const vPct = domain.verifiedTotal > 0 ? Math.round((domain.verifiedDone / domain.verifiedTotal) * 100) : 0;
        const name = escapeHtml(domain.name).padEnd(14).slice(0, 14);
        // Count constructs by type
        const typeCounts = {};
        for (const c of domain.constructs) {
            typeCounts[c.type] = (typeCounts[c.type] || 0) + 1;
        }
        const total = domain.constructs.length;
        return `<a href="${domainLink(domain.name)}" class="dash-row">
      <span class="dash-name">${name}</span>
      <span class="dash-bar">${asciiBar(iPct, 16)}</span>
      <span class="dash-pct">${String(iPct).padStart(3)}%</span>
      <span class="dash-sep">|</span>
      <span class="dash-bar">${asciiBar(vPct, 10)}</span>
      <span class="dash-pct">${String(vPct).padStart(3)}%</span>
      <span class="dash-sep">|</span>
      <span class="dash-count">${String(total).padStart(2)} constructs</span>
    </a>`;
    }).join("\n");
    // --- Heatmap: compact grid of construct types per domain ---
    const types = ["Concept", "Capab", "Invar", "Prop", "Obj", "Enum"];
    const typeKeys = ["concept", "capability", "invariant", "property", "objective", "enum"];
    const activeTypeIndices = typeKeys
        .map((tk, idx) => ({ tk, idx }))
        .filter(({ tk }) => domains.some(d => d.constructs.some(c => c.type === tk)));
    const activeTypes = activeTypeIndices.map(({ idx }) => types[idx]);
    const activeTypeKeys = activeTypeIndices.map(({ tk }) => tk);
    const heatHeader = `<span class="heat-name">             </span>` +
        activeTypes.map(t => `<span class="heat-th">${t.padStart(5)}</span>`).join("");
    const heatRows = domains.map(domain => {
        const name = escapeHtml(domain.name).padEnd(13).slice(0, 13);
        const cells = activeTypeKeys.map(tk => {
            const matching = domain.constructs.filter(c => c.type === tk);
            if (matching.length === 0)
                return `<span class="heat-cell heat-na">  .  </span>`;
            const done = matching.filter(c => c.impl.length > 0).length;
            const total = matching.length;
            const cls = done === total ? "heat-done" : done > 0 ? "heat-wip" : "heat-pending";
            return `<span class="heat-cell ${cls}">${String(done).padStart(2)}/${total} </span>`;
        }).join("");
        return `<div class="heat-row"><span class="heat-name">${name}</span>${cells}</div>`;
    }).join("\n");
    // --- Construct type summary chips ---
    const typeSummary = activeTypeKeys.map((tk, i) => {
        const all = domains.flatMap(d => d.constructs.filter(c => c.type === tk));
        const done = all.filter(c => c.impl.length > 0).length;
        const color = V2_TYPE_COLORS[tk] ?? "#fff";
        return `<span class="type-chip" style="border-color:${color};color:${color}">${activeTypes[i]}:${done}/${all.length}</span>`;
    }).join(" ");
    // Summary counts by type
    const { counts } = stats;
    const summaryParts = [];
    if (counts.concepts > 0)
        summaryParts.push(`${counts.concepts} concepts`);
    if (counts.capabilities > 0)
        summaryParts.push(`${counts.capabilities} capabilities`);
    if (counts.invariants > 0)
        summaryParts.push(`${counts.invariants} invariants`);
    if (counts.properties > 0)
        summaryParts.push(`${counts.properties} properties`);
    if (counts.objectives > 0)
        summaryParts.push(`${counts.objectives} objectives`);
    if (counts.enums > 0)
        summaryParts.push(`${counts.enums} enums`);
    const summaryLine = summaryParts.join(" | ");
    return `
<div class="dash-cli">
  <div class="dash-header">
    <span class="dash-title">PROGRESS</span>
    <span class="dash-summary">${summaryLine} | impl ${implDone}/${totalConstructs} (${implPct}%) | verified ${verifiedDone}/${implDone} (${verifiedPct}%)</span>
  </div>

  <div class="dash-global-bars">
    <div class="dash-global-row">
      <span class="dash-global-label">impl </span>
      <span class="dash-bar">${asciiBar(implPct, 30)}</span>
      <span class="dash-pct"> ${implPct}%</span>
    </div>
    <div class="dash-global-row">
      <span class="dash-global-label">veri </span>
      <span class="dash-bar">${asciiBar(verifiedPct, 30)}</span>
      <span class="dash-pct"> ${verifiedPct}%</span>
    </div>
  </div>

  <div class="dash-section-line">${"\u2500\u2500"} DOMAINS ${"\u2500".repeat(63)}</div>

  <div class="dash-comp-header">
    <span class="dash-name">name          </span>
    <span class="dash-bar-label">impl             </span>
    <span class="dash-pct">   </span>
    <span class="dash-sep">|</span>
    <span class="dash-bar-label">verified   </span>
    <span class="dash-pct">   </span>
    <span class="dash-sep">|</span>
    <span class="dash-count">           </span>
  </div>
  <div class="dash-comp-list">
    ${domainRows}
  </div>

  <div class="dash-section-line">${"\u2500\u2500"} HEATMAP ${"\u2500".repeat(63)}</div>

  <div class="dash-heatmap">
    <div class="heat-header">${heatHeader}</div>
    ${heatRows}
  </div>

  <div class="dash-section-line">${"\u2500\u2500"} TYPES ${"\u2500".repeat(65)}</div>

  <div class="dash-types">
    ${typeSummary}
  </div>
</div>`;
}
//# sourceMappingURL=dashboard.js.map