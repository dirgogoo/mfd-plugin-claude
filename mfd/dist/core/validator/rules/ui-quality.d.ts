import type { MfdDocument } from "../../parser/ast.js";
import type { ValidationDiagnostic } from "../index.js";
/**
 * UI quality rules:
 *
 * ELEMENT_NOT_USED: Concrete element not referenced by any screen's `uses` clause.
 *   Skip: @abstract, @interface elements. Opt-in: only when model has screens.
 *
 * ACTION_NO_FROM: Action without a `from` clause (malformed).
 *   Opt-in: only when model has screens.
 *
 * ACTION_NO_RESULT: Action with calls/on but no result branches for navigation.
 *   Skip: pure actions (no calls, no on STREAM, no on Signal).
 *
 * ACTION_DUPLICATE_OUTCOME: Two or more ActionResult with the same outcome string.
 */
export declare function uiQuality(doc: MfdDocument): ValidationDiagnostic[];
//# sourceMappingURL=ui-quality.d.ts.map