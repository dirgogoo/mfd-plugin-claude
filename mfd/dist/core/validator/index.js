import { referentialIntegrity } from "./rules/referential-integrity.js";
import { circularDeps } from "./rules/circular-deps.js";
import { stateCompleteness } from "./rules/state-completeness.js";
import { typeConsistency } from "./rules/type-consistency.js";
import { decoratorValidation } from "./rules/decorator-validation.js";
import { uniqueNames } from "./rules/unique-names.js";
import { flowCompleteness } from "./rules/flow-completeness.js";
import { ruleCompleteness } from "./rules/rule-completeness.js";
import { screenCompleteness } from "./rules/screen-completeness.js";
import { journeyCompleteness } from "./rules/journey-completeness.js";
import { duplicateSecrets } from "./rules/duplicate-secrets.js";
import { relationValidation } from "./rules/relation-validation.js";
import { stateTriggerValidation } from "./rules/state-trigger-validation.js";
import { operationCompleteness } from "./rules/operation-completeness.js";
import { flowOperationValidation } from "./rules/flow-operation-validation.js";
import { ruleOperationValidation } from "./rules/rule-operation-validation.js";
import { actionCompleteness } from "./rules/action-completeness.js";
import { streamEndpointValidation } from "./rules/stream-endpoint-validation.js";
import { inheritanceValidation } from "./rules/inheritance-validation.js";
import { elementCompleteness } from "./rules/element-completeness.js";
const allRules = [
    referentialIntegrity,
    circularDeps,
    stateCompleteness,
    typeConsistency,
    decoratorValidation,
    uniqueNames,
    flowCompleteness,
    ruleCompleteness,
    screenCompleteness,
    journeyCompleteness,
    duplicateSecrets,
    relationValidation,
    stateTriggerValidation,
    operationCompleteness,
    flowOperationValidation,
    ruleOperationValidation,
    actionCompleteness,
    streamEndpointValidation,
    inheritanceValidation,
    elementCompleteness,
];
/**
 * Validate an MFD document against all semantic rules.
 */
export function validate(doc) {
    const diagnostics = [];
    for (const rule of allRules) {
        diagnostics.push(...rule(doc));
    }
    const errors = diagnostics.filter((d) => d.severity === "error");
    const warnings = diagnostics.filter((d) => d.severity === "warning");
    return {
        valid: errors.length === 0,
        errors,
        warnings,
    };
}
// ANSI color helpers (disabled when NO_COLOR is set or not a TTY)
const useColor = process.stderr.isTTY && !process.env["NO_COLOR"];
const c = {
    red: (s) => useColor ? `\x1b[31m${s}\x1b[0m` : s,
    yellow: (s) => useColor ? `\x1b[33m${s}\x1b[0m` : s,
    cyan: (s) => useColor ? `\x1b[36m${s}\x1b[0m` : s,
    green: (s) => useColor ? `\x1b[32m${s}\x1b[0m` : s,
    bold: (s) => useColor ? `\x1b[1m${s}\x1b[0m` : s,
    dim: (s) => useColor ? `\x1b[2m${s}\x1b[0m` : s,
};
/**
 * Format a diagnostic in rustc-style output with colors and context.
 */
export function formatDiagnostic(diag, sourceText) {
    const loc = diag.location.start;
    const file = diag.source ?? "<input>";
    const lines = [];
    const severityColor = diag.severity === "error" ? c.red : c.yellow;
    const header = `${severityColor(c.bold(`${diag.severity}[${diag.code}]`))}: ${c.bold(diag.message)}`;
    lines.push(header);
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
            // Error line with pointer
            lines.push(`${c.cyan(lineNum)} ${pipe} ${sourceLine}`);
            const col = loc.column - 1;
            const endCol = diag.location.end.line === loc.line
                ? diag.location.end.column - 1
                : sourceLine.length;
            const underLen = Math.max(1, endCol - col);
            const underline = " ".repeat(col) + severityColor("^".repeat(underLen));
            lines.push(`${pad} ${pipe} ${underline}`);
        }
    }
    if (diag.help) {
        lines.push(`  ${c.cyan("help")}: ${diag.help}`);
    }
    return lines.join("\n");
}
//# sourceMappingURL=index.js.map