import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve, isAbsolute, relative } from "node:path";
import { parse } from "../parser/index.js";
import { MfdParseError } from "../parser/errors.js";
/** Maximum include nesting depth to prevent runaway recursion */
const MAX_INCLUDE_DEPTH = 20;
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
    const resolved = resolveDocument(rootDoc, dir, dir, visited, files, errors, 0, [absPath]);
    return { document: resolved, files, errors };
}
function resolveDocument(doc, baseDir, projectDir, visited, files, errors, depth, chain) {
    const newBody = [];
    for (const item of doc.body) {
        if (item.type === "SystemDecl") {
            const { system: resolvedSystem, hoisted } = resolveSystem(item, baseDir, projectDir, visited, files, errors, depth, chain);
            // Hoisted items (shared enums/entities from files without component block) go BEFORE the system
            newBody.push(...hoisted);
            newBody.push(resolvedSystem);
        }
        else if (item.type === "IncludeDecl") {
            const included = resolveInclude(item, baseDir, projectDir, visited, files, errors, depth, chain);
            newBody.push(...included);
        }
        else {
            newBody.push(item);
        }
    }
    return { ...doc, body: newBody };
}
function resolveSystem(sys, baseDir, projectDir, visited, files, errors, depth, chain) {
    const newBody = [];
    const hoisted = [];
    for (const item of sys.body) {
        if (item.type === "IncludeDecl") {
            const included = resolveInclude(item, baseDir, projectDir, visited, files, errors, depth, chain);
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
/**
 * Format include chain for error messages: a.mfd → b.mfd → c.mfd
 */
function formatChain(chain) {
    return chain.map((f) => f.split("/").pop() ?? f).join(" → ");
}
function resolveInclude(incl, baseDir, projectDir, visited, files, errors, depth, chain) {
    let filePath = incl.path;
    // SUSPICIOUS_PATH: warn on absolute paths
    if (isAbsolute(filePath)) {
        errors.push({
            type: "SUSPICIOUS_PATH",
            message: `Include uses absolute path '${filePath}' — use relative paths instead (chain: ${formatChain(chain)})`,
            file: filePath,
            includedFrom: baseDir,
        });
    }
    // Add .mfd extension if missing
    if (!filePath.endsWith(".mfd")) {
        filePath += ".mfd";
    }
    const absPath = resolve(baseDir, filePath);
    // SUSPICIOUS_PATH: warn when resolved path escapes project directory
    const rel = relative(projectDir, absPath);
    if (rel.startsWith("..")) {
        errors.push({
            type: "SUSPICIOUS_PATH",
            message: `Include '${filePath}' resolves outside project directory (chain: ${formatChain(chain)})`,
            file: absPath,
            includedFrom: baseDir,
        });
    }
    // MAX_DEPTH_EXCEEDED: prevent runaway recursion
    if (depth >= MAX_INCLUDE_DEPTH) {
        errors.push({
            type: "MAX_DEPTH_EXCEEDED",
            message: `Include nesting exceeds maximum depth of ${MAX_INCLUDE_DEPTH} (chain: ${formatChain([...chain, absPath])})`,
            file: absPath,
            includedFrom: baseDir,
        });
        return [];
    }
    // Circular include detection
    if (visited.has(absPath)) {
        errors.push({
            type: "CIRCULAR_INCLUDE",
            message: `Circular include detected: ${filePath} (chain: ${formatChain([...chain, absPath])})`,
            file: absPath,
            includedFrom: baseDir,
        });
        return [];
    }
    // File existence check
    if (!existsSync(absPath)) {
        errors.push({
            type: "FILE_NOT_FOUND",
            message: `Include file not found: ${filePath} (from ${formatChain(chain)})`,
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
    const resolved = resolveDocument(doc, includeDir, projectDir, visited, files, errors, depth + 1, [...chain, absPath]);
    return resolved.body;
}
function parseWithErrors(source, filePath, errors) {
    try {
        return parse(source, { source: filePath });
    }
    catch (err) {
        if (err instanceof MfdParseError) {
            const loc = err.location.start;
            errors.push({
                type: "PARSE_ERROR",
                message: `Parse error in ${filePath}:${loc.line}:${loc.column}: ${err.message}`,
                file: filePath,
                location: { line: loc.line, column: loc.column },
            });
        }
        else {
            const msg = err instanceof Error ? err.message : String(err);
            errors.push({
                type: "PARSE_ERROR",
                message: `Parse error in ${filePath}: ${msg}`,
                file: filePath,
            });
        }
        return null;
    }
}
//# sourceMappingURL=index.js.map