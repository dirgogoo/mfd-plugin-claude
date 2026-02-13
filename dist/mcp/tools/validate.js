import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseWithRecovery } from "../../core/parser/index.js";
import { MfdParseError } from "../../core/parser/errors.js";
import { validate, formatDiagnostic } from "../../core/validator/index.js";
import { resolveFile } from "../../core/resolver/index.js";
export function handleValidate(args) {
    const absPath = resolve(args.file);
    let source;
    let doc;
    try {
        source = readFileSync(absPath, "utf-8");
    }
    catch {
        return {
            content: [{ type: "text", text: `Cannot read file: ${absPath}` }],
            isError: true,
        };
    }
    let parseErrors = [];
    if (args.resolve_includes) {
        try {
            const result = resolveFile(absPath);
            if (result.errors.length > 0) {
                const msgs = result.errors
                    .map((e) => `error: ${e.message}`)
                    .join("\n");
                return {
                    content: [{ type: "text", text: msgs }],
                    isError: true,
                };
            }
            doc = result.document;
        }
        catch (err) {
            if (err instanceof MfdParseError) {
                return {
                    content: [{ type: "text", text: err.format(source) }],
                    isError: true,
                };
            }
            throw err;
        }
    }
    else {
        const parseResult = parseWithRecovery(source, { source: absPath });
        doc = parseResult.document;
        parseErrors = parseResult.errors;
    }
    const lines = [];
    // Show parse-level errors
    for (const pe of parseErrors) {
        lines.push(formatDiagnostic({
            code: "E000",
            severity: "error",
            message: pe.message,
            location: pe.location,
            source: absPath,
        }, source));
        lines.push("");
    }
    const result = validate(doc);
    const totalErrors = parseErrors.length + result.errors.length;
    if (totalErrors === 0 && result.warnings.length === 0) {
        lines.push(`\u2713 ${absPath} is valid`);
    }
    else {
        for (const err of result.errors) {
            lines.push(formatDiagnostic({ ...err, source: absPath }, source));
            lines.push("");
        }
        for (const warn of result.warnings) {
            lines.push(formatDiagnostic({ ...warn, source: absPath }, source));
            lines.push("");
        }
        const summary = [];
        if (totalErrors > 0)
            summary.push(`${totalErrors} error(s)`);
        if (result.warnings.length > 0)
            summary.push(`${result.warnings.length} warning(s)`);
        lines.push(summary.join(", "));
    }
    return {
        content: [{ type: "text", text: lines.join("\n") }],
        isError: totalErrors > 0,
    };
}
//# sourceMappingURL=validate.js.map