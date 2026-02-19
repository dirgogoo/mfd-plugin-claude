import { collectModel } from "../collect.js";
/**
 * Error path coverage rules:
 *
 * FLOW_MISSING_ERROR_BRANCH: Flow whose returnType is a UnionType (contains |)
 *   but no FlowStep in the body has any branches.
 *   Skip: @abstract flows, flows without returnType, flows with non-union returnType.
 *
 * ACTION_MISSING_ERROR_BRANCH: Action with a `calls` clause but only 1 ActionResult
 *   branch (no error handling).
 *   Skip: actions without `calls`.
 */
export function errorPathCoverage(doc) {
    const model = collectModel(doc);
    const diagnostics = [];
    // FLOW_MISSING_ERROR_BRANCH
    for (const flow of model.flows) {
        if (flow.decorators.some((d) => d.name === "abstract"))
            continue;
        if (!flow.returnType)
            continue;
        if (flow.returnType.type !== "UnionType")
            continue;
        const hasBranches = flow.body.some((item) => item.type === "FlowStep" && item.branches.length > 0);
        if (!hasBranches) {
            diagnostics.push({
                code: "FLOW_MISSING_ERROR_BRANCH",
                severity: "warning",
                message: `Flow '${flow.name}' returns union type but has no error branches`,
                location: flow.loc,
                help: "Add conditional branches (| condition -> action) to handle error paths",
            });
        }
    }
    // ACTION_MISSING_ERROR_BRANCH
    for (const action of model.actions) {
        const hasCalls = action.body.some((item) => item.type === "ActionCallsClause");
        if (!hasCalls)
            continue;
        const resultCount = action.body.filter((item) => item.type === "ActionResult").length;
        if (resultCount <= 1) {
            diagnostics.push({
                code: "ACTION_MISSING_ERROR_BRANCH",
                severity: "warning",
                message: `Action '${action.name}' calls an endpoint but has only ${resultCount} result branch — consider adding error handling`,
                location: action.loc,
                help: "Add an error branch like '| error -> ErrorScreen' or '| error -> end'",
            });
        }
    }
    return diagnostics;
}
//# sourceMappingURL=error-path-coverage.js.map