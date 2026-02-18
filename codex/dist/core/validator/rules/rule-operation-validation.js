import { collectModel } from "../collect.js";
const SKIP_ACTIONS = new Set(["emit", "deny", "reject", "allow", "block", "log", "warn", "notify"]);
/**
 * RULE_ACTION_UNRESOLVED: Strict validation that rule `then`, `elseif then`,
 * and `else` clauses reference declared operations or flows.
 * Only active when the model declares >= 1 operation (opt-in).
 */
export function ruleOperationValidation(doc) {
    const model = collectModel(doc);
    if (model.operations.length === 0)
        return []; // opt-in
    const operationNames = new Set(model.operations.map((o) => o.name));
    const flowNames = new Set(model.flows.map((f) => f.name));
    const diagnostics = [];
    for (const rule of model.rules) {
        for (const clause of rule.body) {
            let action = null;
            if (clause.type === "ThenClause") {
                action = clause.action;
            }
            else if (clause.type === "ElseIfClause") {
                action = clause.action;
            }
            else if (clause.type === "ElseClause") {
                action = clause.action;
            }
            if (!action)
                continue;
            // Skip constraints without function call
            if (!action.includes("("))
                continue;
            const actionName = action.trim().split(/[\s(]/)[0];
            if (SKIP_ACTIONS.has(actionName))
                continue;
            if (!operationNames.has(actionName) && !flowNames.has(actionName)) {
                diagnostics.push({
                    code: "RULE_ACTION_UNRESOLVED",
                    severity: "error",
                    message: `Rule '${rule.name}' ${clause.type === "ThenClause" ? "then" : clause.type === "ElseIfClause" ? "elseif then" : "else"} '${actionName}' is not a declared operation or flow`,
                    location: clause.loc,
                    help: `Declare 'operation ${actionName}(...)' or check the name`,
                });
            }
        }
    }
    return diagnostics;
}
//# sourceMappingURL=rule-operation-validation.js.map