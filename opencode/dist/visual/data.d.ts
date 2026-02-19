/**
 * Data layer: loads an MFD file and produces a complete ModelSnapshot
 * with parsed model, all 6 diagrams, stats, relationships, and validation results.
 *
 * Handles both nested models (constructs inside component blocks) and
 * flat models (constructs at top level, outside component blocks).
 */
import type { ModelSnapshot } from "./types.js";
export declare function loadModelSnapshot(filePath: string, resolveIncludes?: boolean): ModelSnapshot;
//# sourceMappingURL=data.d.ts.map