import { collectModel } from "../../core/validator/collect.js";
import { generateTestContract, serializeTestContract, } from "../../core/contract/test-contract.js";
import { loadDocument } from "./common.js";
const VALID_LEVELS = new Set(["e2e", "integration", "unit", "contract", "all"]);
/**
 * Build a set of construct names owned by a given component.
 */
function getComponentConstructNames(doc, componentName) {
    const names = new Set();
    const lowerTarget = componentName.toLowerCase();
    function walkComponent(comp) {
        if (comp.name.toLowerCase() !== lowerTarget)
            return;
        for (const item of comp.body) {
            const name = item.name;
            if (name)
                names.add(name);
        }
    }
    for (const item of doc.body) {
        if (item.type === "SystemDecl") {
            for (const child of item.body) {
                if (child.type === "ComponentDecl")
                    walkComponent(child);
            }
        }
        else if (item.type === "ComponentDecl") {
            walkComponent(item);
        }
    }
    return names;
}
/**
 * Filter a CollectedModel to only include constructs owned by a component.
 */
function filterByComponent(model, names) {
    return {
        elements: model.elements.filter((e) => names.has(e.name)),
        entities: model.entities.filter((e) => names.has(e.name)),
        enums: model.enums.filter((e) => names.has(e.name)),
        flows: model.flows.filter((f) => names.has(f.name)),
        states: model.states.filter((s) => names.has(s.name)),
        events: model.events.filter((e) => names.has(e.name)),
        signals: model.signals.filter((s) => names.has(s.name)),
        apis: model.apis.filter((a) => names.has(a.name ?? "")),
        rules: model.rules.filter((r) => names.has(r.name)),
        screens: model.screens.filter((s) => names.has(s.name)),
        journeys: model.journeys.filter((j) => names.has(j.name)),
        operations: model.operations.filter((o) => names.has(o.name)),
        actions: model.actions.filter((a) => names.has(a.name)),
        deps: model.deps.filter((d) => names.has(d.target)),
        secrets: model.secrets.filter((s) => names.has(s.name)),
        components: model.components,
        systems: model.systems,
        nodes: model.nodes,
    };
}
export function handleTestContract(args) {
    const level = args.level ?? "all";
    if (!VALID_LEVELS.has(level)) {
        return {
            content: [{
                    type: "text",
                    text: `Invalid level '${level}'. Valid levels: ${[...VALID_LEVELS].join(", ")}`,
                }],
            isError: true,
        };
    }
    const { doc } = loadDocument(args.file, args.resolve_includes);
    const fullModel = collectModel(doc);
    let model = fullModel;
    if (args.component) {
        const names = getComponentConstructNames(doc, args.component);
        if (names.size === 0) {
            return {
                content: [{
                        type: "text",
                        text: `No component '${args.component}' found in the model`,
                    }],
                isError: true,
            };
        }
        model = filterByComponent(fullModel, names);
    }
    const contract = generateTestContract(model, level);
    const json = serializeTestContract(contract);
    return {
        content: [{ type: "text", text: json }],
    };
}
//# sourceMappingURL=test-contract.js.map