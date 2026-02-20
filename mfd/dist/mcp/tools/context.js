import { collectModel } from "../../core/validator/collect.js";
import { buildConstructComponentMap, computeRelationships, makeKey, } from "../../core/relationships/index.js";
import { generateContractFiltered, compactContract, } from "../../core/contract/index.js";
import { loadDocument } from "./common.js";
/**
 * Given a construct name, return it + all related constructs via BFS on the relationship graph.
 */
export function handleContext(args) {
    const { doc } = loadDocument(args.file, args.resolve_includes);
    const model = collectModel(doc);
    const constructComponentMap = buildConstructComponentMap(model);
    const relationships = computeRelationships(model, constructComponentMap);
    const depth = Math.min(Math.max(args.depth ?? 1, 1), 3);
    const nameFilter = args.name.toLowerCase();
    const typeFilter = args.type?.toLowerCase() ?? null;
    // Find target construct(s) by name + optional type
    const targets = [];
    for (const [mapKey, component] of constructComponentMap) {
        const colonIdx = mapKey.indexOf(":");
        if (colonIdx < 0)
            continue;
        const cType = mapKey.substring(0, colonIdx);
        const cName = mapKey.substring(colonIdx + 1);
        if (cName.toLowerCase() === nameFilter || cName.toLowerCase().includes(nameFilter)) {
            if (!typeFilter || cType === typeFilter) {
                const relKey = makeKey(component, cType, cName);
                targets.push({ key: relKey, component, type: cType, name: cName });
            }
        }
    }
    if (targets.length === 0) {
        return {
            content: [{
                    type: "text",
                    text: `No construct found matching name="${args.name}"${typeFilter ? ` type="${typeFilter}"` : ""}`,
                }],
            isError: true,
        };
    }
    // BFS to collect related constructs
    const visited = new Set();
    const queue = [];
    for (const t of targets) {
        visited.add(t.key);
        queue.push({ key: t.key, currentDepth: 0 });
    }
    while (queue.length > 0) {
        const { key, currentDepth } = queue.shift();
        if (currentDepth >= depth)
            continue;
        const rels = relationships.get(key);
        if (!rels)
            continue;
        const neighbors = extractNeighborKeys(rels);
        for (const nKey of neighbors) {
            if (!visited.has(nKey)) {
                visited.add(nKey);
                queue.push({ key: nKey, currentDepth: currentDepth + 1 });
            }
        }
    }
    // Collect construct names from visited keys
    const constructNames = new Set();
    for (const key of visited) {
        // key format: "component:type:name"
        const parts = key.split(":");
        if (parts.length >= 3) {
            const cType = parts[1];
            const cName = parts.slice(2).join(":");
            constructNames.add(`${cType}:${cName}`);
        }
    }
    // Filter model to only include collected constructs
    const filteredModel = filterModelByNames(model, constructNames);
    const contract = generateContractFiltered(model, filteredModel);
    if (args.compact) {
        compactContract(contract);
    }
    const result = {
        targets: targets.map(t => ({ type: t.type, name: t.name, component: t.component })),
        depth,
        totalRelated: visited.size - targets.length,
        ...contract,
    };
    return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
}
/**
 * Extract neighbor keys from a Relationships object by scanning all ConstructRef arrays.
 */
function extractNeighborKeys(rels) {
    const keys = [];
    function addRef(ref) {
        if (ref)
            keys.push(makeKey(ref.component, ref.type, ref.name));
    }
    function addRefs(refs) {
        for (const r of refs)
            addRef(r);
    }
    addRefs(rels.usedByFlows);
    addRefs(rels.governedByStates);
    addRefs(rels.governedByRules);
    addRefs(rels.emitsEvents);
    addRefs(rels.actionSources);
    addRefs(rels.calledByActions);
    addRefs(rels.involvedEntities);
    addRefs(rels.involvedEvents);
    addRef(rels.targetFlow);
    addRef(rels.enumRef);
    addRefs(rels.triggeredByEvents);
    addRefs(rels.triggersStates);
    addRefs(rels.usesOperations);
    addRefs(rels.usedByOperations);
    addRefs(rels.triggeredByRules);
    addRefs(rels.triggersOperations);
    addRefs(rels.enforcesRules);
    addRefs(rels.enforcedByOperations);
    addRefs(rels.emitsSignals);
    addRefs(rels.onSignals);
    addRefs(rels.signalEmittedByActions);
    addRefs(rels.signalListenedByActions);
    addRef(rels.extendsParent);
    addRefs(rels.extendedByChildren);
    addRefs(rels.implementsInterfaces);
    addRefs(rels.implementedByConcretes);
    // EntityFieldRefs
    for (const r of rels.referencedByEntities) {
        // Find the entity in constructComponentMap
        keys.push(makeKey(r.component, "entity", r.entity));
    }
    // ApiRefs
    for (const r of rels.exposedByApi) {
        keys.push(makeKey(r.component, "api", `${r.method}:${r.path}`));
    }
    for (const r of rels.handlesEndpoints) {
        keys.push(makeKey(r.component, "api", `${r.method}:${r.path}`));
    }
    for (const r of rels.callsEndpoints) {
        keys.push(makeKey(r.component, "api", `${r.method}:${r.path}`));
    }
    return keys;
}
/**
 * Filter a CollectedModel to only include constructs whose "type:name" is in the set.
 */
function filterModelByNames(model, names) {
    return {
        elements: model.elements.filter(e => names.has(`element:${e.name}`)),
        entities: model.entities.filter(e => names.has(`entity:${e.name}`)),
        enums: model.enums.filter(e => names.has(`enum:${e.name}`)),
        flows: model.flows.filter(f => names.has(`flow:${f.name}`)),
        states: model.states.filter(s => names.has(`state:${s.name}`)),
        events: model.events.filter(e => names.has(`event:${e.name}`)),
        signals: model.signals.filter(s => names.has(`signal:${s.name}`)),
        apis: model.apis.filter(a => {
            const name = a.name;
            if (name)
                return names.has(`api:${name}`);
            return false;
        }),
        rules: model.rules.filter(r => names.has(`rule:${r.name}`)),
        deps: model.deps,
        secrets: model.secrets,
        components: model.components,
        systems: model.systems,
        nodes: model.nodes,
        screens: model.screens.filter(s => names.has(`screen:${s.name}`)),
        journeys: model.journeys.filter(j => names.has(`journey:${j.name}`)),
        operations: model.operations.filter(o => names.has(`operation:${o.name}`)),
        actions: model.actions.filter(a => names.has(`action:${a.name}`)),
    };
}
//# sourceMappingURL=context.js.map