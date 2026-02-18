import type { MfdDocument } from "../../parser/ast.js";
import type { ValidationDiagnostic } from "../index.js";
/**
 * JOURNEY_INVALID: Checks journey references and structure.
 * JOURNEY_UNREACHABLE_SCREEN: Screen used as `from` but never as `to` (except entry point).
 * JOURNEY_DUPLICATE_TRANSITION: Duplicate from->to:trigger transition.
 */
export declare function journeyCompleteness(doc: MfdDocument): ValidationDiagnostic[];
//# sourceMappingURL=journey-completeness.d.ts.map