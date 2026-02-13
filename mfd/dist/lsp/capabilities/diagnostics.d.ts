import type { Connection } from "vscode-languageserver/node.js";
import type { DocumentManager } from "../document-manager.js";
export declare function setupDiagnostics(connection: Connection, docManager: DocumentManager): void;
export declare function sendDiagnostics(connection: Connection, docManager: DocumentManager, uri: string): void;
//# sourceMappingURL=diagnostics.d.ts.map