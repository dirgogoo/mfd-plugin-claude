import { collectModel } from "../collect.js";
/**
 * DUPLICATE_SECRET: Detects duplicate secret names within the same component.
 */
export function duplicateSecrets(doc) {
    const model = collectModel(doc);
    const diagnostics = [];
    for (const comp of model.components) {
        const seen = new Map();
        for (const item of comp.body) {
            if (item.type === "SecretDecl") {
                if (seen.has(item.name)) {
                    diagnostics.push({
                        code: "DUPLICATE_SECRET",
                        severity: "error",
                        message: `Duplicate secret '${item.name}' in component '${comp.name}'`,
                        location: item.loc,
                    });
                }
                else {
                    seen.set(item.name, true);
                }
            }
        }
    }
    return diagnostics;
}
//# sourceMappingURL=duplicate-secrets.js.map