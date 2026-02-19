import type { MfdDocument } from "../parser/ast.js";
export interface ResolveResult {
    /** The unified document with all includes resolved */
    document: MfdDocument;
    /** All files that were loaded (including the root) */
    files: string[];
    /** Errors encountered during resolution */
    errors: ResolveError[];
}
export interface ResolveError {
    type: "CIRCULAR_INCLUDE" | "FILE_NOT_FOUND" | "PARSE_ERROR" | "MAX_DEPTH_EXCEEDED" | "SUSPICIOUS_PATH";
    message: string;
    file: string;
    includedFrom?: string;
    location?: {
        line: number;
        column: number;
    };
}
export interface ResolveOptions {
    /** Base directory for resolving relative paths */
    baseDir?: string;
}
/**
 * Resolve a multi-file MFD model starting from a root file.
 * Processes all `include` directives, detects circular includes,
 * and produces a unified document.
 */
export declare function resolveFile(rootPath: string, options?: ResolveOptions): ResolveResult;
/**
 * Resolve includes from source text.
 */
export declare function resolveSource(source: string, sourcePath: string, baseDir?: string): ResolveResult;
//# sourceMappingURL=index.d.ts.map