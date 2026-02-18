import type { MfdDocument } from "../../parser/ast.js";
import type { ValidationDiagnostic } from "../index.js";
/**
 * RULE_ACTION_UNRESOLVED: Strict validation that rule `then`, `elseif then`,
 * and `else` clauses reference declared operations or flows.
 * Only active when the model declares >= 1 operation (opt-in).
 */
export declare function ruleOperationValidation(doc: MfdDocument): ValidationDiagnostic[];
//# sourceMappingURL=rule-operation-validation.d.ts.map