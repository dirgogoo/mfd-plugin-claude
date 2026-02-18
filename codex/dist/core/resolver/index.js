import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parse } from "../parser/index.js";
/**
 * Resolve a multi-file MFD model starting from a root file.
 * Processes all `include` directives, detects circular includes,
 * and produces a unified document.
 */
export function resolveFile(rootPath, options = {}) {
    const absRoot = resolve(rootPath);
    const baseDir = options.baseDir ?? dirname(absRoot);
    const source = readFileSync(absRoot, "utf-8");
    return resolveSource(source, absRoot, baseDir);
}
/**
 * Resolve includes from source text.
 */
export function resolveSource(source, sourcePath, baseDir) {
    const absPath = resolve(sourcePath);
    const dir = baseDir ?? dirname(absPath);
    const visited = new Set();
    const files = [];
    const errors = [];
    const rootDoc = parseWithErrors(source, absPath, errors);
    if (!rootDoc) {
        return {
            document: { type: "MfdDocument", loc: { start: { line: 1, column: 1, offset: 0 }, end: { line: 1, column: 1, offset: 0 } }, body: [] },
            files: [absPath],
            errors,
        };
    }
    visited.add(absPath);
    files.push(absPath);
    const resolved = resolveDocument(rootDoc, dir, visited, files, errors);
    return { document: resolved, files, errors };
}
function resolveDocument(doc, baseDir, visited, files, errors) {
    const newBody = [];
    for (const item of doc.body) {
        if (item.type === "SystemDecl") {
            const { system: resolvedSystem, hoisted } = resolveSystem(item, baseDir, visited, files, errors);
            // Hoisted items (shared enums/entities from files without component block) go BEFORE the system
            newBody.push(...hoisted);
            newBody.push(resolvedSystem);
        }
        else if (item.type === "IncludeDecl") {
            const included = resolveInclude(item, baseDir, visited, files, errors);
            newBody.push(...included);
        }
        else {
            newBody.push(item);
        }
    }
    return { ...doc, body: newBody };
}
function resolveSystem(sys, baseDir, visited, files, errors) {
    const newBody = [];
    const hoisted = [];
    for (const item of sys.body) {
        if (item.type === "IncludeDecl") {
            const included = resolveInclude(item, baseDir, visited, files, errors);
            for (const inc of included) {
                if (inc.type === "ComponentDecl" || inc.type === "SemanticComment") {
                    newBody.push(inc);
                }
                else {
                    // Non-component items (shared enums, entities, etc.) are hoisted
                    // to MfdDocument.body since SystemDecl.body only accepts components
                    hoisted.push(inc);
                }
            }
        }
        else {
            newBody.push(item);
        }
    }
    return { system: { ...sys, body: newBody }, hoisted };
}
function resolveInclude(incl, baseDir, visited, files, errors) {
    let filePath = incl.path;
    // Add .mfd extension if missing
    if (!filePath.endsWith(".mfd")) {
        filePath += ".mfd";
    }
    const absPath = resolve(baseDir, filePath);
    // Circular include detection
    if (visited.has(absPath)) {
        errors.push({
            type: "CIRCULAR_INCLUDE",
            message: `Circular include detected: ${filePath}`,
            file: absPath,
            includedFrom: baseDir,
        });
        return [];
    }
    // File existence check
    if (!existsSync(absPath)) {
        errors.push({
            type: "FILE_NOT_FOUND",
            message: `Include file not found: ${filePath}`,
            file: absPath,
            includedFrom: baseDir,
        });
        return [];
    }
    visited.add(absPath);
    files.push(absPath);
    const source = readFileSync(absPath, "utf-8");
    const doc = parseWithErrors(source, absPath, errors);
    if (!doc)
        return [];
    const includeDir = dirname(absPath);
    const resolved = resolveDocument(doc, includeDir, visited, files, errors);
    return resolved.body;
}
function parseWithErrors(source, filePath, errors) {
    try {
        return parse(source, { source: filePath });
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push({
            type: "PARSE_ERROR",
            message: `Parse error in ${filePath}: ${msg}`,
            file: filePath,
        });
        return null;
    }
}
//# sourceMappingURL=index.js.map