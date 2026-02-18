import { collectModel } from "../collect.js";
const SKIP_ACTIONS = new Set(["emit", "return"]);
/**
 * FLOW_STEP_UNRESOLVED / FLOW_BRANCH_UNRESOLVED: Strict validation that
 * flow steps and branches reference declared operations.
 * Only active when the model declares >= 1 operation (opt-in).
 *
 * FLOW_TRIGGER_UNRESOLVED: `on EventName` in flow body must reference a declared event.
 * FLOW_EMITS_FORBIDDEN: flows cannot emit events — only operations can.
 * FLOW_EMIT_STEP_FORBIDDEN: `-> emit(Evento)` in flows is not allowed — only operations can emit.
 */
export function flowOperationValidation(doc) {
    const model = collectModel(doc);
    const diagnostics = [];
    const eventNames = new Set(model.events.map((e) => e.name));
    // Validate flow triggers (on EventName) and emits (emits EventName)
    for (const flow of model.flows) {
        for (const item of flow.body) {
            if (item.type === "OnClause") {
                if (!eventNames.has(item.event)) {
                    diagnostics.push({
                        code: "FLOW_TRIGGER_UNRESOLVED",
                        severity: "error",
                        message: `Flow '${flow.name}' trigger 'on ${item.event}' references undeclared event '${item.event}'`,
                        location: item.loc,
                        help: `Declare 'event ${item.event} { ... }' or check the name`,
                    });
                }
            }
            if (item.type === "EmitsClause") {
                diagnostics.push({
                    code: "FLOW_EMITS_FORBIDDEN",
                    severity: "error",
                    message: `Flow '${flow.name}' cannot emit event '${item.event}' — only operations can emit events`,
                    location: item.loc,
                    help: `Move 'emits ${item.event}' to an operation that the flow calls.\n\n  operation do_something(Input) -> Output {\n    emits ${item.event}\n  }\n\n  flow ${flow.name}(...) -> ... {\n    -> do_something(...)\n  }`,
                });
            }
            if (item.type === "FlowStep") {
                const fs = item;
                if (fs.hasArrow) {
                    const actionName = fs.action.trim().split(/[\s(]/)[0];
                    if (actionName === "emit") {
                        diagnostics.push({
                            code: "FLOW_EMIT_STEP_FORBIDDEN",
                            severity: "error",
                            message: `Flow '${flow.name}' step '-> emit(${fs.args || "..."})' is not allowed — only operations can emit events`,
                            location: fs.loc,
                            help: `Replace the emit step with a call to an operation that emits the event.`,
                        });
                    }
                }
            }
        }
    }
    // Step/branch validation only when operations are declared (opt-in)
    if (model.operations.length === 0)
        return diagnostics;
    const operationNames = new Set(model.operations.map((o) => o.name));
    for (const flow of model.flows) {
        for (const step of flow.body) {
            if (step.type !== "FlowStep")
                continue;
            const fs = step;
            // Steps without arrow are flow control (return, etc)
            if (!fs.hasArrow)
                continue;
            const actionName = fs.action.trim().split(/[\s(]/)[0];
            if (SKIP_ACTIONS.has(actionName))
                continue;
            if (!operationNames.has(actionName)) {
                diagnostics.push({
                    code: "FLOW_STEP_UNRESOLVED",
                    severity: "error",
                    message: `Flow '${flow.name}' step '${actionName}' is not a declared operation`,
                    location: fs.loc,
                    help: `This error only appears when the model declares operations (strict mode). Each flow step must reference a declared operation. Fix:

  operation ${actionName}(InputType) -> OutputType {
    # description
  }

  Or if '${actionName}' is not an operation, remove the arrow: use '${actionName}' as a semantic comment instead of '-> ${actionName}(...)'.`,
                });
            }
            // Branch actions
            for (const branch of fs.branches) {
                const branchAction = branch.action.trim().split(/[\s(]/)[0];
                if (SKIP_ACTIONS.has(branchAction))
                    continue;
                if (!operationNames.has(branchAction)) {
                    diagnostics.push({
                        code: "FLOW_BRANCH_UNRESOLVED",
                        severity: "error",
                        message: `Flow '${flow.name}' branch action '${branchAction}' is not a declared operation`,
                        location: branch.loc,
                        help: `Declare 'operation ${branchAction}(...)' or check the name`,
                    });
                }
            }
        }
    }
    return diagnostics;
}
//# sourceMappingURL=flow-operation-validation.js.map