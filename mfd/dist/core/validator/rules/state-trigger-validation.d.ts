import type { MfdDocument } from "../../parser/ast.js";
import type { ValidationDiagnostic } from "../index.js";
/**
 * STATE_TRIGGER_UNRESOLVED: Checks that state transition triggers
 * reference declared events or flows (reactive pattern).
 */
export declare function stateTriggerValidation(doc: MfdDocument): ValidationDiagnostic[];
//# sourceMappingURL=state-trigger-validation.d.ts.map