/**
 * Construct detail page (Level 3 — Individual Construct)
 * Shows full detail of a single v2 construct with relationship mini-graph.
 *
 * Supports: concept, enum, capability, invariant, property, objective.
 */
import { computeRelationshipsV2 } from "../relationships.js";
import { escapeHtml, formatType, formatTypeLinked, constructLink, domainLink, renderImplChip, renderVerifiedChip, renderDecoratorChips, buildConceptDomainMap, V2_TYPE_COLORS, } from "./shared.js";
// ===== Relationship Mini-Graph =====
function renderRelationshipMiniGraph(type, name, snapshot) {
    const rels = computeRelationshipsV2(snapshot.model);
    const cdMap = snapshot.constructDomainMap;
    // Filter relationships involving this construct
    const involved = rels.filter(r => (r.from.type === type && r.from.name === name) ||
        (r.to.type === type && r.to.name === name));
    if (involved.length === 0)
        return "";
    const centerId = `center_${type}_${name}`.replace(/[^a-zA-Z0-9_]/g, '_');
    const lines = ["graph TB"];
    lines.push(`  ${centerId}["${type}:${name}"]:::centerNode`);
    const seen = new Set();
    const limited = involved.slice(0, 12);
    for (const rel of limited) {
        const isFrom = rel.from.type === type && rel.from.name === name;
        const other = isFrom ? rel.to : rel.from;
        const otherId = `${other.type}_${other.name}`.replace(/[^a-zA-Z0-9_]/g, '_');
        if (!seen.has(otherId)) {
            seen.add(otherId);
            const color = V2_TYPE_COLORS[other.type] ?? "#FFFFFF";
            lines.push(`  ${otherId}["${other.type}:${other.name}"]`);
            lines.push(`  style ${otherId} stroke:${color},color:${color}`);
            // Add click link
            const domain = cdMap.get(`${other.type}:${other.name}`);
            if (domain) {
                lines.push(`  click ${otherId} "${constructLink(domain, other.type, other.name)}"`);
            }
        }
        if (isFrom) {
            lines.push(`  ${centerId} -->|${rel.relation}| ${otherId}`);
        }
        else {
            lines.push(`  ${otherId} -->|${rel.relation}| ${centerId}`);
        }
    }
    lines.push(`  classDef centerNode fill:#1A3A1A,stroke:#00FF41,stroke-width:2px,color:#00FF41`);
    const mermaidCode = lines.join("\n");
    return `
  <div class="scope-rel-diagram scope-diagram-container" data-diagram-type="relationship">
    <div class="mermaid">${escapeHtml(mermaidCode)}</div>
  </div>`;
}
// ===== Header =====
function detailHeader(type, name, domainName, decorators) {
    return `
  <div class="scope-construct-header">
    <div class="scope-construct-header-top">
      <span class="scope-construct-type-badge" style="border-color:${V2_TYPE_COLORS[type] ?? '#fff'};color:${V2_TYPE_COLORS[type] ?? '#fff'}">${escapeHtml(type.toUpperCase())}</span>
      <span class="scope-construct-title">${escapeHtml(name)}</span>
    </div>
    <div class="scope-construct-header-meta">
      <span>Domain: <a href="${domainLink(domainName)}" class="scope-construct-link">${escapeHtml(domainName)}</a></span>
      ${renderImplChip(decorators)}
      ${renderVerifiedChip(decorators)}
    </div>
  </div>`;
}
// ===== Relationship Panel =====
function renderRelationshipPanel(type, name, snapshot) {
    const rels = computeRelationshipsV2(snapshot.model);
    const cdMap = snapshot.constructDomainMap;
    const outgoing = rels.filter(r => r.from.type === type && r.from.name === name);
    const incoming = rels.filter(r => r.to.type === type && r.to.name === name);
    if (outgoing.length === 0 && incoming.length === 0)
        return "";
    const sections = [];
    // Group outgoing by relation
    const outByRel = new Map();
    for (const r of outgoing) {
        const key = r.relation;
        if (!outByRel.has(key))
            outByRel.set(key, []);
        outByRel.get(key).push(r);
    }
    for (const [rel, items] of outByRel) {
        const links = items.map(r => {
            const domain = cdMap.get(`${r.to.type}:${r.to.name}`);
            return domain
                ? `<a href="${constructLink(domain, r.to.type, r.to.name)}" class="scope-construct-link">${escapeHtml(r.to.name)}</a>`
                : escapeHtml(r.to.name);
        }).join("<br>");
        sections.push(`<div class="scope-rel-section"><div class="scope-rel-title">${escapeHtml(rel)} (outgoing)</div><div class="scope-rel-items">${links}</div></div>`);
    }
    // Group incoming by relation
    const inByRel = new Map();
    for (const r of incoming) {
        const key = r.relation;
        if (!inByRel.has(key))
            inByRel.set(key, []);
        inByRel.get(key).push(r);
    }
    for (const [rel, items] of inByRel) {
        const links = items.map(r => {
            const domain = cdMap.get(`${r.from.type}:${r.from.name}`);
            return domain
                ? `<a href="${constructLink(domain, r.from.type, r.from.name)}" class="scope-construct-link">${escapeHtml(r.from.name)}</a>`
                : escapeHtml(r.from.name);
        }).join("<br>");
        sections.push(`<div class="scope-rel-section"><div class="scope-rel-title">${escapeHtml(rel)} (incoming)</div><div class="scope-rel-items">${links}</div></div>`);
    }
    return `
  <div class="scope-relationships-panel">
    <div class="scope-relationships-title">Relationships</div>
    <div class="scope-relationships-grid">
      ${sections.join("")}
    </div>
  </div>`;
}
// ===== Main Dispatcher =====
export function renderConstructDetail(snapshot, domainName, type, itemName) {
    switch (type) {
        case "concept":
            return renderConceptDetail(snapshot, domainName, itemName);
        case "enum":
            return renderEnumDetail(snapshot, domainName, itemName);
        case "capability":
            return renderCapabilityDetail(snapshot, domainName, itemName);
        case "invariant":
            return renderInvariantDetail(snapshot, domainName, itemName);
        case "property":
            return renderPropertyDetail(snapshot, domainName, itemName);
        case "objective":
            return renderObjectiveDetail(snapshot, domainName, itemName);
        default:
            return `<div class="scope-empty-state"><p>Unknown construct type: ${escapeHtml(type)}</p></div>`;
    }
}
// ===== Concept Detail =====
function renderConceptDetail(snapshot, domainName, conceptName) {
    const concept = snapshot.model.concepts.find(c => c.name === conceptName);
    if (!concept) {
        return `<div class="scope-empty-state"><p>Concept not found: ${escapeHtml(conceptName)}</p></div>`;
    }
    const conceptDomainMap = buildConceptDomainMap(snapshot.constructDomainMap);
    const enumNames = new Set(snapshot.model.enums.map(e => e.name));
    // Fields table
    const fieldsHtml = concept.fields.length > 0
        ? `<div class="scope-construct-section">
        <div class="scope-construct-section-title">Fields</div>
        <table class="scope-construct-table">
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
        </table>
      </div>`
        : "";
    // Lifecycle detail
    const lifecycleHtml = concept.lifecycle
        ? `<div class="scope-construct-section">
        <div class="scope-construct-section-title">Lifecycle</div>
        <div style="margin-bottom: var(--scope-space-2)">
          <span class="scope-mono">field: ${escapeHtml(concept.lifecycle.field)}</span>
          <span class="scope-mono" style="margin-left: var(--scope-space-2)">enum: ${conceptDomainMap.has(concept.lifecycle.enumRef)
            ? `<a href="${constructLink(conceptDomainMap.get(concept.lifecycle.enumRef), 'enum', concept.lifecycle.enumRef)}" class="scope-construct-link">${escapeHtml(concept.lifecycle.enumRef)}</a>`
            : escapeHtml(concept.lifecycle.enumRef)}</span>
        </div>
        <table class="scope-construct-table">
          <thead><tr><th>From</th><th></th><th>To</th><th>Capability</th><th>Guard</th></tr></thead>
          <tbody>${concept.lifecycle.transitions.map(t => `<tr>
            <td class="scope-mono">${escapeHtml(t.from)}</td>
            <td>-></td>
            <td class="scope-mono">${escapeHtml(t.to)}</td>
            <td class="scope-mono">${escapeHtml(t.capability)}</td>
            <td class="scope-mono" style="color: var(--scope-text-secondary)">${t.requires ? escapeHtml(t.requires) : ""}</td>
          </tr>`).join("")}</tbody>
        </table>
      </div>`
        : "";
    // Local invariants
    const localInvHtml = concept.invariants.length > 0
        ? `<div class="scope-construct-section">
        <div class="scope-construct-section-title">Local Invariants</div>
        ${concept.invariants.map(inv => `
          <div style="margin-bottom: var(--scope-space-2)">
            <span class="scope-mono" style="font-weight: var(--scope-weight-semibold)">${escapeHtml(inv.name)}</span>
            <div class="scope-mono" style="font-size: var(--scope-text-sm); color: var(--scope-text-secondary); white-space: pre-wrap">${escapeHtml(inv.expression)}</div>
          </div>
        `).join("")}
      </div>`
        : "";
    // Decorators
    const decsHtml = concept.decorators.length > 0
        ? `<div class="scope-construct-section">
        <div class="scope-construct-section-title">Decorators</div>
        <div>${renderDecoratorChips(concept.decorators)}</div>
      </div>`
        : "";
    // @impl paths
    const implDec = concept.decorators.find(d => d.name === "impl");
    const implPathsHtml = implDec && implDec.params.length > 0
        ? `<div class="scope-construct-section">
        <div class="scope-construct-section-title">Implementation Files</div>
        ${implDec.params.map(p => `<div class="scope-mono" style="font-size: var(--scope-text-sm)">${escapeHtml(String(p.value))}</div>`).join("")}
      </div>`
        : "";
    return `
<div class="scope-construct-detail">
  ${detailHeader("concept", conceptName, domainName, concept.decorators)}
  ${renderRelationshipMiniGraph("concept", conceptName, snapshot)}
  <div class="scope-construct-body">
    ${fieldsHtml}
    ${lifecycleHtml}
    ${localInvHtml}
    ${decsHtml}
    ${implPathsHtml}
  </div>
  <div class="scope-construct-sidebar">
    ${renderRelationshipPanel("concept", conceptName, snapshot)}
  </div>
</div>`;
}
// ===== Enum Detail =====
function renderEnumDetail(snapshot, domainName, enumName) {
    const enumDecl = snapshot.model.enums.find(e => e.name === enumName);
    if (!enumDecl) {
        return `<div class="scope-empty-state"><p>Enum not found: ${escapeHtml(enumName)}</p></div>`;
    }
    const values = enumDecl.values
        .map(v => `<span class="scope-chip pending">${escapeHtml(v)}</span>`)
        .join(" ");
    // Find usage references: which concepts/capabilities reference this enum
    const usageRefs = [];
    const cdMap = snapshot.constructDomainMap;
    for (const concept of snapshot.model.concepts) {
        // Check fields
        for (const field of concept.fields) {
            const refs = extractAllTypeRefs(field.fieldType);
            if (refs.includes(enumName)) {
                const domain = cdMap.get(`concept:${concept.name}`);
                if (domain) {
                    usageRefs.push(`<a href="${constructLink(domain, 'concept', concept.name)}" class="scope-construct-link">${escapeHtml(concept.name)}.${escapeHtml(field.name)}</a>`);
                }
            }
        }
        // Check lifecycle
        if (concept.lifecycle && concept.lifecycle.enumRef === enumName) {
            const domain = cdMap.get(`concept:${concept.name}`);
            if (domain) {
                usageRefs.push(`<a href="${constructLink(domain, 'concept', concept.name)}" class="scope-construct-link">${escapeHtml(concept.name)} (lifecycle)</a>`);
            }
        }
    }
    const usageHtml = usageRefs.length > 0
        ? `<div class="scope-construct-section">
        <div class="scope-construct-section-title">Usage References</div>
        ${usageRefs.map(r => `<div>${r}</div>`).join("")}
      </div>`
        : "";
    return `
<div class="scope-construct-detail">
  ${detailHeader("enum", enumName, domainName, enumDecl.decorators)}
  ${renderRelationshipMiniGraph("enum", enumName, snapshot)}
  <div class="scope-construct-body">
    <div class="scope-construct-section">
      <div class="scope-construct-section-title">Values</div>
      <div>${values}</div>
    </div>
    ${usageHtml}
  </div>
  <div class="scope-construct-sidebar">
    ${renderRelationshipPanel("enum", enumName, snapshot)}
  </div>
</div>`;
}
// ===== Capability Detail =====
function renderCapabilityDetail(snapshot, domainName, capName) {
    const cap = snapshot.model.capabilities.find(c => c.name === capName);
    if (!cap) {
        return `<div class="scope-empty-state"><p>Capability not found: ${escapeHtml(capName)}</p></div>`;
    }
    const conceptDomainMap = buildConceptDomainMap(snapshot.constructDomainMap);
    const enumNames = new Set(snapshot.model.enums.map(e => e.name));
    // Signature
    const params = cap.params.map(p => `${p.name}: ${formatType(p.fieldType)}`).join(", ");
    const ret = cap.returnType ? formatType(cap.returnType) : "void";
    const sigHtml = `<div class="scope-construct-section">
    <div class="scope-construct-section-title">Signature</div>
    <div class="scope-mono" style="font-size: var(--scope-text-sm)">${escapeHtml(capName)}(${escapeHtml(params)}) -> ${escapeHtml(ret)}</div>
  </div>`;
    // Clauses — full contract view
    const givenClauses = cap.clauses.filter(c => c.type === "given");
    const thenClauses = cap.clauses.filter(c => c.type === "then");
    const affectsClauses = cap.clauses.filter(c => c.type === "affects");
    const rejectClauses = cap.clauses.filter(c => c.type === "reject");
    const emitsClauses = cap.clauses.filter(c => c.type === "emits");
    const viaClauses = cap.clauses.filter(c => c.type === "via");
    const clauseSections = [];
    if (givenClauses.length > 0) {
        clauseSections.push(`<div class="scope-construct-section">
      <div class="scope-construct-section-title">given</div>
      ${givenClauses.map(c => c.type === "given" ? `<div class="scope-mono" style="font-size: var(--scope-text-sm); margin-bottom: var(--scope-space-1)">${escapeHtml(c.expression)}</div>` : "").join("")}
    </div>`);
    }
    if (thenClauses.length > 0) {
        clauseSections.push(`<div class="scope-construct-section">
      <div class="scope-construct-section-title">then</div>
      ${thenClauses.map(c => c.type === "then" ? `<div class="scope-mono" style="font-size: var(--scope-text-sm); margin-bottom: var(--scope-space-1)">${escapeHtml(c.expression)}</div>` : "").join("")}
    </div>`);
    }
    if (affectsClauses.length > 0) {
        clauseSections.push(`<div class="scope-construct-section">
      <div class="scope-construct-section-title">affects</div>
      ${affectsClauses.map(c => {
            if (c.type !== "affects")
                return "";
            const conceptDomain = conceptDomainMap.get(c.concept);
            const conceptRef = conceptDomain
                ? `<a href="${constructLink(conceptDomain, 'concept', c.concept)}" class="scope-construct-link">${escapeHtml(c.concept)}</a>`
                : escapeHtml(c.concept);
            const whereHtml = c.where ? ` <span style="color: var(--scope-text-secondary)">where ${escapeHtml(c.where)}</span>` : "";
            const assignmentsHtml = c.assignments.map(a => `<div class="scope-mono" style="font-size: var(--scope-text-xs); margin-left: var(--scope-space-4)">${escapeHtml(a.field)} = ${escapeHtml(a.expression)}</div>`).join("");
            return `<div style="margin-bottom: var(--scope-space-2)">
          <div class="scope-mono" style="font-size: var(--scope-text-sm)">affects ${conceptRef}${whereHtml}</div>
          ${assignmentsHtml}
        </div>`;
        }).join("")}
    </div>`);
    }
    if (rejectClauses.length > 0) {
        clauseSections.push(`<div class="scope-construct-section">
      <div class="scope-construct-section-title">reject</div>
      ${rejectClauses.map(c => c.type === "reject" ? `<div style="margin-bottom: var(--scope-space-1)">
        <span class="scope-mono" style="font-size: var(--scope-text-sm); color: #FF5252">${escapeHtml(c.reason)}</span>
        <span class="scope-mono" style="font-size: var(--scope-text-xs); color: var(--scope-text-secondary)"> when ${escapeHtml(c.condition)}</span>
      </div>` : "").join("")}
    </div>`);
    }
    if (emitsClauses.length > 0) {
        clauseSections.push(`<div class="scope-construct-section">
      <div class="scope-construct-section-title">emits</div>
      ${emitsClauses.map(c => c.type === "emits" ? `<div class="scope-mono" style="font-size: var(--scope-text-sm)">${escapeHtml(c.event)}</div>` : "").join("")}
    </div>`);
    }
    if (viaClauses.length > 0) {
        clauseSections.push(`<div class="scope-construct-section">
      <div class="scope-construct-section-title">via</div>
      ${viaClauses.map(c => {
            if (c.type !== "via")
                return "";
            const decs = renderDecoratorChips(c.decorators);
            return `<div class="scope-mono" style="font-size: var(--scope-text-sm); margin-bottom: var(--scope-space-1)">${escapeHtml(c.method)} ${escapeHtml(c.path)} ${decs}</div>`;
        }).join("")}
    </div>`);
    }
    // @impl paths
    const implDec = cap.decorators.find(d => d.name === "impl");
    const implPathsHtml = implDec && implDec.params.length > 0
        ? `<div class="scope-construct-section">
        <div class="scope-construct-section-title">Implementation Files</div>
        ${implDec.params.map(p => `<div class="scope-mono" style="font-size: var(--scope-text-sm)">${escapeHtml(String(p.value))}</div>`).join("")}
      </div>`
        : "";
    return `
<div class="scope-construct-detail">
  ${detailHeader("capability", capName, domainName, cap.decorators)}
  ${renderRelationshipMiniGraph("capability", capName, snapshot)}
  <div class="scope-construct-body">
    ${sigHtml}
    ${clauseSections.join("")}
    ${implPathsHtml}
  </div>
  <div class="scope-construct-sidebar">
    ${renderRelationshipPanel("capability", capName, snapshot)}
  </div>
</div>`;
}
// ===== Invariant Detail =====
function renderInvariantDetail(snapshot, domainName, invName) {
    const inv = snapshot.model.invariants.find(i => i.name === invName);
    if (!inv) {
        return `<div class="scope-empty-state"><p>Invariant not found: ${escapeHtml(invName)}</p></div>`;
    }
    const scopeBadge = inv.scope === "global"
        ? `<span class="scope-chip" style="border-color:${V2_TYPE_COLORS.invariant};color:${V2_TYPE_COLORS.invariant}">global</span>`
        : `<span class="scope-chip" style="border-color:${V2_TYPE_COLORS.invariant};color:${V2_TYPE_COLORS.invariant}">local${inv.conceptName ? `: ${escapeHtml(inv.conceptName)}` : ""}</span>`;
    // Referenced concepts
    const conceptNames = new Set(snapshot.model.concepts.map(c => c.name));
    const cdMap = snapshot.constructDomainMap;
    const referencedConcepts = [];
    for (const cName of conceptNames) {
        if (inv.expression.includes(cName)) {
            const domain = cdMap.get(`concept:${cName}`);
            if (domain) {
                referencedConcepts.push(`<a href="${constructLink(domain, 'concept', cName)}" class="scope-construct-link">${escapeHtml(cName)}</a>`);
            }
            else {
                referencedConcepts.push(escapeHtml(cName));
            }
        }
    }
    const refsHtml = referencedConcepts.length > 0
        ? `<div class="scope-construct-section">
        <div class="scope-construct-section-title">Referenced Concepts</div>
        <div>${referencedConcepts.join(" ")}</div>
      </div>`
        : "";
    const implDec = inv.decorators.find(d => d.name === "impl");
    const implPathsHtml = implDec && implDec.params.length > 0
        ? `<div class="scope-construct-section">
        <div class="scope-construct-section-title">Implementation Files</div>
        ${implDec.params.map(p => `<div class="scope-mono" style="font-size: var(--scope-text-sm)">${escapeHtml(String(p.value))}</div>`).join("")}
      </div>`
        : "";
    return `
<div class="scope-construct-detail">
  ${detailHeader("invariant", invName, domainName, inv.decorators)}
  ${renderRelationshipMiniGraph("invariant", invName, snapshot)}
  <div class="scope-construct-body">
    <div class="scope-construct-section">
      <div class="scope-construct-section-title">Scope</div>
      <div>${scopeBadge}</div>
    </div>
    <div class="scope-construct-section">
      <div class="scope-construct-section-title">Expression</div>
      <div class="scope-mono" style="font-size: var(--scope-text-sm); white-space: pre-wrap">${escapeHtml(inv.expression)}</div>
    </div>
    ${refsHtml}
    ${implPathsHtml}
  </div>
  <div class="scope-construct-sidebar">
    ${renderRelationshipPanel("invariant", invName, snapshot)}
  </div>
</div>`;
}
// ===== Property Detail =====
function renderPropertyDetail(snapshot, domainName, propName) {
    const prop = snapshot.model.properties.find(p => p.name === propName);
    if (!prop) {
        return `<div class="scope-empty-state"><p>Property not found: ${escapeHtml(propName)}</p></div>`;
    }
    // Clauses with type badges
    const clausesHtml = prop.clauses.map(clause => {
        const typeBadge = clause.type === "never"
            ? `<span class="scope-chip" style="background:#2A0A0A;border-color:#FF5252;color:#FF5252">never</span>`
            : clause.type === "eventually"
                ? `<span class="scope-chip" style="background:#1A2A0A;border-color:#34D399;color:#34D399">eventually</span>`
                : `<span class="scope-chip" style="background:#0A1A2A;border-color:#60A5FA;color:#60A5FA">always</span>`;
        const whereHtml = clause.type === "eventually" && clause.where
            ? `<div class="scope-mono" style="font-size: var(--scope-text-xs); color: var(--scope-text-secondary); margin-left: var(--scope-space-4)">where ${escapeHtml(clause.where)}</div>`
            : "";
        return `<div style="margin-bottom: var(--scope-space-2)">
      ${typeBadge}
      <span class="scope-mono" style="font-size: var(--scope-text-sm)">${escapeHtml(clause.expression)}</span>
      ${whereHtml}
    </div>`;
    }).join("");
    // Referenced concepts
    const conceptNames = new Set(snapshot.model.concepts.map(c => c.name));
    const cdMap = snapshot.constructDomainMap;
    const referencedConcepts = new Set();
    for (const clause of prop.clauses) {
        for (const cName of conceptNames) {
            if (clause.expression.includes(cName)) {
                referencedConcepts.add(cName);
            }
        }
    }
    const refsHtml = referencedConcepts.size > 0
        ? `<div class="scope-construct-section">
        <div class="scope-construct-section-title">Referenced Concepts</div>
        <div>${[...referencedConcepts].map(cName => {
            const domain = cdMap.get(`concept:${cName}`);
            return domain
                ? `<a href="${constructLink(domain, 'concept', cName)}" class="scope-construct-link">${escapeHtml(cName)}</a>`
                : escapeHtml(cName);
        }).join(" ")}</div>
      </div>`
        : "";
    return `
<div class="scope-construct-detail">
  ${detailHeader("property", propName, domainName, prop.decorators)}
  ${renderRelationshipMiniGraph("property", propName, snapshot)}
  <div class="scope-construct-body">
    <div class="scope-construct-section">
      <div class="scope-construct-section-title">Clauses</div>
      ${clausesHtml}
    </div>
    ${refsHtml}
  </div>
  <div class="scope-construct-sidebar">
    ${renderRelationshipPanel("property", propName, snapshot)}
  </div>
</div>`;
}
// ===== Objective Detail =====
function renderObjectiveDetail(snapshot, domainName, objName) {
    const obj = snapshot.model.objectives.find(o => o.name === objName);
    if (!obj) {
        return `<div class="scope-empty-state"><p>Objective not found: ${escapeHtml(objName)}</p></div>`;
    }
    const personaHtml = obj.persona
        ? `<div class="scope-construct-section">
        <div class="scope-construct-section-title">Persona</div>
        <div class="scope-mono">${escapeHtml(obj.persona)}</div>
      </div>`
        : "";
    // Transitions table
    const transitionsHtml = obj.transitions.length > 0
        ? `<div class="scope-construct-section">
        <div class="scope-construct-section-title">Transitions</div>
        <table class="scope-construct-table">
          <thead><tr><th>From</th><th></th><th>To</th><th>Trigger</th></tr></thead>
          <tbody>${obj.transitions.map(t => {
            // Try to link trigger to a capability
            const cdMap = snapshot.constructDomainMap;
            const capDomain = cdMap.get(`capability:${t.trigger}`);
            const triggerLink = capDomain
                ? `<a href="${constructLink(capDomain, 'capability', t.trigger)}" class="scope-construct-link">${escapeHtml(t.trigger)}</a>`
                : escapeHtml(t.trigger);
            return `<tr>
              <td class="scope-mono">${escapeHtml(t.from)}</td>
              <td>-></td>
              <td class="scope-mono">${escapeHtml(t.to)}</td>
              <td class="scope-mono">${triggerLink}</td>
            </tr>`;
        }).join("")}</tbody>
        </table>
      </div>`
        : "";
    // Referenced capabilities
    const capNames = new Set(obj.transitions.map(t => t.trigger));
    const cdMap = snapshot.constructDomainMap;
    const capLinks = [];
    for (const capName of capNames) {
        const domain = cdMap.get(`capability:${capName}`);
        if (domain) {
            capLinks.push(`<a href="${constructLink(domain, 'capability', capName)}" class="scope-construct-link">${escapeHtml(capName)}</a>`);
        }
    }
    const capsHtml = capLinks.length > 0
        ? `<div class="scope-construct-section">
        <div class="scope-construct-section-title">Referenced Capabilities</div>
        <div>${capLinks.join(" ")}</div>
      </div>`
        : "";
    return `
<div class="scope-construct-detail">
  ${detailHeader("objective", objName, domainName, obj.decorators)}
  ${renderRelationshipMiniGraph("objective", objName, snapshot)}
  <div class="scope-construct-body">
    ${personaHtml}
    ${transitionsHtml}
    ${capsHtml}
  </div>
  <div class="scope-construct-sidebar">
    ${renderRelationshipPanel("objective", objName, snapshot)}
  </div>
</div>`;
}
// ===== Helpers =====
function extractAllTypeRefs(ft) {
    switch (ft.type) {
        case "PrimitiveType": return [];
        case "ReferenceType": return [ft.name];
        case "OptionalType":
        case "ArrayType":
            return extractAllTypeRefs(ft.inner);
        case "UnionType":
            return ft.alternatives.flatMap(extractAllTypeRefs);
    }
}
//# sourceMappingURL=construct-detail.js.map