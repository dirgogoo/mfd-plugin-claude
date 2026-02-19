import { DiagnosticSeverity } from "vscode-languageserver/node.js";
import { validate } from "../../core/validator/index.js";
import { WorkspaceManager } from "../workspace-manager.js";
import { toRange } from "../utils/position.js";
export function setupDiagnostics(connection, docManager) {
    // Trigger diagnostics on document change
    docManager.documents.onDidChangeContent((change) => {
        sendDiagnostics(connection, docManager, change.document.uri);
    });
    // Clear diagnostics when document closes
    docManager.documents.onDidClose((event) => {
        docManager.invalidate(event.document.uri);
        connection.sendDiagnostics({ uri: event.document.uri, diagnostics: [] });
    });
}
export function sendDiagnostics(connection, docManager, uri) {
    const entry = docManager.getModel(uri);
    if (!entry)
        return;
    const diagnostics = [];
    // Resolver errors (import not found, circular includes)
    const filePath = WorkspaceManager.uriToPath(uri);
    const resolvedEntry = filePath ? docManager.workspace.getEntryFor(filePath) : null;
    if (resolvedEntry) {
        for (const re of resolvedEntry.result.errors) {
            if (re.type === "FILE_NOT_FOUND" || re.type === "CIRCULAR_INCLUDE") {
                diagnostics.push({
                    severity: re.type === "FILE_NOT_FOUND"
                        ? DiagnosticSeverity.Error
                        : DiagnosticSeverity.Warning,
                    range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } },
                    message: re.message,
                    source: "mfd-resolver",
                });
            }
        }
    }
    // Parse-level errors
    for (const pe of entry.parseErrors) {
        diagnostics.push({
            severity: DiagnosticSeverity.Error,
            range: toRange(pe.location),
            message: pe.message,
            source: "mfd",
        });
    }
    // Validation errors/warnings
    const result = validate(entry.doc);
    for (const err of result.errors) {
        diagnostics.push({
            severity: DiagnosticSeverity.Error,
            range: toRange(err.location),
            message: `[${err.code}] ${err.message}`,
            source: "mfd",
            ...(err.help ? { relatedInformation: [] } : {}),
        });
    }
    for (const warn of result.warnings) {
        diagnostics.push({
            severity: DiagnosticSeverity.Warning,
            range: toRange(warn.location),
            message: `[${warn.code}] ${warn.message}`,
            source: "mfd",
        });
    }
    connection.sendDiagnostics({ uri, diagnostics });
}
//# sourceMappingURL=diagnostics.js.map