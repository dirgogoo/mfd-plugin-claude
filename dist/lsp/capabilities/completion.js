import { CompletionItemKind, } from "vscode-languageserver/node.js";
import { CONSTRUCT_KEYWORDS, PRIMITIVE_TYPES, COMMON_DECORATORS, API_STYLES, HTTP_METHODS, SCREEN_KEYWORDS, FLOW_KEYWORDS, RULE_KEYWORDS, OPERATION_KEYWORDS, ACTION_KEYWORDS, } from "../utils/keywords.js";
export function getCompletions(params, docManager) {
    const { textDocument, position } = params;
    const doc = docManager.documents.get(textDocument.uri);
    if (!doc)
        return [];
    const text = doc.getText();
    const lines = text.split("\n");
    const line = lines[position.line] ?? "";
    const prefix = line.slice(0, position.character);
    const items = [];
    // Decorator completion (triggered by @)
    if (prefix.endsWith("@") || /@\w*$/.test(prefix)) {
        for (const d of COMMON_DECORATORS) {
            items.push({
                label: `@${d}`,
                kind: CompletionItemKind.Property,
                detail: `MFD decorator`,
                insertText: needsParens(d) ? `${d}($1)` : d,
                insertTextFormat: 2, // Snippet
            });
        }
        return items;
    }
    // Type completion (after : or ->)
    if (/:\s*\w*$/.test(prefix) || /->\s*\w*$/.test(prefix)) {
        // Primitive types
        for (const t of PRIMITIVE_TYPES) {
            items.push({
                label: t,
                kind: CompletionItemKind.TypeParameter,
                detail: "Primitive type",
            });
        }
        // Model types (entities + enums)
        const knownTypes = docManager.getKnownTypes(textDocument.uri);
        for (const t of knownTypes) {
            if (PRIMITIVE_TYPES.includes(t))
                continue; // skip dupes
            items.push({
                label: t,
                kind: CompletionItemKind.Class,
                detail: "Model type",
            });
        }
        return items;
    }
    // Check if line starts blank or nearly blank — top-level keyword
    if (/^\s*\w*$/.test(prefix)) {
        // Construct keywords
        for (const kw of CONSTRUCT_KEYWORDS) {
            items.push({
                label: kw,
                kind: CompletionItemKind.Keyword,
                detail: `MFD construct`,
            });
        }
        // Screen sub-keywords
        for (const kw of SCREEN_KEYWORDS) {
            items.push({
                label: kw,
                kind: CompletionItemKind.Keyword,
                detail: "Screen construct",
            });
        }
        // Flow sub-keywords
        for (const kw of FLOW_KEYWORDS) {
            items.push({
                label: kw,
                kind: CompletionItemKind.Keyword,
                detail: "Flow keyword",
            });
        }
        // Rule sub-keywords
        for (const kw of RULE_KEYWORDS) {
            items.push({
                label: kw,
                kind: CompletionItemKind.Keyword,
                detail: "Rule keyword",
            });
        }
        // Operation sub-keywords
        for (const kw of OPERATION_KEYWORDS) {
            items.push({
                label: kw,
                kind: CompletionItemKind.Keyword,
                detail: "Operation keyword",
            });
        }
        // Action sub-keywords
        for (const kw of ACTION_KEYWORDS) {
            items.push({
                label: kw,
                kind: CompletionItemKind.Keyword,
                detail: "Action keyword",
            });
        }
        // API styles
        for (const s of API_STYLES) {
            items.push({
                label: s,
                kind: CompletionItemKind.EnumMember,
                detail: "API style",
            });
        }
        // HTTP methods
        for (const m of HTTP_METHODS) {
            items.push({
                label: m,
                kind: CompletionItemKind.EnumMember,
                detail: "HTTP method",
            });
        }
        // Named references
        const knownNames = docManager.getKnownNames(textDocument.uri);
        for (const name of knownNames) {
            items.push({
                label: name,
                kind: CompletionItemKind.Reference,
                detail: "Model reference",
            });
        }
    }
    return items;
}
function needsParens(decorator) {
    const withParams = [
        "version", "status", "format", "min", "max",
        "rate_limit", "cache", "prefix", "impl", "tests",
        "requires", "rotation", "provider", "type", "layout", "persona",
    ];
    return withParams.includes(decorator);
}
//# sourceMappingURL=completion.js.map