import { collectModel } from "../../core/validator/collect.js";
import { loadDocument } from "./common.js";
export function handleRender(args) {
    const { doc } = loadDocument(args.file, args.resolve_includes);
    const model = collectModel(doc);
    let mermaid;
    switch (args.diagram_type) {
        case "component":
            mermaid = renderComponentDiagram(model);
            break;
        case "entity":
            mermaid = renderEntityDiagram(model);
            break;
        case "state":
            mermaid = renderStateDiagram(model);
            break;
        case "flow":
            mermaid = renderFlowDiagram(model);
            break;
        case "screen":
            mermaid = renderScreenDiagram(model);
            break;
        case "journey":
            mermaid = renderJourneyDiagram(model);
            break;
        case "deployment":
            mermaid = renderDeploymentDiagram(model);
            break;
        default:
            return {
                content: [
                    {
                        type: "text",
                        text: `Unknown diagram type: ${args.diagram_type}. Use: component, entity, state, flow, screen, journey, deployment`,
                    },
                ],
                isError: true,
            };
    }
    return {
        content: [{ type: "text", text: mermaid }],
    };
}
export function renderComponentDiagram(model) {
    const lines = ["graph LR"];
    for (const comp of model.components) {
        const status = comp.decorators?.find((d) => d.name === "status");
        const label = status
            ? `${comp.name}\\n(@status: ${status.params[0]?.value ?? "?"})`
            : comp.name;
        lines.push(`  ${comp.name}["${label}"]`);
    }
    for (const comp of model.components) {
        for (const item of comp.body) {
            if (item.type === "DepDecl") {
                const optional = item.decorators?.some((d) => d.name === "optional");
                const arrow = optional ? "-.->" : "-->";
                lines.push(`  ${comp.name} ${arrow} ${item.target}`);
            }
        }
    }
    return lines.join("\n");
}
export function renderEntityDiagram(model) {
    const lines = ["erDiagram"];
    for (const entity of model.entities) {
        lines.push(`  ${entity.name} {`);
        for (const field of entity.fields) {
            let typeName;
            const ft = field.fieldType;
            if (ft.type === "PrimitiveType" || ft.type === "ReferenceType") {
                typeName = ft.name;
            }
            else if (ft.type === "OptionalType") {
                const inner = ft.inner;
                typeName =
                    (inner.type === "PrimitiveType" || inner.type === "ReferenceType"
                        ? inner.name
                        : "unknown") + "?";
            }
            else if (ft.type === "ArrayType") {
                const inner = ft.inner;
                typeName =
                    (inner.type === "PrimitiveType" || inner.type === "ReferenceType"
                        ? inner.name
                        : "unknown") + "[]";
            }
            else {
                typeName = "unknown";
            }
            const pk = field.decorators?.some((d) => d.name === "unique")
                ? "PK"
                : "";
            lines.push(`    ${typeName} ${field.name} ${pk}`.trimEnd());
        }
        lines.push("  }");
    }
    // Relationships based on type references and @relation decorators
    const seenEdges = new Set();
    for (const entity of model.entities) {
        for (const field of entity.fields) {
            let refName = null;
            let isArray = false;
            const ft = field.fieldType;
            if (ft.type === "ReferenceType") {
                refName = ft.name;
            }
            else if (ft.type === "OptionalType" && ft.inner.type === "ReferenceType") {
                refName = ft.inner.name;
            }
            else if (ft.type === "ArrayType") {
                const inner = ft.inner;
                if (inner.type === "ReferenceType") {
                    refName = inner.name;
                    isArray = true;
                }
                else if (inner.type === "PrimitiveType") {
                    // primitive arrays are not relationships
                    continue;
                }
            }
            if (!refName)
                continue;
            const target = model.entities.find((e) => e.name === refName);
            if (!target)
                continue;
            // Deduplicate bidirectional edges (A-B === B-A)
            const edgeKey = [entity.name, target.name].sort().join(":");
            const fieldKey = `${edgeKey}:${field.name}`;
            if (seenEdges.has(fieldKey))
                continue;
            seenEdges.add(fieldKey);
            // Determine cardinality notation
            const relationDeco = field.decorators?.find((d) => d.name === "relation");
            let notation;
            if (relationDeco && relationDeco.params[0]) {
                const card = relationDeco.params[0].value;
                switch (card) {
                    case "one_to_one":
                        notation = "||--||";
                        break;
                    case "one_to_many":
                        notation = "||--o{";
                        break;
                    case "many_to_one":
                        notation = "}o--||";
                        break;
                    case "many_to_many":
                        notation = "}o--o{";
                        break;
                    default:
                        notation = "||--o{";
                        break;
                }
            }
            else {
                // Fallback: infer from type shape
                notation = isArray ? "||--o{" : "||--||";
            }
            lines.push(`  ${entity.name} ${notation} ${target.name} : "${field.name}"`);
        }
    }
    return lines.join("\n");
}
export function renderStateDiagram(model) {
    const lines = ["stateDiagram-v2"];
    for (const state of model.states) {
        lines.push(`  %% State machine: ${state.name}`);
        for (const transition of state.transitions) {
            const from = transition.from === "*" ? "[*]" : transition.from;
            const to = transition.to;
            const label = transition.event ?? "";
            lines.push(`  ${from} --> ${to}: ${label}`);
        }
    }
    return lines.join("\n");
}
export function renderFlowDiagram(model) {
    const lines = ["sequenceDiagram"];
    // Build operation-to-api map for connection annotations
    const opApiMap = new Map();
    for (const op of model.operations) {
        const connections = [];
        for (const item of op.body) {
            if (item.type === "OperationHandlesClause") {
                connections.push(`handles ${item.method} ${item.path}`);
            }
            if (item.type === "OperationCallsClause") {
                connections.push(`calls ${item.method} ${item.path}`);
            }
        }
        if (connections.length > 0)
            opApiMap.set(op.name, connections);
    }
    for (const flow of model.flows) {
        lines.push(`  Note over System: Flow: ${flow.name}`);
        // Show trigger event if present
        for (const item of flow.body) {
            if (item.type === "OnClause") {
                lines.push(`  Events->>System: on ${item.event}`);
            }
        }
        let prevActor = "Client";
        for (const item of flow.body) {
            if (item.type === "FlowStep") {
                const stepName = item.action;
                const isAsync = item.decorators?.some((d) => d.name === "async");
                const arrow = isAsync ? "->>" : "->>";
                // If the step calls an operation that has API connections, annotate it
                const opConnections = opApiMap.get(stepName);
                if (opConnections) {
                    lines.push(`  ${prevActor}${arrow}System: ${stepName}`);
                    for (const conn of opConnections) {
                        lines.push(`  System->>API: ${conn}`);
                    }
                }
                else {
                    lines.push(`  ${prevActor}${arrow}System: ${stepName}`);
                }
            }
        }
        // Show emitted events
        for (const item of flow.body) {
            if (item.type === "EmitsClause") {
                lines.push(`  System->>Events: emits ${item.event}`);
            }
        }
    }
    // Show standalone operations with API connections (not already shown inside flows)
    const opsUsedInFlows = new Set();
    for (const flow of model.flows) {
        for (const item of flow.body) {
            if (item.type === "FlowStep")
                opsUsedInFlows.add(item.action);
        }
    }
    for (const [opName, connections] of opApiMap) {
        if (opsUsedInFlows.has(opName))
            continue; // already shown inline
        lines.push(`  Note over System: Operation: ${opName}`);
        for (const conn of connections) {
            lines.push(`  System->>API: ${conn}`);
        }
    }
    return lines.join("\n");
}
export function renderScreenDiagram(model) {
    const lines = ["graph TD"];
    // Build endpoint → construct lookup maps
    const endpointToConstruct = buildEndpointConstructMap(model);
    // Collect all signal/entity/event/flow node IDs to avoid duplicates
    const extraNodes = new Set();
    for (const screen of model.screens) {
        lines.push(`  ${screen.name}["${screen.name}"]`);
        for (const item of screen.body) {
            if (item.type === "UsesDecl") {
                lines.push(`  ${screen.name} -.->|uses| ${item.element}`);
            }
        }
    }
    // Actions linked to screens via `from` clause
    for (const action of model.actions) {
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
        // Build badge with signal info
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
        lines.push(`  ${action.name}{{"${action.name} [${badges.join("+")}]"}}`);
        if (fromScreen) {
            lines.push(`  ${fromScreen} --> ${action.name}`);
        }
        // Signal nodes: emits and on
        if (emitsSignal) {
            const nodeId = `sig_${emitsSignal}`;
            if (!extraNodes.has(nodeId)) {
                extraNodes.add(nodeId);
                lines.push(`  ${nodeId}[/"${emitsSignal} ⚡"/]`);
            }
            lines.push(`  ${action.name} -->|emits| ${nodeId}`);
        }
        if (onSignal) {
            const nodeId = `sig_${onSignal}`;
            if (!extraNodes.has(nodeId)) {
                extraNodes.add(nodeId);
                lines.push(`  ${nodeId}[/"${onSignal} ⚡"/]`);
            }
            lines.push(`  ${nodeId} -->|triggers| ${action.name}`);
        }
        // Connect action endpoint to related constructs (entity, event, flow, operation)
        const endpoint = callsEndpoint || (streamEndpoint ? `STREAM ${streamEndpoint}` : null);
        if (endpoint) {
            const constructs = endpointToConstruct.get(endpoint);
            if (constructs) {
                for (const c of constructs) {
                    const nodeId = `${c.type}_${c.name}`;
                    if (!extraNodes.has(nodeId)) {
                        extraNodes.add(nodeId);
                        const shape = c.type === "entity" ? `[("${c.name}")]`
                            : c.type === "event" ? `(["${c.name} 📨"])`
                                : c.type === "flow" ? `(["${c.name} 🔄"])`
                                    : c.type === "operation" ? `(["${c.name} ⚙"])`
                                        : `["${c.name}"]`;
                        lines.push(`  ${nodeId}${shape}`);
                    }
                    lines.push(`  ${action.name} -.->|${c.relation}| ${nodeId}`);
                }
            }
        }
        // Action results (navigation targets)
        for (const item of action.body) {
            if (item.type === "ActionResult") {
                const target = item.screen === "end" ? "END((end))" : item.screen;
                lines.push(`  ${action.name} -->|${item.outcome}| ${target}`);
            }
        }
    }
    return lines.join("\n");
}
/**
 * Build a map from "METHOD /path" → related constructs (entities, events, flows, operations).
 * Traces: endpoint → operation (handles) → flow (uses operation) → entities/events.
 */
function buildEndpointConstructMap(model) {
    const map = new Map();
    const addEntry = (key, type, name, relation) => {
        if (!map.has(key))
            map.set(key, []);
        const arr = map.get(key);
        if (!arr.some(e => e.type === type && e.name === name)) {
            arr.push({ type, name, relation });
        }
    };
    // Map API endpoints → return/input types (entities)
    // Resolve @prefix to build full paths matching action references
    for (const api of model.apis) {
        const prefixDec = api.decorators?.find((d) => d.name === "prefix");
        const prefix = prefixDec ? String(prefixDec.params[0]?.value ?? "") : "";
        for (const ep of api.endpoints) {
            const fullPath = prefix + ep.path;
            const key = `${ep.method} ${fullPath}`;
            // Handle both ApiEndpointSimple (returnType/inputType) and ApiEndpointExpanded (response/body)
            const retType = ep.returnType ?? ep.response;
            const inType = ep.inputType ?? ep.body;
            // Return type → entity/event
            const retRefs = extractReturnTypeRefs(retType);
            for (const ref of retRefs) {
                if (model.entities.some(e => e.name === ref))
                    addEntry(key, "entity", ref, "returns");
                if (model.events.some(e => e.name === ref))
                    addEntry(key, "event", ref, "streams");
            }
            // Input type → entity
            const inRefs = extractReturnTypeRefs(inType);
            for (const ref of inRefs) {
                if (model.entities.some(e => e.name === ref))
                    addEntry(key, "entity", ref, "input");
            }
            // STREAM endpoints
            if (ep.method === "STREAM") {
                const streamKey = `STREAM ${fullPath}`;
                for (const ref of retRefs) {
                    if (model.events.some(e => e.name === ref))
                        addEntry(streamKey, "event", ref, "streams");
                    if (model.entities.some(e => e.name === ref))
                        addEntry(streamKey, "entity", ref, "streams");
                }
            }
        }
    }
    // Map operations that handle endpoints → link operation to endpoint
    for (const op of model.operations) {
        for (const item of op.body) {
            if (item.type === "OperationHandlesClause") {
                const key = `${item.method} ${item.path}`;
                addEntry(key, "operation", op.name, "handles");
            }
        }
    }
    return map;
}
function extractReturnTypeRefs(typeExpr) {
    if (!typeExpr)
        return [];
    switch (typeExpr.type) {
        case "ReferenceType": return [typeExpr.name];
        case "OptionalType":
        case "ArrayType": return extractReturnTypeRefs(typeExpr.inner);
        case "UnionType": return (typeExpr.alternatives || []).flatMap(extractReturnTypeRefs);
        default: return [];
    }
}
export function renderJourneyDiagram(model) {
    const lines = ["graph LR"];
    for (const journey of model.journeys) {
        lines.push(`  %% Journey: ${journey.name}`);
        for (const item of journey.body) {
            if (item.type === "JourneyStep") {
                const from = item.from === "*"
                    ? "ANY[*]"
                    : item.from === "end"
                        ? "END((end))"
                        : item.from;
                const to = item.to === "end" ? "END((end))" : item.to;
                lines.push(`  ${from} -->|${item.trigger}| ${to}`);
            }
        }
    }
    return lines.join("\n");
}
export function renderDeploymentDiagram(model) {
    if (model.nodes.length === 0) {
        return "graph LR\n  %% No nodes declared — add 'node <name>' in system body";
    }
    const lines = ["graph LR"];
    // Helper: get @node(name) value from component decorators
    const getNodeName = (comp) => {
        const deco = comp.decorators?.find((d) => d.name === "node");
        if (!deco || !deco.params[0])
            return null;
        return String(deco.params[0].value);
    };
    // Group components by node
    const nodeToComps = new Map();
    const unassigned = [];
    for (const node of model.nodes) {
        nodeToComps.set(node.name, []);
    }
    for (const comp of model.components) {
        const nodeName = getNodeName(comp);
        if (nodeName && nodeToComps.has(nodeName)) {
            nodeToComps.get(nodeName).push(comp.name);
        }
        else {
            unassigned.push(comp.name);
        }
    }
    // Render subgraphs per node
    for (const node of model.nodes) {
        const comps = nodeToComps.get(node.name) ?? [];
        lines.push(`  subgraph ${node.name} ["node: ${node.name}"]`);
        for (const compName of comps) {
            lines.push(`    ${compName}`);
        }
        lines.push(`  end`);
    }
    // Unassigned components (no @node)
    if (unassigned.length > 0) {
        lines.push(`  subgraph unassigned ["(no node)"]`);
        for (const compName of unassigned) {
            lines.push(`    ${compName}`);
        }
        lines.push(`  end`);
    }
    // Cross-node dep arrows
    for (const comp of model.components) {
        const compNode = getNodeName(comp);
        for (const item of comp.body) {
            if (item.type === "DepDecl") {
                const target = model.components.find((c) => c.name === item.target);
                const targetNode = target ? getNodeName(target) : null;
                const isCrossNode = compNode !== targetNode;
                const typeDeco = item.decorators?.find((d) => d.name === "type");
                const depType = typeDeco ? String(typeDeco.params[0]?.value ?? "") : "";
                const label = isCrossNode && depType ? `${depType} ☁` : depType || (isCrossNode ? "☁" : "");
                const arrow = label ? `-->|"${label}"|` : "-->";
                lines.push(`  ${comp.name} ${arrow} ${item.target}`);
            }
        }
    }
    return lines.join("\n");
}
//# sourceMappingURL=render.js.map