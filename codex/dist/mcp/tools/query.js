import { collectModel } from "../../core/validator/collect.js";
import { generateContractFiltered, compactContract, } from "../../core/contract/index.js";
import { loadDocument } from "./common.js";
// Map AST node types to contract array keys
const DECL_TYPE_TO_KEY = {
    EntityDecl: "entities",
    EnumDecl: "enums",
    FlowDecl: "flows",
    StateDecl: "states",
    EventDecl: "events",
    SignalDecl: "signals",
    ApiDecl: "apis",
    RuleDecl: "rules",
    ScreenDecl: "screens",
    JourneyDecl: "journeys",
    OperationDecl: "operations",
    ActionDecl: "actions",
    DepDecl: "deps",
    SecretDecl: "secrets",
};
// User-facing type names to CollectedModel array keys
const TYPE_FILTER_MAP = {
    entity: "entities",
    enum: "enums",
    flow: "flows",
    state: "states",
    event: "events",
    signal: "signals",
    api: "apis",
    rule: "rules",
    screen: "screens",
    journey: "journeys",
    operation: "operations",
    action: "actions",
    dep: "deps",
    secret: "secrets",
    node: "nodes",
};
/**
 * Build a map from construct name to component name by walking the AST directly.
 */
function buildComponentOwnership(doc) {
    const map = new Map();
    function walkComponent(comp) {
        for (const item of comp.body) {
            const key = DECL_TYPE_TO_KEY[item.type];
            if (!key)
                continue;
            const name = item.name;
            const label = name ?? `api:${item.style ?? "unknown"}`;
            map.set(`${key}:${label}`, comp.name);
        }
    }
    for (const item of doc.body) {
        if (item.type === "SystemDecl") {
            for (const child of item.body) {
                if (child.type === "ComponentDecl") {
                    walkComponent(child);
                }
            }
        }
        else if (item.type === "ComponentDecl") {
            walkComponent(item);
        }
    }
    return map;
}
/**
 * Filter a CollectedModel BEFORE generating the contract.
 * This avoids generating contracts for the entire model and then discarding most of it.
 */
function filterCollectedModel(model, ownership, componentFilter, typeFilter, nameFilter) {
    let totalMatches = 0;
    function shouldInclude(collectionKey, itemName) {
        if (componentFilter) {
            const lookupKey = `${collectionKey}:${itemName ?? "unknown"}`;
            const owner = ownership.get(lookupKey);
            if (!owner || owner.toLowerCase() !== componentFilter)
                return false;
        }
        if (nameFilter) {
            if (!itemName || !itemName.toLowerCase().includes(nameFilter))
                return false;
        }
        return true;
    }
    function filterArray(items, collectionKey, filterType, targetType) {
        if (filterType && filterType !== targetType)
            return [];
        const filtered = items.filter(item => shouldInclude(collectionKey, item.name));
        totalMatches += filtered.length;
        return filtered;
    }
    const filteredModel = {
        elements: filterArray(model.elements, "elements", typeFilter && TYPE_FILTER_MAP[typeFilter], "elements"),
        entities: filterArray(model.entities, "entities", typeFilter && TYPE_FILTER_MAP[typeFilter], "entities"),
        enums: filterArray(model.enums, "enums", typeFilter && TYPE_FILTER_MAP[typeFilter], "enums"),
        flows: filterArray(model.flows, "flows", typeFilter && TYPE_FILTER_MAP[typeFilter], "flows"),
        states: filterArray(model.states, "states", typeFilter && TYPE_FILTER_MAP[typeFilter], "states"),
        events: filterArray(model.events, "events", typeFilter && TYPE_FILTER_MAP[typeFilter], "events"),
        signals: filterArray(model.signals, "signals", typeFilter && TYPE_FILTER_MAP[typeFilter], "signals"),
        apis: (() => {
            const targetKey = typeFilter ? TYPE_FILTER_MAP[typeFilter] : null;
            if (targetKey && targetKey !== "apis")
                return [];
            const filtered = model.apis.filter(api => {
                const name = api.name ?? `api:${api.style ?? "unknown"}`;
                return shouldInclude("apis", name);
            });
            totalMatches += filtered.length;
            return filtered;
        })(),
        rules: filterArray(model.rules, "rules", typeFilter && TYPE_FILTER_MAP[typeFilter], "rules"),
        screens: filterArray(model.screens, "screens", typeFilter && TYPE_FILTER_MAP[typeFilter], "screens"),
        journeys: filterArray(model.journeys, "journeys", typeFilter && TYPE_FILTER_MAP[typeFilter], "journeys"),
        operations: filterArray(model.operations, "operations", typeFilter && TYPE_FILTER_MAP[typeFilter], "operations"),
        actions: filterArray(model.actions, "actions", typeFilter && TYPE_FILTER_MAP[typeFilter], "actions"),
        deps: (() => {
            const targetKey = typeFilter ? TYPE_FILTER_MAP[typeFilter] : null;
            if (targetKey && targetKey !== "deps")
                return [];
            const filtered = model.deps.filter(d => shouldInclude("deps", d.target));
            totalMatches += filtered.length;
            return filtered;
        })(),
        secrets: (() => {
            const targetKey = typeFilter ? TYPE_FILTER_MAP[typeFilter] : null;
            if (targetKey && targetKey !== "secrets")
                return [];
            const filtered = model.secrets.filter(s => shouldInclude("secrets", s.name));
            totalMatches += filtered.length;
            return filtered;
        })(),
        nodes: (() => {
            const targetKey = typeFilter ? TYPE_FILTER_MAP[typeFilter] : null;
            if (targetKey && targetKey !== "nodes")
                return [];
            const filtered = model.nodes.filter(n => shouldInclude("nodes", n.name));
            totalMatches += filtered.length;
            return filtered;
        })(),
        // Keep full collections for reference (not filtered)
        components: model.components,
        systems: model.systems,
    };
    return { filteredModel, totalMatches };
}
export function handleQuery(args) {
    const { doc } = loadDocument(args.file, args.resolve_includes);
    const model = collectModel(doc);
    const ownership = buildComponentOwnership(doc);
    const componentFilter = args.component?.toLowerCase() ?? null;
    const typeFilter = args.type?.toLowerCase() ?? null;
    const nameFilter = args.name?.toLowerCase() ?? null;
    // Validate type filter
    if (typeFilter && !TYPE_FILTER_MAP[typeFilter]) {
        return {
            content: [
                {
                    type: "text",
                    text: `Unknown type filter: "${args.type}". Valid types: ${Object.keys(TYPE_FILTER_MAP).join(", ")}`,
                },
            ],
            isError: true,
        };
    }
    // Phase 2 optimization: filter BEFORE generating contract
    const { filteredModel, totalMatches } = filterCollectedModel(model, ownership, componentFilter, typeFilter, nameFilter);
    // Generate contract only for filtered items, using full model for inheritance
    const contract = generateContractFiltered(model, filteredModel);
    if (args.compact) {
        compactContract(contract);
    }
    // Build result — strip empty arrays
    const result = {
        query: {
            component: args.component ?? null,
            type: args.type ?? null,
            name: args.name ?? null,
        },
        totalMatches,
    };
    for (const [key, value] of Object.entries(contract)) {
        if (key === "version")
            continue;
        if (Array.isArray(value) && value.length > 0) {
            result[key] = value;
        }
    }
    // nodes are system-level constructs not in the contract — add separately
    if (filteredModel.nodes.length > 0) {
        result["nodes"] = filteredModel.nodes.map((n) => ({
            name: n.name,
            decorators: n.decorators.map((d) => {
                if (d.params.length === 0)
                    return `@${d.name}`;
                return `@${d.name}(${d.params.map((p) => p.value).join(", ")})`;
            }),
        }));
    }
    return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
}
//# sourceMappingURL=query.js.map