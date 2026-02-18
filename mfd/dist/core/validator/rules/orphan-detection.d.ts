import type { MfdDocument } from "../../parser/ast.js";
import type { ValidationDiagnostic } from "../index.js";
/**
 * Orphan detection rules:
 *
 * ORPHAN_EVENT: event that is never emitted nor listened to
 *   (checks emits, on, state triggers, journey triggers)
 *
 * ORPHAN_FLOW: flow without `handles` clause
 *   (only when model has APIs; skip @abstract flows)
 *
 * ORPHAN_OPERATION: operation without `handles` clause and not referenced by any flow step
 *   (only when model has APIs; skip operations that have `on` or `calls` clauses)
 *
 * ORPHAN_SIGNAL: signal that is never emitted nor listened to by any action
 *   (skip @abstract signals)
 */
export declare function orphanDetection(doc: MfdDocument): ValidationDiagnostic[];
//# sourceMappingURL=orphan-detection.d.ts.map