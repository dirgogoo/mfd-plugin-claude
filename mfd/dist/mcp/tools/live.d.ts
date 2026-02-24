import { type ToolResponse } from "./common.js";
interface LiveArgs {
    file: string;
    action: "mark" | "strip" | "strip-all" | "list-pending";
    construct?: string;
    component?: string;
    threshold?: number;
    page?: number;
    resolve_includes?: boolean;
}
export declare function handleLive(args: LiveArgs): ToolResponse;
export {};
//# sourceMappingURL=live.d.ts.map