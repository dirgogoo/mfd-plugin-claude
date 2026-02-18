import type { MfdDocument } from "../../parser/ast.js";
import type { ValidationDiagnostic } from "../index.js";
/**
 * Abstraction hygiene rules:
 *
 * ABSTRACT_NEVER_EXTENDED: @abstract construct that is never the target of `extends`.
 *   Types checked: entity, element, screen, flow, event, signal.
 *   Skip: when there are < 2 constructs of the same type.
 *
 * INTERFACE_NEVER_IMPLEMENTED: @interface construct that is never in `implements`.
 *   Types checked: entity, element, screen.
 *   Skip: when there are < 2 constructs of the same type.
 */
export declare function abstractionHygiene(doc: MfdDocument): ValidationDiagnostic[];
//# sourceMappingURL=abstraction-hygiene.d.ts.map