/**
 * Data layer (v2): loads an MFD v2 file and produces a complete ModelSnapshot
 * with parsed model, all 7 diagrams, stats, relationships, domains, and validation results.
 *
 * V2-only: v1 files are rejected with an error.
 */
import { readFileSync } from "node:fs";
import { resolve, basename } from "node:path";
import { parseV2, isV2Source } from "./v2-parser.js";
// === Domain name extraction ===
/**
 * Extract a domain name from a source file path.
 * "main.mfd" maps to "(system)", everything else uses the basename without extension.
 */
function extractDomainName(sourcePath) {
    const base = basename(sourcePath, ".mfd");
    return base === "main" ? "(system)" : base;
}
// === Decorator helpers ===
function hasDecorator(decorators, name) {
    return decorators.some((d) => d.name === name);
}
function getDecoratorIntParam(decorators, name) {
    const dec = decorators.find((d) => d.name === name);
    if (!dec || dec.params.length === 0)
        return undefined;
    const val = dec.params[0].value;
    return typeof val === "number" ? val : undefined;
}
function getImplPaths(decorators) {
    const dec = decorators.find((d) => d.name === "impl");
    if (!dec)
        return [];
    return dec.params.map((p) => String(p.value));
}
/**
 * Collect all trackable constructs from a v2 model, each annotated with its type
 * and source file path (from loc.start.source, falling back to the main file).
 */
function collectTrackableConstructs(model, mainFilePath) {
    const result = [];
    const getSource = (loc) => loc?.start?.source ?? mainFilePath;
    for (const c of model.concepts) {
        result.push({ type: "concept", name: c.name, decorators: c.decorators, sourcePath: getSource(c.loc) });
    }
    for (const e of model.enums) {
        result.push({ type: "enum", name: e.name, decorators: e.decorators, sourcePath: getSource(e.loc) });
    }
    for (const c of model.capabilities) {
        result.push({ type: "capability", name: c.name, decorators: c.decorators, sourcePath: getSource(c.loc) });
    }
    for (const i of model.invariants) {
        // Only count global invariants as standalone constructs
        if (i.scope === "global") {
            result.push({ type: "invariant", name: i.name, decorators: i.decorators, sourcePath: getSource(i.loc) });
        }
    }
    for (const p of model.properties) {
        result.push({ type: "property", name: p.name, decorators: p.decorators, sourcePath: getSource(p.loc) });
    }
    for (const o of model.objectives) {
        result.push({ type: "objective", name: o.name, decorators: o.decorators, sourcePath: getSource(o.loc) });
    }
    return result;
}
// === Construct→Domain Map ===
/**
 * Build a map from "type:name" (e.g. "concept:User") to domain name.
 * Domain is derived from the source file where the construct was defined.
 */
function buildConstructDomainMap(constructs) {
    const map = new Map();
    for (const c of constructs) {
        const domain = extractDomainName(c.sourcePath);
        map.set(`${c.type}:${c.name}`, domain);
    }
    return map;
}
// === Domain Info Builder ===
/**
 * Build DomainInfo[] by grouping constructs per domain and calculating
 * implementation/verification progress.
 */
function buildDomainInfos(constructs, domainMap) {
    // Group constructs by domain
    const domainConstructs = new Map();
    const domainFiles = new Map();
    for (const c of constructs) {
        const domain = domainMap.get(`${c.type}:${c.name}`) ?? "(system)";
        if (!domainConstructs.has(domain)) {
            domainConstructs.set(domain, []);
            domainFiles.set(domain, c.sourcePath);
        }
        domainConstructs.get(domain).push(c);
    }
    const infos = [];
    for (const [domain, dConstructs] of domainConstructs) {
        const counts = {};
        let implDone = 0;
        let verifiedDone = 0;
        for (const c of dConstructs) {
            const plural = c.type.endsWith("y") ? c.type.slice(0, -1) + "ies" : c.type + "s";
            counts[plural] = (counts[plural] ?? 0) + 1;
            if (hasDecorator(c.decorators, "impl"))
                implDone++;
            if (hasDecorator(c.decorators, "verified"))
                verifiedDone++;
        }
        infos.push({
            name: domain,
            filePath: domainFiles.get(domain) ?? "",
            constructCounts: counts,
            implDone,
            implTotal: dConstructs.length,
            verifiedDone,
            verifiedTotal: dConstructs.length,
        });
    }
    return infos;
}
// === Stats Builder ===
/**
 * Build StatsV2 from the model.
 */
function buildStatsV2(model, constructs, domainMap) {
    const globalInvariants = model.invariants.filter((i) => i.scope === "global");
    const counts = {
        concepts: model.concepts.length,
        enums: model.enums.length,
        capabilities: model.capabilities.length,
        invariants: globalInvariants.length,
        properties: model.properties.length,
        objectives: model.objectives.length,
        total: constructs.length,
    };
    let withImpl = 0;
    let withVerified = 0;
    for (const c of constructs) {
        if (hasDecorator(c.decorators, "impl"))
            withImpl++;
        if (hasDecorator(c.decorators, "verified"))
            withVerified++;
    }
    const total = constructs.length;
    const implPct = total > 0 ? (withImpl / total) * 100 : 0;
    const verifiedPct = total > 0 ? (withVerified / total) * 100 : 0;
    // Build domain completeness
    const domainGroups = new Map();
    for (const c of constructs) {
        const domain = domainMap.get(`${c.type}:${c.name}`) ?? "(system)";
        if (!domainGroups.has(domain))
            domainGroups.set(domain, []);
        domainGroups.get(domain).push(c);
    }
    const domainCompleteness = [];
    for (const [domain, dConstructs] of domainGroups) {
        let dImplDone = 0;
        let dVerifiedDone = 0;
        const constructDetails = [];
        for (const c of dConstructs) {
            const impl = getImplPaths(c.decorators);
            const verified = getDecoratorIntParam(c.decorators, "verified") ?? 0;
            if (impl.length > 0)
                dImplDone++;
            if (verified > 0)
                dVerifiedDone++;
            constructDetails.push({
                type: c.type,
                name: c.name,
                impl,
                verified,
            });
        }
        domainCompleteness.push({
            name: domain,
            constructs: constructDetails,
            implDone: dImplDone,
            implTotal: dConstructs.length,
            verifiedDone: dVerifiedDone,
            verifiedTotal: dConstructs.length,
        });
    }
    return {
        counts,
        completeness: {
            total,
            withImpl,
            implPct: Math.round(implPct * 10) / 10,
            withVerified,
            verifiedPct: Math.round(verifiedPct * 10) / 10,
        },
        domainCompleteness,
    };
}
// === Validation ===
/**
 * Comprehensive validation for v2 models.
 *
 * Categories:
 * 1. DUPLICATE_*     — duplicate names within construct type
 * 2. EMPTY_*         — constructs with no content
 * 3. REF_*           — references to undeclared names
 * 4. ORPHAN_*        — constructs not referenced by anything
 * 5. DECORATOR_*     — decorator consistency checks
 * 6. QUALITY_*       — modeling best practices
 */
function validateV2(model) {
    const errors = [];
    const warnings = [];
    // === Name sets ===
    const conceptNames = new Set(model.concepts.map((c) => c.name));
    const enumNames = new Set(model.enums.map((e) => e.name));
    const capNames = new Set(model.capabilities.map((c) => c.name));
    const enumValueMap = new Map();
    for (const e of model.enums)
        enumValueMap.set(e.name, new Set(e.values));
    // Concept field map: conceptName → Set<fieldName>
    const conceptFieldMap = new Map();
    for (const c of model.concepts) {
        conceptFieldMap.set(c.name, new Set(c.fields.map((f) => f.name)));
    }
    // === Helper: extract all type names from a FieldTypeV2 ===
    function extractTypeNames(ft, out) {
        switch (ft.type) {
            case "ReferenceType":
                out.add(ft.name);
                break;
            case "OptionalType":
                extractTypeNames(ft.inner, out);
                break;
            case "ArrayType":
                extractTypeNames(ft.inner, out);
                break;
            case "UnionType":
                for (const alt of ft.alternatives)
                    extractTypeNames(alt, out);
                break;
        }
    }
    // === 1. DUPLICATE NAMES ===
    const checkDuplicates = (items, type) => {
        const seen = new Map();
        for (const item of items) {
            const prev = seen.get(item.name);
            if (prev !== undefined) {
                errors.push({
                    message: `Duplicate ${type} name: "${item.name}" (first at line ${prev})`,
                    line: item.loc?.start?.line,
                });
            }
            else {
                seen.set(item.name, item.loc?.start?.line ?? 0);
            }
        }
    };
    checkDuplicates(model.concepts, "concept");
    checkDuplicates(model.enums, "enum");
    checkDuplicates(model.capabilities, "capability");
    checkDuplicates(model.invariants.filter((i) => i.scope === "global"), "invariant");
    checkDuplicates(model.properties, "property");
    checkDuplicates(model.objectives, "objective");
    // === 2. EMPTY CONSTRUCTS ===
    for (const c of model.concepts) {
        if (c.fields.length === 0) {
            warnings.push({ message: `Concept "${c.name}" has no fields`, line: c.loc?.start?.line });
        }
        // Duplicate fields within concept
        const fieldSeen = new Set();
        for (const f of c.fields) {
            if (fieldSeen.has(f.name)) {
                errors.push({ message: `Concept "${c.name}": duplicate field "${f.name}"`, line: c.loc?.start?.line });
            }
            fieldSeen.add(f.name);
        }
    }
    for (const e of model.enums) {
        if (e.values.length === 0) {
            warnings.push({ message: `Enum "${e.name}" has no values`, line: e.loc?.start?.line });
        }
    }
    for (const cap of model.capabilities) {
        if (cap.clauses.length === 0) {
            warnings.push({ message: `Capability "${cap.name}" has no clauses (given/then/affects/reject/emits/via)`, line: cap.loc?.start?.line });
        }
    }
    for (const p of model.properties) {
        if (p.clauses.length === 0) {
            warnings.push({ message: `Property "${p.name}" has no clauses (never/eventually/always)`, line: p.loc?.start?.line });
        }
    }
    for (const o of model.objectives) {
        if (o.transitions.length === 0) {
            warnings.push({ message: `Objective "${o.name}" has no transitions`, line: o.loc?.start?.line });
        }
    }
    // === 3. REFERENTIAL INTEGRITY ===
    // 3a. Concept field types must reference known concepts, enums, or primitives
    const primitives = new Set(["string", "number", "boolean", "date", "datetime", "uuid", "void"]);
    const allTypeNames = new Set([...conceptNames, ...enumNames, ...primitives]);
    for (const c of model.concepts) {
        for (const f of c.fields) {
            const refs = new Set();
            extractTypeNames(f.fieldType, refs);
            for (const ref of refs) {
                if (!allTypeNames.has(ref)) {
                    warnings.push({ message: `Concept "${c.name}": field "${f.name}" references unknown type "${ref}"`, line: c.loc?.start?.line });
                }
            }
        }
    }
    // 3b. Capability param/return types
    for (const cap of model.capabilities) {
        for (const p of cap.params) {
            const refs = new Set();
            extractTypeNames(p.fieldType, refs);
            for (const ref of refs) {
                if (!allTypeNames.has(ref)) {
                    warnings.push({ message: `Capability "${cap.name}": param "${p.name}" references unknown type "${ref}"`, line: cap.loc?.start?.line });
                }
            }
        }
        if (cap.returnType) {
            const refs = new Set();
            extractTypeNames(cap.returnType, refs);
            for (const ref of refs) {
                if (!allTypeNames.has(ref)) {
                    warnings.push({ message: `Capability "${cap.name}": return type references unknown type "${ref}"`, line: cap.loc?.start?.line });
                }
            }
        }
    }
    // 3c. Lifecycle enum references + state values + capability triggers
    for (const concept of model.concepts) {
        if (!concept.lifecycle)
            continue;
        const lc = concept.lifecycle;
        if (!enumNames.has(lc.enumRef)) {
            errors.push({ message: `Concept "${concept.name}": lifecycle references unknown enum "${lc.enumRef}"`, line: concept.loc?.start?.line });
            continue;
        }
        const validStates = enumValueMap.get(lc.enumRef);
        const seenStates = new Set();
        const seenCaps = new Set();
        for (const tr of lc.transitions) {
            if (!validStates.has(tr.from) && !seenStates.has(tr.from)) {
                seenStates.add(tr.from);
                errors.push({ message: `Concept "${concept.name}": lifecycle state "${tr.from}" not in enum ${lc.enumRef}`, line: concept.loc?.start?.line });
            }
            if (!validStates.has(tr.to) && !seenStates.has(tr.to)) {
                seenStates.add(tr.to);
                errors.push({ message: `Concept "${concept.name}": lifecycle state "${tr.to}" not in enum ${lc.enumRef}`, line: concept.loc?.start?.line });
            }
            if (!capNames.has(tr.capability) && !seenCaps.has(tr.capability)) {
                seenCaps.add(tr.capability);
                warnings.push({ message: `Concept "${concept.name}": lifecycle trigger "${tr.capability}" is not a declared capability`, line: concept.loc?.start?.line });
            }
        }
    }
    // 3d. Capability affects — concept must exist, fields must exist in concept
    for (const cap of model.capabilities) {
        for (const clause of cap.clauses) {
            if (clause.type === "affects") {
                if (!conceptNames.has(clause.concept)) {
                    warnings.push({ message: `Capability "${cap.name}": affects unknown concept "${clause.concept}"`, line: cap.loc?.start?.line });
                }
                else {
                    const fields = conceptFieldMap.get(clause.concept);
                    if (fields) {
                        for (const assign of clause.assignments) {
                            if (!fields.has(assign.field)) {
                                warnings.push({ message: `Capability "${cap.name}": affects "${clause.concept}.${assign.field}" but field "${assign.field}" not declared in concept`, line: cap.loc?.start?.line });
                            }
                        }
                    }
                }
            }
        }
    }
    // 3e. Objective transition states must be declared capabilities
    for (const obj of model.objectives) {
        for (const tr of obj.transitions) {
            if (tr.from !== "*" && !capNames.has(tr.from)) {
                warnings.push({ message: `Objective "${obj.name}": state "${tr.from}" is not a declared capability`, line: obj.loc?.start?.line });
            }
            if (tr.to !== "end" && !capNames.has(tr.to)) {
                warnings.push({ message: `Objective "${obj.name}": state "${tr.to}" is not a declared capability`, line: obj.loc?.start?.line });
            }
        }
    }
    // === 4. ORPHAN DETECTION ===
    // Collect all referenced concept names (from fields, params, returns, affects, invariant expressions, properties)
    const referencedConcepts = new Set();
    // From concept fields (type refs to other concepts)
    for (const c of model.concepts) {
        for (const f of c.fields) {
            const refs = new Set();
            extractTypeNames(f.fieldType, refs);
            for (const r of refs)
                if (conceptNames.has(r))
                    referencedConcepts.add(r);
        }
        // Lifecycle references concept itself (not orphan check, but other concepts in transitions)
        if (c.lifecycle)
            referencedConcepts.add(c.name); // has lifecycle = active
    }
    // From capability params/returns/clauses
    for (const cap of model.capabilities) {
        for (const p of cap.params) {
            const refs = new Set();
            extractTypeNames(p.fieldType, refs);
            for (const r of refs)
                if (conceptNames.has(r))
                    referencedConcepts.add(r);
        }
        if (cap.returnType) {
            const refs = new Set();
            extractTypeNames(cap.returnType, refs);
            for (const r of refs)
                if (conceptNames.has(r))
                    referencedConcepts.add(r);
        }
        for (const cl of cap.clauses) {
            if (cl.type === "affects")
                referencedConcepts.add(cl.concept);
        }
    }
    // From invariant/property expressions (simple name matching)
    for (const inv of model.invariants) {
        for (const name of conceptNames) {
            if (inv.expression.includes(name))
                referencedConcepts.add(name);
        }
    }
    for (const prop of model.properties) {
        for (const cl of prop.clauses) {
            for (const name of conceptNames) {
                if (cl.expression.includes(name))
                    referencedConcepts.add(name);
            }
        }
    }
    for (const c of model.concepts) {
        if (!referencedConcepts.has(c.name)) {
            warnings.push({ message: `Concept "${c.name}" is not referenced by any field, capability, invariant, or property`, line: c.loc?.start?.line });
        }
    }
    // Collect all referenced enum names
    const referencedEnums = new Set();
    for (const c of model.concepts) {
        for (const f of c.fields) {
            const refs = new Set();
            extractTypeNames(f.fieldType, refs);
            for (const r of refs)
                if (enumNames.has(r))
                    referencedEnums.add(r);
        }
        if (c.lifecycle)
            referencedEnums.add(c.lifecycle.enumRef);
    }
    for (const cap of model.capabilities) {
        for (const p of cap.params) {
            const refs = new Set();
            extractTypeNames(p.fieldType, refs);
            for (const r of refs)
                if (enumNames.has(r))
                    referencedEnums.add(r);
        }
        if (cap.returnType) {
            const refs = new Set();
            extractTypeNames(cap.returnType, refs);
            for (const r of refs)
                if (enumNames.has(r))
                    referencedEnums.add(r);
        }
    }
    for (const e of model.enums) {
        if (!referencedEnums.has(e.name)) {
            warnings.push({ message: `Enum "${e.name}" is not referenced by any field type, lifecycle, or parameter`, line: e.loc?.start?.line });
        }
    }
    // Collect all referenced capability names (from lifecycles, objectives)
    const referencedCaps = new Set();
    for (const c of model.concepts) {
        if (c.lifecycle) {
            for (const tr of c.lifecycle.transitions)
                referencedCaps.add(tr.capability);
        }
    }
    for (const obj of model.objectives) {
        for (const tr of obj.transitions) {
            if (tr.from !== "*")
                referencedCaps.add(tr.from);
            if (tr.to !== "end")
                referencedCaps.add(tr.to);
        }
    }
    for (const cap of model.capabilities) {
        if (!referencedCaps.has(cap.name)) {
            warnings.push({ message: `Capability "${cap.name}" is not referenced by any lifecycle or objective`, line: cap.loc?.start?.line });
        }
    }
    // === 5. DECORATOR CHECKS ===
    const allConstructs = [
        ...model.concepts, ...model.enums, ...model.capabilities,
        ...model.invariants.filter((i) => i.scope === "global"),
        ...model.properties, ...model.objectives,
    ];
    for (const c of allConstructs) {
        if (hasDecorator(c.decorators, "verified") && !hasDecorator(c.decorators, "impl")) {
            warnings.push({ message: `"${c.name}": @verified without @impl`, line: c.loc?.start?.line });
        }
        if (hasDecorator(c.decorators, "live") && !hasDecorator(c.decorators, "impl")) {
            warnings.push({ message: `"${c.name}": @live without @impl`, line: c.loc?.start?.line });
        }
    }
    // === 6. QUALITY GUARDS ===
    for (const c of model.concepts) {
        if (c.fields.length >= 15) {
            warnings.push({ message: `Concept "${c.name}" has ${c.fields.length} fields (threshold: 15) — consider splitting`, line: c.loc?.start?.line });
        }
        // Concept without identification
        const hasId = c.fields.some((f) => f.name === "id" || f.decorators.some((d) => d.name === "unique"));
        if (c.fields.length > 0 && !hasId) {
            warnings.push({ message: `Concept "${c.name}" has no identification field (id or @unique)`, line: c.loc?.start?.line });
        }
    }
    return { errors, warnings };
}
// === Diagram Rendering (v2) ===
/**
 * Render a domain diagram: shows domains as subgraphs with their constructs.
 */
function renderDomainDiagram(model, domainMap) {
    const lines = ["graph LR"];
    // Group constructs by domain
    const domains = new Map();
    for (const [key, domain] of domainMap) {
        if (!domains.has(domain))
            domains.set(domain, []);
        const [type, name] = key.split(":");
        domains.get(domain).push({ type, name });
    }
    for (const [domain, constructs] of domains) {
        const safeId = domain.replace(/[^a-zA-Z0-9]/g, "_");
        lines.push(`  subgraph ${safeId} ["${domain}"]`);
        for (const c of constructs) {
            const nodeId = `${c.type}_${c.name}`;
            lines.push(`    ${nodeId}["${c.type}: ${c.name}"]`);
        }
        lines.push(`  end`);
    }
    return lines.join("\n");
}
/**
 * Render a concept diagram: ER-style diagram showing concepts with fields and relationships.
 */
function renderConceptDiagram(model) {
    const lines = ["erDiagram"];
    const conceptNames = new Set(model.concepts.map((c) => c.name));
    const seenEdges = new Set();
    for (const concept of model.concepts) {
        lines.push(`  ${concept.name} {`);
        for (const field of concept.fields) {
            const typeName = fieldTypeToString(field.fieldType);
            const pk = field.decorators.some((d) => d.name === "unique") ? "PK" : "";
            lines.push(`    ${typeName} ${field.name} ${pk}`.trimEnd());
        }
        lines.push("  }");
        // Relationships from field references
        for (const field of concept.fields) {
            const refs = extractFieldTypeRefs(field.fieldType);
            for (const ref of refs) {
                if (!conceptNames.has(ref))
                    continue;
                const edgeKey = [concept.name, ref].sort().join(":") + `:${field.name}`;
                if (seenEdges.has(edgeKey))
                    continue;
                seenEdges.add(edgeKey);
                const isArray = isArrayType(field.fieldType);
                const notation = isArray ? "||--o{" : "||--||";
                lines.push(`  ${concept.name} ${notation} ${ref} : "${field.name}"`);
            }
        }
    }
    return lines.join("\n");
}
/**
 * Render a lifecycle diagram: state diagram showing lifecycle transitions.
 */
function renderLifecycleDiagram(model) {
    const lines = ["stateDiagram-v2"];
    for (const concept of model.concepts) {
        if (!concept.lifecycle)
            continue;
        lines.push(`  %% Lifecycle: ${concept.name}.${concept.lifecycle.field} (${concept.lifecycle.enumRef})`);
        for (const t of concept.lifecycle.transitions) {
            const from = t.from === "*" ? "[*]" : t.from;
            const label = t.requires ? `${t.capability} [${t.requires}]` : t.capability;
            lines.push(`  ${from} --> ${t.to}: ${label}`);
        }
    }
    if (lines.length === 1) {
        lines.push("  %% No lifecycles declared");
    }
    return lines.join("\n");
}
/**
 * Render a capability diagram: sequence diagram showing capabilities with their clauses.
 */
function renderCapabilityDiagram(model) {
    const lines = ["sequenceDiagram"];
    for (const cap of model.capabilities) {
        lines.push(`  Note over System: ${cap.name}`);
        for (const clause of cap.clauses) {
            switch (clause.type) {
                case "given":
                    lines.push(`  Note right of System: given ${clause.expression}`);
                    break;
                case "affects":
                    lines.push(`  System->>Domain: affects ${clause.concept}`);
                    for (const a of clause.assignments) {
                        lines.push(`  Note right of Domain: ${a.field} = ${a.expression}`);
                    }
                    break;
                case "reject":
                    lines.push(`  System--xClient: reject "${clause.reason}"`);
                    break;
                case "then":
                    lines.push(`  Note right of System: then ${clause.expression}`);
                    break;
                case "emits":
                    lines.push(`  System->>Events: emits ${clause.event}`);
                    break;
                case "via":
                    lines.push(`  Client->>System: via ${clause.method} ${clause.path}`);
                    break;
            }
        }
    }
    if (model.capabilities.length === 0) {
        lines.push("  Note over System: No capabilities declared");
    }
    return lines.join("\n");
}
/**
 * Render an objective diagram: journey/flow diagram showing objectives with transitions.
 */
function renderObjectiveDiagram(model) {
    const lines = ["graph LR"];
    for (const obj of model.objectives) {
        lines.push(`  %% Objective: ${obj.name}${obj.persona ? ` @persona(${obj.persona})` : ""}`);
        for (const t of obj.transitions) {
            const from = t.from === "*" ? "ANY[*]" : t.from === "end" ? "END((end))" : t.from;
            const to = t.to === "end" ? "END((end))" : t.to;
            lines.push(`  ${from} -->|${t.trigger}| ${to}`);
        }
    }
    if (model.objectives.length === 0) {
        lines.push("  %% No objectives declared");
    }
    return lines.join("\n");
}
/**
 * Render an invariant diagram: shows invariants and their concept references.
 */
function renderInvariantDiagram(model) {
    const lines = ["graph TD"];
    const conceptNames = new Set(model.concepts.map((c) => c.name));
    const addedConcepts = new Set();
    const globalInvariants = model.invariants.filter((i) => i.scope === "global");
    for (const inv of globalInvariants) {
        const invId = `inv_${inv.name}`;
        lines.push(`  ${invId}{{"${inv.name}"}}`);
        // Find concept references in expression
        for (const cName of conceptNames) {
            if (inv.expression.includes(cName)) {
                if (!addedConcepts.has(cName)) {
                    addedConcepts.add(cName);
                    lines.push(`  ${cName}["${cName}"]`);
                }
                lines.push(`  ${invId} -.->|references| ${cName}`);
            }
        }
    }
    // Local invariants (inside concepts)
    const localInvariants = model.invariants.filter((i) => i.scope === "local");
    for (const inv of localInvariants) {
        const invId = `inv_${inv.conceptName}_${inv.name}`;
        lines.push(`  ${invId}{{"${inv.conceptName}.${inv.name}"}}`);
        if (inv.conceptName) {
            if (!addedConcepts.has(inv.conceptName)) {
                addedConcepts.add(inv.conceptName);
                lines.push(`  ${inv.conceptName}["${inv.conceptName}"]`);
            }
            lines.push(`  ${invId} -.->|belongs to| ${inv.conceptName}`);
        }
    }
    if (model.invariants.length === 0) {
        lines.push("  %% No invariants declared");
    }
    return lines.join("\n");
}
/**
 * Render a property diagram: shows properties with their clauses and concept references.
 */
function renderPropertyDiagram(model) {
    const lines = ["graph TD"];
    const conceptNames = new Set(model.concepts.map((c) => c.name));
    const addedConcepts = new Set();
    for (const prop of model.properties) {
        const propId = `prop_${prop.name}`;
        const clauseSummary = prop.clauses.map((c) => c.type).join(", ");
        lines.push(`  ${propId}{{"${prop.name} [${clauseSummary}]"}}`);
        // Find concept references in clause expressions
        for (const clause of prop.clauses) {
            for (const cName of conceptNames) {
                if (clause.expression.includes(cName)) {
                    if (!addedConcepts.has(cName)) {
                        addedConcepts.add(cName);
                        lines.push(`  ${cName}["${cName}"]`);
                    }
                    lines.push(`  ${propId} -.->|${clause.type}| ${cName}`);
                }
            }
        }
    }
    if (model.properties.length === 0) {
        lines.push("  %% No properties declared");
    }
    return lines.join("\n");
}
// === Field type helpers ===
function fieldTypeToString(ft) {
    switch (ft.type) {
        case "PrimitiveType":
        case "ReferenceType":
            return ft.name;
        case "OptionalType":
            return fieldTypeToString(ft.inner) + "?";
        case "ArrayType":
            return fieldTypeToString(ft.inner) + "[]";
        case "UnionType":
            return ft.alternatives.map(fieldTypeToString).join("|");
    }
}
function extractFieldTypeRefs(ft) {
    switch (ft.type) {
        case "PrimitiveType":
            return [];
        case "ReferenceType":
            return [ft.name];
        case "OptionalType":
        case "ArrayType":
            return extractFieldTypeRefs(ft.inner);
        case "UnionType":
            return ft.alternatives.flatMap(extractFieldTypeRefs);
    }
}
function isArrayType(ft) {
    return ft.type === "ArrayType";
}
// === Main Entry Point ===
export function loadModelSnapshot(filePath, resolveIncludes = false) {
    const t0 = performance.now();
    const absPath = resolve(filePath);
    const source = readFileSync(absPath, "utf-8");
    // Detect v2
    if (!isV2Source(source)) {
        throw new Error(`MFD Visual v2: file "${absPath}" does not appear to be a v2 model. ` +
            `V2 models must contain top-level 'concept', 'capability', 'objective', 'invariant', or 'property' constructs. ` +
            `V1 models (with 'component', 'entity', 'flow') are no longer supported by this visual server.`);
    }
    // Parse v2 model
    const t1 = performance.now();
    const model = parseV2(source, absPath);
    const tParse = performance.now();
    // Collect trackable constructs
    const constructs = collectTrackableConstructs(model, absPath);
    const tCollect = performance.now();
    // Build construct→domain map
    const constructDomainMap = buildConstructDomainMap(constructs);
    // Build domain infos
    const domains = buildDomainInfos(constructs, constructDomainMap);
    const tDomains = performance.now();
    // Build stats
    const stats = buildStatsV2(model, constructs, constructDomainMap);
    const tStats = performance.now();
    // Validation
    const validation = validateV2(model);
    const tValidate = performance.now();
    // Lazy diagram generation: only render each diagram type on first access.
    const diagramRenderers = {
        domain: () => renderDomainDiagram(model, constructDomainMap),
        concept: () => renderConceptDiagram(model),
        lifecycle: () => renderLifecycleDiagram(model),
        capability: () => renderCapabilityDiagram(model),
        objective: () => renderObjectiveDiagram(model),
        invariant: () => renderInvariantDiagram(model),
        property: () => renderPropertyDiagram(model),
    };
    const diagramCache = {};
    const diagrams = new Proxy(diagramCache, {
        get(target, prop) {
            if (!(prop in diagramCache) && prop in diagramRenderers) {
                diagramCache[prop] = diagramRenderers[prop]();
            }
            return target[prop];
        },
    });
    // Extract system name and version
    let systemName = "MFD Model";
    let systemVersion = null;
    if (model.systems.length > 0) {
        systemName = model.systems[0].name;
        systemVersion = model.systems[0].version ?? null;
    }
    const tEnd = performance.now();
    console.log(`[MFD Scope] Snapshot built in ${(tEnd - t0).toFixed(0)}ms` +
        ` (parse:${(tParse - t1).toFixed(0)} collect:${(tCollect - tParse).toFixed(0)}` +
        ` domains:${(tDomains - tCollect).toFixed(0)} stats:${(tStats - tDomains).toFixed(0)}` +
        ` validate:${(tValidate - tStats).toFixed(0)} diagrams:lazy)`);
    return {
        systemName,
        systemVersion,
        model,
        diagrams,
        stats,
        validation,
        domains,
        constructDomainMap,
        timestamp: Date.now(),
        filePath: absPath,
    };
}
//# sourceMappingURL=data.js.map