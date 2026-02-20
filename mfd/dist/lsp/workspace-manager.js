import { fileURLToPath, pathToFileURL } from "node:url";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { resolveSource, resolveFile } from "../core/resolver/index.js";
import { collectModel, getKnownTypes, getKnownNames } from "../core/validator/collect.js";
export class WorkspaceManager {
    resolvedCache = new Map();
    // reverseGraph: filePath → Set<rootPaths that include that file>
    reverseGraph = new Map();
    /** Resolve a file (with live text if available). */
    resolve(filePath, liveText) {
        try {
            const result = liveText
                ? resolveSource(liveText, filePath)
                : resolveFile(filePath);
            this.resolvedCache.set(filePath, {
                rootPath: filePath,
                result,
                mergedModel: collectModel(result.document),
            });
            // Rebuild reverse graph for this root
            for (const fp of this.reverseGraph.keys()) {
                this.reverseGraph.get(fp).delete(filePath);
            }
            for (const includedPath of result.files) {
                if (includedPath === filePath)
                    continue; // don't add file to its own reverseGraph
                if (!this.reverseGraph.has(includedPath)) {
                    this.reverseGraph.set(includedPath, new Set());
                }
                this.reverseGraph.get(includedPath).add(filePath);
            }
        }
        catch {
            // resolve failed (e.g. I/O error or parse error) — keep previous cache
        }
    }
    /** Invalidate and re-resolve a file and all roots that import it. */
    invalidate(filePath, liveText) {
        const isNew = !this.resolvedCache.has(filePath);
        this.resolve(filePath, liveText);
        // Run discoverRoots when first seen OR when no parent root is known yet.
        // Handles the case where a file was created before its root existed (e.g. auth.mfd
        // created after main.mfd was already cached without knowing about auth.mfd).
        const noParents = !this.reverseGraph.get(filePath)?.size;
        if (isNew || noParents) {
            this.discoverRoots(filePath);
        }
        // Snapshot before iterating — resolve() mutates the reverseGraph sets,
        // which would cause the live Set iterator to revisit elements infinitely.
        const affectedRoots = [...(this.reverseGraph.get(filePath) ?? [])];
        for (const rootPath of affectedRoots) {
            if (rootPath !== filePath) {
                this.resolve(rootPath); // re-resolve from disk
            }
        }
    }
    /**
     * Scan the file's directory (and parent) for .mfd files that contain imports.
     * This allows cross-file resolution to work even when only a component file is open.
     */
    discoverRoots(filePath) {
        const dir = dirname(filePath);
        const dirsToScan = new Set([dir, dirname(dir)]);
        for (const scanDir of dirsToScan) {
            try {
                for (const f of readdirSync(scanDir)) {
                    if (!f.endsWith(".mfd"))
                        continue;
                    const candidate = join(scanDir, f);
                    if (candidate === filePath)
                        continue;
                    try {
                        const content = readFileSync(candidate, "utf-8");
                        // Only resolve files that have import/include statements (likely roots)
                        if (content.includes("import ") || content.includes("include ")) {
                            this.resolve(candidate);
                        }
                    }
                    catch {
                        // skip unreadable files
                    }
                }
            }
            catch {
                // skip unreadable directories
            }
        }
    }
    /**
     * Scan an entire workspace folder recursively for .mfd root files and pre-resolve them.
     * Called once on LSP initialization so cross-file features work from the start,
     * regardless of whether the project has a git repository.
     */
    scanWorkspace(rootPath, maxDepth = 6) {
        this._scanDir(rootPath, 0, maxDepth);
    }
    _scanDir(dir, depth, maxDepth) {
        if (depth > maxDepth)
            return;
        try {
            for (const entry of readdirSync(dir, { withFileTypes: true })) {
                // Skip hidden dirs and common non-project dirs
                if (entry.name.startsWith(".") || entry.name === "node_modules")
                    continue;
                const fullPath = join(dir, entry.name);
                if (entry.isDirectory()) {
                    this._scanDir(fullPath, depth + 1, maxDepth);
                }
                else if (entry.name.endsWith(".mfd")) {
                    try {
                        const content = readFileSync(fullPath, "utf-8");
                        if (content.includes("import ") || content.includes("include ")) {
                            this.resolve(fullPath);
                        }
                    }
                    catch {
                        // skip unreadable files
                    }
                }
            }
        }
        catch {
            // skip unreadable directories
        }
    }
    /**
     * Returns the ResolvedEntry that "contains" the given file.
     * Prefers the parent root (more complete merged model) over the file's own entry.
     */
    getEntryFor(filePath) {
        // 1. Prefer: some root imports this file (it has a more complete merged model)
        const roots = this.reverseGraph.get(filePath);
        if (roots && roots.size > 0) {
            const [firstRoot] = roots;
            const entry = this.resolvedCache.get(firstRoot);
            if (entry)
                return entry;
        }
        // 2. Fallback: the file itself is a root
        return this.resolvedCache.get(filePath) ?? null;
    }
    /** Get merged known types from the resolved entry for a file. */
    getMergedKnownTypes(filePath) {
        const entry = this.getEntryFor(filePath);
        return entry ? getKnownTypes(entry.mergedModel) : null;
    }
    /** Get merged known names from the resolved entry for a file. */
    getMergedKnownNames(filePath) {
        const entry = this.getEntryFor(filePath);
        return entry ? getKnownNames(entry.mergedModel) : null;
    }
    static uriToPath(uri) {
        try {
            return uri.startsWith("file://") ? fileURLToPath(uri) : null;
        }
        catch {
            return null;
        }
    }
    static pathToUri(absPath) {
        return pathToFileURL(absPath).href;
    }
}
//# sourceMappingURL=workspace-manager.js.map