import type { MfdDocument } from "../../parser/ast.js";
import type { ValidationDiagnostic } from "../index.js";
/**
 * OPERATION_EVENT_UNRESOLVED: Checks that operation emits/on clauses
 * reference declared events.
 *
 * OPERATION_RULE_UNRESOLVED: Checks that operation enforces clauses
 * reference declared rules.
 *
 * OPERATION_HANDLES_UNRESOLVED: handles endpoint not found in any API.
 * OPERATION_CALLS_UNRESOLVED: calls endpoint not found in any API (including @external).
 *
 * FLOW_HANDLES_UNRESOLVED: flow handles endpoint not found in any API.
 * FLOW_CALLS_FORBIDDEN: flows cannot use 'calls' — only operations can consume endpoints.
 *   Flows can receive endpoints with 'handles', but cannot consume them with 'calls'.
 *
 * API_ENDPOINT_ORPHAN: API endpoint has no flow or operation handling it.
 *   Every non-@external API endpoint should have a flow or operation with
 *   'handles METHOD /path' connecting it. APIs don't connect to entities directly —
 *   the chain is: API → Flow/Operation (handles) → Entity (params/return).
 *
 * RULE_ORPHAN: Warning when a rule has no operation enforcing it
 * (only when model has >= 1 operation — opt-in).
 */
export declare function operationCompleteness(doc: MfdDocument): ValidationDiagnostic[];
//# sourceMappingURL=operation-completeness.d.ts.map