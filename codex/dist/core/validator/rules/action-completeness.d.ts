import type { MfdDocument } from "../../parser/ast.js";
import type { ValidationDiagnostic } from "../index.js";
/**
 * ACTION_FROM_UNRESOLVED: from screen not declared.
 * ACTION_CALLS_UNRESOLVED: calls endpoint not found in any API.
 * ACTION_RESULT_SCREEN_UNRESOLVED: result screen not declared.
 * ACTION_ON_STREAM_UNRESOLVED: on STREAM path not found as STREAM endpoint.
 * ACTION_ON_SIGNAL_UNRESOLVED: on Signal references signal not declared.
 * ACTION_EMITS_SIGNAL_UNRESOLVED: emits Signal references signal not declared.
 * ACTION_MIXED_PATTERNS: action cannot have both 'calls' and 'on STREAM'/'on Signal'.
 */
export declare function actionCompleteness(doc: MfdDocument): ValidationDiagnostic[];
//# sourceMappingURL=action-completeness.d.ts.map