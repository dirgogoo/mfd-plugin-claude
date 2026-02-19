import { collectModel } from "../collect.js";
/**
 * UI quality rules:
 *
 * ELEMENT_NOT_USED: Concrete element not referenced by any screen's `uses` clause.
 *   Skip: @abstract, @interface elements. Opt-in: only when model has screens.
 *
 * ACTION_NO_FROM: Action without a `from` clause (malformed).
 *   Opt-in: only when model has screens.
 *
 * ACTION_NO_RESULT: Action with calls/on but no result branches for navigation.
 *   Skip: pure actions (no calls, no on STREAM, no on Signal).
 *
 * ACTION_DUPLICATE_OUTCOME: Two or more ActionResult with the same outcome string.
 */
export function uiQuality(doc) {
    const model = collectModel(doc);
    const diagnostics = [];
    // ---- ELEMENT_NOT_USED ----
    if (model.elements.length > 0 && model.screens.length > 0) {
        const usedElements = new Set();
        for (const screen of model.screens) {
            for (const item of screen.body) {
                if (item.type === "UsesDecl") {
                    usedElements.add(item.element);
                }
            }
        }
        // Also count elements used as extends/implements targets by other elements
        for (const el of model.elements) {
            if (el.extends)
                usedElements.add(el.extends);
            for (const iface of el.implements)
                usedElements.add(iface);
        }
        for (const el of model.elements) {
            if (el.decorators.some((d) => d.name === "abstract"))
                continue;
            if (el.decorators.some((d) => d.name === "interface"))
                continue;
            if (!usedElements.has(el.name)) {
                diagnostics.push({
                    code: "ELEMENT_NOT_USED",
                    severity: "warning",
                    message: `Element '${el.name}' is not used by any screen`,
                    location: el.loc,
                    help: `Add 'uses ${el.name} -> alias' to a screen, or mark as @abstract if it's a base component`,
                });
            }
        }
    }
    // ---- ACTION_NO_FROM ----
    if (model.actions.length > 0 && model.screens.length > 0) {
        for (const action of model.actions) {
            const hasFrom = action.body.some((item) => item.type === "ActionFromClause");
            if (!hasFrom) {
                diagnostics.push({
                    code: "ACTION_NO_FROM",
                    severity: "warning",
                    message: `Action '${action.name}' has no 'from' clause — every action should originate from a screen`,
                    location: action.loc,
                    help: `Add 'from ScreenName' to specify which screen triggers this action`,
                });
            }
        }
    }
    // ---- ACTION_NO_RESULT ----
    for (const action of model.actions) {
        const hasCalls = action.body.some((item) => item.type === "ActionCallsClause");
        const hasOnStream = action.body.some((item) => item.type === "ActionOnStreamClause");
        const hasOnSignal = action.body.some((item) => item.type === "ActionOnSignalClause");
        // Only check actions that have calls, on STREAM, or on Signal
        if (!hasCalls && !hasOnStream && !hasOnSignal)
            continue;
        const results = action.body.filter((item) => item.type === "ActionResult");
        if (results.length === 0) {
            diagnostics.push({
                code: "ACTION_NO_RESULT",
                severity: "warning",
                message: `Action '${action.name}' calls an endpoint but has no result branches for navigation`,
                location: action.loc,
                help: `Add '| sucesso -> TargetScreen' and '| erro -> ErrorScreen' to define navigation after the call`,
            });
        }
    }
    // ---- ACTION_DUPLICATE_OUTCOME ----
    for (const action of model.actions) {
        const outcomes = new Map();
        for (const item of action.body) {
            if (item.type === "ActionResult") {
                outcomes.set(item.outcome, (outcomes.get(item.outcome) || 0) + 1);
            }
        }
        for (const [outcome, count] of outcomes) {
            if (count > 1) {
                diagnostics.push({
                    code: "ACTION_DUPLICATE_OUTCOME",
                    severity: "warning",
                    message: `Action '${action.name}' has duplicate outcome '${outcome}' — each outcome should be unique`,
                    location: action.loc,
                    help: `Rename one of the duplicate outcomes to distinguish the branches`,
                });
            }
        }
    }
    return diagnostics;
}
//# sourceMappingURL=ui-quality.js.map