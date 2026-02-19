import { type ToolResponse } from "./common.js";
interface ContextArgs {
    file: string;
    name: string;
    type?: string;
    depth?: number;
    compact?: boolean;
    resolve_includes?: boolean;
}
/**
 * Given a construct name, return it + all related constructs via BFS on the relationship graph.
 */
export declare function handleContext(args: ContextArgs): ToolResponse;
export {};
//# sourceMappingURL=context.d.ts.map