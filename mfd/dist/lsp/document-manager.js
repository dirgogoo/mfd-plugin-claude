import { TextDocuments, } from "vscode-languageserver/node.js";
import { TextDocument } from "vscode-languageserver-textdocument";
import { readFileSync, existsSync } from "node:fs";
import { parseWithRecovery } from "../core/parser/index.js";
import { collectModel, getKnownTypes, getKnownNames } from "../core/validator/collect.js";
import { WorkspaceManager } from "./workspace-manager.js";
import { collectNamedNodes } from "./utils/position.js";
export class DocumentManager {
    documents;
    workspace;
    cache = new Map();
    constructor() {
        this.documents = new TextDocuments(TextDocument);
        this.workspace = new WorkspaceManager();
        // Hook: change → workspace.invalidate (with live text)
        this.documents.onDidChangeContent((change) => {
            const fp = WorkspaceManager.uriToPath(change.document.uri);
            if (fp)
                this.workspace.invalidate(fp, change.document.getText());
        });
        // Hook: close → workspace.invalidate (from disk)
        this.documents.onDidClose((event) => {
            this.invalidate(event.document.uri);
            const fp = WorkspaceManager.uriToPath(event.document.uri);
            if (fp)
                this.workspace.invalidate(fp);
        });
    }
    /**
     * Get parsed model for a document URI, using cache when possible.
     */
    getModel(uri) {
        const textDoc = this.documents.get(uri);
        if (!textDoc)
            return null;
        const cached = this.cache.get(uri);
        if (cached && cached.version === textDoc.version) {
            return cached;
        }
        const text = textDoc.getText();
        const result = parseWithRecovery(text, { source: uri });
        const model = collectModel(result.document);
        const entry = {
            doc: result.document,
            model,
            parseErrors: result.errors,
            version: textDoc.version,
        };
        this.cache.set(uri, entry);
        return entry;
    }
    /**
     * Invalidate cache for a URI.
     */
    invalidate(uri) {
        this.cache.delete(uri);
    }
    /**
     * Get known types for completion (primitives + entities + enums).
     */
    getKnownTypes(uri) {
        const entry = this.getModel(uri);
        if (!entry)
            return new Set();
        return getKnownTypes(entry.model);
    }
    /**
     * Get known names for references (entities, enums, flows, events, etc.).
     */
    getKnownNames(uri) {
        const entry = this.getModel(uri);
        if (!entry)
            return new Set();
        return getKnownNames(entry.model);
    }
    /**
     * Get merged known types (local + imported). Falls back to single-file.
     */
    getMergedKnownTypes(uri) {
        const fp = WorkspaceManager.uriToPath(uri);
        if (fp) {
            const merged = this.workspace.getMergedKnownTypes(fp);
            if (merged)
                return merged;
        }
        return this.getKnownTypes(uri);
    }
    /**
     * Get merged known names (local + imported). Falls back to single-file.
     */
    getMergedKnownNames(uri) {
        const fp = WorkspaceManager.uriToPath(uri);
        if (fp) {
            const merged = this.workspace.getMergedKnownNames(fp);
            if (merged)
                return merged;
        }
        return this.getKnownNames(uri);
    }
    /**
     * Search for a declaration by name across all files in the import graph.
     */
    findCrossFileDefinition(fromUri, targetName) {
        const fp = WorkspaceManager.uriToPath(fromUri);
        if (!fp)
            return null;
        const entry = this.workspace.getEntryFor(fp);
        if (!entry)
            return null;
        for (const includedPath of entry.result.files) {
            const includedUri = WorkspaceManager.pathToUri(includedPath);
            // Prefer open document (in-memory); fall back to disk
            let docEntry = this.getModel(includedUri);
            if (!docEntry && existsSync(includedPath)) {
                try {
                    const text = readFileSync(includedPath, "utf-8");
                    const parsed = parseWithRecovery(text, { source: includedUri });
                    docEntry = {
                        doc: parsed.document,
                        model: collectModel(parsed.document),
                        parseErrors: parsed.errors,
                        version: -1,
                    };
                }
                catch {
                    continue;
                }
            }
            if (!docEntry)
                continue;
            const namedNodes = collectNamedNodes(docEntry.doc);
            for (const { name, node: n } of namedNodes) {
                if (name === targetName) {
                    return { uri: includedUri, node: n };
                }
            }
        }
        return null;
    }
}
//# sourceMappingURL=document-manager.js.map