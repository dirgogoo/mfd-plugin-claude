import type { ResolveResult } from "../core/resolver/index.js";
import type { CollectedModel } from "../core/validator/collect.js";
interface ResolvedEntry {
    rootPath: string;
    result: ResolveResult;
    mergedModel: CollectedModel;
}
export declare class WorkspaceManager {
    private resolvedCache;
    readonly reverseGraph: Map<string, Set<string>>;
    /** Resolve a file (with live text if available). */
    resolve(filePath: string, liveText?: string): void;
    /** Invalidate and re-resolve a file and all roots that import it. */
    invalidate(filePath: string, liveText?: string): void;
    /** Returns the ResolvedEntry that "contains" the given file. */
    getEntryFor(filePath: string): ResolvedEntry | null;
    /** Get merged known types from the resolved entry for a file. */
    getMergedKnownTypes(filePath: string): Set<string> | null;
    /** Get merged known names from the resolved entry for a file. */
    getMergedKnownNames(filePath: string): Set<string> | null;
    static uriToPath(uri: string): string | null;
    static pathToUri(absPath: string): string;
}
export {};
//# sourceMappingURL=workspace-manager.d.ts.map