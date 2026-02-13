import type { MfdDocument } from "../../parser/ast.js";
import type { ValidationDiagnostic } from "../index.js";
/**
 * RELATION_INVALID: Validates @relation decorator usage on entity fields.
 *
 * 1. Cardinality value must be valid (one_to_one | one_to_many | many_to_one | many_to_many)
 * 2. @relation can only appear on fields whose type references an entity (not primitives)
 * 3. Cardinality must be coherent with the type form:
 *    - one_to_many / many_to_many → requires Entity[]
 *    - one_to_one / many_to_one → requires Entity (singular)
 */
export declare function relationValidation(doc: MfdDocument): ValidationDiagnostic[];
//# sourceMappingURL=relation-validation.d.ts.map