import { TextDocuments, } from "vscode-languageserver/node.js";
import { TextDocument } from "vscode-languageserver-textdocument";
import { parseWithRecovery } from "../core/parser/index.js";
import { collectModel, getKnownTypes, getKnownNames } from "../core/validator/collect.js";
export class DocumentManager {
    documents;
    cache = new Map();
    constructor() {
        this.documents = new TextDocuments(TextDocument);
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
}
//# sourceMappingURL=document-manager.js.map