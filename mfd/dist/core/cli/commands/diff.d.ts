import type { MfdDocument } from "../../parser/ast.js";
export interface DiffEntry {
    type: "added" | "removed" | "modified";
    kind: string;
    name: string;
    details?: string;
}
export declare function diffCommand(file1: string, file2: string): void;
export declare function semanticDiff(doc1: MfdDocument, doc2: MfdDocument): DiffEntry[];
//# sourceMappingURL=diff.d.ts.map