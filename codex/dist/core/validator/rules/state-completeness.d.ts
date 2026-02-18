import type { MfdDocument } from "../../parser/ast.js";
import type { ValidationDiagnostic } from "../index.js";
/**
 * STATE_INVALID: Checks that all states referenced in transitions exist
 * in the associated enum.
 */
export declare function stateCompleteness(doc: MfdDocument): ValidationDiagnostic[];
//# sourceMappingURL=state-completeness.d.ts.map