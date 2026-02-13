import type { MfdDocument } from "../../parser/ast.js";
import type { ValidationDiagnostic } from "../index.js";
/**
 * RULE_INCOMPLETE: Warns when a rule is missing when or then clauses.
 * RULE_CLAUSE_ORDER: Error when else appears before when/then, or multiple else clauses.
 */
export declare function ruleCompleteness(doc: MfdDocument): ValidationDiagnostic[];
//# sourceMappingURL=rule-completeness.d.ts.map