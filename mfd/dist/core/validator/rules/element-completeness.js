import { collectModel } from "../collect.js";
/**
 * ELEMENT_REF: Checks that `uses` declarations in screens reference declared elements.
 */
export function elementCompleteness(doc) {
    const model = collectModel(doc);
    const diagnostics = [];
    const elementNames = new Set(model.elements.map((e) => e.name));
    for (const screen of model.screens) {
        for (const item of screen.body) {
            if (item.type === "UsesDecl") {
                if (!elementNames.has(item.element)) {
                    diagnostics.push({
                        code: "ELEMENT_REF",
                        severity: "warning",
                        message: `Screen '${screen.name}' uses element '${item.element}' which is not declared`,
                        location: item.loc,
                        help: elementNames.size > 0
                            ? `Available elements: ${[...elementNames].sort().join(", ")}`
                            : "No element declarations found",
                    });
                }
            }
        }
    }
    return diagnostics;
}
//# sourceMappingURL=element-completeness.js.map