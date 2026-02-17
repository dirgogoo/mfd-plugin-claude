/**
 * Data layer: loads an MFD file and produces a complete ModelSnapshot
 * with parsed model, all 6 diagrams, stats, relationships, and validation results.
 *
 * Handles both nested models (constructs inside component blocks) and
 * flat models (constructs at top level, outside component blocks).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "../core/parser/index.js";
import { resolveFile } from "../core/resolver/index.js";
import { collectModel } from "../core/validator/collect.js";
import { validate } from "../core/validator/index.js";
import { computeStats } from "../core/utils/stats.js";
import { renderComponentDiagram, renderEntityDiagram, renderStateDiagram, renderFlowDiagram, renderScreenDiagram, renderJourneyDiagram, } from "../mcp/tools/render.js";
import { computeRelationships } from "./relationships.js";
export function loadModelSnapshot(filePath, resolveIncludes = false) {
    const t0 = performance.now();
    const absPath = resolve(filePath);
    const source = readFileSync(absPath, "utf-8");
    let doc;
    const t1 = performance.now();
    if (resolveIncludes) {
        const result = resolveFile(absPath);
        if (result.errors.length > 0) {
            throw new Error(`Resolution errors:\n${result.errors.map((e) => e.message).join("\n")}`);
        }
        doc = result.document;
    }
    else {
        doc = parse(source, { source: absPath });
    }
    const tParse = performance.now();
    const model = collectModel(doc);
    const tCollect = performance.now();
    const stats = computeStats(model, source);
    const tStats = performance.now();
    // Lazy diagram generation: only render each diagram type on first access.
    // Saves ~50-200ms per unused diagram type.
    const diagramRenderers = {
        component: () => renderComponentDiagram(model),
        entity: () => renderEntityDiagram(model),
        state: () => renderStateDiagram(model),
        flow: () => renderFlowDiagram(model),
        screen: () => renderScreenDiagram(model),
        journey: () => renderJourneyDiagram(model),
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
    // Validation
    const valResult = validate(doc);
    const tValidate = performance.now();
    const validation = {
        errors: valResult.errors.map((e) => ({
            message: e.message,
            line: e.location?.start?.line,
            column: e.location?.start?.column,
        })),
        warnings: valResult.warnings.map((w) => ({
            message: w.message,
            line: w.location?.start?.line,
            column: w.location?.start?.column,
        })),
    };
    // Build central construct→component mapping (handles top-level constructs)
    const constructComponentMap = buildConstructComponentMap(model);
    const tMapping = performance.now();
    // Compute relationships using the map
    const relationships = computeRelationships(model, constructComponentMap);
    const tRelationships = performance.now();
    // Build component info using the map
    const components = buildComponentInfos(model, stats, constructComponentMap);
    // Extract system name and version
    let systemName = "MFD Model";
    let systemVersion = null;
    if (model.systems.length > 0) {
        systemName = model.systems[0].name;
        const versionDec = model.systems[0].decorators?.find((d) => d.name === "version");
        if (versionDec && versionDec.params[0]) {
            systemVersion = String(versionDec.params[0].value);
        }
    }
    const tEnd = performance.now();
    console.log(`[MFD Scope] Snapshot built in ${(tEnd - t0).toFixed(0)}ms` +
        ` (parse:${(tParse - t1).toFixed(0)} collect:${(tCollect - tParse).toFixed(0)}` +
        ` stats:${(tStats - tCollect).toFixed(0)} validate:${(tValidate - tStats).toFixed(0)}` +
        ` mapping:${(tMapping - tValidate).toFixed(0)} rels:${(tRelationships - tMapping).toFixed(0)}` +
        ` diagrams:lazy)`);
    return {
        systemName,
        systemVersion,
        model,
        diagrams,
        stats,
        validation,
        relationships,
        components,
        constructComponentMap,
        timestamp: Date.now(),
        filePath: absPath,
    };
}
// ===== Construct → Component Mapping =====
/**
 * Build a map from "type:name" → component name.
 *
 * Strategy:
 * 1. Direct nesting: constructs inside comp.body → direct assignment
 * 2. API name matching: "AuthAPI" → "Auth", "PostsAPI" → "Posts"
 * 3. Heuristic: assign entities/flows/events/rules/states to components
 *    based on which component's APIs, flows, or rules reference them most.
 * 4. Fallback: if still unassigned, use text-matching heuristics.
 */
function buildConstructComponentMap(model) {
    const map = new Map();
    const componentNames = model.components.map((c) => c.name);
    // Pass 1: Direct nesting — constructs inside component bodies
    for (const comp of model.components) {
        for (const item of comp.body) {
            const type = declTypeToType(item.type);
            if (!type)
                continue;
            // APIs need special handling: name is often null (style=REST, name=null),
            // and multiple APIs can share the same style, so we use prefix-based keys
            if (type === "api") {
                map.set(apiMapKey(item), comp.name);
            }
            else if (item.name) {
                map.set(`${type}:${item.name}`, comp.name);
            }
        }
    }
    // Check if we have unassigned constructs (flat model)
    const allConstructs = collectAllConstructNames(model);
    const unassigned = allConstructs.filter((key) => !map.has(key));
    if (unassigned.length === 0)
        return map; // All nested, nothing to do
    // Pass 2: API name → component mapping
    // Convention: API named "AuthAPI" → component "Auth", "PostsAPI" → "Posts"
    const apiComponentMap = new Map();
    for (const api of model.apis) {
        const key = apiMapKey(api);
        if (map.has(key))
            continue; // Already assigned
        if (!api.name)
            continue; // Anonymous — can only be assigned via nesting (Pass 1)
        // Try matching API name to component
        const apiName = api.name;
        for (const compName of componentNames) {
            // "AuthAPI" contains "Auth", "PostsAPI" contains "Posts"
            if (apiName.toLowerCase().startsWith(compName.toLowerCase())) {
                map.set(key, compName);
                apiComponentMap.set(apiName, compName);
                break;
            }
        }
    }
    // Pass 3: Assign entities/enums based on API type references
    // If an API belonging to component X references entity Y in input/output types, assign Y to X
    const entityScores = new Map(); // entity → { comp → score }
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
    const flowScores = new Map(); // flow → { comp → score }
    for (const flow of model.flows) {
        if (map.has(`flow:${flow.name}`))
            continue;
        // Check flow steps for entity names
        for (const step of flow.body) {
            const text = step.action || step.expression || "";
            for (const entity of model.entities) {
                if (text.includes(entity.name)) {
                    // If entity is already assigned, this flow likely belongs to same component
                    const entityComp = map.get(`entity:${entity.name}`);
                    if (entityComp) {
                        addScore(flowScores, flow.name, entityComp, 2);
                    }
                    else {
                        // Score based on entity-component scores
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
        // Check flow params/return types for entity refs
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
            // Enums often relate to entities that reference them
            // Check which entity fields reference this enum
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
    // Events: match by entity name mentions in fields
    for (const event of model.events) {
        if (map.has(`event:${event.name}`))
            continue;
        // Check event name for component/entity clues
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
    // Signals: match by name containing entity or component name
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
    // States: match via enumRef → enum → component
    for (const state of model.states) {
        if (map.has(`state:${state.name}`))
            continue;
        const enumComp = map.get(`enum:${state.enumRef}`);
        if (enumComp) {
            map.set(`state:${state.name}`, enumComp);
        }
    }
    // Rules: match by entity name mentions in when/then clauses
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
    // Journeys: match by screen references
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
    // Operations: match by entity/event refs in params, return types, and emits/on
    for (const op of model.operations) {
        if (map.has(`operation:${op.name}`))
            continue;
        const opScores = new Map();
        // Check params/return for entity refs
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
        // Check emits/on for event refs
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
    // Elements: match by prop type references or by screen usage
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
    // Actions: match by `from` screen reference
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
function declTypeToType(declType) {
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
function apiMapKey(api) {
    const label = api.name || api.style || "api";
    const prefix = api.decorators?.find((d) => d.name === "prefix");
    const prefixVal = prefix ? String(prefix.params?.[0]?.value ?? "") : "";
    return prefixVal ? `api:${label}:${prefixVal}` : `api:${label}`;
}
function collectAllConstructNames(model) {
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
function extractTypeRefs(typeExpr) {
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
// ===== Component Info Builder =====
function buildComponentInfos(model, stats, constructComponentMap) {
    return model.components.map((comp) => {
        const statusDec = comp.decorators?.find((d) => d.name === "status");
        const status = statusDec ? String(statusDec.params[0]?.value ?? null) : null;
        const counts = {};
        // Count constructs assigned to this component via the map
        const countedKeys = new Set();
        for (const [key, compName] of constructComponentMap) {
            if (compName !== comp.name)
                continue;
            countedKeys.add(key);
            const [type] = key.split(":");
            switch (type) {
                case "element":
                    counts.elements = (counts.elements ?? 0) + 1;
                    break;
                case "entity":
                    counts.entities = (counts.entities ?? 0) + 1;
                    break;
                case "enum":
                    counts.enums = (counts.enums ?? 0) + 1;
                    break;
                case "flow":
                    counts.flows = (counts.flows ?? 0) + 1;
                    break;
                case "state":
                    counts.states = (counts.states ?? 0) + 1;
                    break;
                case "event":
                    counts.events = (counts.events ?? 0) + 1;
                    break;
                case "signal":
                    counts.signals = (counts.signals ?? 0) + 1;
                    break;
                case "rule":
                    counts.rules = (counts.rules ?? 0) + 1;
                    break;
                case "screen":
                    counts.screens = (counts.screens ?? 0) + 1;
                    break;
                case "journey":
                    counts.journeys = (counts.journeys ?? 0) + 1;
                    break;
                case "api":
                    counts.apis = (counts.apis ?? 0) + 1;
                    break;
                case "operation":
                    counts.operations = (counts.operations ?? 0) + 1;
                    break;
                case "action":
                    counts.actions = (counts.actions ?? 0) + 1;
                    break;
            }
        }
        // Also count constructs in comp.body that the ccMap assigned to a different
        // component (happens with @interface + implements pattern where names collide)
        for (const item of comp.body) {
            const type = declTypeToType(item.type);
            if (!type)
                continue;
            const name = item.name;
            if (!name)
                continue;
            const key = type === "api" ? apiMapKey(item) : `${type}:${name}`;
            if (countedKeys.has(key))
                continue; // already counted via ccMap
            switch (type) {
                case "element":
                    counts.elements = (counts.elements ?? 0) + 1;
                    break;
                case "entity":
                    counts.entities = (counts.entities ?? 0) + 1;
                    break;
                case "enum":
                    counts.enums = (counts.enums ?? 0) + 1;
                    break;
                case "flow":
                    counts.flows = (counts.flows ?? 0) + 1;
                    break;
                case "state":
                    counts.states = (counts.states ?? 0) + 1;
                    break;
                case "event":
                    counts.events = (counts.events ?? 0) + 1;
                    break;
                case "signal":
                    counts.signals = (counts.signals ?? 0) + 1;
                    break;
                case "rule":
                    counts.rules = (counts.rules ?? 0) + 1;
                    break;
                case "screen":
                    counts.screens = (counts.screens ?? 0) + 1;
                    break;
                case "journey":
                    counts.journeys = (counts.journeys ?? 0) + 1;
                    break;
                case "api":
                    counts.apis = (counts.apis ?? 0) + 1;
                    break;
                case "operation":
                    counts.operations = (counts.operations ?? 0) + 1;
                    break;
                case "action":
                    counts.actions = (counts.actions ?? 0) + 1;
                    break;
            }
        }
        // Count API endpoints
        if (counts.apis) {
            let endpoints = 0;
            for (const api of model.apis) {
                if (constructComponentMap.get(apiMapKey(api)) === comp.name) {
                    endpoints += api.endpoints.length;
                }
            }
            counts.endpoints = endpoints;
        }
        const compStats = stats.componentCompleteness.find((cs) => cs.name === comp.name);
        const implDone = compStats?.implDone ?? 0;
        const implTotal = compStats?.implTotal ?? 0;
        // If stats reports 0 but we have constructs, use construct count as total
        const effectiveTotal = implTotal > 0 ? implTotal : Object.values(counts).reduce((sum, n) => sum + n, 0);
        return { name: comp.name, status, constructCounts: counts, implDone, implTotal: effectiveTotal };
    });
}
//# sourceMappingURL=data.js.map