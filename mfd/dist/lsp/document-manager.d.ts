import { TextDocuments } from "vscode-languageserver/node.js";
import { TextDocument } from "vscode-languageserver-textdocument";
import type { MfdDocument } from "../core/parser/ast.js";
import type { CollectedModel } from "../core/validator/collect.js";
import type { ParseDiagnostic } from "../core/parser/errors.js";
export interface DocumentModel {
    doc: MfdDocument;
    model: CollectedModel;
    parseErrors: ParseDiagnostic[];
    version: number;
}
export declare class DocumentManager {
    readonly documents: TextDocuments<TextDocument>;
    private cache;
    constructor();
    /**
     * Get parsed model for a document URI, using cache when possible.
     */
    getModel(uri: string): DocumentModel | null;
    /**
     * Invalidate cache for a URI.
     */
    invalidate(uri: string): void;
    /**
     * Get known types for completion (primitives + entities + enums).
     */
    getKnownTypes(uri: string): Set<string>;
    /**
     * Get known names for references (entities, enums, flows, events, etc.).
     */
    getKnownNames(uri: string): Set<string>;
}
//# sourceMappingURL=document-manager.d.ts.map