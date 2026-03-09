/**
 * MFD v2 Render Functions
 *
 * Generates Mermaid diagrams from a CollectedModelV2:
 *   domain, concept, lifecycle, capability, objective, invariant, property
 *
 * V1 rendering is no longer supported. Files using v1 constructs
 * will receive an error prompting migration to v2.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseV2, isV2Source } from "../../visual/v2-parser.js";
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
/** Sanitize a string for use as a Mermaid node ID (alphanumeric + underscore). */
function sanitizeId(raw) {
    return raw.replace(/[^a-zA-Z0-9_]/g, "_");
}
/** Escape a string for use inside a Mermaid label (double-quoted context). */
function escapeLabel(raw) {
    return raw.replace(/"/g, "#quot;").replace(/\n/g, " ");
}
/** Extract the base type name from a FieldTypeV2 (unwraps arrays/optionals). */
function baseTypeName(ft) {
    switch (ft.type) {
        case "PrimitiveType":
        case "ReferenceType":
            return ft.name;
        case "OptionalType":
        case "ArrayType":
            return baseTypeName(ft.inner);
        case "UnionType":
            return ft.alternatives.map(baseTypeName).join(" | ");
    }
}
/** Render a FieldTypeV2 as a compact display string (e.g. "string?", "Item[]"). */
function displayType(ft) {
    switch (ft.type) {
        case "PrimitiveType":
        case "ReferenceType":
            return ft.name;
        case "OptionalType":
            return `${displayType(ft.inner)}?`;
        case "ArrayType":
            return `${displayType(ft.inner)}[]`;
        case "UnionType":
            return ft.alternatives.map(displayType).join(" | ");
    }
}
/** Extract the domain (source file) from a construct's loc. Falls back to "model". */
function getDomain(loc) {
    const src = loc?.start?.source;
    if (!src)
        return "model";
    // Strip path, keep filename without extension
    const base = src.replace(/^.*[\\/]/, "").replace(/\.mfd$/, "");
    return base || "model";
}
/** Collect all concept names from the model (for cross-reference scanning). */
function conceptNames(model) {
    return new Set(model.concepts.map((c) => c.name));
}
// ---------------------------------------------------------------------------
// V2 Diagram Types
// ---------------------------------------------------------------------------
const V2_DIAGRAM_TYPES = [
    "domain",
    "concept",
    "lifecycle",
    "capability",
    "objective",
    "invariant",
    "property",
];
// ---------------------------------------------------------------------------
// 1. Domain Diagram
// ---------------------------------------------------------------------------
/**
 * Mermaid `graph LR` grouping constructs by source file.
 * - Concepts: rectangles
 * - Capabilities: hexagons {{}}
 * - Enums: ovals ([])
 * - Concepts with lifecycle get a star indicator
 * - Edges: field refs, lifecycle->enum (dotted), affects refs
 */
export function renderDomainDiagram(model) {
    const lines = ["graph LR"];
    // Group constructs by domain (source file)
    const domainMap = new Map();
    const ensureDomain = (domain) => {
        if (!domainMap.has(domain)) {
            domainMap.set(domain, { concepts: [], capabilities: [], enums: [] });
        }
        return domainMap.get(domain);
    };
    for (const concept of model.concepts) {
        ensureDomain(getDomain(concept.loc)).concepts.push(concept);
    }
    for (const cap of model.capabilities) {
        ensureDomain(getDomain(cap.loc)).capabilities.push(cap);
    }
    for (const en of model.enums) {
        ensureDomain(getDomain(en.loc)).enums.push(en.name);
    }
    const domains = Array.from(domainMap.entries());
    const useSingleDomain = domains.length <= 1;
    // Render subgraphs per domain
    for (const [domain, group] of domains) {
        if (!useSingleDomain) {
            lines.push(`  subgraph ${sanitizeId(domain)} ["${escapeLabel(domain)}"]`);
        }
        const indent = useSingleDomain ? "  " : "    ";
        for (const concept of group.concepts) {
            const star = concept.lifecycle ? " ★" : "";
            const id = sanitizeId(concept.name);
            lines.push(`${indent}${id}["${escapeLabel(concept.name)}${star}"]`);
        }
        for (const cap of group.capabilities) {
            const id = `cap_${sanitizeId(cap.name)}`;
            lines.push(`${indent}${id}{{"${escapeLabel(cap.name)}"}}`);
        }
        for (const enumName of group.enums) {
            const id = `enum_${sanitizeId(enumName)}`;
            lines.push(`${indent}${id}(["${escapeLabel(enumName)}"])`);
        }
        if (!useSingleDomain) {
            lines.push("  end");
        }
    }
    // Edges: field references between concepts
    const allConceptNames = conceptNames(model);
    const seenEdges = new Set();
    for (const concept of model.concepts) {
        const srcId = sanitizeId(concept.name);
        for (const field of concept.fields) {
            const refName = baseTypeName(field.fieldType);
            if (allConceptNames.has(refName) && refName !== concept.name) {
                const tgtId = sanitizeId(refName);
                const edgeKey = `${srcId}->${tgtId}`;
                if (!seenEdges.has(edgeKey)) {
                    seenEdges.add(edgeKey);
                    lines.push(`  ${srcId} --> ${tgtId}`);
                }
            }
        }
        // Lifecycle -> enum (dotted)
        if (concept.lifecycle) {
            const enumId = `enum_${sanitizeId(concept.lifecycle.enumRef)}`;
            lines.push(`  ${srcId} -.->|lifecycle| ${enumId}`);
        }
    }
    // Edges: affects refs from capabilities to concepts
    for (const cap of model.capabilities) {
        const capId = `cap_${sanitizeId(cap.name)}`;
        for (const clause of cap.clauses) {
            if (clause.type === "affects" && allConceptNames.has(clause.concept)) {
                const tgtId = sanitizeId(clause.concept);
                lines.push(`  ${capId} -->|affects| ${tgtId}`);
            }
        }
    }
    return lines.join("\n");
}
// ---------------------------------------------------------------------------
// 2. Concept Diagram
// ---------------------------------------------------------------------------
/**
 * Mermaid `erDiagram` showing concepts with fields, types, and relationships.
 * - PK annotation for @unique fields
 * - Relationships inferred from field types referencing other concepts
 * - Lifecycle field annotated with "(lifecycle)"
 */
export function renderConceptDiagram(model) {
    const lines = ["erDiagram"];
    const allConceptNames = conceptNames(model);
    for (const concept of model.concepts) {
        lines.push(`  ${sanitizeId(concept.name)} {`);
        for (const field of concept.fields) {
            const typeName = displayType(field.fieldType);
            const pk = field.decorators.some((d) => d.name === "unique") ? "PK" : "";
            lines.push(`    ${typeName} ${field.name} ${pk}`.trimEnd());
        }
        // Show lifecycle field if present
        if (concept.lifecycle) {
            lines.push(`    ${concept.lifecycle.enumRef} ${concept.lifecycle.field}`);
        }
        lines.push("  }");
    }
    // Relationships from field type references
    const seenEdges = new Set();
    for (const concept of model.concepts) {
        const srcId = sanitizeId(concept.name);
        for (const field of concept.fields) {
            const ft = field.fieldType;
            let refName = null;
            let isArray = false;
            let isOptional = false;
            if (ft.type === "ReferenceType" && allConceptNames.has(ft.name)) {
                refName = ft.name;
            }
            else if (ft.type === "OptionalType") {
                const inner = ft.inner;
                if (inner.type === "ReferenceType" && allConceptNames.has(inner.name)) {
                    refName = inner.name;
                    isOptional = true;
                }
            }
            else if (ft.type === "ArrayType") {
                const inner = ft.inner;
                if (inner.type === "ReferenceType" && allConceptNames.has(inner.name)) {
                    refName = inner.name;
                    isArray = true;
                }
            }
            if (!refName || refName === concept.name)
                continue;
            const tgtId = sanitizeId(refName);
            const edgeKey = `${srcId}:${tgtId}:${field.name}`;
            if (seenEdges.has(edgeKey))
                continue;
            seenEdges.add(edgeKey);
            // Cardinality notation
            let notation;
            if (isArray) {
                notation = "||--o{";
            }
            else if (isOptional) {
                notation = "||--o|";
            }
            else {
                notation = "||--||";
            }
            lines.push(`  ${srcId} ${notation} ${tgtId} : "${escapeLabel(field.name)}"`);
        }
        // Lifecycle -> enum relationship
        if (concept.lifecycle) {
            const enumId = sanitizeId(concept.lifecycle.enumRef);
            const edgeKey = `${srcId}:${enumId}:lifecycle`;
            if (!seenEdges.has(edgeKey)) {
                seenEdges.add(edgeKey);
                lines.push(`  ${srcId} ||--|| ${enumId} : "(lifecycle)"`);
            }
        }
    }
    return lines.join("\n");
}
// ---------------------------------------------------------------------------
// 3. Lifecycle Diagram
// ---------------------------------------------------------------------------
/**
 * Mermaid `stateDiagram-v2` showing lifecycle state machines from concepts.
 * - Initial state [*] for first transition's "from"
 * - Transitions labeled with capability triggers
 * - Guards shown as notes
 */
export function renderLifecycleDiagram(model) {
    const lines = ["stateDiagram-v2"];
    const conceptsWithLifecycle = model.concepts.filter((c) => c.lifecycle);
    if (conceptsWithLifecycle.length === 0) {
        lines.push("  %% No lifecycle state machines found");
        return lines.join("\n");
    }
    for (const concept of conceptsWithLifecycle) {
        const lc = concept.lifecycle;
        lines.push(`  %% ${concept.name}.${lc.field} : ${lc.enumRef}`);
        lines.push("");
        // Track initial state (first "from" value)
        const seenFroms = new Set();
        for (const t of lc.transitions) {
            const from = sanitizeId(t.from);
            const to = sanitizeId(t.to);
            const label = escapeLabel(t.capability);
            // Emit initial state arrow for the first transition's from state
            if (!seenFroms.has(from) && seenFroms.size === 0) {
                lines.push(`  [*] --> ${from}`);
            }
            seenFroms.add(from);
            lines.push(`  ${from} --> ${to}: ${label}`);
            // Guard note
            if (t.requires) {
                lines.push(`  note right of ${from} : requires ${escapeLabel(t.requires)}`);
            }
        }
        lines.push("");
    }
    return lines.join("\n");
}
// ---------------------------------------------------------------------------
// 4. Capability Diagram
// ---------------------------------------------------------------------------
/**
 * Mermaid `graph TD` showing capability contracts.
 * - Each capability gets a subgraph with signature as title
 * - Inside: GIVEN, THEN, AFFECTS, REJECT sections as sub-subgraphs
 * - Outside: META section with emits/via info
 */
export function renderCapabilityDiagram(model) {
    const lines = ["graph TD"];
    if (model.capabilities.length === 0) {
        lines.push("  %% No capabilities found");
        return lines.join("\n");
    }
    for (const cap of model.capabilities) {
        const capId = sanitizeId(cap.name);
        // Build signature label
        const paramStr = cap.params
            .map((p) => `${p.name}: ${displayType(p.fieldType)}`)
            .join(", ");
        const retStr = cap.returnType ? ` -> ${displayType(cap.returnType)}` : "";
        const signature = `${cap.name}(${paramStr})${retStr}`;
        lines.push(`  subgraph ${capId} ["${escapeLabel(signature)}"]`);
        // Group clauses by type
        const givens = cap.clauses.filter((c) => c.type === "given");
        const thens = cap.clauses.filter((c) => c.type === "then");
        const affects = cap.clauses.filter((c) => c.type === "affects");
        const rejects = cap.clauses.filter((c) => c.type === "reject");
        const emits = cap.clauses.filter((c) => c.type === "emits");
        const vias = cap.clauses.filter((c) => c.type === "via");
        let nodeIdx = 0;
        const nextNodeId = () => `${capId}_n${nodeIdx++}`;
        // GIVEN section
        if (givens.length > 0) {
            lines.push(`    subgraph ${capId}_given ["GIVEN"]`);
            for (const g of givens) {
                if (g.type !== "given")
                    continue;
                const nid = nextNodeId();
                lines.push(`      ${nid}["${escapeLabel(g.expression)}"]`);
            }
            lines.push("    end");
        }
        // THEN section
        if (thens.length > 0) {
            lines.push(`    subgraph ${capId}_then ["THEN"]`);
            for (const t of thens) {
                if (t.type !== "then")
                    continue;
                const nid = nextNodeId();
                lines.push(`      ${nid}["${escapeLabel(t.expression)}"]`);
            }
            lines.push("    end");
        }
        // AFFECTS section
        if (affects.length > 0) {
            lines.push(`    subgraph ${capId}_affects ["AFFECTS"]`);
            for (const a of affects) {
                if (a.type !== "affects")
                    continue;
                const nid = nextNodeId();
                const whereStr = a.where ? ` where ${a.where}` : "";
                const assignStr = a.assignments
                    .map((as) => `${as.field}=${as.expression}`)
                    .join(", ");
                const label = `${a.concept}${whereStr}: ${assignStr}`;
                lines.push(`      ${nid}["${escapeLabel(label)}"]`);
            }
            lines.push("    end");
        }
        // REJECT section
        if (rejects.length > 0) {
            lines.push(`    subgraph ${capId}_reject ["REJECT"]`);
            for (const r of rejects) {
                if (r.type !== "reject")
                    continue;
                const nid = nextNodeId();
                const label = `${r.reason} when ${r.condition}`;
                lines.push(`      ${nid}["${escapeLabel(label)}"]`);
            }
            lines.push("    end");
        }
        lines.push("  end");
        // META: emits and via (outside the capability subgraph, linked to it)
        for (const e of emits) {
            if (e.type !== "emits")
                continue;
            const nid = `${capId}_emit_${sanitizeId(e.event)}`;
            lines.push(`  ${nid}(["${escapeLabel(e.event)}"])`);
            lines.push(`  ${capId} -->|emits| ${nid}`);
        }
        for (const v of vias) {
            if (v.type !== "via")
                continue;
            const nid = `${capId}_via_${sanitizeId(v.method)}_${sanitizeId(v.path)}`;
            const decoStr = v.decorators.length > 0
                ? " " + v.decorators.map((d) => `@${d.name}`).join(" ")
                : "";
            lines.push(`  ${nid}["${escapeLabel(`${v.method} ${v.path}${decoStr}`)}"]`);
            lines.push(`  ${capId} -->|via| ${nid}`);
        }
        lines.push("");
    }
    return lines.join("\n");
}
// ---------------------------------------------------------------------------
// 5. Objective Diagram
// ---------------------------------------------------------------------------
/**
 * Mermaid `graph LR` showing objectives as navigation graphs.
 * - Nodes are capabilities (referenced by trigger)
 * - * -> ANY[*], end -> END((end))
 * - @persona badge in section comment
 */
export function renderObjectiveDiagram(model) {
    const lines = ["graph LR"];
    if (model.objectives.length === 0) {
        lines.push("  %% No objectives found");
        return lines.join("\n");
    }
    for (const obj of model.objectives) {
        const personaBadge = obj.persona ? ` @persona(${obj.persona})` : "";
        lines.push(`  %% Objective: ${obj.name}${personaBadge}`);
        for (const t of obj.transitions) {
            let fromNode;
            if (t.from === "*") {
                fromNode = "ANY[*]";
            }
            else if (t.from === "end") {
                fromNode = "END((end))";
            }
            else {
                fromNode = sanitizeId(t.from);
            }
            let toNode;
            if (t.to === "end") {
                toNode = "END((end))";
            }
            else if (t.to === "*") {
                toNode = "ANY[*]";
            }
            else {
                toNode = sanitizeId(t.to);
            }
            lines.push(`  ${fromNode} -->|${escapeLabel(t.trigger)}| ${toNode}`);
        }
        lines.push("");
    }
    return lines.join("\n");
}
// ---------------------------------------------------------------------------
// 6. Invariant Diagram
// ---------------------------------------------------------------------------
/**
 * Mermaid `graph TD` showing invariants with cross-references to concepts.
 * - Invariant nodes with their names
 * - Concept nodes as rectangles
 * - Dotted edges from invariants to referenced concepts
 * - Local invariants show their parent concept connection
 */
export function renderInvariantDiagram(model) {
    const lines = ["graph TD"];
    if (model.invariants.length === 0) {
        lines.push("  %% No invariants found");
        return lines.join("\n");
    }
    const allConceptNames = conceptNames(model);
    const renderedConcepts = new Set();
    for (const inv of model.invariants) {
        const invId = `inv_${sanitizeId(inv.name)}`;
        const scopeTag = inv.scope === "local" ? " (local)" : "";
        lines.push(`  ${invId}{{"${escapeLabel(inv.name)}${scopeTag}"}}`);
        // If local invariant, connect to parent concept
        if (inv.scope === "local" && inv.conceptName) {
            const conceptId = sanitizeId(inv.conceptName);
            if (!renderedConcepts.has(inv.conceptName)) {
                renderedConcepts.add(inv.conceptName);
                lines.push(`  ${conceptId}["${escapeLabel(inv.conceptName)}"]`);
            }
            lines.push(`  ${invId} -.->|belongs to| ${conceptId}`);
        }
        // Scan expression for concept name references
        for (const cName of allConceptNames) {
            // Match whole word only to avoid false positives
            const regex = new RegExp(`\\b${cName}\\b`);
            if (regex.test(inv.expression)) {
                const conceptId = sanitizeId(cName);
                if (!renderedConcepts.has(cName)) {
                    renderedConcepts.add(cName);
                    lines.push(`  ${conceptId}["${escapeLabel(cName)}"]`);
                }
                // Don't duplicate the "belongs to" edge for local invariants
                if (!(inv.scope === "local" && inv.conceptName === cName)) {
                    lines.push(`  ${invId} -.->|references| ${conceptId}`);
                }
            }
        }
    }
    return lines.join("\n");
}
// ---------------------------------------------------------------------------
// 7. Property Diagram
// ---------------------------------------------------------------------------
/**
 * Mermaid `graph LR` showing temporal properties.
 * - Each property becomes a subgraph
 * - Clauses are nodes inside, color-coded by classDef:
 *     never -> neverNode (red), eventually -> eventuallyNode (yellow), always -> alwaysNode (green)
 * - Dotted edges from clause nodes to referenced concepts
 */
export function renderPropertyDiagram(model) {
    const lines = ["graph LR"];
    if (model.properties.length === 0) {
        lines.push("  %% No properties found");
        return lines.join("\n");
    }
    // Class definitions for color-coding
    lines.push("  classDef neverNode fill:#FF5252,color:#fff,stroke:#D32F2F");
    lines.push("  classDef eventuallyNode fill:#FBBF24,color:#000,stroke:#F59E0B");
    lines.push("  classDef alwaysNode fill:#34D399,color:#000,stroke:#10B981");
    lines.push("");
    const allConceptNames = conceptNames(model);
    const renderedConcepts = new Set();
    let clauseIdx = 0;
    for (const prop of model.properties) {
        const propId = sanitizeId(prop.name);
        lines.push(`  subgraph ${propId} ["${escapeLabel(prop.name)}"]`);
        for (const clause of prop.clauses) {
            const nodeId = `${propId}_c${clauseIdx++}`;
            const label = escapeLabel(clause.expression);
            switch (clause.type) {
                case "never":
                    lines.push(`    ${nodeId}["never: ${label}"]`);
                    lines.push(`    class ${nodeId} neverNode`);
                    break;
                case "eventually": {
                    const whereStr = clause.where ? ` (where ${escapeLabel(clause.where)})` : "";
                    lines.push(`    ${nodeId}["eventually: ${label}${whereStr}"]`);
                    lines.push(`    class ${nodeId} eventuallyNode`);
                    break;
                }
                case "always":
                    lines.push(`    ${nodeId}["always: ${label}"]`);
                    lines.push(`    class ${nodeId} alwaysNode`);
                    break;
            }
            // Dotted edges to referenced concepts
            for (const cName of allConceptNames) {
                const regex = new RegExp(`\\b${cName}\\b`);
                if (regex.test(clause.expression)) {
                    const conceptId = `concept_${sanitizeId(cName)}`;
                    if (!renderedConcepts.has(cName)) {
                        renderedConcepts.add(cName);
                        // Concept node rendered outside subgraph, so defer
                    }
                    // Store edge to render after subgraph closes
                }
            }
        }
        lines.push("  end");
        lines.push("");
    }
    // Render concept nodes and edges outside subgraphs
    // We need a second pass because Mermaid does not allow edges from inside
    // a subgraph to outside in all renderers; instead, render concept nodes
    // at top level and draw dotted edges.
    clauseIdx = 0;
    const conceptEdges = [];
    for (const prop of model.properties) {
        const propId = sanitizeId(prop.name);
        for (const clause of prop.clauses) {
            const nodeId = `${propId}_c${clauseIdx++}`;
            for (const cName of allConceptNames) {
                const regex = new RegExp(`\\b${cName}\\b`);
                if (regex.test(clause.expression)) {
                    const conceptId = `concept_${sanitizeId(cName)}`;
                    if (!renderedConcepts.has(`_rendered_${cName}`)) {
                        renderedConcepts.add(`_rendered_${cName}`);
                        lines.push(`  ${conceptId}["${escapeLabel(cName)}"]`);
                    }
                    conceptEdges.push(`  ${nodeId} -.-> ${conceptId}`);
                }
            }
        }
    }
    for (const edge of conceptEdges) {
        lines.push(edge);
    }
    return lines.join("\n");
}
// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------
/**
 * Main entry point for the mfd_render MCP tool.
 * Dispatches to v2 diagram renderers. V1 files receive an error message.
 */
export function handleRender(args) {
    const absPath = resolve(args.file);
    let source;
    try {
        source = readFileSync(absPath, "utf-8");
    }
    catch (err) {
        return {
            content: [
                {
                    type: "text",
                    text: `Failed to read file: ${absPath}\n${err instanceof Error ? err.message : String(err)}`,
                },
            ],
            isError: true,
        };
    }
    // Detect v1 vs v2
    if (!isV2Source(source)) {
        return {
            content: [
                {
                    type: "text",
                    text: [
                        `v1 rendering is no longer supported.`,
                        `The file "${args.file}" uses v1 constructs (component, entity, flow, etc.).`,
                        `Migrate to v2 (concept, capability, objective, etc.) to use the renderer.`,
                        ``,
                        `Supported v2 diagram types: ${V2_DIAGRAM_TYPES.join(", ")}`,
                    ].join("\n"),
                },
            ],
            isError: true,
        };
    }
    // Parse v2 model
    const model = parseV2(source, absPath);
    // Dispatch to diagram type
    const diagramType = args.diagram_type;
    let mermaid;
    switch (diagramType) {
        case "domain":
            mermaid = renderDomainDiagram(model);
            break;
        case "concept":
            mermaid = renderConceptDiagram(model);
            break;
        case "lifecycle":
            mermaid = renderLifecycleDiagram(model);
            break;
        case "capability":
            mermaid = renderCapabilityDiagram(model);
            break;
        case "objective":
            mermaid = renderObjectiveDiagram(model);
            break;
        case "invariant":
            mermaid = renderInvariantDiagram(model);
            break;
        case "property":
            mermaid = renderPropertyDiagram(model);
            break;
        default:
            return {
                content: [
                    {
                        type: "text",
                        text: `Unknown diagram type: "${args.diagram_type}". Valid v2 types: ${V2_DIAGRAM_TYPES.join(", ")}`,
                    },
                ],
                isError: true,
            };
    }
    return {
        content: [{ type: "text", text: mermaid }],
    };
}
//# sourceMappingURL=render.js.map