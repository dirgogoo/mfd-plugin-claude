import type { MfdDocument } from "../../parser/ast.js";
import type { ValidationDiagnostic } from "../index.js";
/**
 * OPERATION_EVENT_UNRESOLVED: Checks that operation emits/on clauses
 * reference declared events.
 *
 * OPERATION_RULE_UNRESOLVED: Checks that operation enforces clauses
 * reference declared rules.
 *
 * OPERATION_HANDLES_UNRESOLVED: handles endpoint not found in any API.
 * OPERATION_CALLS_UNRESOLVED: calls endpoint not found in any API (including @external).
 *
 * RULE_ORPHAN: Warning when a rule has no operation enforcing it
 * (only when model has >= 1 operation — opt-in).
 */
export declare function operationCompleteness(doc: MfdDocument): ValidationDiagnostic[];
//# sourceMappingURL=operation-completeness.d.ts.map