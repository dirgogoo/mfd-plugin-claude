import { collectModel } from "../../core/validator/collect.js";
import { generateContract, } from "../../core/contract/index.js";
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
// User-facing type names to contract keys
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
};
const CONSTRUCT_KEYS = Object.values(TYPE_FILTER_MAP);
/**
 * Build a map from "contractKey:name" to component name by walking the AST directly.
 * This preserves the hierarchy without the heuristics of flat-model mapping.
 */
function buildComponentOwnership(doc) {
    const map = new Map();
    function walkComponent(comp) {
        for (const item of comp.body) {
            const key = DECL_TYPE_TO_KEY[item.type];
            if (!key)
                continue;
            const name = item.name;
            // For ApiDecl, name can be null — use prefix or index-based key
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
 * Get the name of a contract item (most have .name, apis may not).
 */
function getContractItemName(item) {
    if (typeof item.name === "string")
        return item.name;
    return null;
}
export function handleQuery(args) {
    const { doc } = loadDocument(args.file, args.resolve_includes);
    const model = collectModel(doc);
    const contract = generateContract(model);
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
    // Determine which contract keys to check
    const keysToCheck = typeFilter
        ? [TYPE_FILTER_MAP[typeFilter]]
        : CONSTRUCT_KEYS;
    // Filter the contract
    const filtered = {};
    let totalMatches = 0;
    for (const key of keysToCheck) {
        if (key === "version")
            continue;
        const items = contract[key];
        if (!Array.isArray(items))
            continue;
        const matching = items.filter((item) => {
            const record = item;
            const itemName = getContractItemName(record);
            // Filter by component
            if (componentFilter) {
                const lookupKey = `${key}:${itemName ?? `api:${record.style ?? "unknown"}`}`;
                const owner = ownership.get(lookupKey);
                if (!owner || owner.toLowerCase() !== componentFilter)
                    return false;
            }
            // Filter by name (substring match, case-insensitive)
            if (nameFilter) {
                if (!itemName || !itemName.toLowerCase().includes(nameFilter))
                    return false;
            }
            return true;
        });
        if (matching.length > 0) {
            filtered[key] = matching;
            totalMatches += matching.length;
        }
    }
    const result = {
        query: {
            component: args.component ?? null,
            type: args.type ?? null,
            name: args.name ?? null,
        },
        totalMatches,
        ...filtered,
    };
    return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
}
//# sourceMappingURL=query.js.map