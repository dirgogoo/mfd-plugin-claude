import { collectModel, getKnownNames } from "../collect.js";
/**
 * FLOW_REF: Warns when flow steps reference entities/flows that don't exist
 * in the model. This is a soft check since step actions are semi-structured.
 *
 * FLOW_UNREACHABLE_STEP: Warns when a step appears after a `return` statement,
 * making it unreachable.
 */
export function flowCompleteness(doc) {
    const model = collectModel(doc);
    const knownNames = getKnownNames(model);
    const diagnostics = [];
    for (const flow of model.flows) {
        let foundReturn = false;
        for (const item of flow.body) {
            if (item.type !== "FlowStep")
                continue;
            // FLOW_UNREACHABLE_STEP: step after return
            if (foundReturn) {
                diagnostics.push({
                    code: "FLOW_UNREACHABLE_STEP",
                    severity: "warning",
                    message: `Flow '${flow.name}' has unreachable step '${item.action}' after return`,
                    location: item.loc,
                    help: "Move this step before the return statement or remove it",
                });
                continue;
            }
            // Detect return statements (action starts with "return")
            if (/^return\b/i.test(item.action)) {
                foundReturn = true;
            }
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