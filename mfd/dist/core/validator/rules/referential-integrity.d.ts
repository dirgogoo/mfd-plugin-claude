import type { MfdDocument } from "../../parser/ast.js";
import type { ValidationDiagnostic } from "../index.js";
/**
 * REF_UNRESOLVED: Checks that all type references in fields resolve to
 * declared entities, enums, or primitive types.
 *
 * Entity/event field types: error
 * Flow param/return and API types: warning (DTOs may be implicit)
 */
export declare function referentialIntegrity(doc: MfdDocument): ValidationDiagnostic[];
//# sourceMappingURL=referential-integrity.d.ts.map