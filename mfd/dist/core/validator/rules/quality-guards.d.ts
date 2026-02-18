import type { MfdDocument } from "../../parser/ast.js";
import type { ValidationDiagnostic } from "../index.js";
/**
 * Quality guard rules for modeling best practices:
 *
 * ENTITY_NO_ID: Entity without an `id` field or any @unique field.
 *   Skip: @abstract, @interface entities.
 *
 * ENTITY_TOO_MANY_FIELDS: Entity with 15+ fields.
 *   Skip: @abstract entities.
 *
 * FLOW_TOO_FEW_STEPS: Flow with < 3 FlowStep items.
 *   Skip: @abstract flows.
 *
 * FLOW_TOO_MANY_STEPS: Flow with > 7 FlowStep items.
 *   Skip: @abstract flows.
 */
export declare function qualityGuards(doc: MfdDocument): ValidationDiagnostic[];
//# sourceMappingURL=quality-guards.d.ts.map