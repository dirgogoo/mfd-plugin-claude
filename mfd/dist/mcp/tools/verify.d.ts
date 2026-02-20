import { type ToolResponse } from "./common.js";
interface VerifyArgs {
    file: string;
    action: "mark" | "strip" | "strip-all" | "list-pending" | "mark-from-file";
    construct?: string;
    component?: string;
    threshold?: number;
    batch_size?: number;
    page?: number;
    group_by?: "component";
    codePath?: string;
    resolve_includes?: boolean;
}
export declare function handleVerify(args: VerifyArgs): ToolResponse;
export {};
//# sourceMappingURL=verify.d.ts.map