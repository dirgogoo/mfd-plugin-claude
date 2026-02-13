import type { MfdDocument } from "../../parser/ast.js";
import type { ValidationDiagnostic } from "../index.js";
/**
 * TYPE_UNKNOWN: Checks that all field types are either primitive or declared.
 * (This overlaps with referential-integrity but focuses specifically on entity/event fields)
 */
export declare function typeConsistency(doc: MfdDocument): ValidationDiagnostic[];
//# sourceMappingURL=type-consistency.d.ts.map