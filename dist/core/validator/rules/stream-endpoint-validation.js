import { collectModel } from "../collect.js";
/**
 * STREAM_HAS_INPUT: STREAM endpoint must not have input type (subscriptions are read-only).
 * STREAM_INVALID_RETURN: STREAM endpoint must return a declared event type.
 * STREAM_MISSING_RETURN: STREAM endpoint must have a return type.
 */
export function streamEndpointValidation(doc) {
    const model = collectModel(doc);
    const diagnostics = [];
    const eventNames = new Set(model.events.map((e) => e.name));
    for (const api of model.apis) {
        for (const ep of api.endpoints) {
            if (ep.method !== "STREAM")
                continue;
            // Check for input (STREAM must not have input)
            if (ep.type === "ApiEndpointSimple" && ep.inputType) {
                diagnostics.push({
                    code: "STREAM_HAS_INPUT",
                    severity: "error",
                    message: `STREAM endpoint '${ep.path}' must not have an input type (subscriptions are read-only)`,
                    location: ep.loc,
                    help: "Remove the input type: STREAM /path -> EventType",
                });
            }
            if (ep.type === "ApiEndpointExpanded" && ep.body) {
                diagnostics.push({
                    code: "STREAM_HAS_INPUT",
                    severity: "error",
                    message: `STREAM endpoint '${ep.path}' must not have a body (subscriptions are read-only)`,
                    location: ep.loc,
                    help: "Remove the body property",
                });
            }
            // Check for return type
            const returnType = ep.type === "ApiEndpointSimple" ? ep.returnType :
                ep.type === "ApiEndpointExpanded" ? ep.response : null;
            if (!returnType) {
                diagnostics.push({
                    code: "STREAM_MISSING_RETURN",
                    severity: "error",
                    message: `STREAM endpoint '${ep.path}' must have a return type (the event it delivers)`,
                    location: ep.loc,
                    help: "Add a return type: STREAM /path -> EventType",
                });
                continue;
            }
            // Check that return type references a declared event
            const refName = extractRefName(returnType);
            if (refName && !eventNames.has(refName)) {
                diagnostics.push({
                    code: "STREAM_INVALID_RETURN",
                    severity: "error",
                    message: `STREAM endpoint '${ep.path}' returns '${refName}' which is not a declared event`,
                    location: ep.loc,
                    help: `Declare 'event ${refName} { ... }' or reference an existing event`,
                });
            }
        }
    }
    return diagnostics;
}
function extractRefName(typeExpr) {
    if (!typeExpr)
        return null;
    switch (typeExpr.type) {
        case "ReferenceType":
            return typeExpr.name;
        case "ArrayType":
        case "OptionalType":
            return extractRefName(typeExpr.inner);
        default:
            return null;
    }
}
//# sourceMappingURL=stream-endpoint-validation.js.map