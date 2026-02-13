import { type ToolResponse } from "./common.js";
interface QueryArgs {
    file: string;
    resolve_includes?: boolean;
    component?: string;
    type?: string;
    name?: string;
}
export declare function handleQuery(args: QueryArgs): ToolResponse;
export {};
//# sourceMappingURL=query.d.ts.map