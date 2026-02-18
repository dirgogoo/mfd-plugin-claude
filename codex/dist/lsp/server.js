#!/usr/bin/env node
/**
 * MFD-DSL Language Server
 *
 * Provides IDE features for .mfd files:
 * - Diagnostics (errors/warnings in real-time)
 * - Auto-completion (keywords, types, references, decorators)
 * - Hover information (construct summaries)
 * - Go-to-definition (navigate to declarations)
 * - Document symbols (outline view)
 */
import { createConnection, ProposedFeatures, TextDocumentSyncKind, } from "vscode-languageserver/node.js";
import { DocumentManager } from "./document-manager.js";
import { setupDiagnostics } from "./capabilities/diagnostics.js";
import { getCompletions } from "./capabilities/completion.js";
import { getHover } from "./capabilities/hover.js";
import { getDefinition } from "./capabilities/definition.js";
import { getDocumentSymbols } from "./capabilities/symbols.js";
// Create connection via stdio
const connection = createConnection(ProposedFeatures.all);
const docManager = new DocumentManager();
connection.onInitialize((_params) => {
    return {
        capabilities: {
            textDocumentSync: TextDocumentSyncKind.Incremental,
            completionProvider: {
                triggerCharacters: ["@", ":", "(", ">"],
                resolveProvider: false,
            },
            hoverProvider: true,
            definitionProvider: true,
            documentSymbolProvider: true,
        },
    };
});
// Wire up capabilities
setupDiagnostics(connection, docManager);
connection.onCompletion((params) => {
    return getCompletions(params, docManager);
});
connection.onHover((params) => {
    return getHover(params, docManager);
});
connection.onDefinition((params) => {
    return getDefinition(params, docManager);
});
connection.onDocumentSymbol((params) => {
    return getDocumentSymbols(params.textDocument.uri, docManager);
});
// Listen on documents
docManager.documents.listen(connection);
connection.listen();
//# sourceMappingURL=server.js.map