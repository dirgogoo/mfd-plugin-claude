import { collectModel } from "../collect.js";
/**
 * Screen completeness checks:
 *
 * SCREEN_FORM_NO_ACTION: screen has a form but no action with `calls` from that screen.
 * SCREEN_NOT_REFERENCED: screen is not referenced in any action or journey
 *   (only checked when model has actions or journeys).
 */
export function screenCompleteness(doc) {
    const model = collectModel(doc);
    const diagnostics = [];
    if (model.screens.length === 0)
        return diagnostics;
    // Collect screens referenced by actions (from clauses) and journeys (from/to)
    const referencedScreens = new Set();
    for (const action of model.actions) {
        for (const item of action.body) {
            if (item.type === "ActionFromClause") {
                referencedScreens.add(item.screen);
            }
            if (item.type === "ActionResult" && item.screen !== "end") {
                referencedScreens.add(item.screen);
            }
        }
    }
    for (const journey of model.journeys) {
        for (const item of journey.body) {
            if (item.type === "JourneyStep") {
                if (item.from !== "*" && item.from !== "end")
                    referencedScreens.add(item.from);
                if (item.to !== "*" && item.to !== "end")
                    referencedScreens.add(item.to);
            }
        }
    }
    // Collect screens that have actions with `calls` or `on STREAM` or `on Signal` from them
    const screensWithCallActions = new Set();
    for (const action of model.actions) {
        let fromScreen = null;
        let hasCalls = false;
        for (const item of action.body) {
            if (item.type === "ActionFromClause")
                fromScreen = item.screen;
            if (item.type === "ActionCallsClause" || item.type === "ActionOnStreamClause" || item.type === "ActionOnSignalClause") {
                hasCalls = true;
            }
        }
        if (fromScreen && hasCalls) {
            screensWithCallActions.add(fromScreen);
        }
    }
    for (const screen of model.screens) {
        // Check if screen has form declarations
        const hasForms = screen.body.some((item) => item.type === "FormDecl");
        // SCREEN_FORM_NO_ACTION: screen with form but no action consuming it
        if (hasForms && !screensWithCallActions.has(screen.name)) {
            // Only warn when model has actions (opt-in)
            if (model.actions.length > 0) {
                diagnostics.push({
                    code: "SCREEN_FORM_NO_ACTION",
                    severity: "warning",
                    message: `Screen '${screen.name}' has a form but no action with 'calls' from it`,
                    location: screen.loc,
                    help: `Add an action with 'from ${screen.name}' and 'calls METHOD /path' to connect the form to an endpoint`,
                });
            }
        }
        // SCREEN_NOT_REFERENCED: screen not referenced in actions/journeys
        if (model.actions.length > 0 || model.journeys.length > 0) {
            if (!referencedScreens.has(screen.name)) {
                diagnostics.push({
                    code: "SCREEN_NOT_REFERENCED",
                    severity: "warning",
                    message: `Screen '${screen.name}' is not referenced in any action or journey`,
                    location: screen.loc,
                    help: `Add an action 'from ${screen.name}' or include it in a journey`,
                });
            }
        }
    }
    return diagnostics;
}
//# sourceMappingURL=screen-completeness.js.map