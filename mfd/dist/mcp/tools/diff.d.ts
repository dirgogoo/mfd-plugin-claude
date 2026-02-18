import { type ToolResponse } from "./common.js";
interface DiffArgs {
    file1: string;
    file2: string;
    resolve_includes?: boolean;
}
export declare function handleDiff(args: DiffArgs): ToolResponse;
export {};
//# sourceMappingURL=diff.d.ts.map