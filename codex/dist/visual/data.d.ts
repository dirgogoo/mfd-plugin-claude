/**
 * Data layer (v2): loads an MFD v2 file and produces a complete ModelSnapshot
 * with parsed model, all 7 diagrams, stats, relationships, domains, and validation results.
 *
 * V2-only: v1 files are rejected with an error.
 */
import type { ModelSnapshot } from "./types.js";
export declare function loadModelSnapshot(filePath: string, resolveIncludes?: boolean): ModelSnapshot;
//# sourceMappingURL=data.d.ts.map