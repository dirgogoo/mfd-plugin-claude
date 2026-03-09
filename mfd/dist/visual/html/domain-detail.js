/**
 * Domain detail page (Level 2 — Domain)
 * Tabbed interface with diagrams + cards per v2 construct type.
 * All construct names are navigable links to Level 3 detail pages.
 *
 * Uses the central constructDomainMap to find constructs belonging to this domain.
 */
import { escapeHtml, formatType, formatTypeLinked, constructLink, renderImplChip, renderVerifiedChip, renderDecoratorChips, buildConceptDomainMap, V2_TYPE_COLORS, } from "./shared.js";
import { renderDomainLifecycleDiagram, } from "./domain-diagrams.js";
import { computeRelationshipsV2 } from "../relationships.js";
// ===== Helpers =====
function getDomainConstructs(items, type, domainName, cdMap) {
    return items.filter(item => cdMap.get(`${type}:${item.name}`) === domainName);
}
function diagramContainer(diagramType, mermaidCode) {
    if (!mermaidCode)
        return "";
    return `<div class="scope-diagram-container" data-diagram-type="${diagramType}">
    <div class="mermaid" data-type="${diagramType}">${escapeHtml(mermaidCode)}</div>
  </div>`;
}
function buildTextBar(pct) {
    const filled = Math.round(pct / 12.5);
    const empty = 8 - filled;
    return "\u2588".repeat(filled) + "\u2591".repeat(empty);
}
// ===== Main Render =====
export function renderDomainDetail(snapshot, domainName) {
    const domainInfo = snapshot.domains.find(d => d.name === domainName);
    if (!domainInfo) {
        return {
            html: `<div class="scope-empty-state"><p>Domain not found: ${escapeHtml(domainName)}</p></div>`,
            tabs: [],
            defaultTab: "",
        };
    }
    const cdMap = snapshot.constructDomainMap;
    const conceptDomainMap = buildConceptDomainMap(cdMap);
    const enumNames = new Set(snapshot.model.enums.map(e => e.name));
    const concepts = getDomainConstructs(snapshot.model.concepts, "concept", domainName, cdMap);
    const enums = getDomainConstructs(snapshot.model.enums, "enum", domainName, cdMap);
    const capabilities = getDomainConstructs(snapshot.model.capabilities, "capability", domainName, cdMap);
    const invariants = getDomainConstructs(snapshot.model.invariants, "invariant", domainName, cdMap);
    const properties = getDomainConstructs(snapshot.model.properties, "property", domainName, cdMap);
    const objectives = getDomainConstructs(snapshot.model.objectives, "objective", domainName, cdMap);
    const totalConstructs = concepts.length + enums.length + capabilities.length +
        invariants.length + properties.length + objectives.length;
    const implPct = domainInfo.implTotal > 0
        ? Math.round((domainInfo.implDone / domainInfo.implTotal) * 100)
        : 0;
    const implRatio = domainInfo.implTotal > 0
        ? `${domainInfo.implDone}/${domainInfo.implTotal}`
        : totalConstructs > 0 ? `0/${totalConstructs}` : "";
    // Build tabs
    const tabs = [];
    // 1. Overview tab
    const overviewContent = buildOverviewTab(snapshot, domainName, concepts, enums, capabilities, invariants, properties, objectives, implPct, implRatio);
    tabs.push({ id: "overview", label: "Overview", count: totalConstructs, content: overviewContent });
    // 2. Concepts tab — nodes with fields visible (no cards below)
    if (concepts.length > 0 || enums.length > 0) {
        const graphData = buildConceptsTabGraph(snapshot, domainName, concepts, enums, invariants, properties, conceptDomainMap, enumNames);
        const content = overviewGraphHtml(graphData);
        tabs.push({ id: "concepts", label: "Concepts", count: concepts.length + enums.length, color: V2_TYPE_COLORS.concept, content });
    }
    // 3. Capabilities tab — nodes with clauses visible (no cards below)
    if (capabilities.length > 0) {
        const graphData = buildCapabilitiesTabGraph(snapshot, domainName, capabilities, concepts, enums, objectives, conceptDomainMap, enumNames);
        const content = overviewGraphHtml(graphData);
        tabs.push({ id: "capabilities", label: "Capabilities", count: capabilities.length, color: V2_TYPE_COLORS.capability, content });
    }
    // 4. Lifecycles tab
    const conceptsWithLifecycle = concepts.filter(c => c.lifecycle);
    if (conceptsWithLifecycle.length > 0) {
        const lcDiagram = renderDomainLifecycleDiagram(snapshot, domainName);
        const lcCards = buildLifecycleCards(conceptsWithLifecycle, domainName, conceptDomainMap, enumNames);
        const content = diagramContainer("lifecycle", lcDiagram) + lcCards;
        tabs.push({ id: "lifecycles", label: "Lifecycles", count: conceptsWithLifecycle.length, color: V2_TYPE_COLORS.lifecycle, content });
    }
    // 5. Invariants tab
    if (invariants.length > 0) {
        const graphData = buildTabGraphData(snapshot, domainName, [
            { items: invariants, type: "invariant" },
        ]);
        const invCards = buildInvariantCards(invariants, domainName);
        const content = overviewGraphHtml(graphData, "400px") + invCards;
        tabs.push({ id: "invariants", label: "Invariants", count: invariants.length, color: V2_TYPE_COLORS.invariant, content });
    }
    // 6. Properties tab
    if (properties.length > 0) {
        const graphData = buildTabGraphData(snapshot, domainName, [
            { items: properties, type: "property" },
        ]);
        const propCards = buildPropertyCards(properties, domainName);
        const content = overviewGraphHtml(graphData, "400px") + propCards;
        tabs.push({ id: "properties", label: "Properties", count: properties.length, color: V2_TYPE_COLORS.property, content });
    }
    // 7. Objectives tab
    if (objectives.length > 0) {
        const graphData = buildTabGraphData(snapshot, domainName, [
            { items: objectives, type: "objective" },
        ]);
        const objCards = buildObjectiveCards(objectives, domainName);
        const content = overviewGraphHtml(graphData, "400px") + objCards;
        tabs.push({ id: "objectives", label: "Objectives", count: objectives.length, color: V2_TYPE_COLORS.objective, content });
    }
    // Render tab panels
    const tabPanels = tabs.map((tab, i) => {
        const active = i === 0 ? " active" : "";
        return `<div class="scope-tab-panel${active}" data-tab-panel="${tab.id}">
      <div class="scope-tab-panel-content">
        ${tab.content}
      </div>
    </div>`;
    }).join("");
    const html = `
<div class="scope-component-detail">
  <div class="scope-component-header">
    <span class="scope-component-name">${escapeHtml(domainName)}</span>
  </div>
  <div class="scope-component-meta">
    ${implRatio ? `<span class="scope-mono" style="font-size: var(--scope-text-sm); color: var(--scope-text-secondary)">impl: ${implRatio}</span>` : ""}
  </div>
  ${tabPanels}
</div>`;
    return {
        html,
        tabs: tabs.map(t => ({ id: t.id, label: t.label, count: t.count })),
        defaultTab: tabs[0]?.id ?? "",
    };
}
// ===== Interactive OverviewGraph helpers =====
/** Category mapping for v2 construct types */
function v2Category(type) {
    return type === "concept" || type === "enum" ? "data" : "behavior";
}
/**
 * Build OverviewGraph data for a set of primary constructs.
 * Also pulls in related constructs (targets of edges) as context nodes.
 */
function buildTabGraphData(snapshot, domainName, primaryConstructs) {
    const nodes = [];
    const nodeIds = new Set();
    // Add primary nodes
    for (const { items, type } of primaryConstructs) {
        for (const item of items) {
            const id = `${type}:${item.name}`;
            if (nodeIds.has(id))
                continue;
            nodeIds.add(id);
            nodes.push({
                id,
                name: item.name,
                href: constructLink(domainName, type, item.name),
                constructType: type,
                category: v2Category(type),
            });
        }
    }
    // Get all relationships
    const rels = computeRelationshipsV2(snapshot.model);
    // Find related constructs (edge targets/sources not yet in nodes)
    const cdMap = snapshot.constructDomainMap;
    for (const rel of rels) {
        const fromId = `${rel.from.type}:${rel.from.name}`;
        const toId = `${rel.to.type}:${rel.to.name}`;
        // Only add context node if one end is primary
        if (nodeIds.has(fromId) && !nodeIds.has(toId)) {
            const targetDomain = cdMap.get(toId) ?? domainName;
            nodeIds.add(toId);
            nodes.push({
                id: toId,
                name: rel.to.name,
                href: constructLink(targetDomain, rel.to.type, rel.to.name),
                constructType: rel.to.type,
                category: v2Category(rel.to.type),
            });
        }
        if (nodeIds.has(toId) && !nodeIds.has(fromId)) {
            const sourceDomain = cdMap.get(fromId) ?? domainName;
            nodeIds.add(fromId);
            nodes.push({
                id: fromId,
                name: rel.from.name,
                href: constructLink(sourceDomain, rel.from.type, rel.from.name),
                constructType: rel.from.type,
                category: v2Category(rel.from.type),
            });
        }
    }
    // Build edges (both ends must be in nodeIds)
    const edges = [];
    for (const rel of rels) {
        const fromId = `${rel.from.type}:${rel.from.name}`;
        const toId = `${rel.to.type}:${rel.to.name}`;
        if (nodeIds.has(fromId) && nodeIds.has(toId)) {
            edges.push({ from: fromId, to: toId, edgeType: rel.relation });
        }
    }
    return { nodes, edges };
}
/** Render an OverviewGraph HTML block from graph data */
function overviewGraphHtml(data, height = "calc(100vh - 280px)") {
    if (data.nodes.length === 0)
        return "";
    const jsonStr = escapeHtml(JSON.stringify(data));
    return `
  <div class="scope-diagram-container" data-diagram-type="domain" style="height: ${height}; min-height: ${height}; flex: none">
    <div class="scope-overview-graph" data-graph="${jsonStr}">
      <svg class="scope-overview-graph-edges"></svg>
      <div class="scope-overview-graph-world"></div>
    </div>
  </div>`;
}
/**
 * Build graph data for the Concepts tab.
 * Primary nodes: concepts (with fields), enums (with values), invariants, properties.
 * No capabilities/events/objectives as context.
 */
function buildConceptsTabGraph(snapshot, domainName, concepts, enums, invariants, properties, conceptDomainMap, enumNames) {
    const nodes = [];
    const nodeIds = new Set();
    // Concept nodes with fields
    for (const c of concepts) {
        const id = `concept:${c.name}`;
        nodeIds.add(id);
        nodes.push({
            id,
            name: c.name,
            href: constructLink(domainName, "concept", c.name),
            constructType: "concept",
            category: "data",
            fields: c.fields.map(f => ({
                name: f.name,
                typeHtml: formatTypeLinked(f.fieldType, conceptDomainMap, enumNames),
            })),
        });
    }
    // Enum nodes with values
    for (const e of enums) {
        const id = `enum:${e.name}`;
        nodeIds.add(id);
        nodes.push({
            id,
            name: e.name,
            href: constructLink(domainName, "enum", e.name),
            constructType: "enum",
            category: "data",
            values: e.values,
        });
    }
    // Invariant nodes
    for (const inv of invariants) {
        const id = `invariant:${inv.name}`;
        nodeIds.add(id);
        nodes.push({
            id,
            name: inv.name,
            href: constructLink(domainName, "invariant", inv.name),
            constructType: "invariant",
            category: "behavior",
            subtitle: inv.scope === "global" ? "global" : `local: ${inv.conceptName ?? ""}`,
        });
    }
    // Property nodes
    for (const prop of properties) {
        const id = `property:${prop.name}`;
        nodeIds.add(id);
        nodes.push({
            id,
            name: prop.name,
            href: constructLink(domainName, "property", prop.name),
            constructType: "property",
            category: "behavior",
            subtitle: prop.clauses.map(cl => cl.type).join(", "),
        });
    }
    // Edges only between visible nodes
    const rels = computeRelationshipsV2(snapshot.model);
    const edges = [];
    for (const rel of rels) {
        const fromId = `${rel.from.type}:${rel.from.name}`;
        const toId = `${rel.to.type}:${rel.to.name}`;
        if (nodeIds.has(fromId) && nodeIds.has(toId)) {
            edges.push({ from: fromId, to: toId, edgeType: rel.relation });
        }
    }
    return { nodes, edges };
}
/**
 * Build graph data for the Capabilities tab.
 * Primary: capabilities (with signature + clauses).
 * Context: only objectives, concepts, and events — no invariants/properties/enums.
 */
function buildCapabilitiesTabGraph(snapshot, domainName, capabilities, concepts, _enums, objectives, conceptDomainMap, enumNames) {
    const nodes = [];
    const nodeIds = new Set();
    // Allowed context types (only these get pulled in as secondary nodes)
    const allowedContext = new Set(["concept", "event"]);
    // Capability nodes with clause details
    for (const cap of capabilities) {
        const id = `capability:${cap.name}`;
        nodeIds.add(id);
        const params = cap.params.map(p => `${p.name}: ${formatType(p.fieldType)}`).join(", ");
        const ret = cap.returnType ? formatType(cap.returnType) : "void";
        const signature = `(${params}) → ${ret}`;
        const clauseLines = [];
        for (const cl of cap.clauses) {
            switch (cl.type) {
                case "given":
                    clauseLines.push({ type: "given", text: cl.expression });
                    break;
                case "then":
                    clauseLines.push({ type: "then", text: cl.expression });
                    break;
                case "affects":
                    clauseLines.push({ type: "affects", text: `${cl.concept}${cl.where ? ` where ${cl.where}` : ""}` });
                    break;
                case "reject":
                    clauseLines.push({ type: "reject", text: `${cl.condition} → ${cl.reason}` });
                    break;
                case "emits":
                    clauseLines.push({ type: "emits", text: cl.event });
                    break;
                case "via":
                    clauseLines.push({ type: "via", text: `${cl.method} ${cl.path}` });
                    break;
            }
        }
        nodes.push({
            id, name: cap.name,
            href: constructLink(domainName, "capability", cap.name),
            constructType: "capability", category: "behavior",
            signature, clauseLines,
        });
    }
    // Objective nodes (primary — shown with transitions info)
    for (const obj of objectives) {
        const id = `objective:${obj.name}`;
        nodeIds.add(id);
        const subtitle = obj.persona ? `@persona(${obj.persona})` : "";
        nodes.push({
            id, name: obj.name,
            href: constructLink(domainName, "objective", obj.name),
            constructType: "objective", category: "behavior",
            subtitle: subtitle || `${obj.transitions.length} steps`,
        });
    }
    // Get all relationships and filter context nodes
    const rels = computeRelationshipsV2(snapshot.model);
    const cdMap = snapshot.constructDomainMap;
    for (const rel of rels) {
        const fromId = `${rel.from.type}:${rel.from.name}`;
        const toId = `${rel.to.type}:${rel.to.name}`;
        // Only add context if type is allowed (concept, event, objective)
        if (nodeIds.has(fromId) && !nodeIds.has(toId) && allowedContext.has(rel.to.type)) {
            const targetDomain = cdMap.get(toId) ?? domainName;
            nodeIds.add(toId);
            nodes.push({
                id: toId, name: rel.to.name,
                href: constructLink(targetDomain, rel.to.type, rel.to.name),
                constructType: rel.to.type, category: v2Category(rel.to.type),
            });
        }
        if (nodeIds.has(toId) && !nodeIds.has(fromId) && allowedContext.has(rel.from.type)) {
            const sourceDomain = cdMap.get(fromId) ?? domainName;
            nodeIds.add(fromId);
            nodes.push({
                id: fromId, name: rel.from.name,
                href: constructLink(sourceDomain, rel.from.type, rel.from.name),
                constructType: rel.from.type, category: v2Category(rel.from.type),
            });
        }
    }
    // Edges between visible nodes
    const edges = [];
    for (const rel of rels) {
        const fromId = `${rel.from.type}:${rel.from.name}`;
        const toId = `${rel.to.type}:${rel.to.name}`;
        if (nodeIds.has(fromId) && nodeIds.has(toId)) {
            edges.push({ from: fromId, to: toId, edgeType: rel.relation });
        }
    }
    return { nodes, edges };
}
function buildOverviewTab(snapshot, domainName, concepts, enums, capabilities, invariants, properties, objectives, implPct, implRatio) {
    // Progress header
    const progressBar = buildTextBar(implPct);
    const header = `
  <div class="scope-overview-header" style="padding: var(--scope-space-4); border-bottom: 1px solid var(--scope-border)">
    <div style="display: flex; align-items: center; gap: var(--scope-space-4); margin-bottom: var(--scope-space-2)">
      <span class="scope-mono" style="font-size: var(--scope-text-sm)">impl</span>
      <span class="scope-mono" style="font-size: var(--scope-text-sm); color: var(--scope-text-secondary)">${progressBar} ${implPct}%</span>
      <span class="scope-mono" style="font-size: var(--scope-text-xs); color: var(--scope-text-tertiary)">(${implRatio})</span>
    </div>
    <div style="display: flex; gap: var(--scope-space-3); flex-wrap: wrap">
      ${concepts.length > 0 ? `<span class="scope-chip" style="border-color:${V2_TYPE_COLORS.concept};color:${V2_TYPE_COLORS.concept}">${concepts.length} concepts</span>` : ""}
      ${enums.length > 0 ? `<span class="scope-chip" style="border-color:${V2_TYPE_COLORS.enum};color:${V2_TYPE_COLORS.enum}">${enums.length} enums</span>` : ""}
      ${capabilities.length > 0 ? `<span class="scope-chip" style="border-color:${V2_TYPE_COLORS.capability};color:${V2_TYPE_COLORS.capability}">${capabilities.length} capabilities</span>` : ""}
      ${invariants.length > 0 ? `<span class="scope-chip" style="border-color:${V2_TYPE_COLORS.invariant};color:${V2_TYPE_COLORS.invariant}">${invariants.length} invariants</span>` : ""}
      ${properties.length > 0 ? `<span class="scope-chip" style="border-color:${V2_TYPE_COLORS.property};color:${V2_TYPE_COLORS.property}">${properties.length} properties</span>` : ""}
      ${objectives.length > 0 ? `<span class="scope-chip" style="border-color:${V2_TYPE_COLORS.objective};color:${V2_TYPE_COLORS.objective}">${objectives.length} objectives</span>` : ""}
    </div>
  </div>`;
    // Interactive OverviewGraph with all construct nodes
    const graphData = buildTabGraphData(snapshot, domainName, [
        { items: concepts, type: "concept" },
        { items: enums, type: "enum" },
        { items: capabilities, type: "capability" },
        { items: invariants, type: "invariant" },
        { items: properties, type: "property" },
        { items: objectives, type: "objective" },
    ]);
    return header + overviewGraphHtml(graphData);
}
// ===== Concept Cards =====
function buildConceptCards(concepts, enums, domainName, conceptDomainMap, enumNames) {
    const cards = [];
    for (const concept of concepts) {
        const link = constructLink(domainName, "concept", concept.name);
        const chips = [
            renderImplChip(concept.decorators),
            renderVerifiedChip(concept.decorators),
            concept.lifecycle
                ? `<span class="scope-chip" style="border-color:${V2_TYPE_COLORS.lifecycle};color:${V2_TYPE_COLORS.lifecycle}">lifecycle: ${escapeHtml(concept.lifecycle.field)}</span>`
                : "",
            concept.invariants.length > 0
                ? `<span class="scope-chip" style="border-color:${V2_TYPE_COLORS.invariant};color:${V2_TYPE_COLORS.invariant}">${concept.invariants.length} invariant${concept.invariants.length > 1 ? "s" : ""}</span>`
                : "",
        ].filter(Boolean).join(" ");
        // Fields table
        const fieldsHtml = concept.fields.length > 0
            ? `<table class="scope-construct-table">
          <thead><tr><th>Name</th><th>Type</th><th>Decorators</th></tr></thead>
          <tbody>${concept.fields.map(f => {
                const typeStr = formatTypeLinked(f.fieldType, conceptDomainMap, enumNames);
                const decs = renderDecoratorChips(f.decorators);
                return `<tr>
              <td class="scope-mono">${escapeHtml(f.name)}</td>
              <td class="scope-mono">${typeStr}</td>
              <td>${decs}</td>
            </tr>`;
            }).join("")}</tbody>
        </table>`
            : "";
        cards.push(`
    <div class="scope-construct-card">
      <div class="scope-construct-card-header">
        <a href="${link}" class="scope-construct-link">${escapeHtml(concept.name)}</a>
        ${chips}
      </div>
      <div class="scope-construct-card-body">${fieldsHtml}</div>
    </div>`);
    }
    // Enum cards
    for (const en of enums) {
        const link = constructLink(domainName, "enum", en.name);
        const chips = renderDecoratorChips(en.decorators);
        const valuesHtml = en.values.map(v => `<span class="scope-chip pending">${escapeHtml(v)}</span>`).join(" ");
        cards.push(`
    <div class="scope-construct-card">
      <div class="scope-construct-card-header">
        <a href="${link}" class="scope-construct-link">${escapeHtml(en.name)}</a>
        <span class="scope-chip" style="border-color:${V2_TYPE_COLORS.enum};color:${V2_TYPE_COLORS.enum}">enum</span>
        ${chips}
      </div>
      <div class="scope-construct-card-body">${valuesHtml}</div>
    </div>`);
    }
    return `<div class="scope-construct-cards">${cards.join("")}</div>`;
}
// ===== Capability Cards =====
function buildCapabilityCards(capabilities, domainName, conceptDomainMap, enumNames) {
    const cards = [];
    for (const cap of capabilities) {
        const link = constructLink(domainName, "capability", cap.name);
        const chips = [
            renderImplChip(cap.decorators),
            renderVerifiedChip(cap.decorators),
        ].filter(Boolean).join(" ");
        // Signature
        const params = cap.params.map(p => `${p.name}: ${formatType(p.fieldType)}`).join(", ");
        const ret = cap.returnType ? formatType(cap.returnType) : "void";
        const sigHtml = `<div class="scope-mono" style="font-size: var(--scope-text-sm); margin-bottom: var(--scope-space-2)">${escapeHtml(cap.name)}(${escapeHtml(params)}) -> ${escapeHtml(ret)}</div>`;
        // Clause counts
        const given = cap.clauses.filter(c => c.type === "given").length;
        const then_ = cap.clauses.filter(c => c.type === "then").length;
        const affects = cap.clauses.filter(c => c.type === "affects").length;
        const reject = cap.clauses.filter(c => c.type === "reject").length;
        const emits = cap.clauses.filter(c => c.type === "emits").length;
        const via = cap.clauses.filter(c => c.type === "via").length;
        const clauseParts = [];
        if (given > 0)
            clauseParts.push(`given: ${given}`);
        if (then_ > 0)
            clauseParts.push(`then: ${then_}`);
        if (affects > 0)
            clauseParts.push(`affects: ${affects}`);
        if (reject > 0)
            clauseParts.push(`reject: ${reject}`);
        if (emits > 0)
            clauseParts.push(`emits: ${emits}`);
        if (via > 0)
            clauseParts.push(`via: ${via}`);
        const clauseHtml = clauseParts.length > 0
            ? `<div style="font-size: var(--scope-text-xs); color: var(--scope-text-secondary)">${clauseParts.join(" | ")}</div>`
            : "";
        // Via endpoint
        const viaClauses = cap.clauses.filter(c => c.type === "via");
        const viaHtml = viaClauses.length > 0
            ? viaClauses.map(v => {
                if (v.type !== "via")
                    return "";
                const decs = renderDecoratorChips(v.decorators);
                return `<div class="scope-mono" style="font-size: var(--scope-text-xs); color: var(--scope-text-secondary)">via ${escapeHtml(v.method)} ${escapeHtml(v.path)} ${decs}</div>`;
            }).join("")
            : "";
        // Emits
        const emitsClauses = cap.clauses.filter(c => c.type === "emits");
        const emitsHtml = emitsClauses.length > 0
            ? `<div style="font-size: var(--scope-text-xs); color: var(--scope-text-secondary)">emits: ${emitsClauses.map(e => e.type === "emits" ? escapeHtml(e.event) : "").join(", ")}</div>`
            : "";
        cards.push(`
    <div class="scope-construct-card">
      <div class="scope-construct-card-header">
        <a href="${link}" class="scope-construct-link">${escapeHtml(cap.name)}</a>
        ${chips}
      </div>
      <div class="scope-construct-card-body">
        ${sigHtml}
        ${clauseHtml}
        ${viaHtml}
        ${emitsHtml}
      </div>
    </div>`);
    }
    return `<div class="scope-construct-cards">${cards.join("")}</div>`;
}
// ===== Lifecycle Cards =====
function buildLifecycleCards(concepts, domainName, conceptDomainMap, enumNames) {
    const cards = [];
    for (const concept of concepts) {
        const lc = concept.lifecycle;
        const link = constructLink(domainName, "concept", concept.name);
        // Enum ref link
        const enumDomain = conceptDomainMap.get(lc.enumRef);
        const enumLink = enumDomain
            ? `<a href="${constructLink(enumDomain, 'enum', lc.enumRef)}" class="scope-construct-link">${escapeHtml(lc.enumRef)}</a>`
            : escapeHtml(lc.enumRef);
        // Transitions table
        const transitionsHtml = lc.transitions.length > 0
            ? `<table class="scope-construct-table">
          <thead><tr><th>From</th><th></th><th>To</th><th>Capability</th><th>Guard</th></tr></thead>
          <tbody>${lc.transitions.map(t => `<tr>
            <td class="scope-mono">${escapeHtml(t.from)}</td>
            <td>-></td>
            <td class="scope-mono">${escapeHtml(t.to)}</td>
            <td class="scope-mono">${escapeHtml(t.capability)}</td>
            <td class="scope-mono" style="color: var(--scope-text-secondary)">${t.requires ? escapeHtml(t.requires) : ""}</td>
          </tr>`).join("")}</tbody>
        </table>`
            : "";
        cards.push(`
    <div class="scope-construct-card">
      <div class="scope-construct-card-header">
        <a href="${link}" class="scope-construct-link">${escapeHtml(concept.name)}</a>
        <span class="scope-chip" style="border-color:${V2_TYPE_COLORS.lifecycle};color:${V2_TYPE_COLORS.lifecycle}">field: ${escapeHtml(lc.field)}</span>
        <span class="scope-mono" style="font-size: var(--scope-text-xs)">: ${enumLink}</span>
      </div>
      <div class="scope-construct-card-body">${transitionsHtml}</div>
    </div>`);
    }
    return `<div class="scope-construct-cards">${cards.join("")}</div>`;
}
// ===== Invariant Cards =====
function buildInvariantCards(invariants, domainName) {
    const conceptNames = new Set();
    // We don't have direct access to all concept names from the snapshot here,
    // but we can parse from expression text — kept simple
    const cards = [];
    for (const inv of invariants) {
        const link = constructLink(domainName, "invariant", inv.name);
        const scopeBadge = inv.scope === "global"
            ? `<span class="scope-chip" style="border-color:${V2_TYPE_COLORS.invariant};color:${V2_TYPE_COLORS.invariant}">global</span>`
            : `<span class="scope-chip" style="border-color:${V2_TYPE_COLORS.invariant};color:${V2_TYPE_COLORS.invariant}">local${inv.conceptName ? `: ${escapeHtml(inv.conceptName)}` : ""}</span>`;
        const chips = [
            scopeBadge,
            renderImplChip(inv.decorators),
        ].filter(Boolean).join(" ");
        cards.push(`
    <div class="scope-construct-card">
      <div class="scope-construct-card-header">
        <a href="${link}" class="scope-construct-link">${escapeHtml(inv.name)}</a>
        ${chips}
      </div>
      <div class="scope-construct-card-body">
        <div class="scope-mono" style="font-size: var(--scope-text-sm); white-space: pre-wrap">${escapeHtml(inv.expression)}</div>
      </div>
    </div>`);
    }
    return `<div class="scope-construct-cards">${cards.join("")}</div>`;
}
// ===== Property Cards =====
function buildPropertyCards(properties, domainName) {
    const cards = [];
    for (const prop of properties) {
        const link = constructLink(domainName, "property", prop.name);
        const chips = [
            renderImplChip(prop.decorators),
        ].filter(Boolean).join(" ");
        const clausesHtml = prop.clauses.map(clause => {
            const typeBadge = clause.type === "never"
                ? `<span class="scope-chip" style="background:#2A0A0A;border-color:#FF5252;color:#FF5252">never</span>`
                : clause.type === "eventually"
                    ? `<span class="scope-chip" style="background:#1A2A0A;border-color:#34D399;color:#34D399">eventually</span>`
                    : `<span class="scope-chip" style="background:#0A1A2A;border-color:#60A5FA;color:#60A5FA">always</span>`;
            const whereHtml = clause.type === "eventually" && clause.where
                ? ` <span class="scope-mono" style="font-size: var(--scope-text-xs); color: var(--scope-text-secondary)">where ${escapeHtml(clause.where)}</span>`
                : "";
            return `<div style="margin-bottom: var(--scope-space-1)">
        ${typeBadge}
        <span class="scope-mono" style="font-size: var(--scope-text-sm)">${escapeHtml(clause.expression)}</span>
        ${whereHtml}
      </div>`;
        }).join("");
        cards.push(`
    <div class="scope-construct-card">
      <div class="scope-construct-card-header">
        <a href="${link}" class="scope-construct-link">${escapeHtml(prop.name)}</a>
        ${chips}
      </div>
      <div class="scope-construct-card-body">${clausesHtml}</div>
    </div>`);
    }
    return `<div class="scope-construct-cards">${cards.join("")}</div>`;
}
// ===== Objective Cards =====
function buildObjectiveCards(objectives, domainName) {
    const cards = [];
    for (const obj of objectives) {
        const link = constructLink(domainName, "objective", obj.name);
        const personaBadge = obj.persona
            ? `<span class="scope-chip" style="border-color:${V2_TYPE_COLORS.objective};color:${V2_TYPE_COLORS.objective}">@persona(${escapeHtml(obj.persona)})</span>`
            : "";
        const chips = [
            personaBadge,
            renderImplChip(obj.decorators),
        ].filter(Boolean).join(" ");
        // Transitions table
        const transitionsHtml = obj.transitions.length > 0
            ? `<table class="scope-construct-table">
          <thead><tr><th>From</th><th></th><th>To</th><th>Trigger</th></tr></thead>
          <tbody>${obj.transitions.map(t => `<tr>
            <td class="scope-mono">${escapeHtml(t.from)}</td>
            <td>-></td>
            <td class="scope-mono">${escapeHtml(t.to)}</td>
            <td class="scope-mono" style="color: var(--scope-text-secondary)">${escapeHtml(t.trigger)}</td>
          </tr>`).join("")}</tbody>
        </table>`
            : "";
        cards.push(`
    <div class="scope-construct-card">
      <div class="scope-construct-card-header">
        <a href="${link}" class="scope-construct-link">${escapeHtml(obj.name)}</a>
        ${chips}
      </div>
      <div class="scope-construct-card-body">${transitionsHtml}</div>
    </div>`);
    }
    return `<div class="scope-construct-cards">${cards.join("")}</div>`;
}
//# sourceMappingURL=domain-detail.js.map