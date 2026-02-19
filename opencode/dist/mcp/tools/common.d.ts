import type { MfdDocument } from "../../core/parser/ast.js";
export interface ToolResponse {
    content: Array<{
        type: "text";
        text: string;
    }>;
    isError?: boolean;
}
export declare function loadDocument(filePath: string, resolveIncludes?: boolean): {
    doc: MfdDocument;
    source: string;
};
//# sourceMappingURL=common.d.ts.map