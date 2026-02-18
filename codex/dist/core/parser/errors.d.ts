import type { SourceRange } from "./ast.js";
/** Standard parse error codes */
export declare const PARSE_CODES: {
    readonly E001: {
        readonly label: "syntax";
        readonly description: "Generic syntax error";
    };
    readonly E002: {
        readonly label: "unexpected-token";
        readonly description: "Unexpected token encountered";
    };
    readonly E003: {
        readonly label: "unclosed-brace";
        readonly description: "Unclosed brace or block";
    };
    readonly E004: {
        readonly label: "missing-name";
        readonly description: "Missing construct name";
    };
    readonly E005: {
        readonly label: "missing-type";
        readonly description: "Missing type annotation";
    };
    readonly E006: {
        readonly label: "invalid-decorator";
        readonly description: "Malformed decorator syntax";
    };
    readonly E007: {
        readonly label: "missing-body";
        readonly description: "Missing construct body";
    };
    readonly E008: {
        readonly label: "invalid-transition";
        readonly description: "Malformed state transition";
    };
    readonly E009: {
        readonly label: "invalid-endpoint";
        readonly description: "Malformed API endpoint";
    };
    readonly E010: {
        readonly label: "recovered";
        readonly description: "Construct recovered with errors (partial parse)";
    };
    readonly E011: {
        readonly label: "eof";
        readonly description: "Unexpected end of file";
    };
};
export type ParseCode = keyof typeof PARSE_CODES;
/**
 * Classify a raw parse error message into a standard code using heuristics.
 */
export declare function classifyParseError(message: string): ParseCode;
export interface ParseDiagnostic {
    code: ParseCode;
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
    readonly code: ParseCode;
    readonly location: SourceRange;
    readonly source?: string;
    readonly expected?: string[];
    readonly found?: string;
    constructor(info: ParseErrorInfo);
    /** Format error like rustc style with colors and context */
    format(sourceText?: string): string;
}
//# sourceMappingURL=errors.d.ts.map