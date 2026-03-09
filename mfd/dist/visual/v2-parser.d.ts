/**
 * Lightweight regex-based parser for MFD v2 files.
 * Extracts enough structure for visualization — NOT a full parser.
 * Will be replaced by the real v2 parser when it's built.
 */
import type { CollectedModelV2 } from "./v2-types.js";
/**
 * Parse a v2 .mfd source string into a CollectedModelV2.
 * This is a lightweight regex-based parser for visualization purposes.
 */
export declare function parseV2(source: string, filePath?: string): CollectedModelV2;
/**
 * Detect if a source file is v2 by looking for v2-specific keywords.
 */
export declare function isV2Source(source: string): boolean;
//# sourceMappingURL=v2-parser.d.ts.map