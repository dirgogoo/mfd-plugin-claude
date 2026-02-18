/**
 * Overview page (Level 1 — System):
 * Diagram-first layout. Component diagram has enriched node labels
 * with status, construct counts, and impl progress built into each node.
 *
 * Also exports renderSystemInfo() for the system info tab.
 */
import { escapeHtml } from "./shared.js";
const COMPONENT_PALETTE = [
    '#00FFFF', // cyan
    '#FF6B6B', // coral
    '#FBBF24', // amber
    '#A78BFA', // violet
    '#34D399', // emerald
    '#F472B6', // pink
    '#60A5FA', // blue
    '#FB923C', // orange
];
function buildComponentGraphData(snapshot) {
    const nodes = [];
    const edges = [];
    let colorIdx = 0;
    for (const comp of snapshot.components) {
        const status = comp.status ?? "planned";
        const parts = [];
        if (comp.constructCounts.entities)
            parts.push(`${comp.constructCounts.entities} entities`);
        if (comp.constructCounts.flows)
            parts.push(`${comp.constructCounts.flows} flows`);
        if (comp.constructCounts.endpoints)
            parts.push(`${comp.constructCounts.endpoints} endpoints`);
        else if (comp.constructCounts.apis)
            parts.push(`${comp.constructCounts.apis} apis`);
        if (comp.constructCounts.states)
            parts.push(`${comp.constructCounts.states} states`);
        if (comp.constructCounts.screens)
            parts.push(`${comp.constructCounts.screens} screens`);
        if (comp.constructCounts.events)
            parts.push(`${comp.constructCounts.events} events`);
        if (comp.constructCounts.signals)
            parts.push(`${comp.constructCounts.signals} signals`);
        if (comp.constructCounts.rules)
            parts.push(`${comp.constructCounts.rules} rules`);
        if (comp.constructCounts.journeys)
            parts.push(`${comp.constructCounts.journeys} journeys`);
        if (comp.constructCounts.operations)
            parts.push(`${comp.constructCounts.operations} operations`);
        const counts = parts.join(" \u00b7 ") || "empty";
        const implPct = comp.implTotal > 0 ? Math.round((comp.implDone / comp.implTotal) * 100) : 0;
        const color = COMPONENT_PALETTE[colorIdx % COMPONENT_PALETTE.length];
        colorIdx++;
        // Check decorators and inheritance on the AST component
        const astComp = snapshot.model.components.find(c => c.name === comp.name);
        const isAbstract = astComp?.decorators?.some((d) => d.name === "abstract") ?? false;
        const isInterface = astComp?.decorators?.some((d) => d.name === "interface") ?? false;
        const extendsFrom = astComp?.extends ?? undefined;
        const implementsList = astComp?.implements?.length ? astComp.implements : undefined;
        nodes.push({
            id: comp.name,
            name: comp.name,
            href: `/component/${encodeURIComponent(comp.name)}`,
            status,
            counts,
            implPct,
            color,
            isAbstract,
            isInterface,
            extendsFrom,
            implementsList,
        });
    }
    // Dep edges
    for (const comp of snapshot.model.components) {
        for (const item of comp.body) {
            if (item.type === "DepDecl") {
                const target = item.target;
                const optional = item.decorators?.some((d) => d.name === "optional") ?? false;
                edges.push({ from: comp.name, to: target, optional, edgeType: "dep" });
            }
        }
    }
    // Inheritance edges (extends / implements)
    for (const comp of snapshot.model.components) {
        if (comp.extends) {
            edges.push({ from: comp.name, to: comp.extends, optional: false, edgeType: "extends" });
        }
        if (comp.implements?.length) {
            for (const iface of comp.implements) {
                edges.push({ from: comp.name, to: iface, optional: false, edgeType: "implements" });
            }
        }
    }
    return { nodes, edges };
}
function buildComponentGraphHtml(data) {
    const jsonStr = escapeHtml(JSON.stringify(data));
    return `<div class="scope-component-graph" data-graph="${jsonStr}">
    <svg class="scope-component-graph-edges"></svg>
    <div class="scope-component-graph-world"></div>
  </div>`;
}
/** Build a simple text-based progress bar like ████░░░░ */
function buildTextBar(pct) {
    const filled = Math.round(pct / 12.5); // 8 chars total
    const empty = 8 - filled;
    return "█".repeat(filled) + "░".repeat(empty);
}
export function renderOverview(snapshot) {
    if (snapshot.model.components.length > 0) {
        const graphData = buildComponentGraphData(snapshot);
        return `
<div class="scope-diagram-container" id="diagram-container" data-diagram-type="component" style="height: calc(100vh - 130px)">
  ${buildComponentGraphHtml(graphData)}
</div>`;
    }
    return `
<div class="scope-diagram-container" id="diagram-container" data-diagram-type="component" style="height: calc(100vh - 130px)">
  <div class="scope-empty-state">
    <div class="scope-empty-state-icon">
      <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="24" cy="24" r="20"/><line x1="16" y1="16" x2="32" y2="32"/></svg>
    </div>
    <p>No component constructs defined</p>
  </div>
</div>`;
}
// ===== System Info Tab =====
function getDecoratorValue(decorators, name) {
    const dec = decorators?.find((d) => d.name === name);
    if (!dec || !dec.params?.[0])
        return null;
    return String(dec.params[0].value);
}
function sectionLine(label, width = 72) {
    const pad = Math.max(0, width - label.length - 4);
    return `<div class="sys-section-line">${"─".repeat(2)} ${escapeHtml(label)} ${"─".repeat(pad)}</div>`;
}
export function renderSystemInfo(snapshot) {
    const { stats, validation, model } = snapshot;
    const { counts, details, tokens, dependencyGraph } = stats;
    // Imports from system body
    const systemBody = model.systems[0]?.body ?? [];
    const imports = systemBody
        .filter((item) => item.type === "IncludeDecl")
        .map((inc) => inc.path);
    // Extract component descriptions from system body SemanticComments
    // Pattern: separator / "Componente: Name" / "Description text" / separator
    const compDescriptions = new Map();
    const systemComments = systemBody.filter((item) => item.type === "SemanticComment");
    const isSeparator = (text) => /^=+$/.test(text.trim());
    for (let i = 0; i < systemComments.length; i++) {
        const text = systemComments[i].text.trim();
        const match = text.match(/^Componente:\s*(.+)$/i);
        if (match) {
            const compName = match[1].trim();
            // Next non-separator comment is the description
            for (let j = i + 1; j < systemComments.length; j++) {
                const next = systemComments[j].text.trim();
                if (isSeparator(next))
                    break;
                if (next) {
                    compDescriptions.set(compName, next);
                    break;
                }
            }
        }
    }
    // System-level description: comments that are NOT separator lines and NOT "Componente:" headers
    const systemDescLines = systemComments
        .map((c) => c.text.trim())
        .filter((t) => !isSeparator(t) && !/^Componente:/i.test(t) && !compDescriptions.has(t) && ![...compDescriptions.values()].includes(t))
        .filter((t) => t.length > 0);
    // Deps with component ownership
    const depEntries = [];
    for (const comp of model.components) {
        for (const item of comp.body) {
            if (item.type === "DepDecl") {
                const dep = item;
                const depType = getDecoratorValue(dep.decorators, "type") ?? "—";
                depEntries.push({ component: comp.name, target: dep.target, type: depType });
            }
        }
    }
    // Secrets with component ownership
    const secretEntries = [];
    for (const comp of model.components) {
        for (const item of comp.body) {
            if (item.type === "SecretDecl") {
                const sec = item;
                const rotation = getDecoratorValue(sec.decorators, "rotation") ?? "";
                const provider = getDecoratorValue(sec.decorators, "provider") ?? "";
                secretEntries.push({ component: comp.name, name: sec.name, rotation, provider });
            }
        }
    }
    // Dep graph stats
    const dgNodes = dependencyGraph?.nodes ?? 0;
    const dgEdges = dependencyGraph?.edges ?? 0;
    const dgDepth = dependencyGraph?.maxDepth ?? 0;
    const dgCycles = dependencyGraph?.cycles ?? 0;
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
    // Dep rows
    const depRows = depEntries.length > 0
        ? depEntries.map((d) => {
            const comp = escapeHtml(d.component).padEnd(14).slice(0, 14);
            const target = escapeHtml(d.target).padEnd(14).slice(0, 14);
            const dtype = d.type !== "—" ? `@type(${escapeHtml(d.type)})` : "";
            return `<div class="sys-dep-row"><span class="sys-dep-from">${comp}</span> <span class="sys-dep-arrow">-&gt;</span> <span class="sys-dep-to">${target}</span> <span class="sys-dep-type">${dtype}</span></div>`;
        }).join("\n")
        : `<div class="sys-dep-row" style="opacity:0.4">  (none)</div>`;
    // Secret rows
    const secretRows = secretEntries.length > 0
        ? secretEntries.map((s) => {
            const comp = escapeHtml(s.component).padEnd(14).slice(0, 14);
            const name = escapeHtml(s.name).padEnd(22).slice(0, 22);
            const parts = [];
            if (s.rotation)
                parts.push(`@rotation(${escapeHtml(s.rotation)})`);
            if (s.provider)
                parts.push(`@provider(${escapeHtml(s.provider)})`);
            return `<div class="sys-secret-row"><span class="sys-secret-comp">${comp}</span> <span class="sys-secret-name">${name}</span> <span class="sys-secret-meta">${parts.join(" ")}</span></div>`;
        }).join("\n")
        : `<div class="sys-secret-row" style="opacity:0.4">  (none)</div>`;
    // Validation status line
    const valStatusParts = [];
    valStatusParts.push(`${errCount} error${errCount !== 1 ? "s" : ""}`);
    valStatusParts.push(`${warnCount} warning${warnCount !== 1 ? "s" : ""}`);
    const valStatus = valStatusParts.join(" &#x2502; ");
    // Detail counts grid
    const detailPairs = [
        ["entity fields", details.entityFields],
        ["api endpoints", details.apiEndpoints],
        ["stream endpoints", details.streamEndpoints],
        ["external apis", details.externalApis],
        ["transitions", details.transitions],
        ["abstract", details.abstractConstructs],
        ["interfaces", details.interfaceConstructs],
        ["inheritance", details.inheritanceRelations],
    ];
    const detailGrid = [];
    for (let i = 0; i < detailPairs.length; i += 2) {
        const left = detailPairs[i];
        const right = detailPairs[i + 1];
        const lLabel = left[0].padEnd(18);
        const lVal = String(left[1]).padStart(4);
        let row = `<span class="sys-detail-label">${lLabel}</span><span class="sys-detail-val">${lVal}</span>`;
        if (right) {
            const rLabel = right[0].padEnd(18);
            const rVal = String(right[1]).padStart(4);
            row += `    <span class="sys-detail-label">${rLabel}</span><span class="sys-detail-val">${rVal}</span>`;
        }
        detailGrid.push(`<div class="sys-detail-row">${row}</div>`);
    }
    // Construct type counts for the left column
    const constructTypes = [
        ["components", counts.components],
        ["entities", counts.entities],
        ["enums", counts.enums],
        ["flows", counts.flows],
        ["operations", counts.operations],
        ["states", counts.states],
        ["events", counts.events],
        ["signals", counts.signals],
        ["apis", counts.apis],
        ["rules", counts.rules],
        ["screens", counts.screens],
        ["elements", counts.elements],
        ["actions", counts.actions],
        ["journeys", counts.journeys],
        ["deps", counts.deps],
        ["secrets", counts.secrets],
    ].filter((pair) => pair[1] > 0);
    const constructRows = constructTypes.map(([label, val]) => `<div class="sys-count-row"><span class="sys-count-label">${escapeHtml(label)}</span><span class="sys-count-val">${val}</span></div>`).join("\n      ");
    // Component summary rows with status and description
    const compSummaryRows = model.components.map((comp) => {
        const status = getDecoratorValue(comp.decorators, "status") ?? "—";
        const desc = compDescriptions.get(comp.name) ?? "";
        const statusCls = status === "production" ? "sys-status-prod"
            : status === "implementing" ? "sys-status-impl"
                : status === "modeling" ? "sys-status-model"
                    : "sys-status-default";
        return `<a href="/component/${encodeURIComponent(comp.name)}" class="sys-comp-row">
        <span class="sys-comp-name">${escapeHtml(comp.name)}</span>
        <span class="sys-comp-status ${statusCls}">${escapeHtml(status)}</span>
        ${desc ? `<span class="sys-comp-desc">${escapeHtml(desc)}</span>` : ""}
      </a>`;
    }).join("\n      ");
    // System description (if any non-component comments exist at system level)
    const descriptionHtml = systemDescLines.length > 0
        ? `${sectionLine("DESCRIPTION")}
      <div class="sys-description">${systemDescLines.map((l) => `<div>${escapeHtml(l)}</div>`).join("\n        ")}</div>`
        : "";
    return `
<div class="sys-cli">
  <div class="sys-two-col">
    <div class="sys-col">
      ${sectionLine("SYSTEM")}
      <div class="sys-kv"><span class="sys-label">name</span>      <span class="sys-value">${escapeHtml(snapshot.systemName)}</span></div>
      <div class="sys-kv"><span class="sys-label">version</span>   <span class="sys-value">${snapshot.systemVersion ? escapeHtml(snapshot.systemVersion) : "—"}</span></div>
      <div class="sys-kv"><span class="sys-label">file</span>      <span class="sys-value sys-file">${escapeHtml(snapshot.filePath)}</span></div>
      <div class="sys-kv"><span class="sys-label">tokens</span>    <span class="sys-value">~${tokens} (est)</span></div>
      <div class="sys-kv"><span class="sys-label">dep graph</span> <span class="sys-value">${dgNodes} nodes &#x2502; ${dgEdges} edges &#x2502; depth ${dgDepth} &#x2502; ${dgCycles} cycle${dgCycles !== 1 ? "s" : ""}</span></div>
      ${descriptionHtml}

      ${sectionLine("COMPONENTS")}
      <div class="sys-comp-list">
        ${compSummaryRows}
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

      ${sectionLine("DETAILS")}
      <div class="sys-detail-grid">
        ${detailGrid.join("\n        ")}
      </div>

      ${sectionLine("SECRETS")}
      <div class="sys-secrets">
        ${secretRows}
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