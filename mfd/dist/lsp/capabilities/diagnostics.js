import { DiagnosticSeverity } from "vscode-languageserver/node.js";
import { validate } from "../../core/validator/index.js";
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