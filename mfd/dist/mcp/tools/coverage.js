import { existsSync, readdirSync, lstatSync } from "node:fs";
import { resolve, dirname, relative, extname } from "node:path";
import { collectModel } from "../../core/validator/collect.js";
import { loadDocument } from "./common.js";
const DEFAULT_EXTENSIONS = [
    ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
    ".vue", ".svelte", ".css", ".scss", ".html", ".json",
];
const DEFAULT_EXCLUDE = [
    "node_modules", "dist", ".d.ts", ".test.", ".spec.",
    "__tests__", "__mocks__",
];
const DEPRECATED_IMPL_VALUES = new Set(["done", "backend", "frontend", "partial"]);
/**
 * Reverse traceability: scan a source directory and identify files NOT
 * referenced by any @impl in the model. Reports tracked (model-linked)
 * and untracked (orphan) files with coverage percentage.
 */
export function handleCoverage(args) {
    const projectRoot = findProjectRoot(args.file);
    const scanDir = resolve(projectRoot, args.scan_dir);
    if (!existsSync(scanDir)) {
        return {
            content: [{
                    type: "text",
                    text: `Directory not found: ${args.scan_dir} (resolved to ${scanDir})`,
                }],
            isError: true,
        };
    }
    // 1. Load model and collect @impl paths
    const { doc } = loadDocument(args.file, args.resolve_includes);
    const model = collectModel(doc);
    // Build ownership map: construct name → component name
    const ownership = new Map();
    for (const comp of model.components) {
        for (const item of comp.body) {
            const name = item.name;
            if (name)
                ownership.set(name, comp.name);
        }
    }
    const componentFilter = args.component?.toLowerCase() ?? null;
    // Extract all @impl paths into a Map<normalizedPath, ConstructRef[]>
    const implMap = new Map();
    const collections = [
        { type: "entity", items: model.entities },
        { type: "enum", items: model.enums },
        { type: "flow", items: model.flows },
        { type: "state", items: model.states },
        { type: "event", items: model.events },
        { type: "signal", items: model.signals },
        { type: "screen", items: model.screens },
        { type: "journey", items: model.journeys },
        { type: "operation", items: model.operations },
        { type: "action", items: model.actions },
        { type: "element", items: model.elements },
        { type: "rule", items: model.rules },
    ];
    for (const { type, items } of collections) {
        for (const item of items) {
            const name = item.name;
            if (!name)
                continue;
            const component = ownership.get(name) ?? null;
            if (componentFilter && (!component || component.toLowerCase() !== componentFilter))
                continue;
            extractImplPaths(item, type, name, component, implMap);
        }
    }
    // Also check APIs
    for (const api of model.apis) {
        const name = api.name ?? api.style ?? "api";
        const component = ownership.get(name) ?? null;
        if (componentFilter && (!component || component.toLowerCase() !== componentFilter))
            continue;
        extractImplPaths(api, "api", name, component, implMap);
    }
    // 2. Scan directory for source files
    const extensions = new Set(args.extensions ?? DEFAULT_EXTENSIONS);
    const excludePatterns = args.exclude ?? DEFAULT_EXCLUDE;
    const allFiles = [];
    scanDirectory(scanDir, extensions, excludePatterns, allFiles);
    // 3. Compute relative paths and match against implMap
    const tracked = [];
    const untracked = [];
    for (const absFile of allFiles) {
        const relPath = relative(projectRoot, absFile);
        const normalizedRel = relPath.replace(/\\/g, "/");
        const refs = implMap.get(normalizedRel);
        if (refs && refs.length > 0) {
            tracked.push({ file: normalizedRel, constructs: refs });
        }
        else {
            untracked.push({ file: normalizedRel });
        }
    }
    // 4. Count @impl paths that point outside scan_dir
    let implPathsOutsideScan = 0;
    for (const implPath of implMap.keys()) {
        const absImplPath = resolve(projectRoot, implPath);
        if (!absImplPath.startsWith(scanDir)) {
            implPathsOutsideScan++;
        }
    }
    const totalFiles = allFiles.length;
    const trackedFiles = tracked.length;
    const untrackedFiles = untracked.length;
    const coveragePct = totalFiles > 0
        ? Math.round((trackedFiles / totalFiles) * 1000) / 10
        : 0;
    const result = {
        summary: {
            totalFiles,
            trackedFiles,
            untrackedFiles,
            coveragePct,
            implPathsTotal: implMap.size,
            implPathsOutsideScan,
        },
        tracked,
        untracked,
    };
    return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
}
function extractImplPaths(item, type, name, component, implMap) {
    const decorators = item.decorators ?? [];
    const implDeco = decorators.find((d) => d.name === "impl");
    if (!implDeco)
        return;
    for (const p of implDeco.params) {
        const val = p.kind === "string" || p.kind === "identifier" ? String(p.value) : null;
        if (!val)
            continue;
        if (DEPRECATED_IMPL_VALUES.has(val))
            continue;
        const normalized = val.replace(/\\/g, "/");
        const refs = implMap.get(normalized) ?? [];
        refs.push({ type, name, component });
        implMap.set(normalized, refs);
    }
}
function scanDirectory(dir, extensions, excludePatterns, results) {
    let entries;
    try {
        entries = readdirSync(dir, { encoding: "utf-8" });
    }
    catch {
        return;
    }
    for (const entry of entries) {
        const fullPath = resolve(dir, entry);
        // Check exclude patterns against the full path
        if (excludePatterns.some(pat => fullPath.includes(pat)))
            continue;
        let stat;
        try {
            stat = lstatSync(fullPath);
        }
        catch {
            continue;
        }
        // Don't follow symlinks
        if (stat.isSymbolicLink())
            continue;
        if (stat.isDirectory()) {
            scanDirectory(fullPath, extensions, excludePatterns, results);
        }
        else if (stat.isFile()) {
            const ext = extname(entry);
            if (extensions.has(ext)) {
                results.push(fullPath);
            }
        }
    }
}
function findProjectRoot(filePath) {
    let dir = dirname(resolve(filePath));
    for (let i = 0; i < 10; i++) {
        if (existsSync(resolve(dir, "package.json")) || existsSync(resolve(dir, ".git"))) {
            return dir;
        }
        const parent = dirname(dir);
        if (parent === dir)
            break;
        dir = parent;
    }
    return dirname(resolve(filePath));
}
//# sourceMappingURL=coverage.js.map