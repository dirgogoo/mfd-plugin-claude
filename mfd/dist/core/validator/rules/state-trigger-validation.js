import { collectModel } from "../collect.js";
/**
 * STATE_TRIGGER_UNRESOLVED: Checks that state transition triggers
 * reference declared events or flows (reactive pattern).
 */
export function stateTriggerValidation(doc) {
    const model = collectModel(doc);
    const diagnostics = [];
    const eventNames = new Set(model.events.map((e) => e.name));
    const flowNames = new Set(model.flows.map((f) => f.name));
    const operationNames = new Set(model.operations.map((o) => o.name));
    for (const state of model.states) {
        for (const transition of state.transitions) {
            if (!transition.event)
                continue;
            const triggerName = transition.event;
            if (eventNames.has(triggerName) || flowNames.has(triggerName) || operationNames.has(triggerName))
                continue;
            // Build suggestion from available events
            const suggestions = [];
            for (const name of eventNames) {
                if (name.toLowerCase().includes(triggerName.toLowerCase()) ||
                    triggerName.toLowerCase().includes(name.toLowerCase())) {
                    suggestions.push(name);
                }
            }
            const helpParts = [
                "Declare an event with that name, or rename the trigger to match an existing event or flow",
            ];
            if (suggestions.length > 0) {
                helpParts.push(`Similar events: ${suggestions.join(", ")}`);
            }
            diagnostics.push({
                code: "STATE_TRIGGER_UNRESOLVED",
                severity: "warning",
                message: `State '${state.name}' transition trigger '${triggerName}' does not match any declared event or flow`,
                location: transition.loc,
                help: helpParts.join(". "),
            });
        }
    }
    return diagnostics;
}
//# sourceMappingURL=state-trigger-validation.js.map