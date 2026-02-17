/**
 * Component detail page (Level 2 — Component)
 * Tabbed interface with diagrams + cards per construct type.
 * All construct names are navigable links to Level 3 detail pages.
 *
 * Uses the central constructComponentMap to find constructs belonging to this component.
 */
import { escapeHtml, formatType, formatTypeLinked, constructLink, renderImplChip, buildEntityComponentMap, } from "./shared.js";
import { makeKey } from "../relationships.js";
export function renderComponentDetail(snapshot, componentName) {
    const comp = snapshot.model.components.find((c) => c.name === componentName);
    if (!comp) {
        return {
            html: `<div class="scope-empty-state"><p>Component not found: ${escapeHtml(componentName)}</p></div>`,
            tabs: [],
            defaultTab: "",
        };
    }
    const compStats = snapshot.stats.componentCompleteness.find((cs) => cs.name === componentName);
    const statusDec = comp.decorators?.find((d) => d.name === "status");
    const statusValue = statusDec ? String(statusDec.params[0]?.value ?? "?") : null;
    const statusChip = statusValue
        ? `<span class="scope-chip ${statusValue === 'active' || statusValue === 'done' || statusValue === 'implemented' ? 'done' : statusValue === 'draft' || statusValue === 'in_progress' ? 'wip' : 'pending'}">${statusValue}</span>`
        : "";
    // Show @interface / @abstract decorators and implements/extends relationships
    const isInterface = comp.decorators?.some((d) => d.name === "interface");
    const isAbstract = comp.decorators?.some((d) => d.name === "abstract");
    const extendsName = comp.extends ?? null;
    const implementsNames = comp.implements ?? [];
    const interfaceChip = isInterface
        ? `<span class="scope-chip" style="background: var(--scope-accent-muted); color: var(--scope-accent); border: 1px solid var(--scope-border)">@interface</span>`
        : "";
    const abstractChip = isAbstract
        ? `<span class="scope-chip" style="background: var(--scope-accent-muted); color: var(--scope-accent); border: 1px solid var(--scope-border)">@abstract</span>`
        : "";
    const extendsChip = extendsName
        ? `<span class="scope-chip" style="background: #1e1b4b; color: #a78bfa; border: 1px solid #4c1d95">extends <a href="/component/${encodeURIComponent(extendsName)}" style="color: #a78bfa; text-decoration: underline">${escapeHtml(extendsName)}</a></span>`
        : "";
    const implementsChips = implementsNames
        .map((n) => `<span class="scope-chip" style="background: #1a2e1a; color: #4ade80; border: 1px solid #166534">implements <a href="/component/${encodeURIComponent(n)}" style="color: #4ade80; text-decoration: underline">${escapeHtml(n)}</a></span>`)
        .join(" ");
    const ccMap = snapshot.constructComponentMap;
    const entityComponentMap = buildEntityComponentMap(snapshot.model, ccMap);
    const enumNames = new Set(snapshot.model.enums.map((e) => e.name));
    // When @interface components are implemented, the ccMap may map shared construct
    // names (e.g. adapter_connect) to the implementing component instead of the interface.
    // Use comp.body reference equality as a fallback to ensure each component sees its own constructs.
    const bodyItemSet = new Set(comp.body);
    const ownedOrInBody = (type, name, item) => ccMap.get(`${type}:${name}`) === componentName || bodyItemSet.has(item);
    // When a component implements an @interface, both declare constructs with
    // the same name (e.g. both have "event AdapterAlarm"). Since snapshot.model.*
    // contains entries from ALL components, the ccMap name-based check picks up
    // both copies. Deduplicate by name to avoid showing the same construct twice.
    function filterOwnedUnique(items, type) {
        const seen = new Set();
        return items.filter((item) => {
            if (!ownedOrInBody(type, item.name, item))
                return false;
            if (seen.has(item.name))
                return false;
            seen.add(item.name);
            return true;
        });
    }
    const deps = comp.body.filter((b) => b.type === "DepDecl");
    const secrets = comp.body.filter((b) => b.type === "SecretDecl");
    const entities = filterOwnedUnique(snapshot.model.entities, "entity");
    const enums = filterOwnedUnique(snapshot.model.enums, "enum");
    const flows = filterOwnedUnique(snapshot.model.flows, "flow");
    // APIs are filtered directly from the component body since multiple APIs
    // can share the same name (e.g. "REST") making ccMap lookup unreliable
    const apis = comp.body.filter((b) => b.type === "ApiDecl");
    const states = filterOwnedUnique(snapshot.model.states, "state");
    const events = filterOwnedUnique(snapshot.model.events, "event");
    const rules = filterOwnedUnique(snapshot.model.rules, "rule");
    const screens = filterOwnedUnique(snapshot.model.screens, "screen");
    const journeys = filterOwnedUnique(snapshot.model.journeys, "journey");
    const operations = filterOwnedUnique(snapshot.model.operations, "operation");
    const signals = filterOwnedUnique(snapshot.model.signals, "signal");
    const totalConstructs = entities.length + enums.length + flows.length + apis.length +
        states.length + events.length + signals.length + rules.length + screens.length + journeys.length + operations.length;
    const implRatio = compStats && compStats.implTotal > 0
        ? `${compStats.implDone}/${compStats.implTotal}`
        : totalConstructs > 0 ? `0/${totalConstructs}` : "";
    const testRatio = compStats && compStats.implTotal > 0
        ? `${compStats.constructs.filter((c) => c.tests).length}/${compStats.implTotal}`
        : "";
    // Hoist actions early (needed for overview, API, and screens tabs)
    const actions = snapshot.model.actions.filter((a) => ownedOrInBody("action", a.name, a));
    // Build tabs
    const tabs = [];
    // Overview tab — compact header with progress bars + interactive overview graph
    const overviewHeader = buildOverviewHeader(compStats, totalConstructs);
    const overviewGraphData = buildOverviewGraphData(entities, flows, apis, states, events, signals, screens, actions, operations, componentName, snapshot, ccMap);
    const overviewGraphHtml = buildOverviewGraphHtml(overviewGraphData);
    tabs.push({ id: "overview", label: "Overview", count: totalConstructs, diagram: null, cards: overviewHeader + overviewGraphHtml });
    // Entities tab — interactive graph
    if (entities.length > 0 || enums.length > 0) {
        const graphData = buildEntityGraphData(entities, enums, snapshot.model.entities, componentName, entityComponentMap, enumNames);
        const graphHtml = buildEntityGraphHtml(graphData);
        tabs.push({ id: "entities", label: "Entities", count: entities.length + enums.length, color: "var(--scope-diagram-entity)", diagram: null, cards: graphHtml });
    }
    // Flows tab — interactive graph
    if (flows.length > 0) {
        const allEvents = snapshot.model.events;
        const flowGraphData = buildFlowGraphData(flows, componentName, entityComponentMap, enumNames, ccMap, allEvents, snapshot.model.entities, operations, rules);
        const flowGraphHtml = buildFlowGraphHtml(flowGraphData);
        tabs.push({ id: "flows", label: "Flows", count: flows.length, color: "var(--scope-diagram-flow)", diagram: null, cards: flowGraphHtml });
    }
    // States tab — combined interactive graph
    if (states.length > 0) {
        const graphData = buildCombinedStateGraphData(states, componentName, ccMap, snapshot.model.events, snapshot.model.enums);
        const stateGraphHtml = buildStateGraphHtml(graphData);
        tabs.push({ id: "states", label: "States", count: states.length, color: "var(--scope-diagram-state)", diagram: null, cards: stateGraphHtml });
    }
    // API tab — interactive graph
    if (apis.length > 0) {
        const endpointCount = apis.reduce((sum, a) => sum + a.endpoints.length, 0);
        const apiGraphData = buildApiGraphData(apis, operations, flows, actions, componentName, snapshot, entityComponentMap, enumNames);
        const apiGraphCards = buildApiGraphHtml(apiGraphData);
        tabs.push({ id: "api", label: "API", count: endpointCount, diagram: null, cards: apiGraphCards });
    }
    // Screens tab — interactive graph
    if (screens.length > 0) {
        const elements = snapshot.model.elements.filter((e) => ownedOrInBody("element", e.name, e));
        const screenGraphData = buildScreenGraphData(screens, elements, actions, componentName, snapshot, entityComponentMap, enumNames);
        const screenGraphHtml = buildScreenGraphHtml(screenGraphData);
        tabs.push({ id: "screens", label: "Screens", count: screens.length, color: "var(--scope-diagram-screen)", diagram: null, cards: screenGraphHtml });
    }
    // Events tab — interactive graph
    if (events.length > 0) {
        const eventGraphData = buildEventGraphData(events, componentName, snapshot, entityComponentMap, enumNames);
        const eventGraphHtml = buildEventGraphHtml(eventGraphData);
        tabs.push({ id: "events", label: "Events", count: events.length, diagram: null, cards: eventGraphHtml });
    }
    // Signals tab
    if (signals.length > 0) {
        const signalCards = buildSignalCards(signals, componentName, entityComponentMap, enumNames);
        tabs.push({ id: "signals", label: "Signals", count: signals.length, diagram: null, cards: signalCards });
    }
    // Rules tab
    if (rules.length > 0) {
        const ruleCards = buildRuleCards(rules, componentName);
        tabs.push({ id: "rules", label: "Rules", count: rules.length, diagram: null, cards: ruleCards });
    }
    // Operations tab
    if (operations.length > 0) {
        const operationCards = buildOperationCards(operations, componentName, ccMap);
        tabs.push({ id: "operations", label: "Operations", count: operations.length, diagram: null, cards: operationCards });
    }
    // Journeys tab — interactive graph
    if (journeys.length > 0) {
        const allEventNames = new Set(snapshot.model.events.map((e) => e.name));
        const allSignalNames = new Set(snapshot.model.signals.map((s) => s.name));
        const journeyGraphDataList = journeys.map((j) => buildJourneyGraphData(j, componentName, ccMap, allEventNames, allSignalNames, actions));
        const journeyGraphHtml = buildJourneyGraphHtml(journeyGraphDataList);
        tabs.push({ id: "journeys", label: "Journeys", count: journeys.length, color: "var(--scope-diagram-journey)", diagram: null, cards: journeyGraphHtml });
    }
    // Render tab panels (first tab or activeTab is active)
    const tabPanels = tabs.map((tab, i) => {
        const active = i === 0 ? " active" : "";
        const diagramHtml = tab.diagram
            ? `<div class="scope-mini-diagram scope-diagram-container" data-diagram-type="${tab.id}">
          <div class="mermaid" data-type="${tab.id}">${escapeHtml(tab.diagram)}</div>
        </div>`
            : "";
        return `<div class="scope-tab-panel${active}" data-tab-panel="${tab.id}">
      <div class="scope-tab-panel-content">
        ${tab.cards}
        ${diagramHtml}
      </div>
    </div>`;
    }).join("");
    const html = `
<div class="scope-component-detail">
  <div class="scope-component-header">
    <span class="scope-component-name">${escapeHtml(componentName)}</span>
    ${statusChip}${interfaceChip}${abstractChip}${extendsChip}${implementsChips}
  </div>
  <div class="scope-component-meta">
    ${implRatio ? `<span class="scope-mono" style="font-size: var(--scope-text-sm); color: var(--scope-text-secondary)">impl: ${implRatio}</span>` : ""}
    ${testRatio ? `<span class="scope-mono" style="font-size: var(--scope-text-sm); color: var(--scope-text-secondary)">tests: ${testRatio}</span>` : ""}
  </div>
  ${tabPanels}
</div>`;
    return {
        html,
        tabs: tabs.map(t => ({ id: t.id, label: t.label, count: t.count })),
        defaultTab: tabs[0]?.id ?? "overview",
    };
}
// ===== Overview Tab — Compact header with progress bars =====
function asciiBar(pct, width = 16) {
    const filled = Math.round((pct / 100) * width);
    const empty = width - filled;
    return "\u2588".repeat(filled) + "\u2591".repeat(empty);
}
function buildOverviewHeader(compStats, totalConstructs) {
    const implDone = compStats?.implDone ?? 0;
    const implTotal = compStats?.implTotal ?? totalConstructs;
    const testsDone = compStats?.constructs?.filter((c) => c.tests).length ?? 0;
    const implPct = implTotal > 0 ? Math.round((implDone / implTotal) * 100) : 0;
    const testsPct = implTotal > 0 ? Math.round((testsDone / implTotal) * 100) : 0;
    return `<div class="scope-overview-header">
    <div class="dash-global-bars">
      <div class="dash-global-row">
        <span class="dash-global-label">impl </span>
        <span class="dash-bar">${asciiBar(implPct, 24)}</span>
        <span class="dash-pct"> ${implDone}/${implTotal} ${implPct}%</span>
      </div>
      <div class="dash-global-row">
        <span class="dash-global-label">tests</span>
        <span class="dash-bar">${asciiBar(testsPct, 24)}</span>
        <span class="dash-pct"> ${testsDone}/${implTotal} ${testsPct}%</span>
      </div>
    </div>
  </div>`;
}
const DATA_TYPES = new Set(["entity", "event", "signal"]);
function buildOverviewGraphData(entities, flows, apis, states, events, signals, screens, actions, operations, componentName, snapshot, ccMap) {
    const nodes = [];
    const edges = [];
    const edgeSet = new Set();
    const rels = snapshot.relationships;
    const addedNodeIds = new Set();
    function addNode(type, name, decorators) {
        const id = `${type}:${name}`;
        if (addedNodeIds.has(id))
            return;
        addedNodeIds.add(id);
        const category = DATA_TYPES.has(type) ? "data" : "behavior";
        const implChip = renderImplChip(decorators);
        const isAbstract = decorators?.some((d) => d.name === "abstract") ?? false;
        const isInterface = decorators?.some((d) => d.name === "interface") ?? false;
        nodes.push({
            id,
            name,
            href: constructLink(componentName, type, name),
            implChip,
            constructType: type,
            category,
            isAbstract,
            isInterface,
            extendsName: null,
            implementsNames: [],
        });
    }
    function addEdge(fromType, fromName, toType, toName, edgeType) {
        const from = `${fromType}:${fromName}`;
        const to = `${toType}:${toName}`;
        const key = `${from}>${to}>${edgeType}`;
        if (edgeSet.has(key))
            return;
        edgeSet.add(key);
        edges.push({ from, to, edgeType });
    }
    // Nodes — behavior: screen, flow, state, api | data: entity, event, signal
    for (const s of screens)
        addNode("screen", s.name, s.decorators);
    for (const f of flows)
        addNode("flow", f.name, f.decorators);
    for (const s of states)
        addNode("state", s.name, s.decorators);
    for (const a of apis)
        addNode("api", a.name ?? "api", a.decorators);
    for (const e of entities)
        addNode("entity", e.name, e.decorators);
    for (const e of events)
        addNode("event", e.name, e.decorators);
    for (const s of signals)
        addNode("signal", s.name, s.decorators);
    // Reuse the dedup set as the node lookup for ghost-node checks
    const nodeIds = addedNodeIds;
    const entityNames = new Set(entities.map((e) => e.name));
    // Helper: extract named type references from a type expression
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
    // 1. Flow → Entity (flow params/return reference entity types)
    for (const flow of flows) {
        const refs = new Set();
        for (const param of flow.params) {
            for (const ref of extractTypeRefs(param))
                if (entityNames.has(ref))
                    refs.add(ref);
        }
        if (flow.returnType) {
            for (const ref of extractTypeRefs(flow.returnType))
                if (entityNames.has(ref))
                    refs.add(ref);
        }
        for (const eName of refs)
            addEdge("flow", flow.name, "entity", eName, "flow-entity");
    }
    // 2. Flow → Event (emits/on clauses)
    for (const flow of flows) {
        for (const item of flow.body) {
            if (item.type === "EmitsClause" && nodeIds.has(`event:${item.event}`)) {
                addEdge("flow", flow.name, "event", item.event, "flow-event");
            }
            if (item.type === "OnClause" && nodeIds.has(`event:${item.event}`)) {
                addEdge("event", item.event, "flow", flow.name, "event-flow");
            }
        }
    }
    // 3. API → Event (endpoint return types referencing events, e.g. STREAM)
    // Note: API → Entity edges removed — entities connect via flows (API → Flow → Entity)
    for (const api of apis) {
        const apiName = api.name ?? "api";
        for (const ep of api.endpoints) {
            const allRefs = [
                ...extractTypeRefs(ep.inputType),
                ...extractTypeRefs(ep.returnType),
            ];
            for (const ref of new Set(allRefs)) {
                if (nodeIds.has(`event:${ref}`))
                    addEdge("api", apiName, "event", ref, "api-event");
            }
        }
    }
    // 4. Event → State (state transitions triggered by events)
    for (const state of states) {
        for (const transition of state.transitions) {
            const evName = transition.event;
            if (evName && nodeIds.has(`event:${evName}`)) {
                addEdge("event", evName, "state", state.name, "event-state");
            }
        }
    }
    // 5. State → Entity (via relationship engine — state governs entities with matching enum fields)
    for (const entity of entities) {
        const rel = rels.get(makeKey(componentName, "entity", entity.name));
        if (!rel)
            continue;
        for (const ref of rel.governedByStates) {
            if (ref.component === componentName && nodeIds.has(`state:${ref.name}`)) {
                addEdge("state", ref.name, "entity", entity.name, "governance");
            }
        }
    }
    // 6. Screen ↔ API and Screen ↔ Signal (via actions)
    // Build prefix map for matching action calls to APIs
    const apiPrefixMap = [];
    for (const api of apis) {
        const prefixDeco = api.decorators?.find((d) => d.name === "prefix");
        const prefix = prefixDeco?.params?.[0] ? String(prefixDeco.params[0].value) : "";
        apiPrefixMap.push({ apiName: api.name ?? "api", prefix, endpoints: api.endpoints });
    }
    function findApiForPath(method, path) {
        for (const { apiName, prefix, endpoints } of apiPrefixMap) {
            for (const ep of endpoints) {
                const fullPath = (prefix + ep.path).replace(/\/+$/, "") || "/";
                // Normalize :param patterns for comparison
                const normalize = (p) => p.replace(/:[^/]+/g, ":param").replace(/\/+$/, "") || "/";
                if (ep.method === method && normalize(fullPath) === normalize(path)) {
                    return apiName;
                }
            }
        }
        return null;
    }
    function findApiForStream(streamPath) {
        for (const { apiName, prefix, endpoints } of apiPrefixMap) {
            for (const ep of endpoints) {
                if (ep.method !== "STREAM")
                    continue;
                const fullPath = (prefix + ep.path).replace(/\/+$/, "") || "/";
                const normalize = (p) => p.replace(/:[^/]+/g, ":param").replace(/\/+$/, "") || "/";
                if (normalize(fullPath) === normalize(streamPath))
                    return apiName;
            }
        }
        return null;
    }
    for (const action of actions) {
        let fromScreen = null;
        let callsMethod = null;
        let callsPath = null;
        let onSignal = null;
        let emitsSignal = null;
        let onStream = null;
        for (const item of action.body) {
            if (item.type === "ActionFromClause")
                fromScreen = item.screen;
            if (item.type === "ActionCallsClause") {
                callsMethod = item.method;
                callsPath = item.path;
            }
            if (item.type === "ActionOnSignalClause")
                onSignal = item.signal;
            if (item.type === "ActionEmitsSignalClause")
                emitsSignal = item.signal;
            if (item.type === "ActionOnStreamClause")
                onStream = item.path;
        }
        if (fromScreen && nodeIds.has(`screen:${fromScreen}`)) {
            // Screen → API (via action calls endpoint)
            if (callsMethod && callsPath) {
                const apiName = findApiForPath(callsMethod, callsPath);
                if (apiName && nodeIds.has(`api:${apiName}`)) {
                    addEdge("screen", fromScreen, "api", apiName, "screen-api");
                }
            }
            // Screen → API (via action on STREAM)
            if (onStream) {
                const apiName = findApiForStream(onStream);
                if (apiName && nodeIds.has(`api:${apiName}`)) {
                    addEdge("screen", fromScreen, "api", apiName, "screen-api");
                }
            }
            // Screen → Signal (action emits signal)
            if (emitsSignal && nodeIds.has(`signal:${emitsSignal}`)) {
                addEdge("screen", fromScreen, "signal", emitsSignal, "screen-signal");
            }
            // Signal → Screen (action on signal)
            if (onSignal && nodeIds.has(`signal:${onSignal}`)) {
                addEdge("signal", onSignal, "screen", fromScreen, "signal-screen");
            }
        }
    }
    // 6a. Flow → API (flow directly handles endpoint)
    for (const flow of flows) {
        for (const item of flow.body) {
            if (item.type === "OperationHandlesClause") {
                const apiName = findApiForPath(item.method, item.path);
                if (apiName && nodeIds.has(`api:${apiName}`)) {
                    addEdge("api", apiName, "flow", flow.name, "api-flow");
                }
            }
        }
    }
    // 6b. Operation handles → trace to calling flows
    for (const op of operations) {
        if (!op.body)
            continue;
        for (const item of op.body) {
            if (item.type === "OperationHandlesClause") {
                const apiName = findApiForPath(item.method, item.path);
                if (apiName && nodeIds.has(`api:${apiName}`)) {
                    const opRel = rels.get(makeKey(componentName, "operation", op.name));
                    if (opRel) {
                        for (const flowRef of opRel.usedByFlows) {
                            if (flowRef.component === componentName && nodeIds.has(`flow:${flowRef.name}`)) {
                                addEdge("api", apiName, "flow", flowRef.name, "api-flow");
                            }
                        }
                    }
                }
            }
        }
    }
    // Inheritance (only for the included types)
    for (const { type, items } of [
        { type: "entity", items: entities },
        { type: "flow", items: flows },
        { type: "event", items: events },
        { type: "screen", items: screens },
        { type: "signal", items: signals },
    ]) {
        for (const item of items) {
            if (item.extends) {
                const parentName = item.extends;
                if (items.some((i) => i.name === parentName)) {
                    addEdge(type, item.name, type, parentName, "extends");
                    const node = nodes.find(n => n.id === `${type}:${item.name}`);
                    if (node)
                        node.extendsName = parentName;
                }
            }
            if (item.implements) {
                for (const ifaceName of item.implements) {
                    if (items.some((i) => i.name === ifaceName)) {
                        addEdge(type, item.name, type, ifaceName, "implements");
                        const node = nodes.find(n => n.id === `${type}:${item.name}`);
                        if (node && !node.implementsNames.includes(ifaceName))
                            node.implementsNames.push(ifaceName);
                    }
                }
            }
        }
    }
    // --- Cross-component ghost nodes ---
    function addGhostNode(type, name, comp) {
        const id = `${type}:${name}`;
        if (nodeIds.has(id))
            return;
        const category = DATA_TYPES.has(type) ? "data" : "behavior";
        nodes.push({
            id, name,
            href: constructLink(comp, type, name),
            implChip: "",
            constructType: type,
            category,
            ghost: true,
            component: comp,
        });
        nodeIds.add(id);
    }
    // Operations emitting events — trace through to calling flows
    // Operations are not shown as nodes in the overview, so we connect
    // the flows that USE them to the events they EMIT.
    for (const op of operations) {
        if (!op.body)
            continue;
        for (const item of op.body) {
            if (item.type === "EmitsClause") {
                const evName = item.event;
                const evComp = ccMap.get(`event:${evName}`);
                if (!evComp)
                    continue;
                // Cross-component: add ghost node for the foreign event
                if (evComp !== componentName) {
                    addGhostNode("event", evName, evComp);
                }
                // Local or cross-component: connect calling flows to the event
                if (nodeIds.has(`event:${evName}`)) {
                    const opRel = rels.get(makeKey(componentName, "operation", op.name));
                    if (opRel) {
                        for (const flowRef of opRel.usedByFlows) {
                            if (flowRef.component === componentName && nodeIds.has(`flow:${flowRef.name}`)) {
                                addEdge("flow", flowRef.name, "event", evName, "flow-event");
                            }
                        }
                    }
                }
            }
            // Operations triggered by events (on clause)
            if (item.type === "OnClause") {
                const evName = item.event;
                const evComp = ccMap.get(`event:${evName}`);
                if (!evComp)
                    continue;
                if (evComp !== componentName) {
                    addGhostNode("event", evName, evComp);
                }
                if (nodeIds.has(`event:${evName}`)) {
                    const opRel = rels.get(makeKey(componentName, "operation", op.name));
                    if (opRel) {
                        for (const flowRef of opRel.usedByFlows) {
                            if (flowRef.component === componentName && nodeIds.has(`flow:${flowRef.name}`)) {
                                addEdge("event", evName, "flow", flowRef.name, "event-flow");
                            }
                        }
                    }
                }
            }
        }
    }
    // Flows triggered by cross-component events (on EventName)
    for (const flow of flows) {
        for (const item of flow.body) {
            if (item.type === "OnClause") {
                const evName = item.event;
                const evComp = ccMap.get(`event:${evName}`);
                if (evComp && evComp !== componentName) {
                    addGhostNode("event", evName, evComp);
                    addEdge("event", evName, "flow", flow.name, "event-flow");
                }
            }
        }
    }
    // State transitions triggered by cross-component events
    for (const state of states) {
        for (const transition of state.transitions) {
            const evName = transition.event;
            if (!evName)
                continue;
            const evComp = ccMap.get(`event:${evName}`);
            if (evComp && evComp !== componentName) {
                addGhostNode("event", evName, evComp);
                addEdge("event", evName, "state", state.name, "event-state");
            }
        }
    }
    // Entity fields referencing cross-component entities
    for (const entity of entities) {
        for (const field of entity.fields) {
            const refs = extractTypeRefs(field.fieldType);
            for (const ref of refs) {
                const refComp = ccMap.get(`entity:${ref}`) || ccMap.get(`enum:${ref}`);
                if (refComp && refComp !== componentName) {
                    addGhostNode("entity", ref, refComp);
                    addEdge("entity", entity.name, "entity", ref, "entity-ref");
                }
            }
        }
    }
    // Reverse: external entities whose fields reference local entities
    for (const extEntity of snapshot.model.entities) {
        const extComp = ccMap.get(`entity:${extEntity.name}`);
        if (!extComp || extComp === componentName)
            continue; // skip local
        for (const field of extEntity.fields) {
            const refs = extractTypeRefs(field.fieldType);
            for (const ref of refs) {
                if (entityNames.has(ref)) {
                    addGhostNode("entity", extEntity.name, extComp);
                    addEdge("entity", extEntity.name, "entity", ref, "entity-ref");
                }
            }
        }
    }
    // Reverse: external flows that emit or consume local events
    const localEventNames = new Set(events.map((e) => e.name));
    for (const extFlow of snapshot.model.flows) {
        const extComp = ccMap.get(`flow:${extFlow.name}`);
        if (!extComp || extComp === componentName)
            continue;
        for (const item of extFlow.body) {
            if (item.type === "EmitsClause" && localEventNames.has(item.event)) {
                addGhostNode("flow", extFlow.name, extComp);
                addEdge("flow", extFlow.name, "event", item.event, "flow-event");
            }
            if (item.type === "OnClause" && localEventNames.has(item.event)) {
                addGhostNode("flow", extFlow.name, extComp);
                addEdge("event", item.event, "flow", extFlow.name, "event-flow");
            }
        }
    }
    // Reverse: external operations that emit or consume local events
    for (const extOp of snapshot.model.operations) {
        const extComp = ccMap.get(`operation:${extOp.name}`);
        if (!extComp || extComp === componentName)
            continue;
        for (const item of extOp.body) {
            if (item.type === "EmitsClause" && localEventNames.has(item.event)) {
                addGhostNode("operation", extOp.name, extComp);
                addEdge("operation", extOp.name, "event", item.event, "flow-event");
            }
            if (item.type === "OnClause" && localEventNames.has(item.event)) {
                addGhostNode("operation", extOp.name, extComp);
                addEdge("event", item.event, "operation", extOp.name, "event-flow");
            }
        }
    }
    // Actions calling cross-component APIs
    for (const action of actions) {
        let fromScreen = null;
        let callsMethod = null;
        let callsPath = null;
        for (const item of action.body) {
            if (item.type === "ActionFromClause")
                fromScreen = item.screen;
            if (item.type === "ActionCallsClause") {
                callsMethod = item.method;
                callsPath = item.path;
            }
        }
        if (!callsMethod || !callsPath)
            continue;
        for (const api of snapshot.model.apis) {
            const apiComp = ccMap.get(`api:${api.name}`);
            if (!apiComp || apiComp === componentName)
                continue;
            const prefixDeco = api.decorators?.find((d) => d.name === "prefix");
            const prefix = prefixDeco?.params?.[0] ? String(prefixDeco.params[0].value) : "";
            for (const ep of api.endpoints) {
                const fullPath = (prefix + ep.path).replace(/\/+$/, "") || "/";
                const normalize = (p) => p.replace(/:[^/]+/g, ":param").replace(/\/+$/, "") || "/";
                if (ep.method === callsMethod && normalize(fullPath) === normalize(callsPath)) {
                    const apiName = api.name ?? "api";
                    addGhostNode("api", apiName, apiComp);
                    if (fromScreen && nodeIds.has(`screen:${fromScreen}`)) {
                        addEdge("screen", fromScreen, "api", apiName, "screen-api");
                    }
                }
            }
        }
    }
    return { nodes, edges };
}
function buildOverviewGraphHtml(graphData) {
    const jsonStr = escapeHtml(JSON.stringify(graphData));
    return `<div class="scope-overview-graph" data-graph="${jsonStr}">
    <svg class="scope-overview-graph-edges"></svg>
    <div class="scope-overview-graph-world"></div>
  </div>`;
}
function extractBaseTypeName(typeExpr) {
    if (!typeExpr)
        return null;
    switch (typeExpr.type) {
        case "ReferenceType":
            return typeExpr.name;
        case "OptionalType":
            return extractBaseTypeName(typeExpr.inner);
        case "ArrayType":
            return extractBaseTypeName(typeExpr.inner);
        case "UnionType":
            for (const alt of typeExpr.alternatives) {
                const name = extractBaseTypeName(alt);
                if (name)
                    return name;
            }
            return null;
        default:
            return null;
    }
}
function isArrayType(typeExpr) {
    if (!typeExpr)
        return false;
    if (typeExpr.type === "ArrayType")
        return true;
    if (typeExpr.type === "OptionalType")
        return isArrayType(typeExpr.inner);
    return false;
}
function buildEntityGraphData(entities, enums, allEntities, componentName, entityComponentMap, enumNames) {
    const localEntityNames = new Set(entities.map((e) => e.name));
    const allEntityNames = new Set(allEntities.map((e) => e.name));
    const nodes = [];
    const edges = [];
    const ghostNames = new Set();
    for (const entity of entities) {
        const implChip = renderImplChip(entity.decorators);
        const fields = entity.fields.map((f) => {
            const typeHtml = formatTypeLinked(f.fieldType, entityComponentMap, enumNames);
            const decs = (f.decorators || []).map((d) => `@${d.name}${d.params?.length ? `(${d.params.map((p) => p.value).join(", ")})` : ""}`);
            return { name: f.name, typeHtml, decorators: decs };
        });
        const isAbstract = entity.decorators?.some((d) => d.name === "abstract") ?? false;
        const isInterface = entity.decorators?.some((d) => d.name === "interface") ?? false;
        nodes.push({
            id: entity.name,
            name: entity.name,
            href: constructLink(componentName, "entity", entity.name),
            implChip,
            constructType: "entity",
            fields,
            isAbstract,
            isInterface,
            extendsName: entity.extends || null,
            implementsNames: entity.implements || [],
        });
        // Inheritance edges
        if (entity.extends) {
            edges.push({ from: entity.name, to: entity.extends, field: "", cardinality: "extends", edgeType: "extends" });
            if (!localEntityNames.has(entity.extends))
                ghostNames.add(entity.extends);
        }
        for (const iface of (entity.implements || [])) {
            edges.push({ from: entity.name, to: iface, field: "", cardinality: "implements", edgeType: "implements" });
            if (!localEntityNames.has(iface))
                ghostNames.add(iface);
        }
        // Detect edges from fields
        for (const f of entity.fields) {
            const targetName = extractBaseTypeName(f.fieldType);
            if (!targetName)
                continue;
            if (targetName === entity.name)
                continue; // skip self-ref for now
            // Edge to enum
            if (enumNames.has(targetName)) {
                edges.push({ from: entity.name, to: targetName, field: f.name, cardinality: "enum" });
                continue;
            }
            if (!allEntityNames.has(targetName))
                continue;
            // Determine cardinality
            const relationDec = f.decorators?.find((d) => d.name === "relation");
            let cardinality = "ref";
            if (relationDec) {
                const val = String(relationDec.params[0]?.value ?? "");
                if (val === "one_to_one" || val === "1:1")
                    cardinality = "1:1";
                else if (val === "one_to_many" || val === "1:N")
                    cardinality = "1:N";
                else if (val === "many_to_one" || val === "N:1")
                    cardinality = "N:1";
                else if (val === "many_to_many" || val === "N:M")
                    cardinality = "N:M";
                else
                    cardinality = val;
            }
            else if (isArrayType(f.fieldType)) {
                cardinality = "1:N";
            }
            edges.push({ from: entity.name, to: targetName, field: f.name, cardinality });
            // Track external entities as ghosts
            if (!localEntityNames.has(targetName)) {
                ghostNames.add(targetName);
            }
        }
    }
    // Reverse ghosts: external entities whose fields reference local entities
    for (const extEntity of allEntities) {
        if (localEntityNames.has(extEntity.name))
            continue; // skip local
        if (ghostNames.has(extEntity.name))
            continue; // already tracked
        let referencesLocal = false;
        for (const f of extEntity.fields) {
            const targetName = extractBaseTypeName(f.fieldType);
            if (targetName && localEntityNames.has(targetName)) {
                // External entity references a local entity — add reverse edge & ghost
                const relationDec = f.decorators?.find((d) => d.name === "relation");
                let cardinality = "ref";
                if (relationDec) {
                    const val = String(relationDec.params[0]?.value ?? "");
                    if (val === "one_to_one" || val === "1:1")
                        cardinality = "1:1";
                    else if (val === "one_to_many" || val === "1:N")
                        cardinality = "1:N";
                    else if (val === "many_to_one" || val === "N:1")
                        cardinality = "N:1";
                    else if (val === "many_to_many" || val === "N:M")
                        cardinality = "N:M";
                    else
                        cardinality = val;
                }
                else if (isArrayType(f.fieldType)) {
                    cardinality = "1:N";
                }
                edges.push({ from: extEntity.name, to: targetName, field: f.name, cardinality });
                referencesLocal = true;
            }
        }
        // Also check extends/implements referencing local entities
        if (extEntity.extends && localEntityNames.has(extEntity.extends)) {
            edges.push({ from: extEntity.name, to: extEntity.extends, field: "", cardinality: "extends", edgeType: "extends" });
            referencesLocal = true;
        }
        for (const iface of (extEntity.implements || [])) {
            if (localEntityNames.has(iface)) {
                edges.push({ from: extEntity.name, to: iface, field: "", cardinality: "implements", edgeType: "implements" });
                referencesLocal = true;
            }
        }
        if (referencesLocal) {
            ghostNames.add(extEntity.name);
        }
    }
    // Add ghost nodes for external entities — include their fields and component
    for (const ghostName of ghostNames) {
        const ghostComp = entityComponentMap.get(ghostName);
        const ghostEntity = allEntities.find((e) => e.name === ghostName);
        const ghostFields = ghostEntity
            ? ghostEntity.fields.map((f) => {
                const typeHtml = formatTypeLinked(f.fieldType, entityComponentMap, enumNames);
                const decs = (f.decorators || []).map((d) => `@${d.name}${d.params?.length ? `(${d.params.map((p) => p.value).join(", ")})` : ""}`);
                return { name: f.name, typeHtml, decorators: decs };
            })
            : [];
        const ghostIsAbstract = ghostEntity?.decorators?.some((d) => d.name === "abstract") ?? false;
        const ghostIsInterface = ghostEntity?.decorators?.some((d) => d.name === "interface") ?? false;
        nodes.push({
            id: ghostName,
            name: ghostName,
            href: ghostComp ? constructLink(ghostComp, "entity", ghostName) : "#",
            implChip: ghostEntity ? renderImplChip(ghostEntity.decorators) : "",
            constructType: "entity",
            fields: ghostFields,
            ghost: true,
            ghostComponent: ghostComp || undefined,
            isAbstract: ghostIsAbstract,
            isInterface: ghostIsInterface,
            extendsName: ghostEntity?.extends || null,
            implementsNames: ghostEntity?.implements || [],
        });
    }
    // Add enum nodes
    for (const en of enums) {
        const values = en.values.map((v) => typeof v === "string" ? v : v.name ?? String(v));
        nodes.push({
            id: en.name,
            name: en.name,
            href: constructLink(componentName, "enum", en.name),
            implChip: renderImplChip(en.decorators),
            constructType: "enum",
            fields: [],
            enumValues: values,
        });
    }
    return { nodes, edges };
}
function buildEntityGraphHtml(graphData) {
    const jsonStr = escapeHtml(JSON.stringify(graphData));
    return `<div class="scope-entity-graph" data-graph="${jsonStr}">
    <svg class="scope-entity-graph-edges"></svg>
    <div class="scope-entity-graph-world"></div>
  </div>`;
}
function buildEnumCards(enums, componentName) {
    if (enums.length === 0)
        return "";
    const enumCards = enums
        .map((en) => {
        const nameLink = `<a href="${constructLink(componentName, 'enum', en.name)}" class="scope-construct-link">${escapeHtml(en.name)}</a>`;
        const values = en.values
            .map((v) => `<span class="scope-chip pending">${escapeHtml(typeof v === 'string' ? v : v.name ?? String(v))}</span>`)
            .join(" ");
        return `<div class="scope-entity-card">
        <div class="scope-entity-card-name">${nameLink}</div>
        <div style="margin-top: var(--scope-space-1)">${values}</div>
      </div>`;
    })
        .join("");
    return `<div style="margin-top: var(--scope-space-3)"><div style="font-size: var(--scope-text-xs); color: var(--scope-text-tertiary); text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: var(--scope-space-2)">Enums</div><div class="scope-entity-cards">${enumCards}</div></div>`;
}
function extractAllBaseTypeNames(typeExpr) {
    if (!typeExpr)
        return [];
    switch (typeExpr.type) {
        case "ReferenceType":
            return [{ name: typeExpr.name, isError: /[Ee]rro/.test(typeExpr.name) }];
        case "OptionalType":
        case "ArrayType":
            return extractAllBaseTypeNames(typeExpr.inner);
        case "UnionType":
            return typeExpr.alternatives.flatMap((a) => extractAllBaseTypeNames(a));
        default:
            return [];
    }
}
function buildFlowGraphData(flows, componentName, entityComponentMap, enumNames, ccMap, allEvents, allEntities, operations, rules) {
    const flowNodes = [];
    const ioNodeMap = new Map();
    const eventNodeMap = new Map();
    const edges = [];
    const allEventNames = new Set(allEvents.map((e) => e.name));
    // --- Phase 1: Compute flowOpsMap before building flow nodes (needed for derived signatures) ---
    const usedOpNames = new Set();
    const flowByName = new Map(flows.map((f) => [f.name, f]));
    const opNameSet = new Set(operations.map((o) => o.name));
    /** Returns { own: regular steps, overrides: override replacements, inherited: from parent minus overridden } */
    function getFlowOperationCalls(flow) {
        const own = [];
        const overrides = [];
        const overriddenTargets = new Set();
        for (const item of flow.body) {
            if (item.type === "FlowStep") {
                const actionName = item.action.trim().split(/[\s(]/)[0];
                if (opNameSet.has(actionName))
                    own.push(actionName);
            }
            if (item.type === "FlowOverrideStep") {
                overriddenTargets.add(item.target.trim().split(/[\s(]/)[0]);
                const actionName = item.action.trim().split(/[\s(]/)[0];
                if (opNameSet.has(actionName))
                    overrides.push(actionName);
            }
        }
        const inherited = [];
        if (flow.extends) {
            const parent = flowByName.get(flow.extends);
            if (parent) {
                const parentResult = getFlowOperationCalls(parent);
                const allParentOps = [...parentResult.own, ...parentResult.inherited];
                for (const op of allParentOps) {
                    if (!overriddenTargets.has(op))
                        inherited.push(op);
                }
            }
        }
        return { own, overrides, inherited };
    }
    const flowOpsMap = new Map();
    /** Derive signature from operations: union of input/output types */
    function deriveSignatureFromOps(flow) {
        const result = flowOpsMap.get(flow.name);
        if (!result)
            return null;
        const allOpNames = [...result.own, ...result.overrides, ...result.inherited];
        if (allOpNames.length === 0)
            return null;
        const inputTypes = new Set();
        const outputTypes = [];
        const seenOutput = new Set();
        for (const opName of allOpNames) {
            const op = operations.find((o) => o.name === opName);
            if (!op)
                continue;
            for (const param of op.params) {
                const t = formatType(param);
                if (t)
                    inputTypes.add(t);
            }
            if (op.returnType) {
                const t = formatType(op.returnType);
                if (t && !seenOutput.has(t)) {
                    seenOutput.add(t);
                    outputTypes.push(t);
                }
            }
        }
        if (inputTypes.size === 0 && outputTypes.length === 0)
            return null;
        const params = Array.from(inputTypes).join(", ");
        const ret = outputTypes.length > 0 ? outputTypes.join(" | ") : "void";
        return `(${params}) -> ${ret}`;
    }
    for (const flow of flows) {
        const result = getFlowOperationCalls(flow);
        flowOpsMap.set(flow.name, result);
    }
    // --- Phase 2: Build flow nodes with derived signatures ---
    // Helper to create or reuse IO nodes (entity lookup, ghost detection, fields)
    function getOrCreateIONode(baseName, kind) {
        const ioKey = `io:${baseName}:${kind}`;
        if (!ioNodeMap.has(ioKey)) {
            const comp = entityComponentMap.get(baseName);
            const href = comp ? constructLink(comp, enumNames.has(baseName) ? "enum" : "entity", baseName) : "#";
            const entityData = allEntities.find((e) => e.name === baseName);
            const isGhost = comp !== undefined && comp !== componentName;
            const fields = entityData
                ? entityData.fields.map((f) => ({
                    name: f.name,
                    typeHtml: formatTypeLinked(f.fieldType, entityComponentMap, enumNames),
                    decorators: (f.decorators || []).map((d) => `@${d.name}${d.params?.length ? `(${d.params.map((p) => p.value).join(", ")})` : ""}`),
                }))
                : [];
            ioNodeMap.set(ioKey, {
                id: ioKey, name: baseName, href, kind,
                constructType: enumNames.has(baseName) ? "enum" : "entity",
                fields,
                ghost: isGhost || undefined,
                ghostComponent: isGhost ? comp : undefined,
            });
        }
        return ioKey;
    }
    for (const flow of flows) {
        const implChip = renderImplChip(flow.decorators);
        // Use flow's declared signature as primary; fall back to operation-derived only when flow has no declared types
        const declaredParams = flow.params.map((p) => formatType(p)).join(", ");
        const declaredRet = flow.returnType ? formatType(flow.returnType) : "void";
        const declaredSignature = `(${declaredParams}) -> ${declaredRet}`;
        const hasDeclaredTypes = flow.params.length > 0 || flow.returnType !== null;
        const signature = hasDeclaredTypes ? declaredSignature : (deriveSignatureFromOps(flow) || declaredSignature);
        // Extract comment (first SemanticComment in body)
        let comment = null;
        const steps = [];
        let stepIndex = 0;
        for (const item of flow.body) {
            if (item.type === "SemanticComment" && comment === null) {
                comment = item.text;
                continue;
            }
            if (item.type === "FlowStep") {
                stepIndex++;
                const isReturn = !item.hasArrow && item.action.startsWith("return");
                const isEmit = item.action === "emit";
                const isAsync = item.decorators?.some((d) => d.name === "async") ?? false;
                steps.push({
                    index: stepIndex,
                    kind: isReturn ? "return" : isEmit ? "emit" : "step",
                    action: item.action,
                    args: item.args,
                    isAsync,
                    branches: (item.branches || []).map((b) => ({
                        condition: b.condition,
                        action: b.action,
                    })),
                });
            }
            if (item.type === "FlowOverrideStep") {
                stepIndex++;
                const isAsync = item.decorators?.some((d) => d.name === "async") ?? false;
                steps.push({
                    index: stepIndex,
                    kind: "override",
                    action: item.action,
                    args: item.args,
                    isAsync,
                    branches: [],
                    overrideTarget: item.target,
                });
            }
        }
        const isAbstract = flow.decorators?.some((d) => d.name === "abstract") ?? false;
        const isInterface = flow.decorators?.some((d) => d.name === "interface") ?? false;
        flowNodes.push({
            id: flow.name,
            name: flow.name,
            href: constructLink(componentName, "flow", flow.name),
            implChip,
            signature,
            comment,
            steps,
            isAbstract,
            isInterface,
            extendsName: flow.extends || null,
            implementsNames: flow.implements || [],
        });
        // Event nodes from emit steps
        for (const step of steps) {
            if (step.kind === "emit" && step.args) {
                const eventName = step.args.replace(/[()]/g, "").trim();
                const eventKey = `event:${eventName}`;
                if (!eventNodeMap.has(eventKey)) {
                    const eventComp = ccMap.get(`event:${eventName}`);
                    const href = eventComp ? constructLink(eventComp, "event", eventName) : "#";
                    eventNodeMap.set(eventKey, { id: eventKey, name: eventName, href, constructType: "event" });
                }
                edges.push({ from: flow.name, to: eventKey, label: eventName, edgeType: "emit" });
            }
        }
        // Operation edges
        const result = flowOpsMap.get(flow.name);
        for (const opName of result.own) {
            usedOpNames.add(opName);
            edges.push({ from: flow.name, to: `op:${opName}`, label: "calls", edgeType: "calls" });
        }
        for (const opName of result.overrides) {
            usedOpNames.add(opName);
            edges.push({ from: flow.name, to: `op:${opName}`, label: "override", edgeType: "override" });
        }
        for (const opName of result.inherited) {
            usedOpNames.add(opName);
        }
        if (flow.extends && flowByName.has(flow.extends)) {
            edges.push({ from: flow.extends, to: flow.name, label: "extends", edgeType: "extends" });
        }
        // Endpoint nodes from flow handles
        for (const item of flow.body) {
            if (item.type === "OperationHandlesClause") {
                const ep = `${item.method} ${item.path}`;
                const epId = `ep:${ep}`;
                if (!endpointNodeMap.has(epId)) {
                    endpointNodeMap.set(epId, {
                        id: epId, name: ep, href: constructLink(componentName, "flow", flow.name),
                        constructType: "endpoint", method: item.method, path: item.path, direction: "handles",
                    });
                }
                edges.push({ from: epId, to: flow.name, label: "handles", edgeType: "handles" });
            }
        }
    }
    // --- Phase 3: IO nodes from flow's declared signature ---
    for (const flow of flows) {
        const seenInputKeys = new Set();
        const seenOutputKeys = new Set();
        // Input types from flow.params (declared in DSL)
        for (const param of flow.params) {
            const baseName = extractBaseTypeName(param);
            if (!baseName)
                continue;
            const ioKey = getOrCreateIONode(baseName, "input");
            if (seenInputKeys.has(ioKey))
                continue;
            seenInputKeys.add(ioKey);
            edges.push({ from: ioKey, to: flow.name, label: baseName, edgeType: "input" });
        }
        // Output types from flow.returnType (declared in DSL)
        if (flow.returnType) {
            const outputTypes = extractAllBaseTypeNames(flow.returnType);
            for (const ot of outputTypes) {
                const kind = ot.isError ? "error" : "output";
                const ioKey = getOrCreateIONode(ot.name, kind);
                if (seenOutputKeys.has(ioKey))
                    continue;
                seenOutputKeys.add(ioKey);
                edges.push({ from: flow.name, to: ioKey, label: ot.name, edgeType: kind });
            }
        }
    }
    // Build operation nodes + endpoint nodes
    const usedRuleNames = new Set();
    const operationNodes = [];
    const endpointNodeMap = new Map();
    for (const opName of usedOpNames) {
        const op = operations.find((o) => o.name === opName);
        const params = op.params.map((p) => formatType(p)).join(", ");
        const ret = op.returnType ? formatType(op.returnType) : "void";
        const sig = `(${params}) -> ${ret}`;
        const comment = op.body.find((i) => i.type === "SemanticComment")?.text || null;
        const emits = op.body.filter((i) => i.type === "EmitsClause").map((i) => i.event);
        const enforces = op.body.filter((i) => i.type === "EnforcesClause").map((i) => i.rule);
        const handles = op.body.filter((i) => i.type === "OperationHandlesClause").map((i) => `${i.method} ${i.path}`);
        const calls = op.body.filter((i) => i.type === "OperationCallsClause").map((i) => `${i.method} ${i.path}`);
        const opId = `op:${opName}`;
        operationNodes.push({
            id: opId, name: opName,
            href: constructLink(componentName, "operation", opName),
            implChip: renderImplChip(op.decorators),
            signature: sig, comment, emits, enforces, handles, calls,
        });
        for (const ruleName of enforces) {
            usedRuleNames.add(ruleName);
            edges.push({ from: opId, to: `rule:${ruleName}`, label: "enforces", edgeType: "enforces" });
        }
        // Event nodes from operation emits
        for (const eventName of emits) {
            const eventKey = `event:${eventName}`;
            if (!eventNodeMap.has(eventKey)) {
                const eventComp = ccMap.get(`event:${eventName}`);
                const href = eventComp ? constructLink(eventComp, "event", eventName) : "#";
                eventNodeMap.set(eventKey, { id: eventKey, name: eventName, href, constructType: "event" });
            }
            edges.push({ from: opId, to: eventKey, label: eventName, edgeType: "emit" });
        }
        // Endpoint nodes from operation handles
        for (const ep of handles) {
            const [method, ...pathParts] = ep.split(" ");
            const path = pathParts.join(" ");
            const epId = `ep:${ep}`;
            if (!endpointNodeMap.has(epId)) {
                endpointNodeMap.set(epId, {
                    id: epId, name: ep, href: constructLink(componentName, "operation", opName),
                    constructType: "endpoint", method, path, direction: "handles",
                });
            }
            edges.push({ from: epId, to: opId, label: "handles", edgeType: "handles" });
        }
        // Endpoint nodes from operation calls
        for (const ep of calls) {
            const [method, ...pathParts] = ep.split(" ");
            const path = pathParts.join(" ");
            const epId = `ep:${ep}`;
            if (!endpointNodeMap.has(epId)) {
                endpointNodeMap.set(epId, {
                    id: epId, name: ep, href: "#",
                    constructType: "endpoint", method, path, direction: "calls",
                });
            }
            edges.push({ from: opId, to: epId, label: "calls", edgeType: "calls-ext" });
        }
    }
    // Build rule nodes
    const ruleNodes = [];
    for (const ruleName of usedRuleNames) {
        const rule = rules.find((r) => r.name === ruleName);
        if (!rule)
            continue;
        const whenClause = rule.body.find((i) => i.type === "WhenClause");
        const thenClause = rule.body.find((i) => i.type === "ThenClause");
        ruleNodes.push({
            id: `rule:${ruleName}`, name: ruleName,
            href: constructLink(componentName, "rule", ruleName),
            whenExpr: whenClause?.expression || "",
            thenAction: thenClause?.action || "",
        });
    }
    return {
        flows: flowNodes,
        ioNodes: Array.from(ioNodeMap.values()),
        eventNodes: Array.from(eventNodeMap.values()),
        operationNodes,
        endpointNodes: Array.from(endpointNodeMap.values()),
        ruleNodes,
        edges,
    };
}
function buildFlowGraphHtml(graphData) {
    const jsonStr = escapeHtml(JSON.stringify(graphData));
    return `<div class="scope-flow-graph" data-graph="${jsonStr}">
    <svg class="scope-flow-graph-edges"></svg>
    <div class="scope-flow-graph-world"></div>
  </div>`;
}
// ===== Flow Cards =====
function buildFlowCards(flows, componentName) {
    const flowItems = flows
        .map((flow) => {
        const implChip = renderImplChip(flow.decorators);
        const nameLink = `<a href="${constructLink(componentName, 'flow', flow.name)}" class="scope-construct-link">${escapeHtml(flow.name)}</a>`;
        const params = flow.params.map((p) => formatType(p)).join(", ");
        const ret = flow.returnType ? formatType(flow.returnType) : "void";
        const steps = flow.body
            .filter((item) => item.type === "FlowStep")
            .map((step) => `<span class="scope-mono" style="font-size: var(--scope-text-xs); color: var(--scope-text-secondary)">-> ${escapeHtml(step.action)}</span>`)
            .join("<br>");
        return `<div class="scope-entity-card">
        <div class="scope-entity-card-name">
          <span>${nameLink}(<span class="scope-mono" style="font-size: var(--scope-text-xs)">${escapeHtml(params)}</span>) -> <span class="scope-mono" style="font-size: var(--scope-text-xs)">${escapeHtml(ret)}</span></span>
          ${implChip}
        </div>
        <div style="margin-top: var(--scope-space-2)">${steps}</div>
      </div>`;
    })
        .join("");
    return `<div class="scope-entity-cards">${flowItems}</div>`;
}
function buildCombinedStateGraphData(states, componentName, ccMap, allEvents, allEnums) {
    const allEventNames = new Set(allEvents.map((e) => e.name));
    const machines = [];
    const stateNodes = [];
    const eventNodeMap = new Map();
    const enumNodeMap = new Map();
    const edges = [];
    const triggerEdgeSet = new Set();
    for (const state of states) {
        const machineName = state.name;
        const stateHref = constructLink(componentName, "state", machineName);
        const enumComp = ccMap.get(`enum:${state.enumRef}`);
        const enumHref = enumComp ? constructLink(enumComp, "enum", state.enumRef) : "#";
        machines.push({ name: machineName, stateHref, enumRef: state.enumRef, enumHref });
        // Collect states for this machine
        const localStateNames = new Set();
        const localFromNames = new Set();
        const wildcardTargets = new Set();
        for (const t of state.transitions) {
            if (t.from !== "*") {
                localStateNames.add(t.from);
                localFromNames.add(t.from);
            }
            localStateNames.add(t.to);
            if (t.from === "*") {
                wildcardTargets.add(t.to);
            }
            // State → State transition (prefixed IDs for uniqueness)
            if (t.from !== "*") {
                edges.push({
                    from: `state:${machineName}:${t.from}`,
                    to: `state:${machineName}:${t.to}`,
                    label: t.event || undefined,
                    edgeType: "transition",
                });
            }
            // Event → State trigger edge
            if (t.event && allEventNames.has(t.event)) {
                const eventKey = `event:${t.event}`;
                if (!eventNodeMap.has(eventKey)) {
                    const evComp = ccMap.get(`event:${t.event}`);
                    const href = evComp ? constructLink(evComp, "event", t.event) : "#";
                    eventNodeMap.set(eventKey, { id: eventKey, name: t.event, href, constructType: "event", machines: [machineName] });
                }
                else {
                    const existing = eventNodeMap.get(eventKey);
                    if (!existing.machines.includes(machineName)) {
                        existing.machines.push(machineName);
                    }
                }
                const triggerTarget = `state:${machineName}:${t.to}`;
                const triggerKey = `${eventKey}->${triggerTarget}`;
                if (!triggerEdgeSet.has(triggerKey)) {
                    triggerEdgeSet.add(triggerKey);
                    edges.push({ from: eventKey, to: triggerTarget, label: "trigger", edgeType: "trigger" });
                }
            }
        }
        // Build state nodes for this machine
        const machineStateNodes = [];
        for (const name of localStateNames) {
            const isInitial = wildcardTargets.has(name) || (!localFromNames.has(name) && localStateNames.size > 1 && name === [...localStateNames][0]);
            const isTerminal = !localFromNames.has(name);
            machineStateNodes.push({
                id: `state:${machineName}:${name}`,
                name,
                machine: machineName,
                isInitial: isInitial || undefined,
                isTerminal: isTerminal || undefined,
            });
        }
        // If no initial state, mark the first from-state
        if (!machineStateNodes.some(n => n.isInitial) && state.transitions.length > 0) {
            const firstFrom = state.transitions.find((t) => t.from !== "*");
            if (firstFrom) {
                const node = machineStateNodes.find(n => n.name === firstFrom.from);
                if (node)
                    node.isInitial = true;
            }
        }
        stateNodes.push(...machineStateNodes);
        // Build enum node for this machine
        const enumDecl = allEnums.find((e) => e.name === state.enumRef);
        if (enumDecl) {
            const enumId = `enum:${machineName}:${state.enumRef}`;
            if (!enumNodeMap.has(enumId)) {
                const values = enumDecl.values.map((v) => typeof v === "string" ? v : v.name ?? String(v));
                enumNodeMap.set(enumId, { id: enumId, name: state.enumRef, href: enumHref, values, machine: machineName });
                // Connect enum to each state in this machine
                for (const sn of machineStateNodes) {
                    edges.push({ from: enumId, to: sn.id, edgeType: "enum-value" });
                }
            }
        }
    }
    return {
        machines,
        stateNodes,
        eventNodes: Array.from(eventNodeMap.values()),
        enumNodes: Array.from(enumNodeMap.values()),
        edges,
    };
}
function buildStateGraphHtml(graphData) {
    const jsonStr = escapeHtml(JSON.stringify(graphData));
    return `<div class="scope-state-graph" data-graph="${jsonStr}">
    <svg class="scope-state-graph-edges"></svg>
    <div class="scope-state-graph-world"></div>
  </div>`;
}
function buildApiGraphData(apis, operations, flows, actions, componentName, snapshot, entityComponentMap, enumNames) {
    const ccMap = snapshot.constructComponentMap;
    const allEventNames = new Set(snapshot.model.events.map((e) => e.name));
    const endpoints = [];
    const handlerMap = new Map();
    const consumerMap = new Map();
    const constructMap = new Map();
    const edges = [];
    const edgeSet = new Set();
    function addEdge(edge) {
        const key = `${edge.from}|${edge.to}|${edge.edgeType}`;
        if (edgeSet.has(key))
            return;
        edgeSet.add(key);
        edges.push(edge);
    }
    const resolvedEndpoints = [];
    for (const api of apis) {
        const isExternal = api.decorators?.some((d) => d.name === "external") ?? false;
        const prefixDec = api.decorators?.find((d) => d.name === "prefix");
        const prefix = prefixDec ? String(prefixDec.params[0]?.value ?? "") : "";
        const apiName = api.name || "api";
        for (const ep of api.endpoints) {
            const fullPath = prefix + ep.path;
            const epId = `ep:${ep.method}:${fullPath}`;
            const inputTypeAst = ep.inputType || ep.body || null;
            const outputTypeAst = ep.returnType || ep.response || null;
            const inputTypeHtml = inputTypeAst ? formatTypeLinked(inputTypeAst, entityComponentMap, enumNames) : "";
            const outputTypeHtml = outputTypeAst ? formatTypeLinked(outputTypeAst, entityComponentMap, enumNames) : "";
            const hasAuth = ep.decorators?.some((d) => d.name === "auth") ?? false;
            resolvedEndpoints.push({
                id: epId, method: ep.method, fullPath,
                inputTypeAst, outputTypeAst, inputTypeHtml, outputTypeHtml,
                hasAuth, isExternal,
            });
            endpoints.push({
                id: epId,
                name: `${ep.method} ${fullPath}`,
                method: ep.method,
                fullPath,
                inputTypeHtml,
                outputTypeHtml,
                hasAuth,
                isExternal,
                apiGroupName: apiName,
                prefix,
                href: constructLink(componentName, "api", apiName),
            });
        }
    }
    // Phase 2: Match operations → endpoints via handles/calls
    for (const op of operations) {
        const handlesClauses = op.body.filter((i) => i.type === "OperationHandlesClause");
        const callsClauses = op.body.filter((i) => i.type === "OperationCallsClause");
        for (const clause of handlesClauses) {
            const method = clause.method;
            const path = clause.path;
            // Find matching endpoint
            const matched = resolvedEndpoints.find((ep) => ep.method === method && ep.fullPath === path);
            if (!matched)
                continue;
            const opId = `handler:${op.name}`;
            if (!handlerMap.has(opId)) {
                const params = op.params.map((p) => formatType(p)).join(", ");
                const ret = op.returnType ? formatType(op.returnType) : "void";
                handlerMap.set(opId, {
                    id: opId, name: op.name,
                    href: constructLink(componentName, "operation", op.name),
                    implChip: renderImplChip(op.decorators),
                    constructType: "operation",
                    signature: `(${params}) -> ${ret}`,
                    direction: "handles",
                });
            }
            addEdge({ from: opId, to: matched.id, label: "handles", edgeType: "handles" });
        }
        for (const clause of callsClauses) {
            const method = clause.method;
            const path = clause.path;
            const matched = resolvedEndpoints.find((ep) => ep.method === method && ep.fullPath === path);
            if (!matched)
                continue;
            const opId = `handler:${op.name}`;
            if (!handlerMap.has(opId)) {
                const params = op.params.map((p) => formatType(p)).join(", ");
                const ret = op.returnType ? formatType(op.returnType) : "void";
                handlerMap.set(opId, {
                    id: opId, name: op.name,
                    href: constructLink(componentName, "operation", op.name),
                    implChip: renderImplChip(op.decorators),
                    constructType: "operation",
                    signature: `(${params}) -> ${ret}`,
                    direction: "calls",
                });
            }
            addEdge({ from: opId, to: matched.id, label: "calls", edgeType: "calls" });
        }
    }
    // Phase 2b: Match flows → endpoints via handles
    for (const flow of flows) {
        const handlesClauses = flow.body.filter((i) => i.type === "OperationHandlesClause");
        for (const clause of handlesClauses) {
            const method = clause.method;
            const path = clause.path;
            const matched = resolvedEndpoints.find((ep) => ep.method === method && ep.fullPath === path);
            if (!matched)
                continue;
            const flowId = `handler:${flow.name}`;
            if (!handlerMap.has(flowId)) {
                const params = flow.params.map((p) => formatType(p)).join(", ");
                const ret = flow.returnType ? formatType(flow.returnType) : "void";
                handlerMap.set(flowId, {
                    id: flowId, name: flow.name,
                    href: constructLink(componentName, "flow", flow.name),
                    implChip: renderImplChip(flow.decorators),
                    constructType: "flow",
                    signature: `(${params}) -> ${ret}`,
                    direction: "handles",
                });
            }
            addEdge({ from: flowId, to: matched.id, label: "handles", edgeType: "handles" });
        }
    }
    // Phase 3: Match actions → endpoints via calls/on-stream
    for (const action of actions) {
        let callsEndpoint = null;
        let onStream = null;
        for (const item of action.body) {
            if (item.type === "ActionCallsClause") {
                callsEndpoint = `${item.method} ${item.path}`;
            }
            else if (item.type === "ActionOnStreamClause") {
                onStream = `STREAM ${item.path}`;
            }
        }
        if (!callsEndpoint && !onStream)
            continue;
        if (callsEndpoint) {
            const [method, ...pathParts] = callsEndpoint.split(" ");
            const path = pathParts.join(" ");
            const matched = resolvedEndpoints.find((ep) => ep.method === method && ep.fullPath === path);
            if (matched) {
                const actionId = `consumer:${action.name}`;
                if (!consumerMap.has(actionId)) {
                    consumerMap.set(actionId, {
                        id: actionId, name: action.name,
                        href: constructLink(componentName, "action", action.name),
                        implChip: renderImplChip(action.decorators),
                        constructType: "action",
                        callsEndpoint,
                        onStream: null,
                    });
                }
                addEdge({ from: matched.id, to: actionId, label: "calls", edgeType: "calls-action" });
            }
        }
        if (onStream) {
            const streamPath = onStream.replace("STREAM ", "");
            const matched = resolvedEndpoints.find((ep) => ep.method === "STREAM" && ep.fullPath === streamPath);
            if (matched) {
                const actionId = `consumer:${action.name}`;
                if (!consumerMap.has(actionId)) {
                    consumerMap.set(actionId, {
                        id: actionId, name: action.name,
                        href: constructLink(componentName, "action", action.name),
                        implChip: renderImplChip(action.decorators),
                        constructType: "action",
                        callsEndpoint: null,
                        onStream,
                    });
                }
                addEdge({ from: matched.id, to: actionId, label: "stream", edgeType: "on-stream" });
            }
        }
    }
    // Phase 4: Resolve input/output types → construct nodes
    for (const rep of resolvedEndpoints) {
        // Input types
        if (rep.inputTypeAst) {
            const inputTypes = extractAllBaseTypeNames(rep.inputTypeAst);
            for (const tn of inputTypes) {
                if (tn.isError)
                    continue;
                const name = tn.name;
                let constructType;
                let constructKey;
                if (allEventNames.has(name)) {
                    constructType = "event";
                    constructKey = `event:${name}`;
                }
                else if (enumNames.has(name)) {
                    constructType = "enum";
                    constructKey = `enum:${name}`;
                }
                else {
                    constructType = "entity";
                    constructKey = `entity:${name}`;
                }
                const nodeId = `construct:${name}`;
                if (!constructMap.has(nodeId)) {
                    const ownerComp = ccMap.get(constructKey) || entityComponentMap.get(name);
                    const href = ownerComp ? constructLink(ownerComp, constructType, name) : "#";
                    constructMap.set(nodeId, { id: nodeId, name, href, constructType });
                }
                addEdge({ from: nodeId, to: rep.id, label: name, edgeType: "input" });
            }
        }
        // Output types
        if (rep.outputTypeAst) {
            const outputTypes = extractAllBaseTypeNames(rep.outputTypeAst);
            for (const tn of outputTypes) {
                if (tn.isError)
                    continue;
                const name = tn.name;
                let constructType;
                let constructKey;
                if (allEventNames.has(name)) {
                    constructType = "event";
                    constructKey = `event:${name}`;
                }
                else if (enumNames.has(name)) {
                    constructType = "enum";
                    constructKey = `enum:${name}`;
                }
                else {
                    constructType = "entity";
                    constructKey = `entity:${name}`;
                }
                const nodeId = `construct:${name}`;
                if (!constructMap.has(nodeId)) {
                    const ownerComp = ccMap.get(constructKey) || entityComponentMap.get(name);
                    const href = ownerComp ? constructLink(ownerComp, constructType, name) : "#";
                    constructMap.set(nodeId, { id: nodeId, name, href, constructType });
                }
                addEdge({ from: rep.id, to: nodeId, label: name, edgeType: "output" });
            }
        }
    }
    return {
        endpoints,
        handlers: Array.from(handlerMap.values()),
        consumers: Array.from(consumerMap.values()),
        constructs: Array.from(constructMap.values()),
        edges,
    };
}
function buildApiGraphHtml(graphData) {
    const jsonStr = escapeHtml(JSON.stringify(graphData));
    return `<div class="scope-api-graph" data-graph="${jsonStr}">
    <svg class="scope-api-graph-edges"></svg>
    <div class="scope-api-graph-world"></div>
  </div>`;
}
// ===== Screen Cards =====
function buildScreenCards(screens, componentName, ccMap) {
    const screenCards = screens
        .map((screen) => {
        const nameLink = `<a href="${constructLink(componentName, 'screen', screen.name)}" class="scope-construct-link">${escapeHtml(screen.name)}</a>`;
        const forms = screen.body.filter((b) => b.type === "FormDecl");
        const details = [];
        if (forms.length > 0) {
            details.push(`forms: ${forms.map((f) => escapeHtml(f.name ?? "anonymous")).join(", ")}`);
        }
        return `<div class="scope-entity-card">
        <div class="scope-entity-card-name">${nameLink}</div>
        <div style="font-size: var(--scope-text-xs); color: var(--scope-text-secondary); margin-top: var(--scope-space-1)">
          ${details.map((d) => `<div>${d}</div>`).join("")}
        </div>
      </div>`;
    })
        .join("");
    return `<div class="scope-entity-cards">${screenCards}</div>`;
}
function buildScreenGraphData(screens, elements, actions, componentName, snapshot, entityComponentMap, enumNames) {
    const ccMap = snapshot.constructComponentMap;
    const screenNodes = [];
    const elementMap = new Map();
    const actionNodes = [];
    const apiEndpointMap = new Map();
    const signalNodeMap = new Map();
    const constructNodeMap = new Map();
    const edges = [];
    const edgeSet = new Set();
    const allEventNames = new Set(snapshot.model.events.map((e) => e.name));
    // Build screen-to-elements mapping for action→element inference
    const screenToElements = new Map();
    // Collect all API endpoints in this component for matching
    const comp = snapshot.model.components.find((c) => c.name === componentName);
    const compApis = comp ? comp.body.filter((b) => b.type === "ApiDecl") : [];
    const resolvedEndpoints = [];
    for (const api of compApis) {
        const prefixDec = api.decorators?.find((d) => d.name === "prefix");
        const prefix = prefixDec ? String(prefixDec.params[0]?.value ?? "") : "";
        const apiName = api.name || "api";
        for (const ep of api.endpoints) {
            const fullPath = prefix + ep.path;
            const retType = ep.returnType || ep.response;
            const returnTypeStr = retType ? formatType(retType) : null;
            const epId = `api:${ep.method}:${fullPath}`;
            resolvedEndpoints.push({
                id: epId,
                method: ep.method,
                fullPath,
                returnType: returnTypeStr,
                returnTypeAst: retType || null,
                apiName,
            });
        }
    }
    function addEdge(edge) {
        const key = `${edge.from}|${edge.to}|${edge.edgeType}`;
        if (edgeSet.has(key))
            return;
        edgeSet.add(key);
        edges.push(edge);
    }
    function ensureElement(elName) {
        if (elementMap.has(elName))
            return;
        const el = snapshot.model.elements.find((e) => e.name === elName);
        if (!el)
            return;
        const elComp = ccMap.get(`element:${elName}`) || componentName;
        const isGhost = elComp !== componentName;
        const props = el.body
            .filter((b) => b.type === "PropDecl")
            .map((p) => ({
            name: p.name,
            typeHtml: formatTypeLinked(p.propType, entityComponentMap, enumNames),
        }));
        const forms = el.body
            .filter((b) => b.type === "FormDecl")
            .map((f) => ({
            name: f.name ?? "anonymous",
            fields: (f.fields || []).map((ff) => ({
                name: ff.name,
                typeHtml: formatTypeLinked(ff.fieldType, entityComponentMap, enumNames),
            })),
        }));
        const isAbstract = el.decorators?.some((d) => d.name === "abstract") ?? false;
        const isInterface = el.decorators?.some((d) => d.name === "interface") ?? false;
        elementMap.set(elName, {
            id: `element:${elName}`,
            name: elName,
            href: constructLink(elComp, "element", elName),
            implChip: renderImplChip(el.decorators),
            constructType: "element",
            props,
            forms,
            isAbstract,
            isInterface,
            extendsName: el.extends || null,
            implementsNames: el.implements || [],
            ghost: isGhost || undefined,
            ghostComponent: isGhost ? elComp : undefined,
        });
        // Element extends/implements → ensure those elements too
        if (el.extends) {
            ensureElement(el.extends);
            addEdge({ from: `element:${elName}`, to: `element:${el.extends}`, label: "extends", edgeType: "extends" });
        }
        for (const iface of (el.implements || [])) {
            ensureElement(iface);
            addEdge({ from: `element:${elName}`, to: `element:${iface}`, label: "implements", edgeType: "implements" });
        }
    }
    function ensureApiEndpoint(rep) {
        if (apiEndpointMap.has(rep.id))
            return;
        const apiComp = ccMap.get(`api:${rep.apiName}`);
        apiEndpointMap.set(rep.id, {
            id: rep.id,
            name: `${rep.method} ${rep.fullPath}`,
            href: apiComp ? constructLink(apiComp, "api", rep.apiName) : constructLink(componentName, "api", rep.apiName),
            constructType: "api-endpoint",
            method: rep.method,
            path: rep.fullPath,
            returnType: rep.returnType,
        });
    }
    // Build screen nodes (lightweight containers)
    for (const screen of screens) {
        const layoutDec = screen.decorators?.find((d) => d.name === "layout");
        const layoutValue = layoutDec ? String(layoutDec.params[0]?.value ?? "") : null;
        const usesElements = screen.body
            .filter((b) => b.type === "UsesDecl")
            .map((u) => u.element);
        screenToElements.set(screen.name, usesElements);
        screenNodes.push({
            id: `screen:${screen.name}`,
            name: screen.name,
            href: constructLink(componentName, "screen", screen.name),
            implChip: renderImplChip(screen.decorators),
            constructType: "screen",
            layout: layoutValue,
            usesElements,
        });
        // Screen contains → element
        for (const elName of usesElements) {
            ensureElement(elName);
            addEdge({ from: `screen:${screen.name}`, to: `element:${elName}`, label: "contains", edgeType: "contains" });
        }
        // Screen extends/implements
        if (screen.extends) {
            addEdge({ from: `screen:${screen.name}`, to: `screen:${screen.extends}`, label: "extends", edgeType: "extends" });
        }
        for (const iface of (screen.implements || [])) {
            addEdge({ from: `screen:${screen.name}`, to: `screen:${iface}`, label: "implements", edgeType: "implements" });
        }
    }
    // Build action nodes with element and API connections
    for (const action of actions) {
        let fromScreen = null;
        let callsEndpoint = null;
        let onStream = null;
        let emitsSignal = null;
        let onSignal = null;
        const results = [];
        for (const item of action.body) {
            if (item.type === "ActionFromClause") {
                fromScreen = item.screen;
            }
            else if (item.type === "ActionCallsClause") {
                callsEndpoint = `${item.method} ${item.path}`;
            }
            else if (item.type === "ActionOnStreamClause") {
                onStream = `STREAM ${item.path}`;
            }
            else if (item.type === "ActionEmitsSignalClause") {
                emitsSignal = item.signal;
            }
            else if (item.type === "ActionOnSignalClause") {
                onSignal = item.signal;
            }
            else if (item.type === "ActionResult") {
                results.push({ outcome: item.outcome, screen: item.screen });
            }
        }
        const actionId = `action:${action.name}`;
        actionNodes.push({
            id: actionId,
            name: action.name,
            href: constructLink(componentName, "action", action.name),
            implChip: renderImplChip(action.decorators),
            constructType: "action",
            callsEndpoint,
            onStream,
            emitsSignal,
            onSignal,
            results,
        });
        // Action → Elements: infer from action.from screen → screen.uses elements
        if (fromScreen) {
            const screenElements = screenToElements.get(fromScreen) || [];
            for (const elName of screenElements) {
                ensureElement(elName);
                addEdge({ from: `element:${elName}`, to: actionId, label: "action", edgeType: "action" });
            }
        }
        // Action → API endpoint (calls)
        if (callsEndpoint) {
            const matched = resolvedEndpoints.find((ep) => {
                const actionStr = callsEndpoint;
                const [method, ...pathParts] = actionStr.split(" ");
                const path = pathParts.join(" ");
                return ep.method === method && ep.fullPath === path;
            });
            if (matched) {
                ensureApiEndpoint(matched);
                addEdge({ from: actionId, to: matched.id, label: "calls", edgeType: "calls" });
            }
        }
        // API endpoint → Action (on-stream, reversed direction)
        if (onStream) {
            const streamPath = onStream.replace("STREAM ", "");
            const matched = resolvedEndpoints.find((ep) => ep.method === "STREAM" && ep.fullPath === streamPath);
            if (matched) {
                ensureApiEndpoint(matched);
                addEdge({ from: matched.id, to: actionId, label: "stream", edgeType: "on-stream" });
            }
        }
        // Action results → screen
        for (const r of results) {
            if (r.screen && r.screen !== "end") {
                addEdge({ from: actionId, to: `screen:${r.screen}`, label: r.outcome, edgeType: "result" });
            }
        }
        // Action emits signal → signal node
        if (emitsSignal) {
            const sigId = `signal:${emitsSignal}`;
            if (!signalNodeMap.has(sigId)) {
                const sigComp = ccMap.get(`signal:${emitsSignal}`);
                const href = sigComp ? constructLink(sigComp, "signal", emitsSignal) : "#";
                signalNodeMap.set(sigId, { id: sigId, name: emitsSignal, href, constructType: "signal" });
            }
            addEdge({ from: actionId, to: sigId, label: "emits", edgeType: "emits-signal" });
        }
        // Signal → Action (on signal, reversed direction)
        if (onSignal) {
            const sigId = `signal:${onSignal}`;
            if (!signalNodeMap.has(sigId)) {
                const sigComp = ccMap.get(`signal:${onSignal}`);
                const href = sigComp ? constructLink(sigComp, "signal", onSignal) : "#";
                signalNodeMap.set(sigId, { id: sigId, name: onSignal, href, constructType: "signal" });
            }
            addEdge({ from: sigId, to: actionId, label: "on", edgeType: "on-signal" });
        }
    }
    // Resolve endpoint return types → entity/event/enum construct nodes
    for (const [, ep] of apiEndpointMap) {
        const resolved = resolvedEndpoints.find((r) => r.id === ep.id);
        if (!resolved || !resolved.returnTypeAst)
            continue;
        const typeNames = extractAllBaseTypeNames(resolved.returnTypeAst);
        for (const tn of typeNames) {
            if (tn.isError)
                continue; // skip error types
            const name = tn.name;
            // Determine construct type: event, entity, or enum
            let constructType;
            let constructKey;
            if (allEventNames.has(name)) {
                constructType = "event";
                constructKey = `event:${name}`;
            }
            else if (enumNames.has(name)) {
                constructType = "enum";
                constructKey = `enum:${name}`;
            }
            else {
                constructType = "entity";
                constructKey = `entity:${name}`;
            }
            const nodeId = `construct:${name}`;
            if (!constructNodeMap.has(nodeId)) {
                const ownerComp = ccMap.get(constructKey) || entityComponentMap.get(name);
                const href = ownerComp ? constructLink(ownerComp, constructType, name) : "#";
                constructNodeMap.set(nodeId, { id: nodeId, name, href, constructType });
            }
            const label = ep.method === "STREAM" ? "streams" : "returns";
            addEdge({ from: ep.id, to: nodeId, label, edgeType: "returns" });
        }
    }
    return {
        screens: screenNodes,
        elements: Array.from(elementMap.values()),
        actions: actionNodes,
        apiEndpoints: Array.from(apiEndpointMap.values()),
        signalNodes: Array.from(signalNodeMap.values()),
        constructNodes: Array.from(constructNodeMap.values()),
        edges,
    };
}
function buildScreenGraphHtml(graphData) {
    const jsonStr = escapeHtml(JSON.stringify(graphData));
    return `<div class="scope-screen-graph" data-graph="${jsonStr}">
    <svg class="scope-screen-graph-edges"></svg>
    <div class="scope-screen-graph-world"></div>
  </div>`;
}
// ===== Event Cards =====
function buildEventCards(events, componentName, entityComponentMap, enumNames) {
    const eventCards = events
        .map((event) => {
        const nameLink = `<a href="${constructLink(componentName, 'event', event.name)}" class="scope-construct-link">${escapeHtml(event.name)}</a>`;
        const fields = event.fields
            .map((f) => `<div class="scope-entity-field"><span class="scope-entity-field-name">${escapeHtml(f.name)}</span><span class="scope-entity-field-type">${formatTypeLinked(f.fieldType, entityComponentMap, enumNames)}</span></div>`)
            .join("");
        return `<div class="scope-entity-card">
        <div class="scope-entity-card-name">${nameLink}</div>
        <div class="scope-entity-fields">${fields}</div>
      </div>`;
    })
        .join("");
    return `<div class="scope-entity-cards">${eventCards}</div>`;
}
function buildEventGraphData(events, componentName, snapshot, entityComponentMap, enumNames) {
    const eventNodes = [];
    const emitterMap = new Map();
    const consumerMap = new Map();
    const edges = [];
    const ccMap = snapshot.constructComponentMap;
    const edgeSet = new Set(); // deduplicate edges
    function addEdge(edge) {
        const key = `${edge.from}|${edge.to}|${edge.edgeType}`;
        if (edgeSet.has(key))
            return;
        edgeSet.add(key);
        edges.push(edge);
    }
    for (const event of events) {
        const implChip = renderImplChip(event.decorators);
        const fields = event.fields.map((f) => ({
            name: f.name,
            typeHtml: formatTypeLinked(f.fieldType, entityComponentMap, enumNames),
        }));
        const eventId = `event:${event.name}`;
        eventNodes.push({
            id: eventId,
            name: event.name,
            href: constructLink(componentName, "event", event.name),
            implChip,
            fieldCount: event.fields.length,
            fields,
        });
        // --- EMITTERS: operations that emit this event ---
        for (const op of snapshot.model.operations) {
            const emitsThis = op.body.some((item) => item.type === "EmitsClause" && item.event === event.name);
            if (!emitsThis)
                continue;
            const opComp = ccMap.get(`operation:${op.name}`) || componentName;
            const opId = `emitter-op:${op.name}`;
            if (!emitterMap.has(opId)) {
                emitterMap.set(opId, {
                    id: opId,
                    name: op.name,
                    href: constructLink(opComp, "operation", op.name),
                    constructType: "operation",
                    component: opComp,
                    ghost: opComp !== componentName || undefined,
                });
            }
            addEdge({ from: opId, to: eventId, label: "emits", edgeType: "emits" });
            // Flows that use this operation
            const opRels = snapshot.relationships.get(makeKey(opComp, "operation", op.name));
            if (opRels) {
                for (const flowRef of opRels.usedByFlows) {
                    const flowId = `emitter-flow:${flowRef.name}`;
                    if (!emitterMap.has(flowId)) {
                        emitterMap.set(flowId, {
                            id: flowId,
                            name: flowRef.name,
                            href: constructLink(flowRef.component, "flow", flowRef.name),
                            constructType: "flow",
                            component: flowRef.component,
                            ghost: flowRef.component !== componentName || undefined,
                        });
                    }
                    addEdge({ from: flowId, to: opId, label: "uses", edgeType: "uses" });
                }
                // Rules that this operation enforces
                for (const ruleRef of opRels.enforcesRules) {
                    const ruleId = `emitter-rule:${ruleRef.name}`;
                    if (!emitterMap.has(ruleId)) {
                        emitterMap.set(ruleId, {
                            id: ruleId,
                            name: ruleRef.name,
                            href: constructLink(ruleRef.component, "rule", ruleRef.name),
                            constructType: "rule",
                            component: ruleRef.component,
                            ghost: ruleRef.component !== componentName || undefined,
                        });
                    }
                    addEdge({ from: opId, to: ruleId, label: "enforces", edgeType: "enforces" });
                }
            }
        }
        // --- CONSUMERS ---
        const rels = snapshot.relationships.get(makeKey(componentName, "event", event.name));
        // State transitions triggered by this event — each transition becomes a
        // consumer node showing "from → to" with the cycle name as subtitle
        for (const stateMachine of snapshot.model.states) {
            const stateComp = ccMap.get(`state:${stateMachine.name}`);
            if (!stateComp)
                continue;
            const matchingTransitions = stateMachine.transitions.filter((t) => t.event === event.name);
            if (matchingTransitions.length === 0)
                continue;
            for (const t of matchingTransitions) {
                const fromState = t.from === "*" ? "*" : t.from;
                const toState = t.to;
                const transId = `consumer-trans:${stateMachine.name}:${fromState}:${toState}`;
                if (!consumerMap.has(transId)) {
                    consumerMap.set(transId, {
                        id: transId,
                        name: `${fromState} → ${toState}`,
                        href: constructLink(stateComp, "state", stateMachine.name),
                        constructType: "state-transition",
                        label: stateMachine.name,
                        component: stateComp,
                        ghost: stateComp !== componentName || undefined,
                    });
                }
                addEdge({ from: eventId, to: transId, label: "trigger", edgeType: "trigger" });
            }
        }
        if (rels) {
            // Operations with on EventName
            for (const opRef of rels.triggersOperations) {
                const opId = `consumer-op:${opRef.name}`;
                if (!consumerMap.has(opId)) {
                    consumerMap.set(opId, {
                        id: opId,
                        name: opRef.name,
                        href: constructLink(opRef.component, "operation", opRef.name),
                        constructType: "operation",
                        component: opRef.component,
                        ghost: opRef.component !== componentName || undefined,
                    });
                }
                addEdge({ from: eventId, to: opId, label: "trigger", edgeType: "trigger" });
            }
        }
        // Flows triggered by this event (on EventName)
        for (const flow of snapshot.model.flows) {
            const triggersOnThis = flow.body.some((item) => item.type === "OnClause" && item.event === event.name);
            if (!triggersOnThis)
                continue;
            const flowComp = ccMap.get(`flow:${flow.name}`) || componentName;
            const flowId = `consumer-flow:${flow.name}`;
            if (!consumerMap.has(flowId)) {
                consumerMap.set(flowId, {
                    id: flowId,
                    name: flow.name,
                    href: constructLink(flowComp, "flow", flow.name),
                    constructType: "flow",
                    component: flowComp,
                    ghost: flowComp !== componentName || undefined,
                });
            }
            addEdge({ from: eventId, to: flowId, label: "trigger", edgeType: "trigger" });
        }
        // API STREAM endpoints that return this event type
        for (const api of snapshot.model.apis) {
            const apiComp = ccMap.get(`api:${api.name}`);
            if (!apiComp)
                continue;
            const prefixDeco = api.decorators?.find((d) => d.name === "prefix");
            const prefixVal = prefixDeco?.params?.[0] ? String(prefixDeco.params[0].value) : "";
            for (const ep of api.endpoints) {
                if (ep.method !== "STREAM")
                    continue;
                const retType = ep.returnType || ep.response;
                const returnName = retType?.name || retType?.inner?.name;
                if (returnName !== event.name)
                    continue;
                const streamPath = prefixVal + ep.path;
                const streamId = `consumer-stream:${api.name}:${ep.path}`;
                if (!consumerMap.has(streamId)) {
                    consumerMap.set(streamId, {
                        id: streamId,
                        name: `STREAM ${streamPath}`,
                        href: constructLink(apiComp, "api", api.name || "api"),
                        constructType: "api-stream",
                        label: `STREAM ${streamPath}`,
                        component: apiComp,
                        ghost: apiComp !== componentName || undefined,
                    });
                }
                addEdge({ from: eventId, to: streamId, label: "stream", edgeType: "stream" });
            }
        }
    }
    return {
        events: eventNodes,
        emitters: Array.from(emitterMap.values()),
        consumers: Array.from(consumerMap.values()),
        edges,
    };
}
function buildEventGraphHtml(graphData) {
    const jsonStr = escapeHtml(JSON.stringify(graphData));
    return `<div class="scope-event-graph" data-graph="${jsonStr}">
    <svg class="scope-event-graph-edges"></svg>
    <div class="scope-event-graph-world"></div>
  </div>`;
}
// ===== Signal Cards =====
function buildSignalCards(signals, componentName, entityComponentMap, enumNames) {
    const signalCards = signals
        .map((signal) => {
        const nameLink = `<a href="${constructLink(componentName, 'signal', signal.name)}" class="scope-construct-link">${escapeHtml(signal.name)}</a>`;
        const fields = signal.fields
            .map((f) => `<div class="scope-entity-field"><span class="scope-entity-field-name">${escapeHtml(f.name)}</span><span class="scope-entity-field-type">${formatTypeLinked(f.fieldType, entityComponentMap, enumNames)}</span></div>`)
            .join("");
        return `<div class="scope-entity-card">
        <div class="scope-entity-card-name">${nameLink}</div>
        <div class="scope-entity-fields">${fields}</div>
      </div>`;
    })
        .join("");
    return `<div class="scope-entity-cards">${signalCards}</div>`;
}
// ===== Rule Cards =====
function buildRuleCards(rules, componentName) {
    const ruleItems = rules
        .map((rule) => {
        const nameLink = `<a href="${constructLink(componentName, 'rule', rule.name)}" class="scope-construct-link">${escapeHtml(rule.name)}</a>`;
        const clauseLines = [];
        for (const clause of rule.body) {
            if (clause.type === "WhenClause")
                clauseLines.push(`when ${escapeHtml(clause.expression)}`);
            if (clause.type === "ThenClause")
                clauseLines.push(`then ${escapeHtml(clause.action)}`);
            if (clause.type === "ElseIfClause")
                clauseLines.push(`elseif ${escapeHtml(clause.condition)} then ${escapeHtml(clause.action)}`);
            if (clause.type === "ElseClause")
                clauseLines.push(`else ${escapeHtml(clause.action)}`);
        }
        return `<div class="scope-entity-card">
        <div class="scope-entity-card-name">${nameLink}</div>
        <div style="font-size: var(--scope-text-xs); color: var(--scope-text-secondary); margin-top: var(--scope-space-1)">
          ${clauseLines.map((line) => `<div>${line}</div>`).join("")}
        </div>
      </div>`;
    })
        .join("");
    return `<div class="scope-entity-cards">${ruleItems}</div>`;
}
function buildJourneyGraphData(journey, componentName, ccMap, allEventNames, allSignalNames, actions) {
    const screenMap = new Map();
    const triggerMap = new Map();
    const specialMap = new Map();
    const actionMap = new Map();
    const edges = [];
    const steps = journey.body.filter((b) => b.type === "JourneyStep");
    // Extract persona from decorators
    const personaDec = journey.decorators?.find((d) => d.name === "persona");
    const persona = personaDec ? String(personaDec.params[0]?.value ?? "") : "";
    const implChip = renderImplChip(journey.decorators);
    for (const step of steps) {
        const fromName = step.from;
        const toName = step.to;
        const triggerName = step.trigger;
        // From node
        let fromId;
        if (fromName === "*") {
            fromId = "special:wildcard";
            if (!specialMap.has(fromId)) {
                specialMap.set(fromId, { id: fromId, nodeType: "wildcard" });
            }
        }
        else {
            fromId = `screen:${fromName}`;
            if (!screenMap.has(fromId)) {
                const sComp = ccMap.get(`screen:${fromName}`);
                const href = sComp ? constructLink(sComp, "screen", fromName) : "#";
                const sImpl = findScreenImpl(fromName, ccMap);
                screenMap.set(fromId, { id: fromId, name: fromName, href, implChip: sImpl });
            }
        }
        // To node
        let toId;
        if (toName === "end") {
            toId = "special:end";
            if (!specialMap.has(toId)) {
                specialMap.set(toId, { id: toId, nodeType: "end" });
            }
        }
        else {
            toId = `screen:${toName}`;
            if (!screenMap.has(toId)) {
                const sComp = ccMap.get(`screen:${toName}`);
                const href = sComp ? constructLink(sComp, "screen", toName) : "#";
                const sImpl = findScreenImpl(toName, ccMap);
                screenMap.set(toId, { id: toId, name: toName, href, implChip: sImpl });
            }
        }
        // Trigger node — resolve as event, signal, or unresolved
        const triggerId = `trigger:${triggerName}`;
        if (!triggerMap.has(triggerId)) {
            const isEvent = allEventNames.has(triggerName);
            const isSignal = allSignalNames.has(triggerName);
            const triggerKind = isEvent ? "event" : isSignal ? "signal" : "unresolved";
            const constructType = isEvent ? "event" : isSignal ? "signal" : null;
            const triggerComp = constructType ? ccMap.get(`${constructType}:${triggerName}`) : null;
            const href = triggerComp ? constructLink(triggerComp, constructType, triggerName) : "#";
            triggerMap.set(triggerId, { id: triggerId, name: triggerName, href, triggerKind });
        }
        // Edges: from → trigger → to
        const edgeType = fromName === "*" ? "wildcard" : toName === "end" ? "terminal" : "step";
        edges.push({ from: fromId, to: triggerId, edgeType });
        edges.push({ from: triggerId, to: toId, edgeType });
        // Match actions for this step
        const matchingAction = findMatchingAction(actions, fromName, toName, componentName, ccMap);
        if (matchingAction) {
            const actionId = `action:${matchingAction.name}`;
            if (!actionMap.has(actionId)) {
                const aComp = ccMap.get(`action:${matchingAction.name}`);
                const href = aComp ? constructLink(aComp, "action", matchingAction.name) : "#";
                const aImpl = renderImplChip(matchingAction.decorators);
                // Determine action type
                const hasCalls = matchingAction.body.some((b) => b.type === "ActionCallsClause");
                const hasStream = matchingAction.body.some((b) => b.type === "ActionOnStreamClause");
                const actionType = hasCalls ? "imperative" : hasStream ? "reactive" : "pure";
                // Extract calls endpoint if imperative
                let callsEndpoint = null;
                if (hasCalls) {
                    const callsClause = matchingAction.body.find((b) => b.type === "ActionCallsClause");
                    if (callsClause)
                        callsEndpoint = `${callsClause.method} ${callsClause.path}`;
                }
                actionMap.set(actionId, { id: actionId, name: matchingAction.name, href, implChip: aImpl, actionType, callsEndpoint });
            }
            // Edges: action connects from-screen and to-screen
            // For wildcard steps, use the action's actual "from" screen instead of special:wildcard
            let actionFromId = fromId;
            if (fromName === "*") {
                const actionFromClause = matchingAction.body.find((b) => b.type === "ActionFromClause");
                if (actionFromClause) {
                    const actualFrom = actionFromClause.screen;
                    actionFromId = `screen:${actualFrom}`;
                    // Ensure the screen node exists
                    if (!screenMap.has(actionFromId)) {
                        const sComp = ccMap.get(`screen:${actualFrom}`);
                        const href = sComp ? constructLink(sComp, "screen", actualFrom) : "#";
                        const sImpl = findScreenImpl(actualFrom, ccMap);
                        screenMap.set(actionFromId, { id: actionFromId, name: actualFrom, href, implChip: sImpl });
                    }
                }
            }
            edges.push({ from: actionFromId, to: `action:${matchingAction.name}`, edgeType: "action-from" });
            edges.push({ from: `action:${matchingAction.name}`, to: toId, edgeType: "action-to" });
        }
    }
    // Build label: "jornada_pedido @persona(cliente)"
    let journeyLabel = journey.name;
    if (persona)
        journeyLabel += ` @persona(${persona})`;
    return {
        journeyName: journey.name,
        journeyHref: constructLink(componentName, "journey", journey.name),
        journeyLabel,
        screenNodes: Array.from(screenMap.values()),
        triggerNodes: Array.from(triggerMap.values()),
        specialNodes: Array.from(specialMap.values()),
        actionNodes: Array.from(actionMap.values()),
        edges,
    };
}
function findMatchingAction(actions, fromScreen, toScreen, componentName, ccMap) {
    for (const action of actions) {
        const fromClause = action.body.find((b) => b.type === "ActionFromClause");
        if (!fromClause)
            continue;
        // For wildcard steps (*), match any action that navigates to the "to" screen
        // For normal steps, the action's "from" clause must match the step's from screen
        if (fromScreen !== "*" && fromClause.screen !== fromScreen)
            continue;
        // Check if any result branch navigates to the step's "to" screen
        if (toScreen === "end") {
            const hasEnd = action.body.some((b) => b.type === "ActionResult" && b.screen === "end");
            if (hasEnd)
                return action;
        }
        else {
            const hasMatch = action.body.some((b) => b.type === "ActionResult" && b.screen === toScreen);
            if (hasMatch)
                return action;
        }
    }
    return null;
}
function findScreenImpl(screenName, ccMap) {
    // We don't have the screen AST here, just return empty
    return "";
}
function buildJourneyGraphHtml(graphDataList) {
    return graphDataList.map((graphData) => {
        const jsonStr = escapeHtml(JSON.stringify(graphData));
        return `<div class="scope-journey-graph" data-graph="${jsonStr}">
      <svg class="scope-journey-graph-edges"></svg>
      <div class="scope-journey-graph-world"></div>
    </div>`;
    }).join("");
}
// ===== Operation Cards =====
function buildOperationCards(operations, componentName, ccMap) {
    const operationItems = operations
        .map((op) => {
        const implChip = renderImplChip(op.decorators);
        const nameLink = `<a href="${constructLink(componentName, 'operation', op.name)}" class="scope-construct-link">${escapeHtml(op.name)}</a>`;
        const params = op.params.map((p) => formatType(p)).join(", ");
        const ret = op.returnType ? formatType(op.returnType) : "void";
        const bodyItems = [];
        for (const item of op.body) {
            if (item.type === "EmitsClause") {
                const eventComp = ccMap.get(`event:${item.event}`);
                const eventLink = eventComp
                    ? `<a href="${constructLink(eventComp, 'event', item.event)}" class="scope-construct-link">${escapeHtml(item.event)}</a>`
                    : escapeHtml(item.event);
                bodyItems.push(`<span class="scope-mono" style="font-size: var(--scope-text-xs); color: var(--scope-text-secondary)">emits ${eventLink}</span>`);
            }
            if (item.type === "OnClause") {
                const eventComp = ccMap.get(`event:${item.event}`);
                const eventLink = eventComp
                    ? `<a href="${constructLink(eventComp, 'event', item.event)}" class="scope-construct-link">${escapeHtml(item.event)}</a>`
                    : escapeHtml(item.event);
                bodyItems.push(`<span class="scope-mono" style="font-size: var(--scope-text-xs); color: var(--scope-text-secondary)">on ${eventLink}</span>`);
            }
            if (item.type === "EnforcesClause") {
                const ruleComp = ccMap.get(`rule:${item.rule}`);
                const ruleLink = ruleComp
                    ? `<a href="${constructLink(ruleComp, 'rule', item.rule)}" class="scope-construct-link">${escapeHtml(item.rule)}</a>`
                    : escapeHtml(item.rule);
                bodyItems.push(`<span class="scope-mono" style="font-size: var(--scope-text-xs); color: var(--scope-text-secondary)">enforces ${ruleLink}</span>`);
            }
            if (item.type === "OperationHandlesClause") {
                bodyItems.push(`<span class="scope-mono" style="font-size: var(--scope-text-xs); color: var(--scope-text-secondary)">handles <span class="scope-chip" style="background: var(--scope-accent-muted); color: var(--scope-accent); border: 1px solid var(--scope-border); font-size: var(--scope-text-xs)">${escapeHtml(item.method)}</span> ${escapeHtml(item.path)}</span>`);
            }
            if (item.type === "OperationCallsClause") {
                bodyItems.push(`<span class="scope-mono" style="font-size: var(--scope-text-xs); color: var(--scope-text-secondary)">calls <span class="scope-chip" style="background: var(--scope-accent-muted); color: var(--scope-accent); border: 1px solid var(--scope-border); font-size: var(--scope-text-xs)">${escapeHtml(item.method)}</span> ${escapeHtml(item.path)}</span>`);
            }
            if (item.type === "SemanticComment") {
                bodyItems.push(`<span style="font-size: var(--scope-text-xs); color: var(--scope-text-tertiary)"># ${escapeHtml(item.text)}</span>`);
            }
        }
        return `<div class="scope-entity-card">
        <div class="scope-entity-card-name">
          <span>${nameLink}(<span class="scope-mono" style="font-size: var(--scope-text-xs)">${escapeHtml(params)}</span>) -> <span class="scope-mono" style="font-size: var(--scope-text-xs)">${escapeHtml(ret)}</span></span>
          ${implChip}
        </div>
        ${bodyItems.length > 0 ? `<div style="margin-top: var(--scope-space-2)">${bodyItems.join("<br>")}</div>` : ""}
      </div>`;
    })
        .join("");
    return `<div class="scope-entity-cards">${operationItems}</div>`;
}
//# sourceMappingURL=component-detail.js.map