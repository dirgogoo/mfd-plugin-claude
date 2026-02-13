import type { MfdDocument } from "../../parser/ast.js";
import type { ValidationDiagnostic } from "../index.js";
/**
 * FLOW_STEP_UNRESOLVED / FLOW_BRANCH_UNRESOLVED: Strict validation that
 * flow steps and branches reference declared operations.
 * Only active when the model declares >= 1 operation (opt-in).
 *
 * FLOW_TRIGGER_UNRESOLVED: `on EventName` in flow body must reference a declared event.
 * FLOW_EMITS_UNRESOLVED: `emits EventName` in flow body must reference a declared event.
 */
export declare function flowOperationValidation(doc: MfdDocument): ValidationDiagnostic[];
//# sourceMappingURL=flow-operation-validation.d.ts.map