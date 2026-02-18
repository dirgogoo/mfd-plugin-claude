import { loadDocument } from "./common.js";
import { semanticDiff } from "../../core/cli/commands/diff.js";
export function handleDiff(args) {
    const { doc: doc1 } = loadDocument(args.file1, args.resolve_includes);
    const { doc: doc2 } = loadDocument(args.file2, args.resolve_includes);
    const diffs = semanticDiff(doc1, doc2);
    const added = diffs.filter(d => d.type === "added");
    const removed = diffs.filter(d => d.type === "removed");
    const modified = diffs.filter(d => d.type === "modified");
    const result = {
        summary: {
            added: added.length,
            removed: removed.length,
            modified: modified.length,
            total: diffs.length,
        },
        diffs,
    };
    return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
}
//# sourceMappingURL=diff.js.map