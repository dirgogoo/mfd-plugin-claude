import type { MfdDocument, SourceRange } from "../parser/ast.js";
export type Severity = "error" | "warning";
export interface ValidationDiagnostic {
    code: string;
    severity: Severity;
    message: string;
    location: SourceRange;
    source?: string;
    help?: string;
}
export interface ValidationResult {
    valid: boolean;
    errors: ValidationDiagnostic[];
    warnings: ValidationDiagnostic[];
}
export interface ValidateOptions {
    /** When true, all warnings are promoted to errors */
    strict?: boolean;
}
export type ValidationRule = (doc: MfdDocument) => ValidationDiagnostic[];
/**
 * Validate an MFD document against all semantic rules.
 * When `strict` is true, all warnings are promoted to errors.
 */
export declare function validate(doc: MfdDocument, options?: ValidateOptions): ValidationResult;
/**
 * Format a diagnostic in rustc-style output with colors and context.
 */
export declare function formatDiagnostic(diag: ValidationDiagnostic, sourceText?: string): string;
//# sourceMappingURL=index.d.ts.map