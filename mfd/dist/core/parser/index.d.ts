import type { MfdDocument } from "./ast.js";
import { type ParseDiagnostic } from "./errors.js";
export type { MfdDocument } from "./ast.js";
export * from "./ast.js";
export { MfdParseError } from "./errors.js";
export type { ParseDiagnostic } from "./errors.js";
export interface ParseOptions {
    source?: string;
    startRule?: string;
}
/**
 * Parse MFD-DSL source code into an AST.
 */
export declare function parse(input: string, options?: ParseOptions): MfdDocument;
export interface ParseResult {
    document: MfdDocument;
    errors: ParseDiagnostic[];
    hasErrors: boolean;
}
/**
 * Collect all ErrorNode instances from a parsed AST.
 */
export declare function collectErrorNodes(doc: MfdDocument): ParseDiagnostic[];
/**
 * Return a copy of the document with all ErrorNodes removed.
 */
export declare function stripErrorNodes(doc: MfdDocument): MfdDocument;
/**
 * Parse with error recovery: reports multiple syntax errors instead of
 * stopping at the first one. The original parse() function is unchanged.
 *
 * Layer 1 (grammar-level): ErrorNode productions in the grammar capture
 * unrecognized lines and continue parsing.
 *
 * Layer 2 (wrapper-level): If the grammar itself fails (e.g. unclosed brace),
 * this function attempts skip-reparse by advancing past the problematic
 * top-level construct and retrying.
 */
export declare function parseWithRecovery(input: string, options?: ParseOptions): ParseResult;
//# sourceMappingURL=index.d.ts.map