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
export type ValidationRule = (doc: MfdDocument) => ValidationDiagnostic[];
/**
 * Validate an MFD document against all semantic rules.
 */
export declare function validate(doc: MfdDocument): ValidationResult;
/**
 * Format a diagnostic in rustc-style output with colors and context.
 */
export declare function formatDiagnostic(diag: ValidationDiagnostic, sourceText?: string): string;
//# sourceMappingURL=index.d.ts.map