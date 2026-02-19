import { findNodeAtPosition, collectNamedNodes, toRange } from "../utils/position.js";
export function getDefinition(params, docManager) {
    const entry = docManager.getModel(params.textDocument.uri);
    if (!entry)
        return null;
    const node = findNodeAtPosition(entry.doc, params.position);
    if (!node)
        return null;
    // Look for a name to navigate to
    let targetName = null;
    if (node.type === "ReferenceType") {
        // Type reference like `field: User`
        targetName = node.name;
    }
    else if (node.type === "FieldDecl") {
        // If on a field, try to navigate to its type
        const ft = node.fieldType;
        if (ft?.type === "ReferenceType") {
            targetName = ft.name;
        }
    }
    else if (node.type === "UsesDecl") {
        // screen uses Element
        targetName = node.element;
    }
    else if (node.type === "ActionDecl") {
        // action -> flow target
        targetName = node.target;
    }
    else if (node.type === "ActionResult") {
        // | outcome -> Screen
        targetName = node.screen;
    }
    else if (node.type === "StateDecl") {
        // state : EnumRef
        targetName = node.enumRef;
    }
    else if (node.type === "StateTransition") {
        // Try from/to state names — they map to enum values, not separate constructs
        // More useful: navigate to the parent state's enum
        return null;
    }
    else if (node.type === "UsesDecl") {
        // uses Element -> alias — navigate to element definition
        targetName = node.element;
    }
    else if (node.type === "ActionFromClause") {
        // from ScreenName — navigate to the screen declaration
        targetName = node.screen;
    }
    else if (node.type === "ActionOnSignalClause") {
        // on Signal SomeSignal — navigate to the signal declaration
        targetName = node.signal;
    }
    else if (node.type === "ActionEmitsSignalClause") {
        // emits Signal SomeSignal — navigate to the signal declaration
        targetName = node.signal;
    }
    else if (node.type === "OperationHandlesClause" || node.type === "OperationCallsClause" || node.type === "ActionCallsClause") {
        // handles/calls METHOD /path — navigate to matching api endpoint
        // Since api endpoints are nested, find the api that contains a matching endpoint
        const method = node.method;
        const path = node.path;
        const namedNodes = collectNamedNodes(entry.doc);
        // Walk all nodes looking for ApiDecl with matching endpoint
        for (const { node: n } of namedNodes) {
            if (n.type === "ApiDecl") {
                const api = n;
                for (const ep of api.endpoints || []) {
                    if (ep.method === method && ep.path === path) {
                        return {
                            uri: params.textDocument.uri,
                            range: toRange(ep.loc),
                        };
                    }
                }
            }
        }
        return null;
    }
    else if (node.type === "ElementDecl" || node.type === "EntityDecl" || node.type === "FlowDecl" || node.type === "ScreenDecl" || node.type === "ComponentDecl" || node.type === "EventDecl" || node.type === "SignalDecl") {
        // Inheritance: extends/implements targets
        if (node.extends) {
            targetName = node.extends;
        }
        // For implements, try the first one (limitation: can't know which cursor is on)
        if (!targetName && node.implements?.length > 0) {
            targetName = node.implements[0];
        }
    }
    else if (node.type === "JourneyStep") {
        // Journey step references screens
        const step = node;
        // Try to figure out if cursor is on "from" or "to"
        // For simplicity, try both
        const namedNodes = collectNamedNodes(entry.doc);
        for (const { name, node: n } of namedNodes) {
            if (name === step.from || name === step.to) {
                return {
                    uri: params.textDocument.uri,
                    range: toRange(n.loc),
                };
            }
        }
        // Phase 2: cross-file search for JourneyStep
        for (const stepTarget of [step.from, step.to]) {
            if (stepTarget) {
                const crossFile = docManager.findCrossFileDefinition(params.textDocument.uri, stepTarget);
                if (crossFile) {
                    return { uri: crossFile.uri, range: toRange(crossFile.node.loc) };
                }
            }
        }
        return null;
    }
    if (!targetName)
        return null;
    // Phase 1: find the declaration in the current file
    const namedNodes = collectNamedNodes(entry.doc);
    for (const { name, node: n } of namedNodes) {
        if (name === targetName) {
            return {
                uri: params.textDocument.uri,
                range: toRange(n.loc),
            };
        }
    }
    // Phase 2: cross-file search
    const crossFile = docManager.findCrossFileDefinition(params.textDocument.uri, targetName);
    if (crossFile) {
        return { uri: crossFile.uri, range: toRange(crossFile.node.loc) };
    }
    return null;
}
//# sourceMappingURL=definition.js.map