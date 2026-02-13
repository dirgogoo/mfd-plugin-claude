import { SymbolKind, } from "vscode-languageserver/node.js";
import { toRange } from "../utils/position.js";
const SYMBOL_KIND_MAP = {
    SystemDecl: SymbolKind.Module,
    ComponentDecl: SymbolKind.Namespace,
    EntityDecl: SymbolKind.Class,
    EnumDecl: SymbolKind.Enum,
    FlowDecl: SymbolKind.Function,
    StateDecl: SymbolKind.Event,
    EventDecl: SymbolKind.Event,
    SignalDecl: SymbolKind.Event,
    OperationDecl: SymbolKind.Operator,
    ActionDecl: SymbolKind.Function,
    ElementDecl: SymbolKind.Struct,
    ApiDecl: SymbolKind.Interface,
    RuleDecl: SymbolKind.Constant,
    ScreenDecl: SymbolKind.Struct,
    JourneyDecl: SymbolKind.Object,
    DepDecl: SymbolKind.Variable,
    SecretDecl: SymbolKind.Key,
};
export function getDocumentSymbols(uri, docManager) {
    const entry = docManager.getModel(uri);
    if (!entry)
        return [];
    return buildSymbols(entry.doc.body);
}
function buildSymbols(items) {
    const symbols = [];
    for (const item of items) {
        if (item.type === "SemanticComment" || item.type === "ErrorNode" || item.type === "IncludeDecl") {
            continue;
        }
        const kind = SYMBOL_KIND_MAP[item.type] ?? SymbolKind.Variable;
        const name = getItemName(item);
        if (!name)
            continue;
        const range = toRange(item.loc);
        const symbol = {
            name,
            kind,
            range,
            selectionRange: range,
            children: [],
        };
        // Recurse into containers
        if (item.type === "SystemDecl") {
            symbol.children = buildSymbols(item.body);
        }
        else if (item.type === "ComponentDecl") {
            symbol.children = buildSymbols(item.body);
        }
        else if (item.type === "EntityDecl") {
            // Add fields as children
            const entity = item;
            symbol.children = entity.fields.map((f) => ({
                name: `${f.name}: ${typeToString(f.fieldType)}`,
                kind: SymbolKind.Field,
                range: toRange(f.loc),
                selectionRange: toRange(f.loc),
            }));
        }
        else if (item.type === "EnumDecl") {
            const enumDecl = item;
            symbol.children = enumDecl.values.map((v) => ({
                name: v.name,
                kind: SymbolKind.EnumMember,
                range: toRange(v.loc),
                selectionRange: toRange(v.loc),
            }));
        }
        else if (item.type === "EventDecl" || item.type === "SignalDecl") {
            const decl = item;
            if (decl.fields?.length > 0) {
                symbol.children = decl.fields.map((f) => ({
                    name: `${f.name}: ${typeToString(f.fieldType)}`,
                    kind: SymbolKind.Field,
                    range: toRange(f.loc),
                    selectionRange: toRange(f.loc),
                }));
            }
        }
        else if (item.type === "ApiDecl") {
            const api = item;
            symbol.children = api.endpoints.map((ep) => ({
                name: `${ep.method} ${ep.path}`,
                kind: SymbolKind.Method,
                range: toRange(ep.loc),
                selectionRange: toRange(ep.loc),
            }));
        }
        symbols.push(symbol);
    }
    return symbols;
}
function getItemName(item) {
    if ("name" in item && typeof item.name === "string") {
        return item.name;
    }
    if (item.type === "DepDecl") {
        return `dep -> ${item.target}`;
    }
    if (item.type === "ApiDecl") {
        return item.name ?? `api ${item.style}`;
    }
    return null;
}
function typeToString(t) {
    if (!t)
        return "void";
    switch (t.type) {
        case "PrimitiveType":
        case "ReferenceType":
            return t.name;
        case "OptionalType":
            return `${typeToString(t.inner)}?`;
        case "ArrayType":
            return `${typeToString(t.inner)}[]`;
        case "UnionType":
            return t.alternatives.map(typeToString).join(" | ");
        default:
            return "unknown";
    }
}
//# sourceMappingURL=symbols.js.map