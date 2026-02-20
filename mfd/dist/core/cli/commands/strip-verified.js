import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "../../parser/index.js";
import { semanticDiff } from "./diff.js";
/**
 * CLI command: mfd strip-verified <file> [--baseline <baseline>]
 *
 * Without --baseline: strips ALL @verified decorators from the file.
 * With --baseline: uses semanticDiff to strip @verified only from
 *   constructs that were structurally modified.
 */
export function stripVerifiedCommand(file, opts) {
    const absPath = resolve(file);
    const source = readFileSync(absPath, "utf-8");
    let stripped;
    let count;
    if (opts.baseline) {
        const baselineSource = readFileSync(resolve(opts.baseline), "utf-8");
        const docBaseline = parse(baselineSource, { source: opts.baseline });
        const docCurrent = parse(source, { source: absPath });
        const diffs = semanticDiff(docBaseline, docCurrent);
        const modifiedNames = new Set(diffs
            .filter((d) => d.type === "modified" || d.type === "removed")
            .map((d) => d.name));
        if (modifiedNames.size === 0) {
            console.log("No structural changes detected — @verified decorators unchanged.");
            return;
        }
        const result = stripVerifiedFromNames(source, modifiedNames);
        stripped = result.source;
        count = result.count;
        console.log(`Stripped @verified from ${count} construct(s) with structural changes: ${[...modifiedNames].join(", ")}`);
    }
    else {
        const result = stripAllVerified(source);
        stripped = result.source;
        count = result.count;
        console.log(`Stripped ${count} @verified decorator(s) from ${file}`);
    }
    if (count > 0) {
        writeFileSync(absPath, stripped, "utf-8");
    }
}
/**
 * Strips ALL @verified decorators from source text.
 * Returns the modified source and count of strippings.
 * Uses leading-space-aware regex to avoid collapsing indentation.
 */
export function stripAllVerified(source) {
    let count = 0;
    const result = source
        .split("\n")
        .map((line) => {
        // Remove " @verified(...)" — include leading space to avoid double-space
        const withParens = line.replace(/[ \t]*@verified\s*\([^)]*\)/g, () => { count++; return ""; });
        // Remove standalone " @verified" (word boundary, not followed by opening paren)
        const standalone = withParens.replace(/[ \t]*@verified\b(?!\s*\()/g, () => { count++; return ""; });
        return standalone.replace(/\s+$/, "");
    })
        .join("\n");
    return { source: result, count };
}
/**
 * Strips @verified only from lines declaring constructs in the given names set.
 */
function stripVerifiedFromNames(source, names) {
    let count = 0;
    const declRegex = /^(\s*)(entity|flow|screen|enum|state|event|signal|operation|action|element|rule|journey|api|component)\s+(\S+)/;
    const lines = source.split("\n");
    for (let i = 0; i < lines.length; i++) {
        const m = declRegex.exec(lines[i]);
        if (m && names.has(m[3])) {
            const before = lines[i];
            lines[i] = lines[i]
                .replace(/[ \t]*@verified\s*\([^)]*\)/g, () => { count++; return ""; })
                .replace(/[ \t]*@verified\b(?!\s*\()/g, () => { count++; return ""; })
                .replace(/\s+$/, "");
            if (before !== lines[i]) {
                console.log(`  stripped @verified from: ${m[2]} ${m[3]}`);
            }
        }
    }
    return { source: lines.join("\n"), count };
}
//# sourceMappingURL=strip-verified.js.map