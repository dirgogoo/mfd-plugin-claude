import { type ToolResponse } from "./common.js";
interface CoverageArgs {
    file: string;
    scan_dir: string;
    component?: string;
    extensions?: string[];
    exclude?: string[];
    resolve_includes?: boolean;
}
/**
 * Reverse traceability: scan a source directory and identify files NOT
 * referenced by any @impl in the model. Reports tracked (model-linked)
 * and untracked (orphan) files with coverage percentage.
 */
export declare function handleCoverage(args: CoverageArgs): ToolResponse;
export {};
//# sourceMappingURL=coverage.d.ts.map