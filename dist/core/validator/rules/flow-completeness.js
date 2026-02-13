import { collectModel, getKnownNames } from "../collect.js";
/**
 * FLOW_REF: Warns when flow steps reference entities/flows that don't exist
 * in the model. This is a soft check since step actions are semi-structured.
 */
export function flowCompleteness(doc) {
    const model = collectModel(doc);
    const knownNames = getKnownNames(model);
    const diagnostics = [];
    for (const flow of model.flows) {
        for (const item of flow.body) {
            if (item.type !== "FlowStep")
                continue;
            // Extract identifiers from action text that look like entity references
            // (PascalCase words that might be entity/enum names)
            const pascalRefs = item.action.match(/\b[A-Z][a-zA-Z0-9]*\b/g) || [];
            for (const ref of pascalRefs) {
                // Skip common words that aren't entity references
                if (["User", "Order", "Task", "Session", "Token"].includes(ref) && !knownNames.has(ref)) {
                    diagnostics.push({
                        code: "FLOW_REF",
                        severity: "warning",
                        message: `Flow '${flow.name}' step references '${ref}' which is not defined in the model`,
                        location: item.loc,
                    });
                }
            }
        }
    }
    return diagnostics;
}
//# sourceMappingURL=flow-completeness.js.map