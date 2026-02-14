import { collectModel } from "../collect.js";
/**
 * STATE_INVALID: Checks that all states referenced in transitions exist
 * in the associated enum.
 */
export function stateCompleteness(doc) {
    const model = collectModel(doc);
    const diagnostics = [];
    // Build map of enum name -> values
    const enumValues = new Map();
    for (const e of model.enums) {
        enumValues.set(e.name, new Set(e.values.map((v) => v.name)));
    }
    for (const state of model.states) {
        const values = enumValues.get(state.enumRef);
        if (!values) {
            diagnostics.push({
                code: "STATE_INVALID",
                severity: "error",
                message: `State '${state.name}' references enum '${state.enumRef}' which is not defined`,
                location: state.loc,
                help: `State machines require a matching enum declaration. Correct pattern:

  enum ${state.enumRef} { value1, value2, value3 }

  state ${state.name} : ${state.enumRef} {
    value1 -> value2 : on SomeEvent
    value2 -> value3 : on AnotherEvent
  }` + (model.enums.length > 0
                    ? `\n\nAvailable enums: ${model.enums.map((e) => e.name).join(", ")}`
                    : ""),
            });
            continue;
        }
        for (const transition of state.transitions) {
            // Check 'from' state (skip wildcard *)
            if (transition.from !== "*" && !values.has(transition.from)) {
                diagnostics.push({
                    code: "STATE_INVALID",
                    severity: "error",
                    message: `State '${transition.from}' is not a value of enum '${state.enumRef}'`,
                    location: transition.loc,
                    help: `State names must exactly match enum values (case-sensitive). Valid values for ${state.enumRef}: ${[...values].join(", ")}`,
                });
            }
            // Check 'to' state
            if (transition.to !== "*" && !values.has(transition.to)) {
                diagnostics.push({
                    code: "STATE_INVALID",
                    severity: "error",
                    message: `State '${transition.to}' is not a value of enum '${state.enumRef}'`,
                    location: transition.loc,
                    help: `State names must exactly match enum values (case-sensitive). Valid values for ${state.enumRef}: ${[...values].join(", ")}`,
                });
            }
        }
    }
    return diagnostics;
}
//# sourceMappingURL=state-completeness.js.map