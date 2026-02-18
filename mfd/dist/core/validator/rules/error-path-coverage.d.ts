import type { MfdDocument } from "../../parser/ast.js";
import type { ValidationDiagnostic } from "../index.js";
/**
 * Error path coverage rules:
 *
 * FLOW_MISSING_ERROR_BRANCH: Flow whose returnType is a UnionType (contains |)
 *   but no FlowStep in the body has any branches.
 *   Skip: @abstract flows, flows without returnType, flows with non-union returnType.
 *
 * ACTION_MISSING_ERROR_BRANCH: Action with a `calls` clause but only 1 ActionResult
 *   branch (no error handling).
 *   Skip: actions without `calls`.
 */
export declare function errorPathCoverage(doc: MfdDocument): ValidationDiagnostic[];
//# sourceMappingURL=error-path-coverage.d.ts.map