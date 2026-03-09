/**
 * Domain-scoped Mermaid diagram generators for v2.
 * Produces diagrams filtered to show only constructs belonging to a specific domain.
 */
import { constructLink } from "./shared.js";
// ===== Helpers =====
function sanitizeId(str) {
    return str.replace(/[^a-zA-Z0-9_]/g, '_');
}
function formatSimpleType(ft) {
    switch (ft.type) {
        case "PrimitiveType": return ft.name;
        case "ReferenceType": return ft.name;
        case "OptionalType": return formatSimpleType(ft.inner) + "?";
        case "ArrayType": return formatSimpleType(ft.inner) + "[]";
        case "UnionType": return ft.alternatives.map(formatSimpleType).join("|");
    }
}
function extractTypeRefs(ft) {
    switch (ft.type) {
        case "PrimitiveType": return [];
        case "ReferenceType": return [ft.name];
        case "OptionalType":
        case "ArrayType":
            return extractTypeRefs(ft.inner);
        case "UnionType":
            return ft.alternatives.flatMap(extractTypeRefs);
    }
}
function getDomainConcepts(snapshot, domainName) {
    const cdMap = snapshot.constructDomainMap;
    return snapshot.model.concepts.filter(c => cdMap.get(`concept:${c.name}`) === domainName);
}
function getDomainEnums(snapshot, domainName) {
    const cdMap = snapshot.constructDomainMap;
    return snapshot.model.enums.filter(e => cdMap.get(`enum:${e.name}`) === domainName);
}
function getDomainCapabilities(snapshot, domainName) {
    const cdMap = snapshot.constructDomainMap;
    return snapshot.model.capabilities.filter(c => cdMap.get(`capability:${c.name}`) === domainName);
}
function getDomainInvariants(snapshot, domainName) {
    const cdMap = snapshot.constructDomainMap;
    return snapshot.model.invariants.filter(i => cdMap.get(`invariant:${i.name}`) === domainName);
}
function getDomainProperties(snapshot, domainName) {
    const cdMap = snapshot.constructDomainMap;
    return snapshot.model.properties.filter(p => cdMap.get(`property:${p.name}`) === domainName);
}
function getDomainObjectives(snapshot, domainName) {
    const cdMap = snapshot.constructDomainMap;
    return snapshot.model.objectives.filter(o => cdMap.get(`objective:${o.name}`) === domainName);
}
function hasImpl(decorators) {
    const implDec = decorators.find(d => d.name === "impl");
    return !!(implDec && implDec.params.length > 0);
}
// ===== Concept ER Diagram =====
export function renderDomainConceptDiagram(snapshot, domainName) {
    const concepts = getDomainConcepts(snapshot, domainName);
    const enums = getDomainEnums(snapshot, domainName);
    if (concepts.length === 0 && enums.length === 0)
        return null;
    const conceptNames = new Set(concepts.map(c => c.name));
    const enumNames = new Set(enums.map(e => e.name));
    const lines = ["erDiagram"];
    // Concept nodes with fields
    for (const concept of concepts) {
        lines.push(`  ${sanitizeId(concept.name)} {`);
        for (const field of concept.fields) {
            const typeName = formatSimpleType(field.fieldType);
            const pk = field.decorators?.some(d => d.name === "unique") ? "PK" : "";
            lines.push(`    ${typeName} ${field.name} ${pk}`.trimEnd());
        }
        lines.push("  }");
    }
    // Enum nodes (simplified)
    for (const en of enums) {
        lines.push(`  ${sanitizeId(en.name)} {`);
        for (const val of en.values) {
            lines.push(`    string ${val}`);
        }
        lines.push("  }");
    }
    // Relationships from field references
    for (const concept of concepts) {
        for (const field of concept.fields) {
            const refs = extractTypeRefs(field.fieldType);
            for (const ref of refs) {
                if (conceptNames.has(ref) && ref !== concept.name) {
                    lines.push(`  ${sanitizeId(concept.name)} ||--o{ ${sanitizeId(ref)} : "${field.name}"`);
                }
                if (enumNames.has(ref)) {
                    lines.push(`  ${sanitizeId(concept.name)} ||--o{ ${sanitizeId(ref)} : "${field.name}"`);
                }
            }
        }
        // Lifecycle enum reference
        if (concept.lifecycle && enumNames.has(concept.lifecycle.enumRef)) {
            lines.push(`  ${sanitizeId(concept.name)} ||--|| ${sanitizeId(concept.lifecycle.enumRef)} : "lifecycle"`);
        }
    }
    // External references (ghost nodes for concepts/enums outside this domain)
    const allConceptNames = new Set(snapshot.model.concepts.map(c => c.name));
    const allEnumNames = new Set(snapshot.model.enums.map(e => e.name));
    const ghostNodes = new Set();
    for (const concept of concepts) {
        for (const field of concept.fields) {
            const refs = extractTypeRefs(field.fieldType);
            for (const ref of refs) {
                if (!conceptNames.has(ref) && !enumNames.has(ref) && !ghostNodes.has(ref)) {
                    if (allConceptNames.has(ref) || allEnumNames.has(ref)) {
                        ghostNodes.add(ref);
                        lines.push(`  ${sanitizeId(ref)} {`);
                        lines.push(`    string _external_ref`);
                        lines.push(`  }`);
                        lines.push(`  ${sanitizeId(concept.name)} ||--o{ ${sanitizeId(ref)} : "${field.name}"`);
                    }
                }
            }
        }
    }
    return lines.join("\n");
}
// ===== Lifecycle State Diagram =====
export function renderDomainLifecycleDiagram(snapshot, domainName) {
    const concepts = getDomainConcepts(snapshot, domainName);
    const withLifecycle = concepts.filter(c => c.lifecycle);
    if (withLifecycle.length === 0)
        return null;
    const lines = ["stateDiagram-v2"];
    for (const concept of withLifecycle) {
        const lc = concept.lifecycle;
        lines.push(`  %% ${concept.name}.${lc.field} : ${lc.enumRef}`);
        for (const t of lc.transitions) {
            const from = t.from === "*" ? "[*]" : t.from;
            const to = t.to;
            const label = t.requires ? `${t.capability} [${t.requires}]` : t.capability;
            lines.push(`  ${from} --> ${to}: ${label}`);
        }
    }
    return lines.join("\n");
}
// ===== Capability Contract Diagram =====
export function renderDomainCapabilityDiagram(snapshot, domainName) {
    const capabilities = getDomainCapabilities(snapshot, domainName);
    if (capabilities.length === 0)
        return null;
    const cdMap = snapshot.constructDomainMap;
    const extraNodes = new Set();
    const lines = ["graph TD"];
    for (const cap of capabilities) {
        const capId = sanitizeId(`cap_${cap.name}`);
        const params = cap.params.map(p => `${p.name}: ${formatSimpleType(p.fieldType)}`).join(", ");
        const ret = cap.returnType ? formatSimpleType(cap.returnType) : "void";
        lines.push(`  ${capId}["${cap.name}(${params}) -> ${ret}"]:::capNode`);
        // Via endpoint
        for (const clause of cap.clauses) {
            if (clause.type === "via") {
                const epId = sanitizeId(`ep_${clause.method}_${clause.path}`);
                if (!extraNodes.has(epId)) {
                    extraNodes.add(epId);
                    lines.push(`  ${epId}(["${clause.method} ${clause.path}"]):::endpointNode`);
                }
                lines.push(`  ${capId} -->|via| ${epId}`);
            }
        }
        // Affects concepts
        for (const clause of cap.clauses) {
            if (clause.type === "affects") {
                const conceptId = sanitizeId(`concept_${clause.concept}`);
                if (!extraNodes.has(conceptId)) {
                    extraNodes.add(conceptId);
                    lines.push(`  ${conceptId}[("${clause.concept}")]:::conceptNode`);
                }
                lines.push(`  ${capId} -->|affects| ${conceptId}`);
            }
        }
        // Emits
        for (const clause of cap.clauses) {
            if (clause.type === "emits") {
                const evId = sanitizeId(`ev_${clause.event}`);
                if (!extraNodes.has(evId)) {
                    extraNodes.add(evId);
                    lines.push(`  ${evId}(["${clause.event}"]):::eventNode`);
                }
                lines.push(`  ${capId} -->|emits| ${evId}`);
            }
        }
    }
    lines.push("  classDef capNode fill:#2A0A0A,stroke:#FF6B6B,color:#FF6B6B,stroke-width:2px");
    lines.push("  classDef conceptNode fill:#0A2A2A,stroke:#00E5FF,color:#00E5FF");
    lines.push("  classDef endpointNode fill:#1A1A0A,stroke:#FBBF24,color:#FBBF24");
    lines.push("  classDef eventNode fill:#1A0A2A,stroke:#E040FB,color:#E040FB");
    return lines.join("\n");
}
// ===== Objective Journey Diagram =====
export function renderDomainObjectiveDiagram(snapshot, domainName) {
    const objectives = getDomainObjectives(snapshot, domainName);
    if (objectives.length === 0)
        return null;
    const lines = ["graph LR"];
    for (const obj of objectives) {
        lines.push(`  %% ${obj.name}${obj.persona ? ` @persona(${obj.persona})` : ""}`);
        for (const t of obj.transitions) {
            const from = t.from === "*" ? "ANY[*]" : t.from === "end" ? "END((end))" : t.from;
            const to = t.to === "end" ? "END((end))" : t.to;
            lines.push(`  ${from} -->|${t.trigger}| ${to}`);
        }
    }
    return lines.join("\n");
}
// ===== Invariant Diagram =====
export function renderDomainInvariantDiagram(snapshot, domainName) {
    const invariants = getDomainInvariants(snapshot, domainName);
    if (invariants.length === 0)
        return null;
    const conceptNames = new Set(snapshot.model.concepts.map(c => c.name));
    const extraNodes = new Set();
    const lines = ["graph TD"];
    for (const inv of invariants) {
        const invId = sanitizeId(`inv_${inv.name}`);
        const scopeBadge = inv.scope === "global" ? "[global]" : "[local]";
        lines.push(`  ${invId}{{"${inv.name} ${scopeBadge}"}}:::invNode`);
        // Connect to referenced concepts
        for (const cName of conceptNames) {
            if (inv.expression.includes(cName)) {
                const cId = sanitizeId(`concept_${cName}`);
                if (!extraNodes.has(cId)) {
                    extraNodes.add(cId);
                    lines.push(`  ${cId}[("${cName}")]:::conceptNode`);
                }
                lines.push(`  ${invId} -.->|references| ${cId}`);
            }
        }
    }
    lines.push("  classDef invNode fill:#1A0A2A,stroke:#A78BFA,color:#A78BFA,stroke-width:2px");
    lines.push("  classDef conceptNode fill:#0A2A2A,stroke:#00E5FF,color:#00E5FF");
    return lines.join("\n");
}
// ===== Property Diagram =====
export function renderDomainPropertyDiagram(snapshot, domainName) {
    const properties = getDomainProperties(snapshot, domainName);
    if (properties.length === 0)
        return null;
    const conceptNames = new Set(snapshot.model.concepts.map(c => c.name));
    const extraNodes = new Set();
    const lines = ["graph TD"];
    for (const prop of properties) {
        const propId = sanitizeId(`prop_${prop.name}`);
        const clauseTypes = prop.clauses.map(c => c.type).join("+");
        lines.push(`  ${propId}{{"${prop.name} [${clauseTypes}]"}}:::propNode`);
        // Connect to referenced concepts
        const referencedConcepts = new Set();
        for (const clause of prop.clauses) {
            for (const cName of conceptNames) {
                if (clause.expression.includes(cName)) {
                    referencedConcepts.add(cName);
                }
            }
        }
        for (const cName of referencedConcepts) {
            const cId = sanitizeId(`concept_${cName}`);
            if (!extraNodes.has(cId)) {
                extraNodes.add(cId);
                lines.push(`  ${cId}[("${cName}")]:::conceptNode`);
            }
            lines.push(`  ${propId} -.->|references| ${cId}`);
        }
    }
    lines.push("  classDef propNode fill:#0A2A1A,stroke:#34D399,color:#34D399,stroke-width:2px");
    lines.push("  classDef conceptNode fill:#0A2A2A,stroke:#00E5FF,color:#00E5FF");
    return lines.join("\n");
}
// ===== Relationship Overview Diagram =====
export function renderDomainRelationshipDiagram(snapshot, domainName) {
    const cdMap = snapshot.constructDomainMap;
    const concepts = getDomainConcepts(snapshot, domainName);
    const enums = getDomainEnums(snapshot, domainName);
    const capabilities = getDomainCapabilities(snapshot, domainName);
    const invariants = getDomainInvariants(snapshot, domainName);
    const properties = getDomainProperties(snapshot, domainName);
    const objectives = getDomainObjectives(snapshot, domainName);
    const total = concepts.length + enums.length + capabilities.length +
        invariants.length + properties.length + objectives.length;
    if (total === 0)
        return null;
    function nodeId(type, name) {
        return sanitizeId(`${type}_${name}`);
    }
    const lines = ["graph LR"];
    const edges = new Set();
    function addEdge(from, to, edgeLabel) {
        const key = `${from}-->${to}`;
        if (edges.has(key))
            return;
        edges.add(key);
        if (edgeLabel) {
            lines.push(`  ${from} -->|${edgeLabel}| ${to}`);
        }
        else {
            lines.push(`  ${from} --> ${to}`);
        }
    }
    function implStatus(decorators) {
        const implDec = decorators.find(d => d.name === "impl");
        return implDec && implDec.params.length > 0 ? "impl" : "-";
    }
    // Declare nodes
    for (const c of concepts) {
        const id = nodeId("concept", c.name);
        const href = constructLink(domainName, "concept", c.name);
        const status = implStatus(c.decorators);
        lines.push(`  ${id}["concept: ${c.name}<br/><small>impl: ${status}</small>"]:::conceptNode`);
        lines.push(`  click ${id} "${href}"`);
    }
    for (const e of enums) {
        const id = nodeId("enum", e.name);
        const href = constructLink(domainName, "enum", e.name);
        lines.push(`  ${id}["enum: ${e.name}"]:::enumNode`);
        lines.push(`  click ${id} "${href}"`);
    }
    for (const cap of capabilities) {
        const id = nodeId("capability", cap.name);
        const href = constructLink(domainName, "capability", cap.name);
        const status = implStatus(cap.decorators);
        lines.push(`  ${id}["capability: ${cap.name}<br/><small>impl: ${status}</small>"]:::capNode`);
        lines.push(`  click ${id} "${href}"`);
    }
    for (const inv of invariants) {
        const id = nodeId("invariant", inv.name);
        const href = constructLink(domainName, "invariant", inv.name);
        lines.push(`  ${id}["invariant: ${inv.name}"]:::invNode`);
        lines.push(`  click ${id} "${href}"`);
    }
    for (const prop of properties) {
        const id = nodeId("property", prop.name);
        const href = constructLink(domainName, "property", prop.name);
        lines.push(`  ${id}["property: ${prop.name}"]:::propNode`);
        lines.push(`  click ${id} "${href}"`);
    }
    for (const obj of objectives) {
        const id = nodeId("objective", obj.name);
        const href = constructLink(domainName, "objective", obj.name);
        lines.push(`  ${id}["objective: ${obj.name}"]:::objNode`);
        lines.push(`  click ${id} "${href}"`);
    }
    // Edges: concept field refs
    const conceptNames = new Set(concepts.map(c => c.name));
    const enumNames = new Set(enums.map(e => e.name));
    for (const concept of concepts) {
        for (const field of concept.fields) {
            const refs = extractTypeRefs(field.fieldType);
            for (const ref of refs) {
                if (conceptNames.has(ref) && ref !== concept.name) {
                    addEdge(nodeId("concept", concept.name), nodeId("concept", ref), field.name);
                }
                if (enumNames.has(ref)) {
                    addEdge(nodeId("concept", concept.name), nodeId("enum", ref), field.name);
                }
            }
        }
        // Lifecycle refs
        if (concept.lifecycle) {
            if (enumNames.has(concept.lifecycle.enumRef)) {
                addEdge(nodeId("concept", concept.name), nodeId("enum", concept.lifecycle.enumRef), "lifecycle");
            }
            for (const t of concept.lifecycle.transitions) {
                const capInDomain = capabilities.some(c => c.name === t.capability);
                if (capInDomain) {
                    addEdge(nodeId("concept", concept.name), nodeId("capability", t.capability), "on");
                }
            }
        }
    }
    // Edges: capability affects
    for (const cap of capabilities) {
        for (const clause of cap.clauses) {
            if (clause.type === "affects" && conceptNames.has(clause.concept)) {
                addEdge(nodeId("capability", cap.name), nodeId("concept", clause.concept), "affects");
            }
        }
    }
    // Edges: invariant references
    for (const inv of invariants) {
        for (const cName of conceptNames) {
            if (inv.expression.includes(cName)) {
                addEdge(nodeId("invariant", inv.name), nodeId("concept", cName), "references");
            }
        }
    }
    // Edges: property references
    for (const prop of properties) {
        for (const clause of prop.clauses) {
            for (const cName of conceptNames) {
                if (clause.expression.includes(cName)) {
                    addEdge(nodeId("property", prop.name), nodeId("concept", cName), "references");
                }
            }
        }
    }
    // Edges: objective triggers
    for (const obj of objectives) {
        for (const t of obj.transitions) {
            const capInDomain = capabilities.some(c => c.name === t.trigger);
            if (capInDomain) {
                addEdge(nodeId("objective", obj.name), nodeId("capability", t.trigger), "on");
            }
        }
    }
    // Class definitions
    lines.push("  classDef conceptNode fill:#0A2A2A,stroke:#00E5FF,color:#00E5FF,stroke-width:2px");
    lines.push("  classDef enumNode fill:#1A1A2E,stroke:#60A5FA,color:#60A5FA,stroke-width:1px");
    lines.push("  classDef capNode fill:#2A0A0A,stroke:#FF6B6B,color:#FF6B6B,stroke-width:2px");
    lines.push("  classDef invNode fill:#1A0A2A,stroke:#A78BFA,color:#A78BFA,stroke-width:1px");
    lines.push("  classDef propNode fill:#0A2A1A,stroke:#34D399,color:#34D399,stroke-width:1px");
    lines.push("  classDef objNode fill:#2A0A1A,stroke:#F472B6,color:#F472B6,stroke-width:1px");
    return lines.join("\n");
}
//# sourceMappingURL=domain-diagrams.js.map