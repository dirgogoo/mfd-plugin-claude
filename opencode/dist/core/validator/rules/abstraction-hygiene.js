import { collectModel } from "../collect.js";
/**
 * Abstraction hygiene rules:
 *
 * ABSTRACT_NEVER_EXTENDED: @abstract construct that is never the target of `extends`.
 *   Types checked: entity, element, screen, flow, event, signal.
 *   Skip: when there are < 2 constructs of the same type.
 *
 * INTERFACE_NEVER_IMPLEMENTED: @interface construct that is never in `implements`.
 *   Types checked: entity, element, screen.
 *   Skip: when there are < 2 constructs of the same type.
 */
export function abstractionHygiene(doc) {
    const model = collectModel(doc);
    const diagnostics = [];
    // Groups of constructs that support extends
    const extendableGroups = [
        { type: "entity", constructs: model.entities },
        { type: "element", constructs: model.elements },
        { type: "screen", constructs: model.screens },
        { type: "flow", constructs: model.flows },
        { type: "event", constructs: model.events },
        { type: "signal", constructs: model.signals },
    ];
    // ---- ABSTRACT_NEVER_EXTENDED ----
    for (const group of extendableGroups) {
        if (group.constructs.length < 2)
            continue;
        const extendedTargets = new Set();
        for (const c of group.constructs) {
            if (c.extends)
                extendedTargets.add(c.extends);
        }
        for (const c of group.constructs) {
            if (!c.decorators.some((d) => d.name === "abstract"))
                continue;
            if (!extendedTargets.has(c.name)) {
                diagnostics.push({
                    code: "ABSTRACT_NEVER_EXTENDED",
                    severity: "warning",
                    message: `@abstract ${group.type} '${c.name}' is never extended by any concrete ${group.type}`,
                    location: c.loc,
                    help: `Add '${group.type} Concreto extends ${c.name} { ... }' or remove @abstract if unused`,
                });
            }
        }
    }
    // Groups that support implements (entity, element, screen)
    const implementableGroups = [
        { type: "entity", constructs: model.entities },
        { type: "element", constructs: model.elements },
        { type: "screen", constructs: model.screens },
    ];
    // ---- INTERFACE_NEVER_IMPLEMENTED ----
    for (const group of implementableGroups) {
        if (group.constructs.length < 2)
            continue;
        const implementedTargets = new Set();
        for (const c of group.constructs) {
            for (const iface of c.implements)
                implementedTargets.add(iface);
        }
        for (const c of group.constructs) {
            if (!c.decorators.some((d) => d.name === "interface"))
                continue;
            if (!implementedTargets.has(c.name)) {
                diagnostics.push({
                    code: "INTERFACE_NEVER_IMPLEMENTED",
                    severity: "warning",
                    message: `@interface ${group.type} '${c.name}' is never implemented by any concrete ${group.type}`,
                    location: c.loc,
                    help: `Add '${group.type} Concreto implements ${c.name} { ... }' or remove @interface if unused`,
                });
            }
        }
    }
    return diagnostics;
}
//# sourceMappingURL=abstraction-hygiene.js.map