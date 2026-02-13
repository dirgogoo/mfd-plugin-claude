import type { MfdDocument } from "../../parser/ast.js";
import type { ValidationDiagnostic } from "../index.js";
/**
 * STREAM_HAS_INPUT: STREAM endpoint must not have input type (subscriptions are read-only).
 * STREAM_INVALID_RETURN: STREAM endpoint must return a declared event type.
 * STREAM_MISSING_RETURN: STREAM endpoint must have a return type.
 */
export declare function streamEndpointValidation(doc: MfdDocument): ValidationDiagnostic[];
//# sourceMappingURL=stream-endpoint-validation.d.ts.map