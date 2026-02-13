import type { MfdDocument } from "../../parser/ast.js";
import type { ValidationDiagnostic } from "../index.js";
/**
 * FLOW_REF: Warns when flow steps reference entities/flows that don't exist
 * in the model. This is a soft check since step actions are semi-structured.
 */
export declare function flowCompleteness(doc: MfdDocument): ValidationDiagnostic[];
//# sourceMappingURL=flow-completeness.d.ts.map