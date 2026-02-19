/**
 * Build a map from "type:name" to component name.
 *
 * Strategy:
 * 1. Direct nesting: constructs inside comp.body -> direct assignment
 * 2. API name matching: "AuthAPI" -> "Auth", "PostsAPI" -> "Posts"
 * 3. Heuristic: assign entities/flows/events/rules/states to components
 *    based on which component's APIs, flows, or rules reference them most.
 * 4. Fallback: if still unassigned, use text-matching heuristics.
 */
export function buildConstructComponentMap(model) {
    const map = new Map();
    const componentNames = model.components.map((c) => c.name);
    // Pass 1: Direct nesting
    for (const comp of model.components) {
        for (const item of comp.body) {
            const type = declTypeToType(item.type);
            if (!type)
                continue;
            if (type === "api") {
                map.set(apiMapKey(item), comp.name);
            }
            else if (item.name) {
                map.set(`${type}:${item.name}`, comp.name);
            }
        }
    }
    const allConstructs = collectAllConstructNames(model);
    const unassigned = allConstructs.filter((key) => !map.has(key));
    if (unassigned.length === 0)
        return map;
    // Pass 2: API name -> component mapping
    const apiComponentMap = new Map();
    for (const api of model.apis) {
        const key = apiMapKey(api);
        if (map.has(key))
            continue;
        if (!api.name)
            continue;
        const apiName = api.name;
        for (const compName of componentNames) {
            if (apiName.toLowerCase().startsWith(compName.toLowerCase())) {
                map.set(key, compName);
                apiComponentMap.set(apiName, compName);
                break;
            }
        }
    }
    // Pass 3: Assign entities/enums based on API type references
    const entityScores = new Map();
    for (const api of model.apis) {
        const apiComp = map.get(apiMapKey(api));
        if (!apiComp)
            continue;
        for (const ep of api.endpoints) {
            const refs = [
                ...extractTypeRefs(ep.inputType || ep.body),
                ...extractTypeRefs(ep.returnType || ep.response),
            ];
            for (const ref of refs) {
                if (!map.has(`entity:${ref}`) && !map.has(`enum:${ref}`)) {
                    addScore(entityScores, ref, apiComp, 3);
                }
            }
        }
    }
    // Pass 4: Assign flows based on entity mentions in step text
    const flowScores = new Map();
    for (const flow of model.flows) {
        if (map.has(`flow:${flow.name}`))
            continue;
        for (const step of flow.body) {
            const text = step.action || step.expression || "";
            for (const entity of model.entities) {
                if (text.includes(entity.name)) {
                    const entityComp = map.get(`entity:${entity.name}`);
                    if (entityComp) {
                        addScore(flowScores, flow.name, entityComp, 2);
                    }
                    else {
                        const scores = entityScores.get(entity.name);
                        if (scores) {
                            for (const [comp, score] of scores) {
                                addScore(flowScores, flow.name, comp, score);
                            }
                        }
                    }
                }
            }
        }
        for (const param of flow.params) {
            for (const ref of extractTypeRefs(param)) {
                const entityComp = map.get(`entity:${ref}`) || map.get(`enum:${ref}`);
                if (entityComp) {
                    addScore(flowScores, flow.name, entityComp, 3);
                }
            }
        }
        if (flow.returnType) {
            for (const ref of extractTypeRefs(flow.returnType)) {
                const entityComp = map.get(`entity:${ref}`) || map.get(`enum:${ref}`);
                if (entityComp) {
                    addScore(flowScores, flow.name, entityComp, 3);
                }
            }
        }
    }
    // Assign entities/enums based on scores
    for (const entity of model.entities) {
        if (!map.has(`entity:${entity.name}`)) {
            const comp = getBestScore(entityScores, entity.name);
            if (comp)
                map.set(`entity:${entity.name}`, comp);
        }
    }
    for (const en of model.enums) {
        if (!map.has(`enum:${en.name}`)) {
            for (const entity of model.entities) {
                for (const field of entity.fields) {
                    const refs = extractTypeRefs(field.fieldType);
                    if (refs.includes(en.name)) {
                        const entityComp = map.get(`entity:${entity.name}`);
                        if (entityComp) {
                            map.set(`enum:${en.name}`, entityComp);
                            break;
                        }
                    }
                }
                if (map.has(`enum:${en.name}`))
                    break;
            }
        }
    }
    // Assign flows based on scores
    for (const flow of model.flows) {
        if (!map.has(`flow:${flow.name}`)) {
            const comp = getBestScore(flowScores, flow.name);
            if (comp)
                map.set(`flow:${flow.name}`, comp);
        }
    }
    // Pass 5: Assign remaining constructs via text heuristics
    for (const event of model.events) {
        if (map.has(`event:${event.name}`))
            continue;
        for (const entity of model.entities) {
            if (event.name.includes(entity.name)) {
                const entityComp = map.get(`entity:${entity.name}`);
                if (entityComp) {
                    map.set(`event:${event.name}`, entityComp);
                    break;
                }
            }
        }
    }
    for (const signal of model.signals) {
        if (map.has(`signal:${signal.name}`))
            continue;
        for (const entity of model.entities) {
            if (signal.name.includes(entity.name)) {
                const entityComp = map.get(`entity:${entity.name}`);
                if (entityComp) {
                    map.set(`signal:${signal.name}`, entityComp);
                    break;
                }
            }
        }
    }
    for (const state of model.states) {
        if (map.has(`state:${state.name}`))
            continue;
        const enumComp = map.get(`enum:${state.enumRef}`);
        if (enumComp) {
            map.set(`state:${state.name}`, enumComp);
        }
    }
    for (const rule of model.rules) {
        if (map.has(`rule:${rule.name}`))
            continue;
        const ruleScores = new Map();
        for (const clause of rule.body) {
            const text = clause.expression || clause.condition || clause.action || "";
            for (const entity of model.entities) {
                if (text.includes(entity.name)) {
                    const entityComp = map.get(`entity:${entity.name}`);
                    if (entityComp) {
                        ruleScores.set(entityComp, (ruleScores.get(entityComp) ?? 0) + 1);
                    }
                }
            }
        }
        if (ruleScores.size > 0) {
            const best = [...ruleScores.entries()].sort((a, b) => b[1] - a[1])[0][0];
            map.set(`rule:${rule.name}`, best);
        }
    }
    for (const journey of model.journeys) {
        if (map.has(`journey:${journey.name}`))
            continue;
        for (const step of journey.body) {
            if (step.type === "JourneyStep") {
                const from = step.from;
                if (from && from !== "*") {
                    const screenComp = map.get(`screen:${from}`);
                    if (screenComp) {
                        map.set(`journey:${journey.name}`, screenComp);
                        break;
                    }
                }
            }
        }
    }
    for (const op of model.operations) {
        if (map.has(`operation:${op.name}`))
            continue;
        const opScores = new Map();
        for (const param of op.params) {
            for (const ref of extractTypeRefs(param)) {
                const entityComp = map.get(`entity:${ref}`) || map.get(`enum:${ref}`);
                if (entityComp) {
                    opScores.set(entityComp, (opScores.get(entityComp) ?? 0) + 3);
                }
            }
        }
        if (op.returnType) {
            for (const ref of extractTypeRefs(op.returnType)) {
                const entityComp = map.get(`entity:${ref}`) || map.get(`enum:${ref}`);
                if (entityComp) {
                    opScores.set(entityComp, (opScores.get(entityComp) ?? 0) + 3);
                }
            }
        }
        for (const item of op.body) {
            const evName = item.event;
            if (evName) {
                const eventComp = map.get(`event:${evName}`);
                if (eventComp) {
                    opScores.set(eventComp, (opScores.get(eventComp) ?? 0) + 2);
                }
            }
        }
        if (opScores.size > 0) {
            const best = [...opScores.entries()].sort((a, b) => b[1] - a[1])[0][0];
            map.set(`operation:${op.name}`, best);
        }
    }
    for (const element of model.elements) {
        if (map.has(`element:${element.name}`))
            continue;
        for (const item of element.body) {
            if (item.type === "PropDecl") {
                const propType = item.propType;
                if (propType && propType.type === "ReferenceType") {
                    const entityComp = map.get(`entity:${propType.name}`);
                    if (entityComp) {
                        map.set(`element:${element.name}`, entityComp);
                        break;
                    }
                }
            }
        }
    }
    for (const action of model.actions) {
        if (map.has(`action:${action.name}`))
            continue;
        for (const item of action.body) {
            if (item.type === "ActionFromClause") {
                const screenComp = map.get(`screen:${item.screen}`);
                if (screenComp) {
                    map.set(`action:${action.name}`, screenComp);
                    break;
                }
            }
        }
    }
    // Final fallback: assign any still-unassigned to the first component
    if (componentNames.length > 0) {
        const fallback = componentNames[0];
        for (const key of allConstructs) {
            if (!map.has(key)) {
                map.set(key, fallback);
            }
        }
    }
    return map;
}
export function declTypeToType(declType) {
    const mapping = {
        ElementDecl: "element",
        EntityDecl: "entity",
        EnumDecl: "enum",
        FlowDecl: "flow",
        StateDecl: "state",
        EventDecl: "event",
        SignalDecl: "signal",
        RuleDecl: "rule",
        ScreenDecl: "screen",
        JourneyDecl: "journey",
        ApiDecl: "api",
        OperationDecl: "operation",
        ActionDecl: "action",
    };
    return mapping[declType] ?? null;
}
/**
 * Generate a unique map key for an API declaration.
 * APIs often have name=null (e.g. `api REST @prefix(/auth)` where "REST" is the style, not name).
 * We use style + @prefix to build a unique key: "api:REST:/clientes", "api:REST:/auth", etc.
 */
export function apiMapKey(api) {
    const label = api.name || api.style || "api";
    const prefix = api.decorators?.find((d) => d.name === "prefix");
    const prefixVal = prefix ? String(prefix.params?.[0]?.value ?? "") : "";
    return prefixVal ? `api:${label}:${prefixVal}` : `api:${label}`;
}
export function collectAllConstructNames(model) {
    const keys = [];
    for (const el of model.elements)
        keys.push(`element:${el.name}`);
    for (const e of model.entities)
        keys.push(`entity:${e.name}`);
    for (const e of model.enums)
        keys.push(`enum:${e.name}`);
    for (const f of model.flows)
        keys.push(`flow:${f.name}`);
    for (const s of model.states)
        keys.push(`state:${s.name}`);
    for (const e of model.events)
        keys.push(`event:${e.name}`);
    for (const s of model.signals)
        keys.push(`signal:${s.name}`);
    for (const a of model.apis)
        keys.push(apiMapKey(a));
    for (const r of model.rules)
        keys.push(`rule:${r.name}`);
    for (const s of model.screens)
        keys.push(`screen:${s.name}`);
    for (const j of model.journeys)
        keys.push(`journey:${j.name}`);
    for (const o of model.operations)
        keys.push(`operation:${o.name}`);
    for (const a of model.actions)
        keys.push(`action:${a.name}`);
    return keys;
}
export function extractTypeRefs(typeExpr) {
    if (!typeExpr)
        return [];
    switch (typeExpr.type) {
        case "ReferenceType":
            return [typeExpr.name];
        case "OptionalType":
        case "ArrayType":
            return extractTypeRefs(typeExpr.inner);
        case "UnionType":
            return (typeExpr.alternatives || []).flatMap(extractTypeRefs);
        default:
            return [];
    }
}
function addScore(scores, key, comp, points) {
    if (!scores.has(key))
        scores.set(key, new Map());
    const compScores = scores.get(key);
    compScores.set(comp, (compScores.get(comp) ?? 0) + points);
}
function getBestScore(scores, key) {
    const compScores = scores.get(key);
    if (!compScores || compScores.size === 0)
        return null;
    return [...compScores.entries()].sort((a, b) => b[1] - a[1])[0][0];
}
//# sourceMappingURL=component-map.js.map