import { collectModel } from "../../core/validator/collect.js";
import { generateContract, serializeContract, } from "../../core/contract/index.js";
import { loadDocument } from "./common.js";
export function handleContract(args) {
    const { doc } = loadDocument(args.file, args.resolve_includes);
    const model = collectModel(doc);
    const contract = generateContract(model);
    const json = serializeContract(contract);
    return {
        content: [{ type: "text", text: json }],
    };
}
//# sourceMappingURL=contract.js.map