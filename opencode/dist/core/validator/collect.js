/**
 * Collect all constructs from a document recursively,
 * flattening the hierarchy for validation purposes.
 */
export function collectModel(doc) {
    const model = {
        elements: [],
        entities: [],
        enums: [],
        flows: [],
        states: [],
        events: [],
        signals: [],
        apis: [],
        rules: [],
        deps: [],
        secrets: [],
        components: [],
        systems: [],
        screens: [],
        journeys: [],
        operations: [],
        actions: [],
        nodes: [],
    };
    function visit(items) {
        for (const item of items) {
            switch (item.type) {
                case "NodeDecl":
                    model.nodes.push(item);
                    break;
                case "SystemDecl":
                    model.systems.push(item);
                    visit(item.body);
                    break;
                case "ComponentDecl":
                    model.components.push(item);
                    visit(item.body);
                    break;
                case "ElementDecl":
                    model.elements.push(item);
                    break;
                case "EntityDecl":
                    model.entities.push(item);
                    break;
                case "EnumDecl":
                    model.enums.push(item);
                    break;
                case "FlowDecl":
                    model.flows.push(item);
                    break;
                case "StateDecl":
                    model.states.push(item);
                    break;
                case "EventDecl":
                    model.events.push(item);
                    break;
                case "SignalDecl":
                    model.signals.push(item);
                    break;
                case "ApiDecl":
                    model.apis.push(item);
                    break;
                case "RuleDecl":
                    model.rules.push(item);
                    break;
                case "DepDecl":
                    model.deps.push(item);
                    break;
                case "SecretDecl":
                    model.secrets.push(item);
                    break;
                case "ScreenDecl":
                    model.screens.push(item);
                    break;
                case "JourneyDecl":
                    model.journeys.push(item);
                    break;
                case "OperationDecl":
                    model.operations.push(item);
                    break;
                case "ActionDecl":
                    model.actions.push(item);
                    break;
                case "ErrorNode":
                    break;
            }
        }
    }
    visit(doc.body);
    return model;
}
/**
 * Get all known type names (entities + enums + events + primitive types).
 * Events are included because STREAM endpoints return event types.
 */
export function getKnownTypes(model) {
    const names = new Set([
        "string", "number", "boolean", "date", "datetime", "uuid", "void",
    ]);
    for (const e of model.entities)
        names.add(e.name);
    for (const e of model.enums)
        names.add(e.name);
    for (const e of model.events)
        names.add(e.name);
    return names;
}
/**
 * Get all known construct names (entities, enums, flows, events, components).
 */
export function getKnownNames(model) {
    const names = new Set();
    for (const el of model.elements)
        names.add(el.name);
    for (const e of model.entities)
        names.add(e.name);
    for (const e of model.enums)
        names.add(e.name);
    for (const f of model.flows)
        names.add(f.name);
    for (const e of model.events)
        names.add(e.name);
    for (const s of model.signals)
        names.add(s.name);
    for (const c of model.components)
        names.add(c.name);
    for (const s of model.screens)
        names.add(s.name);
    for (const j of model.journeys)
        names.add(j.name);
    for (const o of model.operations)
        names.add(o.name);
    for (const a of model.actions)
        names.add(a.name);
    return names;
}
//# sourceMappingURL=collect.js.map