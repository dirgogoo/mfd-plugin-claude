/**
 * Construct detail page (Level 3 — Individual Construct)
 * Shows full detail of a single construct with relationship panel.
 */
import { makeKey } from "../relationships.js";
import { escapeHtml, formatTypeLinked, constructLink, componentLink, renderImplChip, renderTestsChip, buildEntityComponentMap, } from "./shared.js";
// ===== Relationship Mini-Graph (Phase 4) =====
function renderRelationshipDiagram(type, name, rels, snapshot) {
    if (!rels)
        return "";
    const neighbors = [];
    const addNeighbor = (ref, color, style, arrow) => {
        const id = `${ref.type}_${ref.name}`.replace(/[^a-zA-Z0-9_]/g, '_');
        if (!neighbors.some(n => n.id === id)) {
            neighbors.push({
                id,
                label: `${ref.type}:${ref.name}`,
                color,
                style,
                arrow,
            });
        }
    };
    // Inheritance
    if (rels.extendsParent)
        addNeighbor(rels.extendsParent, "#9370DB", "solid", "out");
    for (const ref of rels.extendedByChildren)
        addNeighbor(ref, "#9370DB", "dashed", "in");
    for (const ref of rels.implementsInterfaces)
        addNeighbor(ref, "#DDA0DD", "dashed", "out");
    for (const ref of rels.implementedByConcretes)
        addNeighbor(ref, "#DDA0DD", "dashed", "in");
    // Flows that use this construct
    for (const ref of rels.usedByFlows)
        addNeighbor(ref, "#00FF41", "solid", "in");
    // APIs that expose
    for (const ref of rels.exposedByApi) {
        addNeighbor({ component: ref.component ?? "", type: "api", name: `${ref.method} ${ref.path}` }, "#00E5FF", "solid", "out");
    }
    // States that govern
    for (const ref of rels.governedByStates)
        addNeighbor(ref, "#FF8C00", "dashed", "in");
    // Entities that reference
    for (const ref of rels.referencedByEntities) {
        addNeighbor({ component: ref.component ?? "", type: "entity", name: ref.entity }, "#00E5FF", "solid", "in");
    }
    // Emitted events
    for (const ref of rels.emitsEvents)
        addNeighbor(ref, "#FFD700", "solid", "out");
    // Involved entities
    for (const ref of rels.involvedEntities)
        addNeighbor(ref, "#00E5FF", "dashed", "out");
    // Involved events
    for (const ref of rels.involvedEvents)
        addNeighbor(ref, "#FFD700", "dashed", "out");
    // Rules
    for (const ref of rels.governedByRules)
        addNeighbor(ref, "#FF6347", "dashed", "in");
    // Actions from screens
    for (const ref of rels.actionSources)
        addNeighbor(ref, "#FF69B4", "solid", "in");
    // Called by actions
    for (const ref of rels.calledByActions)
        addNeighbor(ref, "#FF69B4", "dashed", "in");
    // Operations used by flows
    for (const ref of rels.usesOperations)
        addNeighbor(ref, "#FF6347", "solid", "out");
    // Flows that use this operation
    for (const ref of rels.usedByOperations)
        addNeighbor(ref, "#00FF41", "solid", "in");
    // Events that trigger this construct
    for (const ref of rels.triggeredByEvents)
        addNeighbor(ref, "#FFD700", "solid", "in");
    // Rules that trigger this operation
    for (const ref of rels.triggeredByRules)
        addNeighbor(ref, "#FF6347", "dashed", "in");
    // Operations triggered by this event
    for (const ref of rels.triggersOperations)
        addNeighbor(ref, "#FF6347", "solid", "out");
    // States triggered by this event
    for (const ref of rels.triggersStates)
        addNeighbor(ref, "#FF8C00", "solid", "out");
    // Enforces rules
    for (const ref of rels.enforcesRules)
        addNeighbor(ref, "#FF6347", "solid", "out");
    // Enforced by operations
    for (const ref of rels.enforcedByOperations)
        addNeighbor(ref, "#FF6347", "solid", "in");
    // Signal relationships
    for (const ref of rels.emitsSignals)
        addNeighbor(ref, "#E040FB", "solid", "out");
    for (const ref of rels.onSignals)
        addNeighbor(ref, "#E040FB", "dashed", "out");
    for (const ref of rels.signalEmittedByActions)
        addNeighbor(ref, "#E040FB", "dashed", "in");
    for (const ref of rels.signalListenedByActions)
        addNeighbor(ref, "#E040FB", "solid", "in");
    if (neighbors.length === 0)
        return "";
    // Limit to 12 neighbors for readability
    const limited = neighbors.slice(0, 12);
    const centerId = `center_${type}_${name}`.replace(/[^a-zA-Z0-9_]/g, '_');
    const lines = ["graph TB"];
    lines.push(`  ${centerId}["${type}:${name}"]:::centerNode`);
    for (const n of limited) {
        lines.push(`  ${n.id}["${n.label}"]`);
        const arrow = n.style === "dashed" ? "-.->" : "-->";
        if (n.arrow === "in") {
            lines.push(`  ${n.id} ${arrow} ${centerId}`);
        }
        else {
            lines.push(`  ${centerId} ${arrow} ${n.id}`);
        }
        lines.push(`  style ${n.id} stroke:${n.color},color:${n.color}`);
    }
    lines.push(`  classDef centerNode fill:#1A3A1A,stroke:#00FF41,stroke-width:2px,color:#00FF41`);
    const mermaidCode = lines.join("\n");
    return `
  <div class="scope-rel-diagram scope-diagram-container" data-diagram-type="relationship">
    <div class="mermaid">${escapeHtml(mermaidCode)}</div>
  </div>`;
}
export function renderConstructDetail(snapshot, componentName, type, itemName) {
    const comp = snapshot.model.components.find((c) => c.name === componentName);
    if (!comp) {
        return `<div class="scope-empty-state"><p>Component not found: ${escapeHtml(componentName)}</p></div>`;
    }
    const entityComponentMap = buildEntityComponentMap(snapshot.model, snapshot.constructComponentMap);
    const relKey = makeKey(componentName, type, itemName);
    const rels = snapshot.relationships.get(relKey);
    switch (type) {
        case "entity":
            return renderEntityDetail(snapshot, componentName, itemName, entityComponentMap, rels);
        case "enum":
            return renderEnumDetail(snapshot, componentName, itemName, rels);
        case "flow":
            return renderFlowDetail(snapshot, componentName, itemName, entityComponentMap, rels);
        case "state":
            return renderStateDetail(snapshot, componentName, itemName, entityComponentMap, rels);
        case "event":
            return renderEventDetail(snapshot, componentName, itemName, entityComponentMap, rels);
        case "signal":
            return renderSignalDetail(snapshot, componentName, itemName, entityComponentMap, rels);
        case "rule":
            return renderRuleDetail(snapshot, componentName, itemName, rels);
        case "element":
            return renderElementDetail(snapshot, componentName, itemName, entityComponentMap, rels);
        case "screen":
            return renderScreenDetail(snapshot, componentName, itemName, entityComponentMap, rels);
        case "journey":
            return renderJourneyDetail(snapshot, componentName, itemName, rels);
        case "operation":
            return renderOperationDetail(snapshot, componentName, itemName, entityComponentMap, rels);
        case "action":
            return renderActionDetail(snapshot, componentName, itemName, rels);
        case "api":
            return renderApiDetail(snapshot, componentName, itemName, entityComponentMap, rels);
        default:
            return `<div class="scope-empty-state"><p>Unknown construct type: ${escapeHtml(type)}</p></div>`;
    }
}
// ===== Header =====
function detailHeader(type, name, componentName, decorators, construct) {
    const isAbstract = decorators?.some((d) => d.name === "abstract");
    const isInterface = decorators?.some((d) => d.name === "interface");
    const abstractBadge = isAbstract ? `<span class="scope-badge-abstract">abstract</span> ` : "";
    const interfaceBadge = isInterface ? `<span class="scope-badge-interface">interface</span> ` : "";
    const inheritParts = [];
    if (construct?.extends) {
        inheritParts.push(`extends <span class="scope-mono">${escapeHtml(construct.extends)}</span>`);
    }
    if (construct?.implements?.length > 0) {
        inheritParts.push(`implements <span class="scope-mono">${escapeHtml(construct.implements.join(", "))}</span>`);
    }
    const inheritHtml = inheritParts.length > 0
        ? `<div style="font-size: var(--scope-text-sm); color: var(--scope-text-secondary); margin-top: 4px">${inheritParts.join(" ")}</div>`
        : "";
    return `
  <div class="scope-construct-header">
    <div class="scope-construct-header-top">
      <span class="scope-construct-type-badge">${abstractBadge}${interfaceBadge}${escapeHtml(type.toUpperCase())}</span>
      <span class="scope-construct-title">${escapeHtml(name)}</span>
    </div>
    <div class="scope-construct-header-meta">
      <span>Component: <a href="${componentLink(componentName)}" class="scope-construct-link">${escapeHtml(componentName)}</a></span>
      ${renderImplChip(decorators)}
      ${renderTestsChip(decorators)}
    </div>
    ${inheritHtml}
  </div>`;
}
// ===== Relationship Panel =====
function relationshipPanel(rels, entityComponentMap) {
    if (!rels)
        return "";
    const sections = [];
    if (rels.extendsParent) {
        sections.push(relSection("Extends", [rels.extendsParent]));
    }
    if (rels.extendedByChildren.length > 0) {
        sections.push(relSection("Extended by", rels.extendedByChildren));
    }
    if (rels.implementsInterfaces.length > 0) {
        sections.push(relSection("Implements", rels.implementsInterfaces));
    }
    if (rels.implementedByConcretes.length > 0) {
        sections.push(relSection("Implemented by", rels.implementedByConcretes));
    }
    if (rels.usedByFlows.length > 0) {
        sections.push(relSection("Used by (flows)", rels.usedByFlows));
    }
    if (rels.exposedByApi.length > 0) {
        const items = rels.exposedByApi.map((a) => `<span class="scope-chip" style="background: var(--scope-accent-muted); color: var(--scope-accent); border: 1px solid var(--scope-border)">${escapeHtml(a.method)}</span> <span class="scope-mono">${escapeHtml(a.path)}</span>`).join("<br>");
        sections.push(`<div class="scope-rel-section"><div class="scope-rel-title">Exposed in (API)</div><div class="scope-rel-items">${items}</div></div>`);
    }
    if (rels.governedByStates.length > 0) {
        sections.push(relSection("Governed by (states)", rels.governedByStates));
    }
    if (rels.governedByRules.length > 0) {
        sections.push(relSection("Governed by (rules)", rels.governedByRules));
    }
    if (rels.referencedByEntities.length > 0) {
        const items = rels.referencedByEntities.map((r) => {
            const eComp = entityComponentMap.get(r.entity) ?? r.component;
            return `<a href="${constructLink(eComp, 'entity', r.entity)}" class="scope-construct-link">${escapeHtml(r.entity)}.${escapeHtml(r.field)}</a>`;
        }).join("<br>");
        sections.push(`<div class="scope-rel-section"><div class="scope-rel-title">Referenced by (entities)</div><div class="scope-rel-items">${items}</div></div>`);
    }
    if (rels.emitsEvents.length > 0) {
        sections.push(relSection("Emits events", rels.emitsEvents));
    }
    if (rels.actionSources.length > 0) {
        sections.push(relSection("Actions (from screens)", rels.actionSources));
    }
    if (rels.involvedEntities.length > 0) {
        sections.push(relSection("Involved entities", rels.involvedEntities));
    }
    if (rels.involvedEvents.length > 0) {
        sections.push(relSection("Involved events", rels.involvedEvents));
    }
    if (rels.usesOperations.length > 0) {
        sections.push(relSection("Calls operations", rels.usesOperations));
    }
    if (rels.usedByOperations.length > 0) {
        sections.push(relSection("Used by (operations)", rels.usedByOperations));
    }
    if (rels.triggeredByEvents.length > 0) {
        sections.push(relSection("Triggered by (events)", rels.triggeredByEvents));
    }
    if (rels.triggeredByRules.length > 0) {
        sections.push(relSection("Triggered by (rules)", rels.triggeredByRules));
    }
    if (rels.triggersOperations.length > 0) {
        sections.push(relSection("Triggers (operations)", rels.triggersOperations));
    }
    if (rels.triggersStates.length > 0) {
        sections.push(relSection("Triggers (states)", rels.triggersStates));
    }
    if (rels.enforcesRules.length > 0) {
        sections.push(relSection("Enforces (rules)", rels.enforcesRules));
    }
    if (rels.enforcedByOperations.length > 0) {
        sections.push(relSection("Enforced by (operations)", rels.enforcedByOperations));
    }
    if (rels.emitsSignals.length > 0) {
        sections.push(relSection("Emits signals", rels.emitsSignals));
    }
    if (rels.onSignals.length > 0) {
        sections.push(relSection("Listens to signals", rels.onSignals));
    }
    if (rels.signalEmittedByActions.length > 0) {
        sections.push(relSection("Emitted by (actions)", rels.signalEmittedByActions));
    }
    if (rels.signalListenedByActions.length > 0) {
        sections.push(relSection("Listened by (actions)", rels.signalListenedByActions));
    }
    if (rels.handlesEndpoints.length > 0) {
        const items = rels.handlesEndpoints.map((a) => `<span class="scope-chip" style="background: var(--scope-accent-muted); color: var(--scope-accent); border: 1px solid var(--scope-border)">${escapeHtml(a.method)}</span> <span class="scope-mono">${escapeHtml(a.path)}</span>`).join("<br>");
        sections.push(`<div class="scope-rel-section"><div class="scope-rel-title">Handles (endpoint)</div><div class="scope-rel-items">${items}</div></div>`);
    }
    if (rels.callsEndpoints.length > 0) {
        const items = rels.callsEndpoints.map((a) => `<span class="scope-chip" style="background: var(--scope-accent-muted); color: var(--scope-accent); border: 1px solid var(--scope-border)">${escapeHtml(a.method)}</span> <span class="scope-mono">${escapeHtml(a.path)}</span>`).join("<br>");
        sections.push(`<div class="scope-rel-section"><div class="scope-rel-title">Calls (endpoint)</div><div class="scope-rel-items">${items}</div></div>`);
    }
    if (sections.length === 0)
        return "";
    return `
  <div class="scope-relationships-panel">
    <div class="scope-relationships-title">Relationships</div>
    <div class="scope-relationships-grid">
      ${sections.join("")}
    </div>
  </div>`;
}
function relSection(title, refs) {
    const items = refs.map((r) => `<a href="${constructLink(r.component, r.type, r.name)}" class="scope-construct-link">${escapeHtml(r.name)}</a>`).join("<br>");
    return `<div class="scope-rel-section"><div class="scope-rel-title">${escapeHtml(title)}</div><div class="scope-rel-items">${items}</div></div>`;
}
// ===== Entity Detail =====
function renderEntityDetail(snapshot, componentName, entityName, entityComponentMap, rels) {
    const enumNames = new Set(snapshot.model.enums.map((e) => e.name));
    const entity = snapshot.model.entities.find((e) => e.name === entityName);
    if (!entity) {
        return `<div class="scope-empty-state"><p>Entity not found: ${escapeHtml(entityName)}</p></div>`;
    }
    const fields = entity.fields
        .map((f) => {
        const typeStr = formatTypeLinked(f.fieldType, entityComponentMap, enumNames);
        const decs = f.decorators?.map((d) => {
            const params = d.params?.length ? `(${d.params.map((p) => p.value).join(", ")})` : "";
            return `<span class="scope-chip pending">@${escapeHtml(d.name)}${params}</span>`;
        }).join(" ") ?? "";
        return `<tr>
        <td class="scope-mono">${escapeHtml(f.name)}</td>
        <td class="scope-mono">${typeStr}</td>
        <td>${decs}</td>
      </tr>`;
    })
        .join("");
    return `
<div class="scope-construct-detail">
  ${detailHeader("entity", entityName, componentName, entity.decorators, entity)}

  ${renderRelationshipDiagram("entity", entityName, rels, snapshot)}

  <div class="scope-construct-body">
    <div class="scope-construct-section">
      <div class="scope-construct-section-title">Fields</div>
      <table class="scope-construct-table">
        <thead><tr><th>Name</th><th>Type</th><th>Decorators</th></tr></thead>
        <tbody>${fields}</tbody>
      </table>
    </div>
  </div>

  <div class="scope-construct-sidebar">
    ${relationshipPanel(rels, entityComponentMap)}
  </div>
</div>`;
}
// ===== Enum Detail =====
function renderEnumDetail(snapshot, componentName, enumName, rels) {
    const enumDecl = snapshot.model.enums.find((e) => e.name === enumName);
    if (!enumDecl) {
        return `<div class="scope-empty-state"><p>Enum not found: ${escapeHtml(enumName)}</p></div>`;
    }
    const values = enumDecl.values
        .map((v) => `<span class="scope-chip pending">${escapeHtml(typeof v === 'string' ? v : v.name ?? String(v))}</span>`)
        .join(" ");
    return `
<div class="scope-construct-detail">
  ${detailHeader("enum", enumName, componentName, enumDecl.decorators)}
  ${renderRelationshipDiagram("enum", enumName, rels, snapshot)}

  <div class="scope-construct-body">
    <div class="scope-construct-section">
      <div class="scope-construct-section-title">Values</div>
      <div>${values}</div>
    </div>
  </div>
  <div class="scope-construct-sidebar">
    ${relationshipPanel(rels, new Map())}
  </div>
</div>`;
}
// ===== Flow Detail =====
function renderFlowDetail(snapshot, componentName, flowName, entityComponentMap, rels) {
    const enumNames = new Set(snapshot.model.enums.map((e) => e.name));
    const flow = snapshot.model.flows.find((f) => f.name === flowName);
    if (!flow) {
        return `<div class="scope-empty-state"><p>Flow not found: ${escapeHtml(flowName)}</p></div>`;
    }
    const params = flow.params.map((p) => formatTypeLinked(p, entityComponentMap, enumNames)).join(", ");
    const ret = flow.returnType ? formatTypeLinked(flow.returnType, entityComponentMap, enumNames) : "void";
    // Extract trigger (on EventName) and emits (emits EventName) clauses
    const ccMap = snapshot.constructComponentMap;
    const triggerClauses = [];
    const emitsClauses = [];
    for (const item of flow.body) {
        if (item.type === "OnClause") {
            const evName = item.event;
            const eventComp = ccMap.get(`event:${evName}`);
            const link = eventComp
                ? `<a href="${constructLink(eventComp, 'event', evName)}" class="scope-construct-link">${escapeHtml(evName)}</a>`
                : escapeHtml(evName);
            triggerClauses.push(`<div class="scope-mono">on ${link}</div>`);
        }
        if (item.type === "EmitsClause") {
            const evName = item.event;
            const eventComp = ccMap.get(`event:${evName}`);
            const link = eventComp
                ? `<a href="${constructLink(eventComp, 'event', evName)}" class="scope-construct-link">${escapeHtml(evName)}</a>`
                : escapeHtml(evName);
            emitsClauses.push(`<div class="scope-mono">emits ${link}</div>`);
        }
    }
    const triggerHtml = triggerClauses.length > 0
        ? `<div class="scope-construct-section">
        <div class="scope-construct-section-title">Triggered by</div>
        ${triggerClauses.join("")}
      </div>`
        : "";
    const emitsHtml = emitsClauses.length > 0
        ? `<div class="scope-construct-section">
        <div class="scope-construct-section-title">Emits</div>
        ${emitsClauses.join("")}
      </div>`
        : "";
    const steps = flow.body.map((item, i) => {
        if (item.type === "FlowStep") {
            const step = item;
            const branches = step.branches?.map((branch, branchIndex) => `
        <div class="scope-flow-step scope-flow-branch">
          <span class="scope-flow-step-num">${i + 1}.${branchIndex + 1}</span>
          <span class="scope-mono">| ${escapeHtml(branch.condition)} -> ${linkifyFlowAction(escapeHtml(branch.action), entityComponentMap, snapshot)}</span>
        </div>
      `).join("");
            return `<div class="scope-flow-step">
        <span class="scope-flow-step-num">${i + 1}.</span>
        <span class="scope-mono">-> ${linkifyFlowAction(escapeHtml(step.action), entityComponentMap, snapshot)}</span>
      </div>
      ${branches}`;
        }
        if (item.type === "FlowOverrideStep") {
            const step = item;
            return `<div class="scope-flow-step scope-flow-override">
        <span class="scope-flow-step-num">${i + 1}.</span>
        <span class="scope-mono">override ${escapeHtml(step.target)} -> ${linkifyFlowAction(escapeHtml(step.action), entityComponentMap, snapshot)}</span>
      </div>`;
        }
        if (item.type === "SemanticComment") {
            return `<div class="scope-flow-step scope-flow-comment">
        <span class="scope-flow-step-num"></span>
        <span style="color: var(--scope-text-tertiary)"># ${escapeHtml(item.text || "")}</span>
      </div>`;
        }
        return "";
    }).join("");
    return `
<div class="scope-construct-detail">
  ${detailHeader("flow", flowName, componentName, flow.decorators, flow)}

  ${renderRelationshipDiagram("flow", flowName, rels, snapshot)}

  <div class="scope-construct-body">
    <div class="scope-construct-section">
      <div class="scope-construct-section-title">Signature</div>
      <div class="scope-mono" style="font-size: var(--scope-text-sm)">${escapeHtml(flowName)}(${params}) -> ${ret}</div>
    </div>

    ${triggerHtml}
    ${emitsHtml}

    <div class="scope-construct-section">
      <div class="scope-construct-section-title">Steps</div>
      <div class="scope-flow-steps">${steps}</div>
    </div>
  </div>

  <div class="scope-construct-sidebar">
    ${relationshipPanel(rels, entityComponentMap)}
  </div>
</div>`;
}
function linkifyFlowAction(actionHtml, entityComponentMap, snapshot) {
    // Replace known entity/event names with links
    let result = actionHtml;
    for (const [name, comp] of entityComponentMap) {
        const regex = new RegExp(`\\b${escapeRegex(escapeHtml(name))}\\b`, "g");
        result = result.replace(regex, `<a href="${constructLink(comp, 'entity', name)}" class="scope-construct-link">${escapeHtml(name)}</a>`);
    }
    // Also check events using central map
    const ccMap = snapshot.constructComponentMap;
    for (const event of snapshot.model.events) {
        const evComp = ccMap.get(`event:${event.name}`);
        if (evComp) {
            const regex = new RegExp(`\\b${escapeRegex(escapeHtml(event.name))}\\b`, "g");
            result = result.replace(regex, `<a href="${constructLink(evComp, 'event', event.name)}" class="scope-construct-link">${escapeHtml(event.name)}</a>`);
        }
    }
    return result;
}
function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
// ===== State Detail =====
function renderStateDetail(snapshot, componentName, stateName, entityComponentMap, rels) {
    const state = snapshot.model.states.find((s) => s.name === stateName);
    if (!state) {
        return `<div class="scope-empty-state"><p>State not found: ${escapeHtml(stateName)}</p></div>`;
    }
    const enumRefComp = entityComponentMap.get(state.enumRef);
    const enumLink = enumRefComp
        ? `<a href="${constructLink(enumRefComp, 'enum', state.enumRef)}" class="scope-construct-link">${escapeHtml(state.enumRef)}</a>`
        : escapeHtml(state.enumRef);
    const transitions = state.transitions
        .map((t) => `<tr>
      <td class="scope-mono">${escapeHtml(t.from)}</td>
      <td>-></td>
      <td class="scope-mono">${escapeHtml(t.to)}</td>
      <td class="scope-mono" style="color: var(--scope-text-secondary)">${t.event ? escapeHtml(t.event) : ""}</td>
    </tr>`)
        .join("");
    return `
<div class="scope-construct-detail">
  ${detailHeader("state", stateName, componentName, state.decorators)}

  ${renderRelationshipDiagram("state", stateName, rels, snapshot)}

  <div class="scope-construct-body">
    <div class="scope-construct-section">
      <div class="scope-construct-section-title">Enum</div>
      <div>${enumLink}</div>
    </div>

    <div class="scope-construct-section">
      <div class="scope-construct-section-title">Transitions</div>
      <table class="scope-construct-table">
        <thead><tr><th>From</th><th></th><th>To</th><th>Trigger</th></tr></thead>
        <tbody>${transitions}</tbody>
      </table>
    </div>
  </div>

  <div class="scope-construct-sidebar">
    ${relationshipPanel(rels, entityComponentMap)}
  </div>
</div>`;
}
// ===== Event Detail =====
function renderEventDetail(snapshot, componentName, eventName, entityComponentMap, rels) {
    const enumNames = new Set(snapshot.model.enums.map((e) => e.name));
    const event = snapshot.model.events.find((e) => e.name === eventName);
    if (!event) {
        return `<div class="scope-empty-state"><p>Event not found: ${escapeHtml(eventName)}</p></div>`;
    }
    const fields = event.fields
        .map((f) => `<tr>
      <td class="scope-mono">${escapeHtml(f.name)}</td>
      <td class="scope-mono">${formatTypeLinked(f.fieldType, entityComponentMap, enumNames)}</td>
    </tr>`)
        .join("");
    return `
<div class="scope-construct-detail">
  ${detailHeader("event", eventName, componentName, event.decorators, event)}

  ${renderRelationshipDiagram("event", eventName, rels, snapshot)}

  <div class="scope-construct-body">
    <div class="scope-construct-section">
      <div class="scope-construct-section-title">Payload</div>
      <table class="scope-construct-table">
        <thead><tr><th>Field</th><th>Type</th></tr></thead>
        <tbody>${fields}</tbody>
      </table>
    </div>
  </div>

  <div class="scope-construct-sidebar">
    ${relationshipPanel(rels, entityComponentMap)}
  </div>
</div>`;
}
// ===== Signal Detail =====
function renderSignalDetail(snapshot, componentName, signalName, entityComponentMap, rels) {
    const enumNames = new Set(snapshot.model.enums.map((e) => e.name));
    const signal = snapshot.model.signals.find((s) => s.name === signalName);
    if (!signal) {
        return `<div class="scope-empty-state"><p>Signal not found: ${escapeHtml(signalName)}</p></div>`;
    }
    const fields = signal.fields
        .map((f) => `<tr>
      <td class="scope-mono">${escapeHtml(f.name)}</td>
      <td class="scope-mono">${formatTypeLinked(f.fieldType, entityComponentMap, enumNames)}</td>
    </tr>`)
        .join("");
    return `
<div class="scope-construct-detail">
  ${detailHeader("signal", signalName, componentName, signal.decorators, signal)}

  ${renderRelationshipDiagram("signal", signalName, rels, snapshot)}

  <div class="scope-construct-body">
    <div class="scope-construct-section">
      <div class="scope-construct-section-title">Payload</div>
      <table class="scope-construct-table">
        <thead><tr><th>Field</th><th>Type</th></tr></thead>
        <tbody>${fields}</tbody>
      </table>
    </div>
  </div>

  <div class="scope-construct-sidebar">
    ${relationshipPanel(rels, entityComponentMap)}
  </div>
</div>`;
}
// ===== Rule Detail =====
function renderRuleDetail(snapshot, componentName, ruleName, rels) {
    const rule = snapshot.model.rules.find((r) => r.name === ruleName);
    if (!rule) {
        return `<div class="scope-empty-state"><p>Rule not found: ${escapeHtml(ruleName)}</p></div>`;
    }
    const clauses = rule.body.map((clause) => {
        if (clause.type === "WhenClause") {
            return `<div class="scope-rule-clause"><span class="scope-rule-keyword">when</span> ${escapeHtml(clause.expression)}</div>`;
        }
        if (clause.type === "ThenClause") {
            return `<div class="scope-rule-clause"><span class="scope-rule-keyword">then</span> ${escapeHtml(clause.action)}</div>`;
        }
        if (clause.type === "ElseIfClause") {
            return `<div class="scope-rule-clause"><span class="scope-rule-keyword">elseif</span> ${escapeHtml(clause.condition)} <span class="scope-rule-keyword">then</span> ${escapeHtml(clause.action)}</div>`;
        }
        if (clause.type === "ElseClause") {
            return `<div class="scope-rule-clause"><span class="scope-rule-keyword">else</span> ${escapeHtml(clause.action)}</div>`;
        }
        return "";
    }).join("");
    return `
<div class="scope-construct-detail">
  ${detailHeader("rule", ruleName, componentName, rule.decorators)}

  ${renderRelationshipDiagram("rule", ruleName, rels, snapshot)}

  <div class="scope-construct-body">
    <div class="scope-construct-section">
      <div class="scope-construct-section-title">Clauses</div>
      <div class="scope-rule-clauses">${clauses}</div>
    </div>
  </div>

  <div class="scope-construct-sidebar">
    ${relationshipPanel(rels, new Map())}
  </div>
</div>`;
}
// ===== Element Detail =====
function renderElementDetail(snapshot, componentName, elementName, entityComponentMap, rels) {
    const enumNames = new Set(snapshot.model.enums.map((e) => e.name));
    const element = snapshot.model.elements.find((e) => e.name === elementName);
    if (!element) {
        return `<div class="scope-empty-state"><p>Element not found: ${escapeHtml(elementName)}</p></div>`;
    }
    const props = element.body.filter((b) => b.type === "PropDecl");
    const forms = element.body.filter((b) => b.type === "FormDecl");
    const propsHtml = props.length > 0
        ? `<div class="scope-construct-section">
        <div class="scope-construct-section-title">Props</div>
        <table class="scope-construct-table">
          <thead><tr><th>Name</th><th>Type</th></tr></thead>
          <tbody>${props.map((p) => `<tr><td class="scope-mono">${escapeHtml(p.name)}</td><td class="scope-mono">${formatTypeLinked(p.propType, entityComponentMap, enumNames)}</td></tr>`).join("")}</tbody>
        </table>
      </div>`
        : "";
    const formsHtml = forms.length > 0
        ? `<div class="scope-construct-section">
        <div class="scope-construct-section-title">Forms</div>
        ${forms.map((f) => {
            const fields = f.fields?.map((field) => `<div class="scope-entity-field"><span class="scope-entity-field-name">${escapeHtml(field.name)}</span><span class="scope-entity-field-type">${formatTypeLinked(field.fieldType, entityComponentMap, enumNames)}</span></div>`).join("") ?? "";
            return `<div class="scope-entity-card"><div class="scope-entity-card-name">${escapeHtml(f.name ?? "anonymous")}</div><div class="scope-entity-fields">${fields}</div></div>`;
        }).join("")}
      </div>`
        : "";
    return `
<div class="scope-construct-detail">
  ${detailHeader("element", elementName, componentName, element.decorators, element)}

  ${renderRelationshipDiagram("element", elementName, rels, snapshot)}

  <div class="scope-construct-body">
    ${propsHtml}
    ${formsHtml}
  </div>

  <div class="scope-construct-sidebar">
    ${relationshipPanel(rels, entityComponentMap)}
  </div>
</div>`;
}
// ===== Screen Detail =====
function renderScreenDetail(snapshot, componentName, screenName, entityComponentMap, rels) {
    const enumNames = new Set(snapshot.model.enums.map((e) => e.name));
    const screen = snapshot.model.screens.find((s) => s.name === screenName);
    if (!screen) {
        return `<div class="scope-empty-state"><p>Screen not found: ${escapeHtml(screenName)}</p></div>`;
    }
    const layoutDec = screen.decorators?.find((d) => d.name === "layout");
    const layoutLabel = layoutDec ? ` @layout(${layoutDec.params[0]?.value ?? ""})` : "";
    const forms = screen.body.filter((b) => b.type === "FormDecl");
    const formsHtml = forms.length > 0
        ? `<div class="scope-construct-section">
        <div class="scope-construct-section-title">Forms</div>
        ${forms.map((f) => {
            const fields = f.fields?.map((field) => `<div class="scope-entity-field"><span class="scope-entity-field-name">${escapeHtml(field.name)}</span><span class="scope-entity-field-type">${formatTypeLinked(field.fieldType, entityComponentMap, enumNames)}</span></div>`).join("") ?? "";
            return `<div class="scope-entity-card"><div class="scope-entity-card-name">${escapeHtml(f.name ?? "anonymous")}</div><div class="scope-entity-fields">${fields}</div></div>`;
        }).join("")}
      </div>`
        : "";
    return `
<div class="scope-construct-detail">
  ${detailHeader(`screen${layoutLabel}`, screenName, componentName, screen.decorators, screen)}

  ${renderRelationshipDiagram("screen", screenName, rels, snapshot)}

  <div class="scope-construct-body">
    ${formsHtml}
  </div>

  <div class="scope-construct-sidebar">
    ${relationshipPanel(rels, entityComponentMap)}
  </div>
</div>`;
}
// ===== Journey Detail =====
function renderJourneyDetail(snapshot, componentName, journeyName, rels) {
    const journey = snapshot.model.journeys.find((j) => j.name === journeyName);
    if (!journey) {
        return `<div class="scope-empty-state"><p>Journey not found: ${escapeHtml(journeyName)}</p></div>`;
    }
    const personaDec = journey.decorators?.find((d) => d.name === "persona");
    const persona = personaDec ? personaDec.params[0]?.value ?? "" : "";
    const ccMap = snapshot.constructComponentMap;
    const steps = journey.body.filter((b) => b.type === "JourneyStep");
    const stepsHtml = steps.map((s) => {
        const fromLink = s.from === "*" ? `<span class="scope-mono">*</span>` : (() => {
            const sComp = ccMap.get(`screen:${s.from}`);
            if (sComp) {
                return `<a href="${constructLink(sComp, 'screen', s.from)}" class="scope-construct-link">${escapeHtml(s.from)}</a>`;
            }
            return `<span class="scope-mono">${escapeHtml(s.from)}</span>`;
        })();
        const toLink = s.to === "end" ? `<span class="scope-mono">end</span>` : (() => {
            const sComp = ccMap.get(`screen:${s.to}`);
            if (sComp) {
                return `<a href="${constructLink(sComp, 'screen', s.to)}" class="scope-construct-link">${escapeHtml(s.to)}</a>`;
            }
            return `<span class="scope-mono">${escapeHtml(s.to)}</span>`;
        })();
        return `<tr>
      <td>${fromLink}</td>
      <td>-></td>
      <td>${toLink}</td>
      <td class="scope-mono" style="color: var(--scope-text-secondary)">on ${escapeHtml(s.trigger)}</td>
    </tr>`;
    }).join("");
    return `
<div class="scope-construct-detail">
  ${detailHeader("journey", journeyName, componentName, journey.decorators)}

  ${renderRelationshipDiagram("journey", journeyName, rels, snapshot)}

  <div class="scope-construct-body">
    ${persona ? `<div class="scope-construct-section"><div class="scope-construct-section-title">Persona</div><div class="scope-mono">${escapeHtml(persona)}</div></div>` : ""}
    <div class="scope-construct-section">
      <div class="scope-construct-section-title">Steps</div>
      <table class="scope-construct-table">
        <thead><tr><th>From</th><th></th><th>To</th><th>Trigger</th></tr></thead>
        <tbody>${stepsHtml}</tbody>
      </table>
    </div>
  </div>

  <div class="scope-construct-sidebar">
    ${relationshipPanel(rels, new Map())}
  </div>
</div>`;
}
// ===== Operation Detail =====
function renderOperationDetail(snapshot, componentName, operationName, entityComponentMap, rels) {
    const enumNames = new Set(snapshot.model.enums.map((e) => e.name));
    const operation = snapshot.model.operations.find((o) => o.name === operationName);
    if (!operation) {
        return `<div class="scope-empty-state"><p>Operation not found: ${escapeHtml(operationName)}</p></div>`;
    }
    const params = operation.params.map((p) => formatTypeLinked(p, entityComponentMap, enumNames)).join(", ");
    const ret = operation.returnType ? formatTypeLinked(operation.returnType, entityComponentMap, enumNames) : "void";
    const ccMap = snapshot.constructComponentMap;
    const emitsClauses = [];
    const onClauses = [];
    const enforcesClauses = [];
    const handlesClauses = [];
    const callsApiClauses = [];
    const comments = [];
    for (const item of operation.body) {
        if (item.type === "EmitsClause") {
            const evName = item.event;
            const eventComp = ccMap.get(`event:${evName}`);
            const link = eventComp
                ? `<a href="${constructLink(eventComp, 'event', evName)}" class="scope-construct-link">${escapeHtml(evName)}</a>`
                : escapeHtml(evName);
            emitsClauses.push(`<div class="scope-mono">emits ${link}</div>`);
        }
        if (item.type === "OnClause") {
            const evName = item.event;
            const eventComp = ccMap.get(`event:${evName}`);
            const link = eventComp
                ? `<a href="${constructLink(eventComp, 'event', evName)}" class="scope-construct-link">${escapeHtml(evName)}</a>`
                : escapeHtml(evName);
            onClauses.push(`<div class="scope-mono">on ${link}</div>`);
        }
        if (item.type === "EnforcesClause") {
            const ruleName = item.rule;
            const ruleComp = ccMap.get(`rule:${ruleName}`);
            const link = ruleComp
                ? `<a href="${constructLink(ruleComp, 'rule', ruleName)}" class="scope-construct-link">${escapeHtml(ruleName)}</a>`
                : escapeHtml(ruleName);
            enforcesClauses.push(`<div class="scope-mono">enforces ${link}</div>`);
        }
        if (item.type === "OperationHandlesClause") {
            handlesClauses.push(`<div class="scope-mono"><span class="scope-chip" style="background: var(--scope-accent-muted); color: var(--scope-accent); border: 1px solid var(--scope-border)">${escapeHtml(item.method)}</span> ${escapeHtml(item.path)}</div>`);
        }
        if (item.type === "OperationCallsClause") {
            callsApiClauses.push(`<div class="scope-mono"><span class="scope-chip" style="background: var(--scope-accent-muted); color: var(--scope-accent); border: 1px solid var(--scope-border)">${escapeHtml(item.method)}</span> ${escapeHtml(item.path)}</div>`);
        }
        if (item.type === "SemanticComment") {
            comments.push(item.text);
        }
    }
    const commentHtml = comments.length > 0
        ? `<div class="scope-construct-section">
        <div class="scope-construct-section-title">Description</div>
        <div style="color: var(--scope-text-secondary)">${comments.map((c) => escapeHtml(c)).join("<br>")}</div>
      </div>`
        : "";
    const emitsHtml = emitsClauses.length > 0
        ? `<div class="scope-construct-section">
        <div class="scope-construct-section-title">Emits</div>
        ${emitsClauses.join("")}
      </div>`
        : "";
    const onHtml = onClauses.length > 0
        ? `<div class="scope-construct-section">
        <div class="scope-construct-section-title">Triggered by</div>
        ${onClauses.join("")}
      </div>`
        : "";
    const enforcesHtml = enforcesClauses.length > 0
        ? `<div class="scope-construct-section">
        <div class="scope-construct-section-title">Enforces</div>
        ${enforcesClauses.join("")}
      </div>`
        : "";
    const handlesHtml = handlesClauses.length > 0
        ? `<div class="scope-construct-section">
        <div class="scope-construct-section-title">Handles (endpoint)</div>
        ${handlesClauses.join("")}
      </div>`
        : "";
    const callsApiHtml = callsApiClauses.length > 0
        ? `<div class="scope-construct-section">
        <div class="scope-construct-section-title">Calls (endpoint)</div>
        ${callsApiClauses.join("")}
      </div>`
        : "";
    return `
<div class="scope-construct-detail">
  ${detailHeader("operation", operationName, componentName, operation.decorators)}

  ${renderRelationshipDiagram("operation", operationName, rels, snapshot)}

  <div class="scope-construct-body">
    <div class="scope-construct-section">
      <div class="scope-construct-section-title">Signature</div>
      <div class="scope-mono" style="font-size: var(--scope-text-sm)">${escapeHtml(operationName)}(${params}) -> ${ret}</div>
    </div>

    ${commentHtml}
    ${handlesHtml}
    ${callsApiHtml}
    ${emitsHtml}
    ${onHtml}
    ${enforcesHtml}
  </div>

  <div class="scope-construct-sidebar">
    ${relationshipPanel(rels, entityComponentMap)}
  </div>
</div>`;
}
// ===== Action Detail =====
function renderActionDetail(snapshot, componentName, actionName, rels) {
    const action = snapshot.model.actions.find((a) => a.name === actionName);
    if (!action) {
        return `<div class="scope-empty-state"><p>Action not found: ${escapeHtml(actionName)}</p></div>`;
    }
    const ccMap = snapshot.constructComponentMap;
    let fromHtml = "";
    let callsHtml = "";
    let onStreamHtml = "";
    let onSignalHtml = "";
    let emitsSignalHtml = "";
    const resultRows = [];
    for (const item of action.body) {
        if (item.type === "ActionFromClause") {
            const screenComp = ccMap.get(`screen:${item.screen}`);
            const link = screenComp
                ? `<a href="${constructLink(screenComp, 'screen', item.screen)}" class="scope-construct-link">${escapeHtml(item.screen)}</a>`
                : escapeHtml(item.screen);
            fromHtml = `<div class="scope-construct-section"><div class="scope-construct-section-title">From</div><div class="scope-mono">${link}</div></div>`;
        }
        if (item.type === "ActionCallsClause") {
            callsHtml = `<div class="scope-construct-section"><div class="scope-construct-section-title">Calls (imperative)</div><div class="scope-mono">${escapeHtml(item.method)} ${escapeHtml(item.path)}</div></div>`;
        }
        if (item.type === "ActionOnStreamClause") {
            onStreamHtml = `<div class="scope-construct-section"><div class="scope-construct-section-title">On STREAM (reactive)</div><div class="scope-mono">STREAM ${escapeHtml(item.path)}</div></div>`;
        }
        if (item.type === "ActionOnSignalClause") {
            const sigName = item.signal;
            const sigComp = ccMap.get(`signal:${sigName}`);
            const link = sigComp
                ? `<a href="${constructLink(sigComp, 'signal', sigName)}" class="scope-construct-link">${escapeHtml(sigName)}</a>`
                : escapeHtml(sigName);
            onSignalHtml = `<div class="scope-construct-section"><div class="scope-construct-section-title">On Signal (reactive)</div><div class="scope-mono">on ${link}</div></div>`;
        }
        if (item.type === "ActionEmitsSignalClause") {
            const sigName = item.signal;
            const sigComp = ccMap.get(`signal:${sigName}`);
            const link = sigComp
                ? `<a href="${constructLink(sigComp, 'signal', sigName)}" class="scope-construct-link">${escapeHtml(sigName)}</a>`
                : escapeHtml(sigName);
            emitsSignalHtml = `<div class="scope-construct-section"><div class="scope-construct-section-title">Emits Signal</div><div class="scope-mono">emits ${link}</div></div>`;
        }
        if (item.type === "ActionResult") {
            const screenName = item.screen;
            const screenComp = screenName !== "end" ? ccMap.get(`screen:${screenName}`) : null;
            const link = screenComp
                ? `<a href="${constructLink(screenComp, 'screen', screenName)}" class="scope-construct-link">${escapeHtml(screenName)}</a>`
                : escapeHtml(screenName);
            resultRows.push(`<tr><td class="scope-mono">${escapeHtml(item.outcome)}</td><td>${link}</td></tr>`);
        }
    }
    const pattern = (onStreamHtml || onSignalHtml) ? "reactive" : "imperative";
    const resultsHtml = resultRows.length > 0
        ? `<div class="scope-construct-section">
        <div class="scope-construct-section-title">Results</div>
        <table class="scope-construct-table">
          <thead><tr><th>Outcome</th><th>Screen</th></tr></thead>
          <tbody>${resultRows.join("")}</tbody>
        </table>
      </div>`
        : "";
    return `
<div class="scope-construct-detail">
  ${detailHeader(`action (${pattern})`, actionName, componentName, action.decorators)}

  ${renderRelationshipDiagram("action", actionName, rels, snapshot)}

  <div class="scope-construct-body">
    ${fromHtml}
    ${callsHtml}
    ${onStreamHtml}
    ${onSignalHtml}
    ${emitsSignalHtml}
    ${resultsHtml}
  </div>

  <div class="scope-construct-sidebar">
    ${relationshipPanel(rels, new Map())}
  </div>
</div>`;
}
// ===== API Detail =====
const METHOD_COLORS = {
    GET: { bg: "#dcfce7", fg: "#166534" },
    POST: { bg: "#dbeafe", fg: "#1e40af" },
    PUT: { bg: "#fef9c3", fg: "#854d0e" },
    DELETE: { bg: "#fee2e2", fg: "#991b1b" },
    PATCH: { bg: "#ffedd5", fg: "#9a3412" },
    STREAM: { bg: "#f3e8ff", fg: "#6b21a8" },
};
function methodChip(method) {
    const colors = METHOD_COLORS[method] || { bg: "var(--scope-accent-muted)", fg: "var(--scope-accent)" };
    return `<span class="scope-chip" style="background: ${colors.bg}; color: ${colors.fg}; border: 1px solid ${colors.bg}; font-weight: 600; font-size: 11px; letter-spacing: 0.5px">${escapeHtml(method)}</span>`;
}
function renderApiDetail(snapshot, componentName, apiName, entityComponentMap, rels) {
    const enumNames = new Set(snapshot.model.enums.map((e) => e.name));
    const api = snapshot.model.apis.find((a) => (a.name || "api") === apiName);
    if (!api) {
        return `<div class="scope-empty-state"><p>API not found: ${escapeHtml(apiName)}</p></div>`;
    }
    const ccMap = snapshot.constructComponentMap;
    const isExternal = api.decorators?.some((d) => d.name === "external") ?? false;
    const prefixDec = api.decorators?.find((d) => d.name === "prefix");
    const prefix = prefixDec ? String(prefixDec.params[0]?.value ?? "") : "";
    // === Info section ===
    const infoParts = [];
    infoParts.push(`<div><strong>Style:</strong> ${escapeHtml(api.style)}</div>`);
    if (prefix) {
        infoParts.push(`<div><strong>Prefix:</strong> <span class="scope-mono">${escapeHtml(prefix)}</span></div>`);
    }
    if (isExternal) {
        infoParts.push(`<div><span class="scope-chip" style="background: #fef3c7; color: #92400e; border: 1px solid #fde68a">@external</span></div>`);
    }
    const infoHtml = `<div class="scope-construct-section">
    <div class="scope-construct-section-title">Info</div>
    <div style="display: flex; flex-direction: column; gap: 4px">${infoParts.join("")}</div>
  </div>`;
    // === Endpoints table ===
    const endpointRows = api.endpoints.map((ep) => {
        const fullPath = prefix + ep.path;
        const inputTypeAst = ep.type === "ApiEndpointSimple" ? ep.inputType : ep.body;
        const outputTypeAst = ep.type === "ApiEndpointSimple" ? ep.returnType : ep.response;
        const inputHtml = inputTypeAst ? formatTypeLinked(inputTypeAst, entityComponentMap, enumNames) : "&mdash;";
        const outputHtml = outputTypeAst ? formatTypeLinked(outputTypeAst, entityComponentMap, enumNames) : "&mdash;";
        const decoratorChips = [];
        for (const d of (ep.decorators || [])) {
            if (d.name === "auth")
                decoratorChips.push(`<span class="scope-chip" style="background: #fef3c7; color: #92400e; border: 1px solid #fde68a">@auth</span>`);
            else if (d.name === "rate_limit") {
                const val = d.params?.[0] ? d.params[0].value : "";
                decoratorChips.push(`<span class="scope-chip" style="background: var(--scope-accent-muted); color: var(--scope-accent); border: 1px solid var(--scope-border)">@rate_limit(${escapeHtml(String(val))})</span>`);
            }
            else if (d.name === "cache") {
                const val = d.params?.[0] ? d.params[0].value : "";
                decoratorChips.push(`<span class="scope-chip" style="background: var(--scope-accent-muted); color: var(--scope-accent); border: 1px solid var(--scope-border)">@cache(${escapeHtml(String(val))})</span>`);
            }
        }
        const decoHtml = decoratorChips.length > 0 ? `<div style="margin-top: 2px">${decoratorChips.join(" ")}</div>` : "";
        return `<tr>
      <td>${methodChip(ep.method)}</td>
      <td class="scope-mono" style="font-size: var(--scope-text-xs)">${escapeHtml(fullPath)}</td>
      <td style="font-size: var(--scope-text-xs)">${inputHtml}</td>
      <td style="font-size: var(--scope-text-xs)">${outputHtml}</td>
      <td>${decoHtml}</td>
    </tr>`;
    });
    const endpointsHtml = endpointRows.length > 0
        ? `<div class="scope-construct-section">
        <div class="scope-construct-section-title">Endpoints (${endpointRows.length})</div>
        <table class="scope-construct-table">
          <thead><tr><th>Method</th><th>Path</th><th>Input</th><th>Output</th><th>Decorators</th></tr></thead>
          <tbody>${endpointRows.join("")}</tbody>
        </table>
      </div>`
        : "";
    // === Handlers: operations that handle this API's endpoints ===
    const resolvedPaths = api.endpoints.map((ep) => ({
        method: ep.method,
        fullPath: prefix + ep.path,
    }));
    const handlerRows = [];
    for (const op of snapshot.model.operations) {
        for (const item of op.body) {
            if (item.type === "OperationHandlesClause") {
                const clause = item;
                const matched = resolvedPaths.find((rp) => rp.method === clause.method && rp.fullPath === clause.path);
                if (matched) {
                    const opComp = ccMap.get(`operation:${op.name}`);
                    const link = opComp
                        ? `<a href="${constructLink(opComp, 'operation', op.name)}" class="scope-construct-link">${escapeHtml(op.name)}</a>`
                        : escapeHtml(op.name);
                    handlerRows.push(`<tr>
            <td>${link}</td>
            <td><span class="scope-chip" style="background: var(--scope-accent-muted); color: var(--scope-accent); border: 1px solid var(--scope-border); font-size: 10px">operation</span></td>
            <td>${methodChip(matched.method)} <span class="scope-mono" style="font-size: var(--scope-text-xs)">${escapeHtml(matched.fullPath)}</span></td>
          </tr>`);
                }
            }
        }
    }
    for (const flow of snapshot.model.flows) {
        for (const item of flow.body) {
            if (item.type === "OperationHandlesClause") {
                const clause = item;
                const matched = resolvedPaths.find((rp) => rp.method === clause.method && rp.fullPath === clause.path);
                if (matched) {
                    const flowComp = ccMap.get(`flow:${flow.name}`);
                    const link = flowComp
                        ? `<a href="${constructLink(flowComp, 'flow', flow.name)}" class="scope-construct-link">${escapeHtml(flow.name)}</a>`
                        : escapeHtml(flow.name);
                    handlerRows.push(`<tr>
            <td>${link}</td>
            <td><span class="scope-chip" style="background: var(--scope-accent-muted); color: var(--scope-accent); border: 1px solid var(--scope-border); font-size: 10px">flow</span></td>
            <td>${methodChip(matched.method)} <span class="scope-mono" style="font-size: var(--scope-text-xs)">${escapeHtml(matched.fullPath)}</span></td>
          </tr>`);
                }
            }
        }
    }
    const handlersHtml = handlerRows.length > 0
        ? `<div class="scope-construct-section">
        <div class="scope-construct-section-title">Handlers (${handlerRows.length})</div>
        <table class="scope-construct-table">
          <thead><tr><th>Name</th><th>Type</th><th>Endpoint</th></tr></thead>
          <tbody>${handlerRows.join("")}</tbody>
        </table>
      </div>`
        : "";
    // === Consumers: actions that call this API's endpoints ===
    const consumerRows = [];
    for (const action of snapshot.model.actions) {
        for (const item of action.body) {
            if (item.type === "ActionCallsClause") {
                const clause = item;
                const matched = resolvedPaths.find((rp) => rp.method === clause.method && rp.fullPath === clause.path);
                if (matched) {
                    const actionComp = ccMap.get(`action:${action.name}`);
                    const link = actionComp
                        ? `<a href="${constructLink(actionComp, 'action', action.name)}" class="scope-construct-link">${escapeHtml(action.name)}</a>`
                        : escapeHtml(action.name);
                    // Find from screen
                    const fromClause = action.body.find((b) => b.type === "ActionFromClause");
                    const fromScreen = fromClause?.screen ?? "";
                    const screenComp = fromScreen ? ccMap.get(`screen:${fromScreen}`) : null;
                    const screenLink = screenComp
                        ? `<a href="${constructLink(screenComp, 'screen', fromScreen)}" class="scope-construct-link">${escapeHtml(fromScreen)}</a>`
                        : escapeHtml(fromScreen);
                    consumerRows.push(`<tr>
            <td>${link}</td>
            <td>${screenLink ? `from ${screenLink}` : ""}</td>
            <td>${methodChip(matched.method)} <span class="scope-mono" style="font-size: var(--scope-text-xs)">${escapeHtml(matched.fullPath)}</span></td>
          </tr>`);
                }
            }
            if (item.type === "ActionOnStreamClause") {
                const clause = item;
                const streamPath = clause.path;
                const matched = resolvedPaths.find((rp) => rp.method === "STREAM" && rp.fullPath === streamPath);
                if (matched) {
                    const actionComp = ccMap.get(`action:${action.name}`);
                    const link = actionComp
                        ? `<a href="${constructLink(actionComp, 'action', action.name)}" class="scope-construct-link">${escapeHtml(action.name)}</a>`
                        : escapeHtml(action.name);
                    const fromClause = action.body.find((b) => b.type === "ActionFromClause");
                    const fromScreen = fromClause?.screen ?? "";
                    const screenComp = fromScreen ? ccMap.get(`screen:${fromScreen}`) : null;
                    const screenLink = screenComp
                        ? `<a href="${constructLink(screenComp, 'screen', fromScreen)}" class="scope-construct-link">${escapeHtml(fromScreen)}</a>`
                        : escapeHtml(fromScreen);
                    consumerRows.push(`<tr>
            <td>${link}</td>
            <td>${screenLink ? `from ${screenLink}` : ""}</td>
            <td>${methodChip("STREAM")} <span class="scope-mono" style="font-size: var(--scope-text-xs)">${escapeHtml(matched.fullPath)}</span></td>
          </tr>`);
                }
            }
        }
    }
    const consumersHtml = consumerRows.length > 0
        ? `<div class="scope-construct-section">
        <div class="scope-construct-section-title">Consumers (actions)</div>
        <table class="scope-construct-table">
          <thead><tr><th>Action</th><th>Screen</th><th>Endpoint</th></tr></thead>
          <tbody>${consumerRows.join("")}</tbody>
        </table>
      </div>`
        : "";
    // === Description (semantic comments) ===
    const comments = api.comments?.map((c) => c.text || c) || [];
    const commentHtml = comments.length > 0
        ? `<div class="scope-construct-section">
        <div class="scope-construct-section-title">Description</div>
        <div style="color: var(--scope-text-secondary)">${comments.map((c) => escapeHtml(c)).join("<br>")}</div>
      </div>`
        : "";
    return `
<div class="scope-construct-detail">
  ${detailHeader("api", apiName, componentName, api.decorators)}

  ${renderRelationshipDiagram("api", apiName, rels, snapshot)}

  <div class="scope-construct-body">
    ${infoHtml}
    ${endpointsHtml}
    ${handlersHtml}
    ${consumersHtml}
    ${commentHtml}
  </div>

  <div class="scope-construct-sidebar">
    ${relationshipPanel(rels, entityComponentMap)}
  </div>
</div>`;
}
//# sourceMappingURL=construct-detail.js.map