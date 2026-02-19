import type { Range, Position } from "vscode-languageserver";
import type { SourceRange, MfdDocument, BaseNode } from "../../core/parser/ast.js";
/**
 * Convert MFD SourceRange (1-based) to LSP Range (0-based).
 */
export declare function toRange(loc: SourceRange): Range;
/**
 * Convert LSP Position (0-based) to MFD-style line/column (1-based).
 */
export declare function fromPosition(pos: Position): {
    line: number;
    column: number;
};
/**
 * Find the most specific AST node at a given LSP position.
 */
export declare function findNodeAtPosition(doc: MfdDocument, position: Position): BaseNode | null;
/**
 * Collect all named constructs from AST for searching by name.
 */
export declare function collectNamedNodes(doc: MfdDocument): Array<{
    name: string;
    node: BaseNode;
}>;
//# sourceMappingURL=position.d.ts.map