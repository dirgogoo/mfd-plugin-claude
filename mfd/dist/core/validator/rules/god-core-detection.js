import { collectModel } from "../collect.js";
/**
 * God Core anti-pattern detection:
 *
 * GOD_CORE: A component containing > 60% of all constructs in the system.
 *   Counts all body items except SemanticComment, DepDecl, and SecretDecl.
 *   Skip: systems with < 2 components.
 */
export function godCoreDetection(doc) {
    const model = collectModel(doc);
    const diagnostics = [];
    if (model.components.length < 2)
        return diagnostics;
    // Count meaningful constructs per component
    const excluded = new Set(["SemanticComment", "DepDecl", "SecretDecl"]);
    const counts = new Map();
    let total = 0;
    for (const comp of model.components) {
        const count = comp.body.filter((item) => !excluded.has(item.type)).length;
        counts.set(comp.name, count);
        total += count;
    }
    if (total === 0)
        return diagnostics;
    for (const comp of model.components) {
        const count = counts.get(comp.name) ?? 0;
        const pct = Math.round((count / total) * 100);
        if (pct > 60) {
            diagnostics.push({
                code: "GOD_CORE",
                severity: "warning",
                message: `Component '${comp.name}' contains ${pct}% of all constructs (${count}/${total}) — potential God Core anti-pattern`,
                location: comp.loc,
                help: "Redistribute constructs to domain-specific components following the Ownership Principle",
            });
        }
    }
    return diagnostics;
}
//# sourceMappingURL=god-core-detection.js.map