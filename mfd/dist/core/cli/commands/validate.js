import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseWithRecovery } from "../../parser/index.js";
import { resolveFile } from "../../resolver/index.js";
import { validate, formatDiagnostic } from "../../validator/index.js";
import { MfdParseError } from "../../parser/errors.js";
// ANSI color helpers
const useColor = process.stdout.isTTY && !process.env["NO_COLOR"];
const cc = {
    red: (s) => useColor ? `\x1b[31m${s}\x1b[0m` : s,
    yellow: (s) => useColor ? `\x1b[33m${s}\x1b[0m` : s,
    green: (s) => useColor ? `\x1b[32m${s}\x1b[0m` : s,
    bold: (s) => useColor ? `\x1b[1m${s}\x1b[0m` : s,
};
export function validateCommand(file, options) {
    const filePath = resolve(file);
    let source;
    try {
        source = readFileSync(filePath, "utf-8");
    }
    catch {
        console.error(cc.red(`error: Cannot read file '${filePath}'`));
        process.exit(1);
    }
    const shouldResolve = options.resolve ?? /^\s*(import|include)\s+"/m.test(source);
    let doc;
    let parseErrors = [];
    if (shouldResolve) {
        try {
            const result = resolveFile(filePath);
            if (result.errors.length > 0) {
                for (const err of result.errors) {
                    console.error(cc.red(`error: ${err.message}`));
                }
                process.exit(1);
            }
            doc = result.document;
        }
        catch (err) {
            if (err instanceof MfdParseError) {
                console.error(err.format(source));
                process.exit(1);
            }
            throw err;
        }
    }
    else {
        const parseResult = parseWithRecovery(source, { source: filePath });
        doc = parseResult.document;
        parseErrors = parseResult.errors;
    }
    // Show parse-level errors (syntax errors recovered from)
    for (const pe of parseErrors) {
        const diag = {
            code: "E000",
            severity: "error",
            message: pe.message,
            location: pe.location,
            source: filePath,
        };
        console.error(formatDiagnostic(diag, source));
        console.error();
    }
    const result = validate(doc);
    const totalErrors = parseErrors.length + result.errors.length;
    const totalWarnings = result.warnings.length;
    if (totalErrors === 0 && totalWarnings === 0) {
        console.log(`${cc.green("\u2713")} ${filePath} is valid`);
        process.exit(0);
    }
    for (const err of result.errors) {
        console.error(formatDiagnostic({ ...err, source: filePath }, source));
        console.error();
    }
    for (const warn of result.warnings) {
        console.log(formatDiagnostic({ ...warn, source: filePath }, source));
        console.log();
    }
    const summary = [];
    if (totalErrors > 0) {
        summary.push(cc.red(cc.bold(`${totalErrors} error(s)`)));
    }
    if (totalWarnings > 0) {
        summary.push(cc.yellow(`${totalWarnings} warning(s)`));
    }
    console.log(summary.join(", "));
    if (totalErrors > 0) {
        process.exit(1);
    }
    else if (totalWarnings > 0) {
        process.exit(2);
    }
}
//# sourceMappingURL=validate.js.map