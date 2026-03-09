/**
 * Overview page (Level 1 — System):
 * Domain graph visualization for v2 models.
 * Each node is a domain (file) with construct counts and impl progress.
 * Edges show cross-domain references.
 *
 * Also exports renderSystemInfo() for the system info tab.
 */
import { escapeHtml, domainLink } from "./shared.js";
import { computeRelationshipsV2 } from "../relationships.js";
const DOMAIN_PALETTE = [
    '#00FFFF', // cyan
    '#FF6B6B', // coral
    '#FBBF24', // amber
    '#A78BFA', // violet
    '#34D399', // emerald
    '#F472B6', // pink
    '#60A5FA', // blue
    '#FB923C', // orange
];
function buildDomainGraphData(snapshot) {
    const nodes = [];
    const edges = [];
    let colorIdx = 0;
    for (const domain of snapshot.domains) {
        const parts = [];
        const cc = domain.constructCounts;
        if (cc.concepts)
            parts.push(`${cc.concepts} concepts`);
        if (cc.enums)
            parts.push(`${cc.enums} enums`);
        if (cc.capabilities)
            parts.push(`${cc.capabilities} capabilities`);
        if (cc.invariants)
            parts.push(`${cc.invariants} invariants`);
        if (cc.properties)
            parts.push(`${cc.properties} properties`);
        if (cc.objectives)
            parts.push(`${cc.objectives} objectives`);
        const counts = parts.join(" \u00b7 ") || "empty";
        const implPct = domain.implTotal > 0 ? Math.round((domain.implDone / domain.implTotal) * 100) : 0;
        const color = DOMAIN_PALETTE[colorIdx % DOMAIN_PALETTE.length];
        colorIdx++;
        nodes.push({
            id: domain.name,
            name: domain.name,
            href: domainLink(domain.name),
            counts,
            implPct,
            color,
        });
    }
    // Cross-domain edges from relationships
    const rels = computeRelationshipsV2(snapshot.model);
    const cdMap = snapshot.constructDomainMap;
    const edgeSeen = new Set();
    for (const rel of rels) {
        const fromDomain = cdMap.get(`${rel.from.type}:${rel.from.name}`);
        const toDomain = cdMap.get(`${rel.to.type}:${rel.to.name}`);
        if (!fromDomain || !toDomain || fromDomain === toDomain)
            continue;
        const edgeKey = `${fromDomain}->${toDomain}`;
        if (edgeSeen.has(edgeKey))
            continue;
        edgeSeen.add(edgeKey);
        edges.push({
            from: fromDomain,
            to: toDomain,
            label: rel.relation,
        });
    }
    return { nodes, edges };
}
function buildDomainGraphHtml(data) {
    const jsonStr = escapeHtml(JSON.stringify(data));
    return `<div class="scope-domain-graph" data-graph="${jsonStr}">
    <svg class="scope-domain-graph-edges"></svg>
    <div class="scope-domain-graph-world"></div>
  </div>`;
}
export function renderOverview(snapshot) {
    if (snapshot.domains.length > 0) {
        const graphData = buildDomainGraphData(snapshot);
        return `
<div class="scope-diagram-container" id="diagram-container" data-diagram-type="domain" style="height: calc(100vh - 130px)">
  ${buildDomainGraphHtml(graphData)}
</div>`;
    }
    return `
<div class="scope-diagram-container" id="diagram-container" data-diagram-type="domain" style="height: calc(100vh - 130px)">
  <div class="scope-empty-state">
    <div class="scope-empty-state-icon">
      <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="24" cy="24" r="20"/><line x1="16" y1="16" x2="32" y2="32"/></svg>
    </div>
    <p>No domain constructs defined</p>
  </div>
</div>`;
}
// ===== System Info Tab =====
function sectionLine(label, width = 72) {
    const pad = Math.max(0, width - label.length - 4);
    return `<div class="sys-section-line">${"\u2500".repeat(2)} ${escapeHtml(label)} ${"\u2500".repeat(pad)}</div>`;
}
export function renderSystemInfo(snapshot) {
    const { stats, validation, model } = snapshot;
    const { counts, completeness } = stats;
    // Imports from systems
    const imports = model.systems.length > 0 ? model.systems[0].imports : [];
    // Validation
    const errCount = validation.errors.length;
    const warnCount = validation.warnings.length;
    const validationItems = [
        ...validation.errors.map((e) => `<div class="sys-val-item sys-val-error">&#x2716; ${e.line ? `line ${e.line}: ` : ""}${escapeHtml(e.message)}</div>`),
        ...validation.warnings.map((w) => `<div class="sys-val-item sys-val-warn">&#x26A0; ${w.line ? `line ${w.line}: ` : ""}${escapeHtml(w.message)}</div>`),
    ];
    // Import list
    const importRows = imports.length > 0
        ? imports.map((p) => `<div class="sys-import-row">  ${escapeHtml(p)}</div>`).join("\n")
        : `<div class="sys-import-row" style="opacity:0.4">  (none)</div>`;
    // Validation status line
    const valStatusParts = [];
    valStatusParts.push(`${errCount} error${errCount !== 1 ? "s" : ""}`);
    valStatusParts.push(`${warnCount} warning${warnCount !== 1 ? "s" : ""}`);
    const valStatus = valStatusParts.join(" &#x2502; ");
    // Construct type counts for the right column
    const constructTypes = [
        ["concepts", counts.concepts],
        ["enums", counts.enums],
        ["capabilities", counts.capabilities],
        ["invariants", counts.invariants],
        ["properties", counts.properties],
        ["objectives", counts.objectives],
    ].filter((pair) => pair[1] > 0);
    const constructRows = constructTypes.map(([label, val]) => `<div class="sys-count-row"><span class="sys-count-label">${escapeHtml(label)}</span><span class="sys-count-val">${val}</span></div>`).join("\n      ");
    // Domain summary rows
    const domainSummaryRows = snapshot.domains.map((domain) => {
        const implPct = domain.implTotal > 0 ? Math.round((domain.implDone / domain.implTotal) * 100) : 0;
        const constructCount = Object.values(domain.constructCounts).reduce((sum, n) => sum + n, 0);
        return `<a href="${domainLink(domain.name)}" class="sys-comp-row">
        <span class="sys-comp-name">${escapeHtml(domain.name)}</span>
        <span class="sys-comp-status sys-status-default">${constructCount} constructs</span>
        <span class="sys-comp-desc">${implPct}% impl</span>
      </a>`;
    }).join("\n      ");
    // Completeness detail
    const implPct = completeness.implPct;
    const verifiedPct = completeness.verifiedPct;
    const detailPairs = [
        ["total constructs", completeness.total],
        ["with @impl", completeness.withImpl],
        ["impl %", `${implPct}%`],
        ["with @verified", completeness.withVerified],
        ["verified %", `${verifiedPct}%`],
        ["domains", snapshot.domains.length],
    ];
    const detailGrid = [];
    for (let i = 0; i < detailPairs.length; i += 2) {
        const left = detailPairs[i];
        const right = detailPairs[i + 1];
        const lLabel = String(left[0]).padEnd(18);
        const lVal = String(left[1]).padStart(4);
        let row = `<span class="sys-detail-label">${lLabel}</span><span class="sys-detail-val">${lVal}</span>`;
        if (right) {
            const rLabel = String(right[0]).padEnd(18);
            const rVal = String(right[1]).padStart(4);
            row += `    <span class="sys-detail-label">${rLabel}</span><span class="sys-detail-val">${rVal}</span>`;
        }
        detailGrid.push(`<div class="sys-detail-row">${row}</div>`);
    }
    return `
<div class="sys-cli">
  <div class="sys-two-col">
    <div class="sys-col">
      ${sectionLine("SYSTEM")}
      <div class="sys-kv"><span class="sys-label">name</span>      <span class="sys-value">${escapeHtml(snapshot.systemName)}</span></div>
      <div class="sys-kv"><span class="sys-label">version</span>   <span class="sys-value">${snapshot.systemVersion ? escapeHtml(snapshot.systemVersion) : "\u2014"}</span></div>
      <div class="sys-kv"><span class="sys-label">file</span>      <span class="sys-value sys-file">${escapeHtml(snapshot.filePath)}</span></div>

      ${sectionLine("DOMAINS")}
      <div class="sys-comp-list">
        ${domainSummaryRows || '<div style="opacity:0.4">  (none)</div>'}
      </div>

      ${imports.length > 0 ? `${sectionLine("IMPORTS")}
      <div class="sys-import-list">
        ${importRows}
      </div>` : ""}
    </div>

    <div class="sys-col">
      ${sectionLine("CONSTRUCTS")}
      <div class="sys-count-grid">
        ${constructRows}
      </div>
      <div class="sys-count-total">${counts.total} total</div>

      ${sectionLine("COMPLETENESS")}
      <div class="sys-detail-grid">
        ${detailGrid.join("\n        ")}
      </div>

      ${sectionLine("VALIDATION")}
      <div class="sys-val-summary">${valStatus}</div>
      <div class="sys-val-list">
        ${validationItems.length > 0 ? validationItems.join("\n        ") : '<div style="opacity:0.4">  (all clear)</div>'}
      </div>
    </div>
  </div>
</div>`;
}
//# sourceMappingURL=overview.js.map