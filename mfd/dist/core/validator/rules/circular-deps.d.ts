import type { MfdDocument } from "../../parser/ast.js";
import type { ValidationDiagnostic } from "../index.js";
/**
 * CIRCULAR_DEP: Checks that the dependency graph between components is a DAG.
 */
export declare function circularDeps(doc: MfdDocument): ValidationDiagnostic[];
//# sourceMappingURL=circular-deps.d.ts.map