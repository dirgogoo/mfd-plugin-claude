import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "../../core/parser/index.js";
import { resolveFile } from "../../core/resolver/index.js";
/**
 * Auto-detect whether source contains import/include directives.
 */
function hasIncludes(source) {
    return /^\s*(import|include)\s+"/m.test(source);
}
export function loadDocument(filePath, resolveIncludes) {
    const absPath = resolve(filePath);
    const source = readFileSync(absPath, "utf-8");
    const shouldResolve = resolveIncludes ?? hasIncludes(source);
    if (shouldResolve) {
        const result = resolveFile(absPath);
        if (result.errors.length > 0) {
            const msgs = result.errors.map((e) => e.message).join("\n");
            throw new Error(`Resolution errors:\n${msgs}`);
        }
        return { doc: result.document, source };
    }
    const doc = parse(source, { source: absPath });
    return { doc, source };
}
//# sourceMappingURL=common.js.map