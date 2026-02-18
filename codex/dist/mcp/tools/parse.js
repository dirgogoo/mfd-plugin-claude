import { loadDocument } from "./common.js";
export function handleParse(args) {
    const { doc } = loadDocument(args.file, args.resolve_includes);
    return {
        content: [
            {
                type: "text",
                text: JSON.stringify(doc, null, 2),
            },
        ],
    };
}
//# sourceMappingURL=parse.js.map