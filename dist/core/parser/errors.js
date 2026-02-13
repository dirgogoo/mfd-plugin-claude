// ANSI color helpers (disabled when NO_COLOR is set or not a TTY)
const useColor = process.stderr.isTTY && !process.env["NO_COLOR"];
const c = {
    red: (s) => useColor ? `\x1b[31m${s}\x1b[0m` : s,
    cyan: (s) => useColor ? `\x1b[36m${s}\x1b[0m` : s,
    bold: (s) => useColor ? `\x1b[1m${s}\x1b[0m` : s,
    dim: (s) => useColor ? `\x1b[2m${s}\x1b[0m` : s,
};
export class MfdParseError extends Error {
    location;
    source;
    expected;
    found;
    constructor(info) {
        super(info.message);
        this.name = "MfdParseError";
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
        lines.push(`${c.red(c.bold("error"))}: ${c.bold(this.message)}`);
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