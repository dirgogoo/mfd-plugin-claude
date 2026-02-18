import type { MfdDocument } from "../../parser/ast.js";
import type { ValidationDiagnostic } from "../index.js";
/**
 * Screen completeness checks:
 *
 * SCREEN_FORM_NO_ACTION: screen has a form but no action with `calls` from that screen.
 * SCREEN_NOT_REFERENCED: screen is not referenced in any action or journey
 *   (only checked when model has actions or journeys).
 */
export declare function screenCompleteness(doc: MfdDocument): ValidationDiagnostic[];
//# sourceMappingURL=screen-completeness.d.ts.map