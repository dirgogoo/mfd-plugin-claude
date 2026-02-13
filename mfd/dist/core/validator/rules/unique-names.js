import { collectModel } from "../collect.js";
/**
 * DUPLICATE_NAME: Checks for duplicate names within the same scope.
 */
export function uniqueNames(doc) {
    const diagnostics = [];
    function checkScope(items, scopeName) {
        const seen = new Map();
        for (const item of items) {
            if (!("name" in item) || !item.name)
                continue;
            // Only check named constructs
            if (!["ElementDecl", "EntityDecl", "EnumDecl", "FlowDecl", "StateDecl", "EventDecl", "SignalDecl",
                "ApiDecl", "RuleDecl", "ComponentDecl", "ScreenDecl", "JourneyDecl", "OperationDecl", "ActionDecl"].includes(item.type))
                continue;
            const key = `${item.type}:${item.name}`;
            const kindKey = item.name;
            // Check for same name regardless of type
            const existing = seen.get(kindKey);
            if (existing) {
                diagnostics.push({
                    code: "DUPLICATE_NAME",
                    severity: "error",
                    message: `Duplicate name '${item.name}' in scope '${scopeName}'`,
                    location: item.loc,
                    help: `A ${existing.type.replace("Decl", "").toLowerCase()} with this name already exists at line ${existing.loc.start.line}`,
                });
            }
            else {
                seen.set(kindKey, { type: item.type, loc: item.loc });
            }
        }
    }
    // Check top-level scope
    const model = collectModel(doc);
    // Check within each component
    for (const comp of model.components) {
        checkScope(comp.body.filter((i) => "name" in i), comp.name);
    }
    // Check within each system
    for (const sys of model.systems) {
        checkScope(sys.body.filter((i) => "name" in i), sys.name);
    }
    // Check global scope for top-level items
    checkScope(doc.body.filter((i) => "name" in i), "<global>");
    return diagnostics;
}
//# sourceMappingURL=unique-names.js.map