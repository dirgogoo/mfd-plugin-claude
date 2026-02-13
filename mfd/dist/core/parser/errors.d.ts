import type { SourceRange } from "./ast.js";
export interface ParseDiagnostic {
    message: string;
    location: SourceRange;
    context: string;
    raw: string;
}
export interface ParseErrorInfo {
    message: string;
    location: SourceRange;
    source?: string;
    expected?: string[];
    found?: string;
}
export declare class MfdParseError extends Error {
    readonly location: SourceRange;
    readonly source?: string;
    readonly expected?: string[];
    readonly found?: string;
    constructor(info: ParseErrorInfo);
    /** Format error like rustc style with colors and context */
    format(sourceText?: string): string;
}
//# sourceMappingURL=errors.d.ts.map