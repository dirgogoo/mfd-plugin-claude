/**
 * CLI command: mfd strip-verified <file> [--baseline <baseline>]
 *
 * Without --baseline: strips ALL @verified decorators from the file.
 * With --baseline: uses semanticDiff to strip @verified only from
 *   constructs that were structurally modified.
 */
export declare function stripVerifiedCommand(file: string, opts: {
    baseline?: string;
}): void;
/**
 * Strips ALL @verified decorators from source text.
 * Returns the modified source and count of strippings.
 * Uses leading-space-aware regex to avoid collapsing indentation.
 */
export declare function stripAllVerified(source: string): {
    source: string;
    count: number;
};
//# sourceMappingURL=strip-verified.d.ts.map