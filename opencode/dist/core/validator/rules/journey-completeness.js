import { collectModel } from "../collect.js";
/**
 * JOURNEY_INVALID: Checks journey references and structure.
 * JOURNEY_UNREACHABLE_SCREEN: Screen used as `from` but never as `to` (except entry point).
 * JOURNEY_DUPLICATE_TRANSITION: Duplicate from->to:trigger transition.
 */
export function journeyCompleteness(doc) {
    const model = collectModel(doc);
    const diagnostics = [];
    const screenNames = new Set(model.screens.map((s) => s.name));
    const eventNames = new Set(model.events.map((e) => e.name));
    for (const journey of model.journeys) {
        const steps = journey.body.filter((i) => i.type === "JourneyStep");
        if (steps.length === 0) {
            diagnostics.push({
                code: "JOURNEY_INVALID",
                severity: "warning",
                message: `Journey '${journey.name}' has no steps`,
                location: journey.loc,
                help: "Add at least one step: ScreenA -> ScreenB : on trigger",
            });
        }
        // Track transitions for duplicate detection and reachability
        const transitionKeys = new Set();
        const toScreens = new Set();
        const fromScreens = new Set();
        for (const step of steps) {
            // end cannot be origin
            if (step.from === "end") {
                diagnostics.push({
                    code: "JOURNEY_INVALID",
                    severity: "error",
                    message: `Journey '${journey.name}' uses 'end' as origin, which is not allowed`,
                    location: step.loc,
                    help: "'end' is a terminal node and cannot be used as a source",
                });
            }
            // Check screen refs (skip * and end)
            if (step.from !== "*" && step.from !== "end" && !screenNames.has(step.from)) {
                diagnostics.push({
                    code: "JOURNEY_INVALID",
                    severity: "warning",
                    message: `Journey '${journey.name}' references screen '${step.from}' which is not declared`,
                    location: step.loc,
                    help: "Declare the screen or check the name",
                });
            }
            if (step.to !== "end" && step.to !== "*" && !screenNames.has(step.to)) {
                diagnostics.push({
                    code: "JOURNEY_INVALID",
                    severity: "warning",
                    message: `Journey '${journey.name}' references screen '${step.to}' which is not declared`,
                    location: step.loc,
                    help: "Declare the screen or check the name",
                });
            }
            // JOURNEY_TRIGGER_UNRESOLVED: trigger must be a declared event
            if (step.trigger && !eventNames.has(step.trigger)) {
                diagnostics.push({
                    code: "JOURNEY_TRIGGER_UNRESOLVED",
                    severity: "error",
                    message: `Journey '${journey.name}' trigger '${step.trigger}' is not a declared event`,
                    location: step.loc,
                    help: `Declare 'event ${step.trigger} { ... }' or check the name`,
                });
            }
            // Track for reachability and duplicates
            if (step.from !== "*" && step.from !== "end")
                fromScreens.add(step.from);
            if (step.to !== "*" && step.to !== "end")
                toScreens.add(step.to);
            // JOURNEY_DUPLICATE_TRANSITION: same from->to:trigger
            const key = `${step.from}->${step.to}:${step.trigger ?? ""}`;
            if (transitionKeys.has(key)) {
                diagnostics.push({
                    code: "JOURNEY_DUPLICATE_TRANSITION",
                    severity: "warning",
                    message: `Journey '${journey.name}' has duplicate transition '${step.from} -> ${step.to}${step.trigger ? ` : on ${step.trigger}` : ""}'`,
                    location: step.loc,
                    help: "Remove the duplicate transition",
                });
            }
            transitionKeys.add(key);
        }
        // JOURNEY_UNREACHABLE_SCREEN: screen used as from but never reached (not a to)
        // The first `from` screen is treated as entry point (reachable by default).
        if (steps.length > 0) {
            const entryPoint = steps[0].from;
            for (const screen of fromScreens) {
                if (screen !== entryPoint && !toScreens.has(screen)) {
                    diagnostics.push({
                        code: "JOURNEY_UNREACHABLE_SCREEN",
                        severity: "warning",
                        message: `Journey '${journey.name}' screen '${screen}' is used as origin but never reached (not a target of any transition)`,
                        location: journey.loc,
                        help: `Add a transition targeting '${screen}' or remove transitions originating from it`,
                    });
                }
            }
        }
    }
    return diagnostics;
}
//# sourceMappingURL=journey-completeness.js.map