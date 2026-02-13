/**
 * Convert MFD SourceRange (1-based) to LSP Range (0-based).
 */
export function toRange(loc) {
    return {
        start: { line: loc.start.line - 1, character: loc.start.column - 1 },
        end: { line: loc.end.line - 1, character: loc.end.column - 1 },
    };
}
/**
 * Convert LSP Position (0-based) to MFD-style line/column (1-based).
 */
export function fromPosition(pos) {
    return { line: pos.line + 1, column: pos.character + 1 };
}
/**
 * Check if a position is within a source range.
 */
function positionInRange(pos, loc) {
    const line = pos.line + 1; // convert to 1-based
    const col = pos.character + 1;
    if (line < loc.start.line || line > loc.end.line)
        return false;
    if (line === loc.start.line && col < loc.start.column)
        return false;
    if (line === loc.end.line && col > loc.end.column)
        return false;
    return true;
}
/**
 * Find the most specific AST node at a given LSP position.
 */
export function findNodeAtPosition(doc, position) {
    let best = null;
    function visit(node) {
        if (!node.loc)
            return;
        if (!positionInRange(position, node.loc))
            return;
        // This node contains the position — it's a candidate
        best = node;
        // Try to find a more specific child
        if (node.type === "MfdDocument") {
            for (const item of node.body) {
                visit(item);
            }
        }
        else if (node.type === "SystemDecl") {
            const sys = node;
            for (const item of sys.body) {
                visit(item);
            }
        }
        else if (node.type === "ComponentDecl") {
            const comp = node;
            for (const item of comp.body) {
                visit(item);
            }
        }
        else if ("fields" in node && Array.isArray(node.fields)) {
            for (const field of node.fields) {
                visit(field);
            }
        }
        else if ("body" in node && Array.isArray(node.body)) {
            for (const item of node.body) {
                if (item && typeof item === "object" && "type" in item) {
                    visit(item);
                }
            }
        }
        else if ("endpoints" in node && Array.isArray(node.endpoints)) {
            for (const ep of node.endpoints) {
                visit(ep);
            }
        }
        else if ("transitions" in node && Array.isArray(node.transitions)) {
            for (const t of node.transitions) {
                visit(t);
            }
        }
        // Check decorators
        if ("decorators" in node && Array.isArray(node.decorators)) {
            for (const d of node.decorators) {
                visit(d);
            }
        }
        // Check fieldType
        if ("fieldType" in node && node.fieldType) {
            visit(node.fieldType);
        }
        // Check returnType, params, etc.
        if ("returnType" in node && node.returnType) {
            visit(node.returnType);
        }
        if ("params" in node && Array.isArray(node.params)) {
            for (const p of node.params) {
                if (p && typeof p === "object" && "type" in p) {
                    visit(p);
                }
            }
        }
    }
    visit(doc);
    return best;
}
/**
 * Collect all named constructs from AST for searching by name.
 */
export function collectNamedNodes(doc) {
    const result = [];
    function visitItems(items) {
        for (const item of items) {
            if ("name" in item && typeof item.name === "string") {
                result.push({ name: item.name, node: item });
            }
            if (item.type === "SystemDecl") {
                visitItems(item.body);
            }
            else if (item.type === "ComponentDecl") {
                visitItems(item.body);
            }
        }
    }
    visitItems(doc.body);
    return result;
}
//# sourceMappingURL=position.js.map