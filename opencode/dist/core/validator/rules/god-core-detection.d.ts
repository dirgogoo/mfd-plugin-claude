import type { MfdDocument } from "../../parser/ast.js";
import type { ValidationDiagnostic } from "../index.js";
/**
 * God Core anti-pattern detection:
 *
 * GOD_CORE: A component containing > 60% of all constructs in the system.
 *   Counts all body items except SemanticComment, DepDecl, and SecretDecl.
 *   Skip: systems with < 2 components.
 */
export declare function godCoreDetection(doc: MfdDocument): ValidationDiagnostic[];
//# sourceMappingURL=god-core-detection.d.ts.map