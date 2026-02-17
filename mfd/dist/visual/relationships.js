/**
 * Relationship Engine — computes bidirectional links between constructs.
 *
 * Analyzes the CollectedModel to build a graph of references:
 * - Entity fields with ReferenceType → entity↔entity
 * - Action `from Screen` + `calls API` → action→screen, action→api
 * - API endpoint input/output types → api→entity (detail-level only, NOT overview graph)
 * - Flow/Operation `handles` endpoint → flow→api, operation→api
 * - State `enumRef` → state→enum
 * - Flow steps with entity/event names → flow→entity, flow→event
 *
 * Connection model: API → Flow/Operation (via handles) → Entity (via params/return).
 * APIs do NOT connect directly to entities in the overview graph.
 * Only operations can consume endpoints (calls); flows can only serve them (handles).
 *
 * Uses the central constructComponentMap to resolve which component owns each construct.
 */
function emptyRelationships() {
    return {
        usedByFlows: [],
        exposedByApi: [],
        governedByStates: [],
        governedByRules: [],
        referencedByEntities: [],
        emitsEvents: [],
        actionSources: [],
        calledByActions: [],
        involvedEntities: [],
        involvedEvents: [],
        targetFlow: null,
        enumRef: null,
        triggeredByEvents: [],
        triggersStates: [],
        usesOperations: [],
        usedByOperations: [],
        triggeredByRules: [],
        triggersOperations: [],
        enforcesRules: [],
        enforcedByOperations: [],
        emitsSignals: [],
        onSignals: [],
        signalEmittedByActions: [],
        signalListenedByActions: [],
        handlesEndpoints: [],
        callsEndpoints: [],
        extendsParent: null,
        extendedByChildren: [],
        implementsInterfaces: [],
        implementedByConcretes: [],
    };
}
function makeKey(component, type, name) {
    return `${component}:${type}:${name}`;
}
export function computeRelationships(model, constructComponentMap) {
    const map = new Map();
    const entityNames = new Set(model.entities.map((e) => e.name));
    const enumNames = new Set(model.enums.map((e) => e.name));
    const eventNames = new Set(model.events.map((e) => e.name));
    const signalNames = new Set(model.signals.map((s) => s.name));
    function getComp(type, name) {
        return constructComponentMap.get(`${type}:${name}`);
    }
    function getOrCreate(component, type, name) {
        const key = makeKey(component, type, name);
        if (!map.has(key)) {
            map.set(key, emptyRelationships());
        }
        return map.get(key);
    }
    function extractRefs(typeExpr) {
        if (!typeExpr)
            return [];
        switch (typeExpr.type) {
            case "ReferenceType":
                return [typeExpr.name];
            case "OptionalType":
            case "ArrayType":
                return extractRefs(typeExpr.inner);
            case "UnionType":
                return (typeExpr.alternatives || []).flatMap(extractRefs);
            default:
                return [];
        }
    }
    // 1. Entity fields with ReferenceType → entity↔entity link
    for (const entity of model.entities) {
        const entityComp = getComp("entity", entity.name);
        if (!entityComp)
            continue;
        for (const field of entity.fields) {
            const refs = extractRefs(field.fieldType);
            for (const refName of refs) {
                if (entityNames.has(refName) || enumNames.has(refName)) {
                    const refType = entityNames.has(refName) ? "entity" : "enum";
                    const refComp = getComp(refType, refName);
                    if (refComp) {
                        const refRel = getOrCreate(refComp, refType, refName);
                        refRel.referencedByEntities.push({
                            entity: entity.name,
                            field: field.name,
                            component: entityComp,
                        });
                    }
                }
            }
        }
    }
    // 2. Flows → entity/event references
    for (const flow of model.flows) {
        const flowComp = getComp("flow", flow.name);
        if (!flowComp)
            continue;
        const flowRel = getOrCreate(flowComp, "flow", flow.name);
        // Check params and return types for entity refs
        for (const param of flow.params) {
            for (const refName of extractRefs(param)) {
                if (entityNames.has(refName)) {
                    const refComp = getComp("entity", refName);
                    if (refComp) {
                        addUnique(flowRel.involvedEntities, { component: refComp, type: "entity", name: refName });
                        const entityRel = getOrCreate(refComp, "entity", refName);
                        addUnique(entityRel.usedByFlows, { component: flowComp, type: "flow", name: flow.name });
                    }
                }
            }
        }
        if (flow.returnType) {
            for (const refName of extractRefs(flow.returnType)) {
                if (entityNames.has(refName)) {
                    const refComp = getComp("entity", refName);
                    if (refComp) {
                        addUnique(flowRel.involvedEntities, { component: refComp, type: "entity", name: refName });
                        const entityRel = getOrCreate(refComp, "entity", refName);
                        addUnique(entityRel.usedByFlows, { component: flowComp, type: "flow", name: flow.name });
                    }
                }
            }
        }
        // Flow triggers (on EventName) and emits (emits EventName) — direct clauses
        for (const item of flow.body) {
            if (item.type === "OnClause") {
                const evName = item.event;
                if (eventNames.has(evName)) {
                    const evComp = getComp("event", evName);
                    if (evComp) {
                        addUnique(flowRel.triggeredByEvents, { component: evComp, type: "event", name: evName });
                        const eventRel = getOrCreate(evComp, "event", evName);
                        addUnique(eventRel.usedByFlows, { component: flowComp, type: "flow", name: flow.name });
                    }
                }
            }
            if (item.type === "EmitsClause") {
                const evName = item.event;
                if (eventNames.has(evName)) {
                    const evComp = getComp("event", evName);
                    if (evComp) {
                        addUnique(flowRel.emitsEvents, { component: evComp, type: "event", name: evName });
                        const eventRel = getOrCreate(evComp, "event", evName);
                        addUnique(eventRel.usedByFlows, { component: flowComp, type: "flow", name: flow.name });
                    }
                }
            }
        }
        // Check flow steps for entity/event mentions (action + args)
        for (const step of flow.body) {
            if (step.type === "FlowStep") {
                const action = step.action || "";
                const args = step.args || "";
                const stepText = `${action} ${args}`;
                for (const eName of entityNames) {
                    if (stepText.includes(eName)) {
                        const eComp = getComp("entity", eName);
                        if (eComp) {
                            addUnique(flowRel.involvedEntities, { component: eComp, type: "entity", name: eName });
                            const entityRel = getOrCreate(eComp, "entity", eName);
                            addUnique(entityRel.usedByFlows, { component: flowComp, type: "flow", name: flow.name });
                        }
                    }
                }
                for (const evName of eventNames) {
                    if (stepText.includes(evName)) {
                        const evComp = getComp("event", evName);
                        if (evComp) {
                            addUnique(flowRel.emitsEvents, { component: evComp, type: "event", name: evName });
                            const eventRel = getOrCreate(evComp, "event", evName);
                            addUnique(eventRel.usedByFlows, { component: flowComp, type: "flow", name: flow.name });
                        }
                    }
                }
            }
        }
    }
    // 3. API endpoints → entity refs
    for (const api of model.apis) {
        const apiComp = getComp("api", api.name);
        if (!apiComp)
            continue;
        for (const ep of api.endpoints) {
            const inputRefs = extractRefs(ep.inputType || ep.body);
            const outputRefs = extractRefs(ep.returnType || ep.response);
            const allRefs = [...new Set([...inputRefs, ...outputRefs])];
            for (const refName of allRefs) {
                if (entityNames.has(refName)) {
                    const refComp = getComp("entity", refName);
                    if (refComp) {
                        const entityRel = getOrCreate(refComp, "entity", refName);
                        entityRel.exposedByApi.push({
                            method: ep.method,
                            path: ep.path,
                            component: apiComp,
                        });
                    }
                }
            }
        }
    }
    // 4. States → enum refs
    for (const state of model.states) {
        const stateComp = getComp("state", state.name);
        if (!stateComp)
            continue;
        const stateRel = getOrCreate(stateComp, "state", state.name);
        if (state.enumRef) {
            const enumComp = getComp("enum", state.enumRef);
            if (enumComp) {
                stateRel.enumRef = { component: enumComp, type: "enum", name: state.enumRef };
            }
        }
        // State triggers → event refs (reactive pattern)
        for (const transition of state.transitions) {
            if (!transition.event)
                continue;
            const triggerName = transition.event;
            if (eventNames.has(triggerName)) {
                const eventComp = getComp("event", triggerName);
                if (eventComp) {
                    addUnique(stateRel.triggeredByEvents, {
                        component: eventComp, type: "event", name: triggerName
                    });
                    const eventRel = getOrCreate(eventComp, "event", triggerName);
                    addUnique(eventRel.triggersStates, {
                        component: stateComp, type: "state", name: state.name
                    });
                }
            }
        }
        // States govern entities that use the same enum
        for (const entity of model.entities) {
            for (const field of entity.fields) {
                const refs = extractRefs(field.fieldType);
                if (state.enumRef && refs.includes(state.enumRef)) {
                    const entityComp = getComp("entity", entity.name);
                    if (entityComp) {
                        const entityRel = getOrCreate(entityComp, "entity", entity.name);
                        addUnique(entityRel.governedByStates, { component: stateComp, type: "state", name: state.name });
                    }
                }
            }
        }
    }
    // 5. Actions → screen/api refs (from, calls, results)
    for (const action of model.actions) {
        const actionComp = getComp("action", action.name);
        if (!actionComp)
            continue;
        const actionRel = getOrCreate(actionComp, "action", action.name);
        for (const item of action.body) {
            if (item.type === "ActionFromClause") {
                const screenComp = getComp("screen", item.screen);
                if (screenComp) {
                    const screenRel = getOrCreate(screenComp, "screen", item.screen);
                    addUnique(screenRel.actionSources, { component: actionComp, type: "action", name: action.name });
                }
            }
            if (item.type === "ActionOnStreamClause") {
                // Link reactive action to the API that declares the STREAM endpoint
                const streamPath = item.path;
                for (const api of model.apis) {
                    const apiComp = getComp("api", api.name);
                    if (!apiComp)
                        continue;
                    const prefixDeco = api.decorators.find((d) => d.name === "prefix");
                    const prefixVal = prefixDeco?.params?.[0] ? String(prefixDeco.params[0].value) : "";
                    for (const ep of api.endpoints) {
                        if (ep.method === "STREAM") {
                            const fullPath = (prefixVal + ep.path).replace(/\/+$/, "") || "/";
                            const normalizedStream = streamPath.replace(/\/+$/, "") || "/";
                            if (fullPath === normalizedStream) {
                                addUnique(actionRel.calledByActions, { component: apiComp, type: "api", name: api.name ?? "(anonymous)" });
                            }
                        }
                    }
                }
            }
            if (item.type === "ActionResult") {
                const screenName = item.screen;
                if (screenName && screenName !== "end") {
                    const screenComp = getComp("screen", screenName);
                    if (screenComp) {
                        getOrCreate(screenComp, "screen", screenName);
                    }
                }
            }
        }
    }
    // 6. Rules → entity refs (heuristic)
    for (const rule of model.rules) {
        const ruleComp = getComp("rule", rule.name);
        if (!ruleComp)
            continue;
        for (const clause of rule.body) {
            const text = clause.expression || clause.condition || clause.action || "";
            for (const eName of entityNames) {
                if (text.includes(eName)) {
                    const entityComp = getComp("entity", eName);
                    if (entityComp) {
                        const entityRel = getOrCreate(entityComp, "entity", eName);
                        addUnique(entityRel.governedByRules, { component: ruleComp, type: "rule", name: rule.name });
                    }
                }
            }
        }
    }
    // 7a. Operations → event refs (emits/on)
    for (const op of model.operations) {
        const opComp = getComp("operation", op.name);
        if (!opComp)
            continue;
        const opRel = getOrCreate(opComp, "operation", op.name);
        for (const item of op.body) {
            if (item.type === "EmitsClause") {
                const eventComp = getComp("event", item.event);
                if (eventComp) {
                    addUnique(opRel.emitsEvents, { component: eventComp, type: "event", name: item.event });
                    const eventRel = getOrCreate(eventComp, "event", item.event);
                    addUnique(eventRel.usedByFlows, { component: opComp, type: "operation", name: op.name });
                }
            }
            if (item.type === "OnClause") {
                const eventComp = getComp("event", item.event);
                if (eventComp) {
                    addUnique(opRel.triggeredByEvents, { component: eventComp, type: "event", name: item.event });
                    const eventRel = getOrCreate(eventComp, "event", item.event);
                    addUnique(eventRel.triggersOperations, { component: opComp, type: "operation", name: op.name });
                }
            }
            if (item.type === "EnforcesClause") {
                const ruleComp = getComp("rule", item.rule);
                if (ruleComp) {
                    addUnique(opRel.enforcesRules, { component: ruleComp, type: "rule", name: item.rule });
                    const ruleRel = getOrCreate(ruleComp, "rule", item.rule);
                    addUnique(ruleRel.enforcedByOperations, { component: opComp, type: "operation", name: op.name });
                }
            }
        }
    }
    // 7b. Flows → operation refs (step names)
    for (const flow of model.flows) {
        const flowComp = getComp("flow", flow.name);
        if (!flowComp)
            continue;
        const flowRel = getOrCreate(flowComp, "flow", flow.name);
        for (const step of flow.body) {
            if (step.type !== "FlowStep" || !step.hasArrow)
                continue;
            const actionName = (step.action || "").trim().split(/[\s(]/)[0];
            if (actionName === "emit" || actionName === "return")
                continue;
            const opComp = getComp("operation", actionName);
            if (opComp) {
                addUnique(flowRel.usesOperations, { component: opComp, type: "operation", name: actionName });
                const opRel = getOrCreate(opComp, "operation", actionName);
                addUnique(opRel.usedByFlows, { component: flowComp, type: "flow", name: flow.name });
            }
        }
    }
    // 7c. Rules → operation refs (then clauses)
    for (const rule of model.rules) {
        const ruleComp = getComp("rule", rule.name);
        if (!ruleComp)
            continue;
        for (const clause of rule.body) {
            const clauseType = clause.type;
            if (clauseType !== "ThenClause" && clauseType !== "ElseIfClause" && clauseType !== "ElseClause")
                continue;
            const action = clause.action || "";
            if (!action.includes("("))
                continue;
            const actionName = action.trim().split(/[\s(]/)[0];
            if (actionName === "emit" || actionName === "deny")
                continue;
            const opComp = getComp("operation", actionName);
            if (opComp) {
                const opRel = getOrCreate(opComp, "operation", actionName);
                addUnique(opRel.triggeredByRules, { component: ruleComp, type: "rule", name: rule.name });
            }
        }
    }
    // 7d. Screen → element (via uses)
    for (const screen of model.screens) {
        const screenComp = getComp("screen", screen.name);
        if (!screenComp)
            continue;
        for (const item of screen.body) {
            if (item.type === "UsesDecl") {
                const elName = item.element;
                const elComp = getComp("element", elName);
                if (elComp) {
                    const screenRel = getOrCreate(screenComp, "screen", screen.name);
                    addUnique(screenRel.involvedEntities, { component: elComp, type: "element", name: elName });
                }
            }
        }
    }
    // 7e. Actions → signal refs (on Signal / emits Signal)
    for (const action of model.actions) {
        const actionComp = getComp("action", action.name);
        if (!actionComp)
            continue;
        const actionRel = getOrCreate(actionComp, "action", action.name);
        for (const item of action.body) {
            if (item.type === "ActionOnSignalClause") {
                const sigName = item.signal;
                if (signalNames.has(sigName)) {
                    const sigComp = getComp("signal", sigName);
                    if (sigComp) {
                        addUnique(actionRel.onSignals, { component: sigComp, type: "signal", name: sigName });
                        const sigRel = getOrCreate(sigComp, "signal", sigName);
                        addUnique(sigRel.signalListenedByActions, { component: actionComp, type: "action", name: action.name });
                    }
                }
            }
            if (item.type === "ActionEmitsSignalClause") {
                const sigName = item.signal;
                if (signalNames.has(sigName)) {
                    const sigComp = getComp("signal", sigName);
                    if (sigComp) {
                        addUnique(actionRel.emitsSignals, { component: sigComp, type: "signal", name: sigName });
                        const sigRel = getOrCreate(sigComp, "signal", sigName);
                        addUnique(sigRel.signalEmittedByActions, { component: actionComp, type: "action", name: action.name });
                    }
                }
            }
        }
    }
    // 7f. Operations → handles/calls endpoint refs
    for (const op of model.operations) {
        const opComp = getComp("operation", op.name);
        if (!opComp)
            continue;
        const opRel = getOrCreate(opComp, "operation", op.name);
        for (const item of op.body) {
            if (item.type === "OperationHandlesClause") {
                opRel.handlesEndpoints.push({
                    method: item.method,
                    path: item.path,
                    component: opComp,
                });
            }
            if (item.type === "OperationCallsClause") {
                opRel.callsEndpoints.push({
                    method: item.method,
                    path: item.path,
                    component: opComp,
                });
            }
        }
    }
    // 7g. Flows → handles endpoint refs
    for (const flow of model.flows) {
        const flowComp = getComp("flow", flow.name);
        if (!flowComp)
            continue;
        const flowRel = getOrCreate(flowComp, "flow", flow.name);
        for (const item of flow.body) {
            if (item.type === "OperationHandlesClause") {
                flowRel.handlesEndpoints.push({
                    method: item.method,
                    path: item.path,
                    component: flowComp,
                });
            }
        }
    }
    // 8. Inheritance relationships (extends/implements)
    const inheritableCollections = [
        { type: "element", items: model.elements },
        { type: "entity", items: model.entities },
        { type: "flow", items: model.flows },
        { type: "event", items: model.events },
        { type: "signal", items: model.signals },
        { type: "screen", items: model.screens },
    ];
    // Components have extends/implements on the component decl itself
    for (const comp of model.components) {
        const compName = comp.name;
        const compRel = getOrCreate(compName, "component", compName);
        if (comp.extends) {
            const parentName = comp.extends;
            const parentComp = model.components.find((c) => c.name === parentName);
            if (parentComp) {
                const parentCompName = parentComp.name;
                compRel.extendsParent = { component: parentCompName, type: "component", name: parentName };
                const parentRel = getOrCreate(parentCompName, "component", parentName);
                parentRel.extendedByChildren.push({ component: compName, type: "component", name: compName });
            }
        }
        if (comp.implements) {
            for (const ifaceName of comp.implements) {
                const ifaceComp = model.components.find((c) => c.name === ifaceName);
                if (ifaceComp) {
                    const ifaceCompName = ifaceComp.name;
                    compRel.implementsInterfaces.push({ component: ifaceCompName, type: "component", name: ifaceName });
                    const ifaceRel = getOrCreate(ifaceCompName, "component", ifaceName);
                    ifaceRel.implementedByConcretes.push({ component: compName, type: "component", name: compName });
                }
            }
        }
    }
    for (const { type, items } of inheritableCollections) {
        for (const item of items) {
            const itemComp = getComp(type, item.name);
            if (!itemComp)
                continue;
            const itemRel = getOrCreate(itemComp, type, item.name);
            if (item.extends) {
                const parentItem = items.find((i) => i.name === item.extends);
                if (parentItem) {
                    const parentComp = getComp(type, parentItem.name);
                    if (parentComp) {
                        itemRel.extendsParent = { component: parentComp, type, name: parentItem.name };
                        const parentRel = getOrCreate(parentComp, type, parentItem.name);
                        parentRel.extendedByChildren.push({ component: itemComp, type, name: item.name });
                    }
                }
            }
            if (item.implements) {
                for (const ifaceName of item.implements) {
                    const ifaceItem = items.find((i) => i.name === ifaceName);
                    if (ifaceItem) {
                        const ifaceComp = getComp(type, ifaceItem.name);
                        if (ifaceComp) {
                            itemRel.implementsInterfaces.push({ component: ifaceComp, type, name: ifaceItem.name });
                            const ifaceRel = getOrCreate(ifaceComp, type, ifaceItem.name);
                            ifaceRel.implementedByConcretes.push({ component: itemComp, type, name: item.name });
                        }
                    }
                }
            }
        }
    }
    // 7. Journeys → screen refs
    for (const journey of model.journeys) {
        const journeyComp = getComp("journey", journey.name);
        if (!journeyComp)
            continue;
        for (const step of journey.body) {
            if (step.type === "JourneyStep") {
                for (const screenName of [step.from, step.to]) {
                    if (screenName && screenName !== "end" && screenName !== "*") {
                        const screenComp = getComp("screen", screenName);
                        if (screenComp) {
                            // Note the connection (journeys reference screens)
                            getOrCreate(screenComp, "screen", screenName);
                        }
                    }
                }
            }
        }
    }
    return map;
}
function addUnique(arr, ref) {
    if (!arr.some((r) => r.component === ref.component && r.type === ref.type && r.name === ref.name)) {
        arr.push(ref);
    }
}
export { makeKey };
//# sourceMappingURL=relationships.js.map