import { TextDocuments } from "vscode-languageserver/node.js";
import { TextDocument } from "vscode-languageserver-textdocument";
import type { MfdDocument } from "../core/parser/ast.js";
import type { CollectedModel } from "../core/validator/collect.js";
import type { ParseDiagnostic } from "../core/parser/errors.js";
import { WorkspaceManager } from "./workspace-manager.js";
export interface DocumentModel {
    doc: MfdDocument;
    model: CollectedModel;
    parseErrors: ParseDiagnostic[];
    version: number;
}
export declare class DocumentManager {
    readonly documents: TextDocuments<TextDocument>;
    readonly workspace: WorkspaceManager;
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
    /**
     * Get merged known types (local + imported). Falls back to single-file.
     */
    getMergedKnownTypes(uri: string): Set<string>;
    /**
     * Get merged known names (local + imported). Falls back to single-file.
     */
    getMergedKnownNames(uri: string): Set<string>;
    /**
     * Search for a declaration by name across all files in the import graph.
     */
    findCrossFileDefinition(fromUri: string, targetName: string): {
        uri: string;
        node: any;
    } | null;
}
//# sourceMappingURL=document-manager.d.ts.map