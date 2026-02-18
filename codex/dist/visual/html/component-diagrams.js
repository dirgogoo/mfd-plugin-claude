/**
 * Component-scoped Mermaid diagram generators.
 * Produces diagrams filtered to show only constructs belonging to a specific component.
 */
import { constructLink } from "./shared.js";
import { makeKey } from "../relationships.js";
export function renderComponentEntityDiagram(snapshot, compName) {
    const ccMap = snapshot.constructComponentMap;
    const entities = snapshot.model.entities.filter(e => ccMap.get(`entity:${e.name}`) === compName);
    if (entities.length === 0)
        return null;
    const entityNames = new Set(entities.map(e => e.name));
    const lines = ["erDiagram"];
    for (const entity of entities) {
        lines.push(`  ${entity.name} {`);
        for (const field of entity.fields) {
            let typeName;
            const ft = field.fieldType;
            if (ft.type === "PrimitiveType" || ft.type === "ReferenceType") {
                typeName = ft.name;
            }
            else if (ft.type === "OptionalType") {
                const inner = ft.inner;
                typeName = (inner.type === "PrimitiveType" || inner.type === "ReferenceType" ? inner.name : "unknown") + "?";
            }
            else if (ft.type === "ArrayType") {
                const inner = ft.inner;
                typeName = (inner.type === "PrimitiveType" || inner.type === "ReferenceType" ? inner.name : "unknown") + "[]";
            }
            else {
                typeName = "unknown";
            }
            const pk = field.decorators?.some((d) => d.name === "unique") ? "PK" : "";
            lines.push(`    ${typeName} ${field.name} ${pk}`.trimEnd());
        }
        lines.push("  }");
    }
    // Inheritance relationships
    for (const entity of entities) {
        if (entity.extends) {
            const parentName = entity.extends;
            if (entityNames.has(parentName)) {
                lines.push(`  ${parentName} ||--|| ${entity.name} : "extends"`);
            }
        }
        if (entity.implements) {
            for (const ifaceName of entity.implements) {
                if (entityNames.has(ifaceName)) {
                    lines.push(`  ${ifaceName} }|..|{ ${entity.name} : "implements"`);
                }
            }
        }
    }
    // Relationships between entities in this component
    for (const entity of entities) {
        for (const field of entity.fields) {
            let refName = null;
            const ft = field.fieldType;
            if (ft.type === "ReferenceType")
                refName = ft.name;
            else if (ft.type === "OptionalType" && ft.inner.type === "ReferenceType")
                refName = ft.inner.name;
            if (refName) {
                if (entityNames.has(refName)) {
                    lines.push(`  ${entity.name} ||--o{ ${refName} : "${field.name}"`);
                }
                else {
                    // Ghost node -- external entity
                    const extComp = ccMap.get(`entity:${refName}`);
                    if (extComp) {
                        // Add as ghost entity with minimal definition
                        if (!lines.some(l => l.includes(`${refName} {`))) {
                            lines.push(`  ${refName} {`);
                            lines.push(`    string _external_ref`);
                            lines.push(`  }`);
                        }
                        lines.push(`  ${entity.name} ||--o{ ${refName} : "${field.name}"`);
                    }
                }
            }
        }
    }
    return lines.join("\n");
}
export function renderComponentStateDiagram(snapshot, compName) {
    const ccMap = snapshot.constructComponentMap;
    const states = snapshot.model.states.filter(s => ccMap.get(`state:${s.name}`) === compName);
    if (states.length === 0)
        return null;
    const lines = ["stateDiagram-v2"];
    for (const state of states) {
        lines.push(`  %% ${state.name}`);
        for (const transition of state.transitions) {
            const from = transition.from === "*" ? "[*]" : transition.from;
            const to = transition.to;
            const label = transition.event ?? "";
            lines.push(`  ${from} --> ${to}: ${label}`);
        }
    }
    return lines.join("\n");
}
export function renderComponentFlowDiagram(snapshot, compName) {
    const ccMap = snapshot.constructComponentMap;
    const flows = snapshot.model.flows.filter(f => ccMap.get(`flow:${f.name}`) === compName);
    if (flows.length === 0)
        return null;
    // Build operation → API endpoint details for this component
    const opApiMap = new Map();
    const operations = snapshot.model.operations.filter(o => ccMap.get(`operation:${o.name}`) === compName);
    for (const op of operations) {
        const connections = [];
        for (const item of op.body) {
            if (item.type === "OperationHandlesClause") {
                connections.push({ relation: "handles", method: item.method, path: item.path });
            }
            if (item.type === "OperationCallsClause") {
                connections.push({ relation: "calls", method: item.method, path: item.path });
            }
        }
        if (connections.length > 0)
            opApiMap.set(op.name, connections);
    }
    // Build endpoint → construct map for connecting endpoint nodes to entities/events
    const endpointConstructs = buildComponentEndpointMap(snapshot, compName);
    const extraNodes = new Set();
    const lines = ["graph TD"];
    for (const flow of flows) {
        const flowId = flow.name.replace(/[^a-zA-Z0-9]/g, '_');
        const params = flow.params.map(p => formatSimpleType(p)).join(", ");
        const ret = flow.returnType ? formatSimpleType(flow.returnType) : "void";
        lines.push(`  ${flowId}["${flow.name}(${params}) -> ${ret}"]:::flowNode`);
        // Steps → operations with endpoint nodes
        for (const step of flow.body) {
            if (step.type === "FlowStep") {
                const action = step.action || "";
                const opConns = opApiMap.get(action);
                if (opConns) {
                    const opId = `op_${action}`.replace(/[^a-zA-Z0-9_]/g, '_');
                    if (!extraNodes.has(opId)) {
                        extraNodes.add(opId);
                        lines.push(`  ${opId}{{"${action}"}}:::opNode`);
                    }
                    lines.push(`  ${flowId} --> ${opId}`);
                    // Endpoint as separate nodes connected to the operation
                    for (const conn of opConns) {
                        const epLabel = `${conn.method} ${conn.path}`;
                        const epId = `ep_${epLabel}`.replace(/[^a-zA-Z0-9_]/g, '_');
                        if (!extraNodes.has(epId)) {
                            extraNodes.add(epId);
                            lines.push(`  ${epId}(["${epLabel}"]):::endpointNode`);
                        }
                        lines.push(`  ${opId} -->|${conn.relation}| ${epId}`);
                        // Connect endpoint to entities/events it returns/streams
                        const epKey = `${conn.method} ${conn.path}`;
                        const constructs = endpointConstructs.get(epKey);
                        if (constructs) {
                            for (const c of constructs) {
                                const cId = `${c.type}_${c.name}`.replace(/[^a-zA-Z0-9_]/g, '_');
                                if (!extraNodes.has(cId)) {
                                    extraNodes.add(cId);
                                    const cls = c.type === "entity" ? "entityNode" : "eventNode";
                                    const shape = c.type === "entity" ? `[("${c.name}")]` : `(["${c.name}"])`;
                                    lines.push(`  ${cId}${shape}:::${cls}`);
                                }
                                lines.push(`  ${epId} -.->|${c.relation}| ${cId}`);
                            }
                        }
                    }
                }
            }
        }
        // Emitted events
        for (const item of flow.body) {
            if (item.type === "EmitsClause") {
                const evName = item.event;
                const evId = `ev_${evName}`.replace(/[^a-zA-Z0-9_]/g, '_');
                if (!extraNodes.has(evId)) {
                    extraNodes.add(evId);
                    lines.push(`  ${evId}(["${evName}"]):::eventNode`);
                }
                lines.push(`  ${flowId} -->|emits| ${evId}`);
            }
        }
        // Trigger events
        for (const item of flow.body) {
            if (item.type === "OnClause") {
                const evName = item.event;
                const evId = `ev_${evName}`.replace(/[^a-zA-Z0-9_]/g, '_');
                if (!extraNodes.has(evId)) {
                    extraNodes.add(evId);
                    lines.push(`  ${evId}(["${evName}"]):::eventNode`);
                }
                lines.push(`  ${evId} -->|triggers| ${flowId}`);
            }
        }
    }
    lines.push("  classDef flowNode fill:#0A2A0A,stroke:#00FF41,color:#00FF41,stroke-width:2px");
    lines.push("  classDef entityNode fill:#0A2A2A,stroke:#00E5FF,color:#00E5FF");
    lines.push("  classDef eventNode fill:#1A0A2A,stroke:#E040FB,color:#E040FB");
    lines.push("  classDef opNode fill:#2A1A0A,stroke:#FF9100,color:#FF9100");
    lines.push("  classDef endpointNode fill:#1A1A0A,stroke:#FBBF24,color:#FBBF24");
    return lines.join("\n");
}
export function renderComponentScreenDiagram(snapshot, compName) {
    const ccMap = snapshot.constructComponentMap;
    const screens = snapshot.model.screens.filter(s => ccMap.get(`screen:${s.name}`) === compName);
    if (screens.length === 0)
        return null;
    // Build endpoint → construct lookup (same logic as global renderer)
    const endpointToConstruct = buildComponentEndpointMap(snapshot, compName);
    const extraNodes = new Set();
    const lines = ["graph TD"];
    // Screen nodes with uses
    for (const screen of screens) {
        lines.push(`  ${screen.name}["${screen.name}"]:::screenNode`);
        for (const item of screen.body) {
            if (item.type === "UsesDecl") {
                const el = item.element;
                const elId = `el_${el}`;
                if (!extraNodes.has(elId)) {
                    extraNodes.add(elId);
                    lines.push(`  ${elId}["${el}"]:::elementNode`);
                }
                lines.push(`  ${screen.name} -.->|uses| ${elId}`);
            }
        }
    }
    // Actions belonging to this component
    const actions = snapshot.model.actions.filter(a => ccMap.get(`action:${a.name}`) === compName);
    const allScreenNames = new Set(snapshot.model.screens.map(s => s.name));
    for (const action of actions) {
        let fromScreen = null;
        let actionType = "pure";
        let callsEndpoint = null;
        let streamEndpoint = null;
        let onSignal = null;
        let emitsSignal = null;
        for (const item of action.body) {
            if (item.type === "ActionFromClause")
                fromScreen = item.screen;
            if (item.type === "ActionCallsClause") {
                actionType = "imperative";
                callsEndpoint = `${item.method} ${item.path}`;
            }
            if (item.type === "ActionOnStreamClause") {
                actionType = "reactive-stream";
                streamEndpoint = item.path;
            }
            if (item.type === "ActionOnSignalClause") {
                actionType = "reactive-signal";
                onSignal = item.signal;
            }
            if (item.type === "ActionEmitsSignalClause") {
                emitsSignal = item.signal;
            }
        }
        // Badge
        const badges = [];
        if (actionType === "pure")
            badges.push("pure");
        else if (actionType === "imperative")
            badges.push("calls");
        else if (actionType === "reactive-stream")
            badges.push("stream");
        else if (actionType === "reactive-signal")
            badges.push("on signal");
        if (emitsSignal)
            badges.push("emits");
        lines.push(`  ${action.name}{{"${action.name}\\n[${badges.join("+")}]"}}:::actionNode`);
        if (fromScreen) {
            // Ensure cross-component screens are rendered
            if (!screens.some(s => s.name === fromScreen) && allScreenNames.has(fromScreen)) {
                if (!extraNodes.has(fromScreen)) {
                    extraNodes.add(fromScreen);
                    lines.push(`  ${fromScreen}["${fromScreen}"]:::extScreenNode`);
                }
            }
            lines.push(`  ${fromScreen} --> ${action.name}`);
        }
        // Signal nodes
        if (emitsSignal) {
            const nodeId = `sig_${emitsSignal}`;
            if (!extraNodes.has(nodeId)) {
                extraNodes.add(nodeId);
                lines.push(`  ${nodeId}[/"${emitsSignal}"/]:::signalNode`);
            }
            lines.push(`  ${action.name} -->|emits| ${nodeId}`);
        }
        if (onSignal) {
            const nodeId = `sig_${onSignal}`;
            if (!extraNodes.has(nodeId)) {
                extraNodes.add(nodeId);
                lines.push(`  ${nodeId}[/"${onSignal}"/]:::signalNode`);
            }
            lines.push(`  ${nodeId} -->|triggers| ${action.name}`);
        }
        // Endpoint as separate node → construct connections
        const endpoint = callsEndpoint || (streamEndpoint ? `STREAM ${streamEndpoint}` : null);
        if (endpoint) {
            const epId = `ep_${endpoint}`.replace(/[^a-zA-Z0-9_]/g, '_');
            if (!extraNodes.has(epId)) {
                extraNodes.add(epId);
                lines.push(`  ${epId}(["${endpoint}"]):::endpointNode`);
            }
            lines.push(`  ${action.name} --> ${epId}`);
            // Connect endpoint to entities/events it returns/streams
            const constructs = endpointToConstruct.get(endpoint);
            if (constructs) {
                for (const c of constructs) {
                    const nodeId = `${c.type}_${c.name}`;
                    if (!extraNodes.has(nodeId)) {
                        extraNodes.add(nodeId);
                        const cls = c.type === "entity" ? "entityNode" : c.type === "event" ? "eventNode" : "flowNode";
                        const shape = c.type === "entity" ? `[("${c.name}")]` : `(["${c.name}"])`;
                        lines.push(`  ${nodeId}${shape}:::${cls}`);
                    }
                    lines.push(`  ${epId} -.->|${c.relation}| ${nodeId}`);
                }
            }
        }
        // Action results (navigation)
        for (const item of action.body) {
            if (item.type === "ActionResult") {
                const target = item.screen;
                if (target === "end") {
                    if (!extraNodes.has("END")) {
                        extraNodes.add("END");
                        lines.push(`  END((end))`);
                    }
                    lines.push(`  ${action.name} -->|${item.outcome}| END`);
                }
                else {
                    // Ensure cross-component screen targets are rendered
                    if (!screens.some(s => s.name === target) && allScreenNames.has(target)) {
                        if (!extraNodes.has(target)) {
                            extraNodes.add(target);
                            lines.push(`  ${target}["${target}"]:::extScreenNode`);
                        }
                    }
                    lines.push(`  ${action.name} -->|${item.outcome}| ${target}`);
                }
            }
        }
    }
    lines.push("  classDef screenNode fill:#0A1A2A,stroke:#448AFF,color:#448AFF,stroke-width:2px");
    lines.push("  classDef extScreenNode fill:#0A1A2A,stroke:#448AFF,color:#448AFF,stroke-width:1px,stroke-dasharray:5 5");
    lines.push("  classDef elementNode fill:#1A1A1A,stroke:#666,color:#999");
    lines.push("  classDef actionNode fill:#1A2A1A,stroke:#00FF41,color:#00FF41");
    lines.push("  classDef signalNode fill:#2A1A2A,stroke:#E040FB,color:#E040FB");
    lines.push("  classDef endpointNode fill:#1A1A0A,stroke:#FBBF24,color:#FBBF24");
    lines.push("  classDef entityNode fill:#0A2A2A,stroke:#00E5FF,color:#00E5FF");
    lines.push("  classDef eventNode fill:#1A0A2A,stroke:#E040FB,color:#E040FB");
    lines.push("  classDef flowNode fill:#0A2A0A,stroke:#00FF41,color:#00FF41");
    return lines.join("\n");
}
function buildComponentEndpointMap(snapshot, compName) {
    const map = new Map();
    const model = snapshot.model;
    const addEntry = (key, type, name, relation) => {
        if (!map.has(key))
            map.set(key, []);
        const arr = map.get(key);
        if (!arr.some(e => e.type === type && e.name === name)) {
            arr.push({ type, name, relation });
        }
    };
    for (const api of model.apis) {
        const prefixDec = api.decorators?.find((d) => d.name === "prefix");
        const prefix = prefixDec ? String(prefixDec.params[0]?.value ?? "") : "";
        for (const ep of api.endpoints) {
            const fullPath = prefix + ep.path;
            const key = `${ep.method} ${fullPath}`;
            const retType = ep.returnType ?? ep.response;
            const inType = ep.inputType ?? ep.body;
            for (const ref of extractTypeRefs(retType)) {
                if (model.entities.some(e => e.name === ref))
                    addEntry(key, "entity", ref, "returns");
                if (model.events.some(e => e.name === ref))
                    addEntry(key, "event", ref, "streams");
            }
            for (const ref of extractTypeRefs(inType)) {
                if (model.entities.some(e => e.name === ref))
                    addEntry(key, "entity", ref, "input");
            }
            if (ep.method === "STREAM") {
                const streamKey = `STREAM ${fullPath}`;
                for (const ref of extractTypeRefs(retType)) {
                    if (model.events.some(e => e.name === ref))
                        addEntry(streamKey, "event", ref, "streams");
                    if (model.entities.some(e => e.name === ref))
                        addEntry(streamKey, "entity", ref, "streams");
                }
            }
        }
    }
    return map;
}
function extractTypeRefs(typeExpr) {
    if (!typeExpr)
        return [];
    switch (typeExpr.type) {
        case "ReferenceType": return [typeExpr.name];
        case "OptionalType":
        case "ArrayType": return extractTypeRefs(typeExpr.inner);
        case "UnionType": return (typeExpr.alternatives || []).flatMap(extractTypeRefs);
        default: return [];
    }
}
export function renderComponentJourneyDiagram(snapshot, compName) {
    const ccMap = snapshot.constructComponentMap;
    const journeys = snapshot.model.journeys.filter(j => ccMap.get(`journey:${j.name}`) === compName);
    if (journeys.length === 0)
        return null;
    const lines = ["graph LR"];
    for (const journey of journeys) {
        for (const item of journey.body) {
            if (item.type === "JourneyStep") {
                const step = item;
                const from = step.from === "*" ? "ANY[*]" : step.from === "end" ? "END((end))" : step.from;
                const to = step.to === "end" ? "END((end))" : step.to;
                lines.push(`  ${from} -->|${step.trigger}| ${to}`);
            }
        }
    }
    return lines.join("\n");
}
export function renderComponentDepDiagram(snapshot, compName) {
    const comp = snapshot.model.components.find(c => c.name === compName);
    if (!comp)
        return null;
    const deps = comp.body.filter(b => b.type === "DepDecl");
    // Also find reverse deps (who depends on this component)
    const reverseDeps = [];
    for (const other of snapshot.model.components) {
        if (other.name === compName)
            continue;
        for (const item of other.body) {
            if (item.type === "DepDecl" && item.target === compName) {
                reverseDeps.push(other.name);
            }
        }
    }
    if (deps.length === 0 && reverseDeps.length === 0)
        return null;
    const lines = ["graph LR"];
    lines.push(`  ${compName}["${compName}"]:::centerNode`);
    for (const dep of deps) {
        const target = dep.target;
        const optional = dep.decorators?.some((d) => d.name === "optional");
        const arrow = optional ? "-.->" : "-->";
        lines.push(`  ${compName} ${arrow} ${target}`);
    }
    for (const revDep of reverseDeps) {
        lines.push(`  ${revDep} --> ${compName}`);
    }
    lines.push("  classDef centerNode fill:#1A3A1A,stroke:#00FF41,stroke-width:2px,color:#00FF41");
    return lines.join("\n");
}
function formatSimpleType(typeExpr) {
    if (!typeExpr)
        return "unknown";
    switch (typeExpr.type) {
        case "PrimitiveType": return typeExpr.name;
        case "ReferenceType": return typeExpr.name;
        case "OptionalType": return formatSimpleType(typeExpr.inner) + "?";
        case "ArrayType": return formatSimpleType(typeExpr.inner) + "[]";
        case "UnionType": return typeExpr.alternatives.map(formatSimpleType).join("|");
        default: return "unknown";
    }
}
/**
 * Generates a relationship diagram showing ALL constructs in a component
 * and how they connect to each other. Uses the precomputed relationships
 * from the RelationshipEngine.
 */
export function renderComponentRelationshipDiagram(snapshot, compName) {
    const ccMap = snapshot.constructComponentMap;
    const rels = snapshot.relationships;
    const entities = snapshot.model.entities.filter(e => ccMap.get(`entity:${e.name}`) === compName);
    const enums = snapshot.model.enums.filter(e => ccMap.get(`enum:${e.name}`) === compName);
    const flows = snapshot.model.flows.filter(f => ccMap.get(`flow:${f.name}`) === compName);
    const comp = snapshot.model.components.find(c => c.name === compName);
    const apis = (comp ? comp.body.filter((b) => b.type === "ApiDecl") : []);
    const states = snapshot.model.states.filter(s => ccMap.get(`state:${s.name}`) === compName);
    const events = snapshot.model.events.filter(e => ccMap.get(`event:${e.name}`) === compName);
    const rules = snapshot.model.rules.filter(r => ccMap.get(`rule:${r.name}`) === compName);
    const screens = snapshot.model.screens.filter(s => ccMap.get(`screen:${s.name}`) === compName);
    const journeys = snapshot.model.journeys.filter(j => ccMap.get(`journey:${j.name}`) === compName);
    const total = entities.length + enums.length + flows.length + apis.length +
        states.length + events.length + rules.length + screens.length + journeys.length;
    if (total === 0)
        return null;
    // Sanitize node IDs for Mermaid (no spaces, special chars)
    function nodeId(type, name) {
        return `${type}_${name}`.replace(/[^a-zA-Z0-9_]/g, '_');
    }
    // Escape label text for Mermaid (quotes need to be safe)
    function label(text) {
        return text.replace(/"/g, '#quot;');
    }
    const lines = ["graph LR"];
    const edges = new Set();
    function addEdge(from, to, edgeLabel) {
        const key = `${from}-->${to}`;
        if (edges.has(key))
            return;
        edges.add(key);
        if (edgeLabel) {
            lines.push(`  ${from} -->|${label(edgeLabel)}| ${to}`);
        }
        else {
            lines.push(`  ${from} --> ${to}`);
        }
    }
    // Extract @impl and @tests decorator values
    function getDecValue(decorators, decName) {
        const d = decorators?.find((dec) => dec.name === decName);
        return d ? String(d.params[0]?.value ?? "") : "";
    }
    function statusLine(decorators) {
        const implDec = decorators?.find((dec) => dec.name === "impl");
        const tests = getDecValue(decorators, "tests");
        const implLabel = implDec && implDec.params.length > 0
            ? `impl: ${implDec.params.length} file(s)`
            : "impl: -";
        const testsLabel = tests ? `tests: ${tests}` : "tests: -";
        return `<br/><small>${implLabel} | ${testsLabel}</small>`;
    }
    // Declare all nodes with uniform shape, type label, status, and color per type
    function addNode(type, name, decorators) {
        const id = nodeId(type, name);
        const href = constructLink(compName, type, name);
        const status = statusLine(decorators);
        lines.push(`  ${id}["${label(type)}: ${label(name)}${status}"]:::${type}Node`);
        lines.push(`  click ${id} "${href}"`);
    }
    for (const e of entities)
        addNode("entity", e.name, e.decorators);
    for (const e of enums)
        addNode("enum", e.name, e.decorators);
    for (const f of flows)
        addNode("flow", f.name, f.decorators);
    for (const a of apis) {
        const isExternal = a.decorators?.some((d) => d.name === "external");
        addNode(isExternal ? "externalApi" : "api", a.name ?? "api", a.decorators);
    }
    for (const s of states)
        addNode("state", s.name, s.decorators);
    for (const e of events)
        addNode("event", e.name, e.decorators);
    for (const r of rules)
        addNode("rule", r.name, r.decorators);
    for (const s of screens)
        addNode("screen", s.name, s.decorators);
    for (const j of journeys)
        addNode("journey", j.name, j.decorators);
    // Build edges from relationships
    // Entity → Flow (usedByFlows)
    for (const entity of entities) {
        const rel = rels.get(makeKey(compName, "entity", entity.name));
        if (!rel)
            continue;
        for (const ref of rel.usedByFlows) {
            if (ref.component === compName) {
                addEdge(nodeId("entity", entity.name), nodeId("flow", ref.name), "used by");
            }
        }
        for (const ref of rel.exposedByApi) {
            if (ref.component === compName) {
                // Find the api construct name — use the first api in this component
                for (const api of apis) {
                    for (const ep of api.endpoints) {
                        if (ep.method === ref.method && ep.path === ref.path) {
                            const isExt = api.decorators?.some((d) => d.name === "external");
                            addEdge(nodeId("entity", entity.name), nodeId(isExt ? "externalApi" : "api", api.name ?? "api"), `${ref.method}`);
                        }
                    }
                }
            }
        }
        for (const ref of rel.governedByStates) {
            if (ref.component === compName) {
                addEdge(nodeId("state", ref.name), nodeId("entity", entity.name), "governs");
            }
        }
        for (const ref of rel.governedByRules) {
            if (ref.component === compName) {
                addEdge(nodeId("rule", ref.name), nodeId("entity", entity.name), "validates");
            }
        }
    }
    // Flow → Event (emitsEvents)
    for (const flow of flows) {
        const rel = rels.get(makeKey(compName, "flow", flow.name));
        if (!rel)
            continue;
        for (const ref of rel.emitsEvents) {
            if (ref.component === compName) {
                addEdge(nodeId("flow", flow.name), nodeId("event", ref.name), "emit");
            }
        }
        // Actions from screens (now via actionSources)
        for (const ref of rel.actionSources) {
            if (ref.component === compName) {
                addEdge(nodeId("screen", ref.name), nodeId("flow", flow.name), "action");
            }
        }
    }
    // State → Enum (enumRef)
    for (const state of states) {
        const rel = rels.get(makeKey(compName, "state", state.name));
        if (!rel)
            continue;
        if (rel.enumRef && rel.enumRef.component === compName) {
            addEdge(nodeId("state", state.name), nodeId("enum", rel.enumRef.name), "enum");
        }
    }
    // Journey → Screen links
    for (const journey of journeys) {
        for (const item of journey.body) {
            if (item.type === "JourneyStep") {
                const step = item;
                for (const screenName of [step.from, step.to]) {
                    if (screenName && screenName !== "end" && screenName !== "*") {
                        if (ccMap.get(`screen:${screenName}`) === compName) {
                            addEdge(nodeId("journey", journey.name), nodeId("screen", screenName), "navigates");
                        }
                    }
                }
            }
        }
    }
    // Inheritance edges
    for (const { type, items } of [
        { type: "entity", items: entities },
        { type: "flow", items: flows },
        { type: "event", items: events },
        { type: "screen", items: screens },
    ]) {
        for (const item of items) {
            if (item.extends) {
                const parentName = item.extends;
                if (items.some((i) => i.name === parentName)) {
                    addEdge(nodeId(type, item.name), nodeId(type, parentName), "extends");
                }
            }
            if (item.implements) {
                for (const ifaceName of item.implements) {
                    if (items.some((i) => i.name === ifaceName)) {
                        addEdge(nodeId(type, item.name), nodeId(type, ifaceName), "implements");
                    }
                }
            }
            // Mark abstract/interface nodes
            const isAbstract = item.decorators?.some((d) => d.name === "abstract");
            const isInterface = item.decorators?.some((d) => d.name === "interface");
            if (isAbstract) {
                lines.push(`  class ${nodeId(type, item.name)} abstractNode`);
            }
            if (isInterface) {
                lines.push(`  class ${nodeId(type, item.name)} interfaceNode`);
            }
        }
    }
    // classDefs for each type
    lines.push("  classDef entityNode fill:#0A2A2A,stroke:#00E5FF,color:#00E5FF,stroke-width:2px");
    lines.push("  classDef enumNode fill:#1A1A2E,stroke:#7C4DFF,color:#7C4DFF,stroke-width:1px");
    lines.push("  classDef flowNode fill:#0A2A0A,stroke:#00FF41,color:#00FF41,stroke-width:2px");
    lines.push("  classDef apiNode fill:#2A1A0A,stroke:#FF9100,color:#FF9100,stroke-width:2px");
    lines.push("  classDef externalApiNode fill:#0A0A0A,stroke:#FF9100,color:#FF9100,stroke-dasharray:5 5,opacity:0.6");
    lines.push("  classDef stateNode fill:#2A0A0A,stroke:#FF5252,color:#FF5252,stroke-width:2px");
    lines.push("  classDef eventNode fill:#1A0A2A,stroke:#E040FB,color:#E040FB,stroke-width:1px");
    lines.push("  classDef ruleNode fill:#2A2A0A,stroke:#FFD740,color:#FFD740,stroke-width:1px");
    lines.push("  classDef screenNode fill:#0A1A2A,stroke:#448AFF,color:#448AFF,stroke-width:2px");
    lines.push("  classDef journeyNode fill:#2A1A1A,stroke:#FF6E40,color:#FF6E40,stroke-width:1px");
    lines.push("  classDef abstractNode fill:#1A0A2A,stroke:#9370DB,color:#9370DB,stroke-width:2px,stroke-dasharray:5 5");
    lines.push("  classDef interfaceNode fill:#1A0A2A,stroke:#DDA0DD,color:#DDA0DD,stroke-width:2px,stroke-dasharray:3 3");
    return lines.join("\n");
}
//# sourceMappingURL=component-diagrams.js.map