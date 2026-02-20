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
        // On first open: scan sibling directory for root files that might import this one
        if (isNew) {
            this.discoverRoots(filePath);
        }
        const affectedRoots = this.reverseGraph.get(filePath) ?? new Set();
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
                    if (this.resolvedCache.has(candidate))
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