import { collectModel } from "../collect.js";
/**
 * Normalize a path for comparison: remove trailing slashes.
 */
function normalizePath(p) {
    return p.replace(/\/+$/, "") || "/";
}
/**
 * OPERATION_EVENT_UNRESOLVED: Checks that operation emits/on clauses
 * reference declared events.
 *
 * OPERATION_RULE_UNRESOLVED: Checks that operation enforces clauses
 * reference declared rules.
 *
 * OPERATION_HANDLES_UNRESOLVED: handles endpoint not found in any API.
 * OPERATION_CALLS_UNRESOLVED: calls endpoint not found in any API (including @external).
 *
 * RULE_ORPHAN: Warning when a rule has no operation enforcing it
 * (only when model has >= 1 operation — opt-in).
 */
export function operationCompleteness(doc) {
    const model = collectModel(doc);
    const diagnostics = [];
    const eventNames = new Set(model.events.map((e) => e.name));
    const ruleNames = new Set(model.rules.map((r) => r.name));
    const enforcedRules = new Set();
    // Resolve all API endpoints: "METHOD fullPath"
    const apiEndpoints = new Set();
    for (const api of model.apis) {
        const prefixDeco = api.decorators.find((d) => d.name === "prefix");
        const prefixVal = prefixDeco?.params[0]
            ? String(prefixDeco.params[0].value)
            : "";
        for (const ep of api.endpoints) {
            const fullPath = normalizePath(prefixVal + ep.path);
            apiEndpoints.add(`${ep.method} ${fullPath}`);
        }
    }
    for (const op of model.operations) {
        for (const item of op.body) {
            if (item.type === "EmitsClause") {
                if (!eventNames.has(item.event)) {
                    diagnostics.push({
                        code: "OPERATION_EVENT_UNRESOLVED",
                        severity: "error",
                        message: `Operation '${op.name}' emits '${item.event}' which is not declared`,
                        location: item.loc,
                        help: "Declare the event or check the name",
                    });
                }
            }
            if (item.type === "OnClause") {
                if (!eventNames.has(item.event)) {
                    diagnostics.push({
                        code: "OPERATION_EVENT_UNRESOLVED",
                        severity: "error",
                        message: `Operation '${op.name}' trigger '${item.event}' is not a declared event`,
                        location: item.loc,
                        help: "Declare the event or check the name",
                    });
                }
            }
            if (item.type === "OperationHandlesClause") {
                const key = `${item.method} ${normalizePath(item.path)}`;
                if (!apiEndpoints.has(key)) {
                    diagnostics.push({
                        code: "OPERATION_HANDLES_UNRESOLVED",
                        severity: "warning",
                        message: `Operation '${op.name}' handles '${item.method} ${item.path}' which is not declared in any API`,
                        location: item.loc,
                        help: "Declare the endpoint in an 'api' block or check the method/path",
                    });
                }
            }
            if (item.type === "OperationCallsClause") {
                const key = `${item.method} ${normalizePath(item.path)}`;
                if (!apiEndpoints.has(key)) {
                    diagnostics.push({
                        code: "OPERATION_CALLS_UNRESOLVED",
                        severity: "warning",
                        message: `Operation '${op.name}' calls '${item.method} ${item.path}' which is not declared in any API (including @external)`,
                        location: item.loc,
                        help: "Declare the endpoint in an 'api' block (use @external for third-party APIs) or check the method/path",
                    });
                }
            }
            if (item.type === "EnforcesClause") {
                if (!ruleNames.has(item.rule)) {
                    diagnostics.push({
                        code: "OPERATION_RULE_UNRESOLVED",
                        severity: "error",
                        message: `Operation '${op.name}' enforces '${item.rule}' which is not a declared rule`,
                        location: item.loc,
                        help: "Declare the rule or check the name",
                    });
                }
                else {
                    enforcedRules.add(item.rule);
                }
            }
        }
    }
    // RULE_ORPHAN: only when model has operations (opt-in)
    if (model.operations.length > 0) {
        for (const rule of model.rules) {
            if (!enforcedRules.has(rule.name)) {
                diagnostics.push({
                    code: "RULE_ORPHAN",
                    severity: "warning",
                    message: `Rule '${rule.name}' is not enforced by any operation`,
                    location: rule.loc,
                    help: `Add 'enforces ${rule.name}' to the relevant operation`,
                });
            }
        }
    }
    return diagnostics;
}
//# sourceMappingURL=operation-completeness.js.map