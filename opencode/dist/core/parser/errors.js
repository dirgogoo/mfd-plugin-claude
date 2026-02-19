/** Standard parse error codes */
export const PARSE_CODES = {
    E001: { label: "syntax", description: "Generic syntax error" },
    E002: { label: "unexpected-token", description: "Unexpected token encountered" },
    E003: { label: "unclosed-brace", description: "Unclosed brace or block" },
    E004: { label: "missing-name", description: "Missing construct name" },
    E005: { label: "missing-type", description: "Missing type annotation" },
    E006: { label: "invalid-decorator", description: "Malformed decorator syntax" },
    E007: { label: "missing-body", description: "Missing construct body" },
    E008: { label: "invalid-transition", description: "Malformed state transition" },
    E009: { label: "invalid-endpoint", description: "Malformed API endpoint" },
    E010: { label: "recovered", description: "Construct recovered with errors (partial parse)" },
    E011: { label: "eof", description: "Unexpected end of file" },
};
/**
 * Classify a raw parse error message into a standard code using heuristics.
 */
export function classifyParseError(message) {
    const msg = message.toLowerCase();
    if (msg.includes("end of input") || msg.includes("unexpected end"))
        return "E011";
    if (msg.includes("unclosed") || msg.includes("expected \"}\"") || msg.includes("missing \"}\""))
        return "E003";
    if (msg.includes("unexpected"))
        return "E002";
    if (msg.includes("missing name") || msg.includes("expected identifier"))
        return "E004";
    if (msg.includes("missing type") || msg.includes("expected type"))
        return "E005";
    if (msg.includes("decorator") || msg.includes("@"))
        return "E006";
    if (msg.includes("missing body") || msg.includes("expected \"{\""))
        return "E007";
    if (msg.includes("transition") || msg.includes("->"))
        return "E008";
    if (msg.includes("endpoint") || msg.includes("GET ") || msg.includes("POST "))
        return "E009";
    if (msg.includes("recover"))
        return "E010";
    return "E001";
}
// ANSI color helpers (disabled when NO_COLOR is set or not a TTY)
const useColor = process.stderr.isTTY && !process.env["NO_COLOR"];
const c = {
    red: (s) => useColor ? `\x1b[31m${s}\x1b[0m` : s,
    cyan: (s) => useColor ? `\x1b[36m${s}\x1b[0m` : s,
    bold: (s) => useColor ? `\x1b[1m${s}\x1b[0m` : s,
    dim: (s) => useColor ? `\x1b[2m${s}\x1b[0m` : s,
};
export class MfdParseError extends Error {
    code;
    location;
    source;
    expected;
    found;
    constructor(info) {
        super(info.message);
        this.name = "MfdParseError";
        this.code = classifyParseError(info.message);
        this.location = info.location;
        this.source = info.source;
        this.expected = info.expected;
        this.found = info.found;
    }
    /** Format error like rustc style with colors and context */
    format(sourceText) {
        const loc = this.location.start;
        const file = this.source ?? "<input>";
        const lines = [];
        lines.push(`${c.red(c.bold(`error[${this.code}]`))}: ${c.bold(this.message)}`);
        lines.push(`  ${c.cyan("-->")} ${file}:${loc.line}:${loc.column}`);
        if (sourceText) {
            const sourceLines = sourceText.split("\n");
            const lineIdx = loc.line - 1;
            if (lineIdx >= 0 && lineIdx < sourceLines.length) {
                const sourceLine = sourceLines[lineIdx];
                const lineNum = String(loc.line);
                const pad = " ".repeat(lineNum.length);
                const pipe = c.cyan("|");
                // Context: line before
                if (lineIdx > 0) {
                    const prevNum = String(loc.line - 1);
                    const prevPad = " ".repeat(lineNum.length - prevNum.length);
                    lines.push(`${c.dim(prevPad + prevNum)} ${pipe} ${c.dim(sourceLines[lineIdx - 1])}`);
                }
                lines.push(`${c.cyan(lineNum)} ${pipe} ${sourceLine}`);
                const col = loc.column - 1;
                const underline = " ".repeat(col) + c.red("^");
                lines.push(`${pad} ${pipe} ${underline}`);
            }
        }
        if (this.expected && this.expected.length > 0) {
            lines.push(`  ${c.cyan("expected")}: ${this.expected.join(", ")}`);
        }
        if (this.found) {
            lines.push(`  ${c.cyan("found")}: ${this.found}`);
        }
        return lines.join("\n");
    }
}
//# sourceMappingURL=errors.js.map