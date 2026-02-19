import { fileURLToPath, pathToFileURL } from "node:url";
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
        // Always resolve (populates cache on first open too)
        this.resolve(filePath, liveText);
        const affectedRoots = this.reverseGraph.get(filePath) ?? new Set();
        for (const rootPath of affectedRoots) {
            if (rootPath !== filePath) {
                this.resolve(rootPath); // re-resolve from disk (root is closed/unchanged)
            }
        }
    }
    /** Returns the ResolvedEntry that "contains" the given file. */
    getEntryFor(filePath) {
        // 1. The file itself is a root
        if (this.resolvedCache.has(filePath)) {
            return this.resolvedCache.get(filePath);
        }
        // 2. Some root imports this file
        const roots = this.reverseGraph.get(filePath);
        if (roots && roots.size > 0) {
            const [firstRoot] = roots;
            return this.resolvedCache.get(firstRoot) ?? null;
        }
        return null;
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