import { type ToolResponse } from "./common.js";
interface TraceArgs {
    file: string;
    name?: string;
    component?: string;
    resolve_includes?: boolean;
    mark?: {
        construct: string;
        paths: string[];
    };
    markTests?: {
        construct: string;
        paths: string[];
    };
}
/**
 * Traceability tool: reads @impl/@tests decorators and verifies file existence.
 * Also supports writing @impl back to the .mfd file.
 */
export declare function handleTrace(args: TraceArgs): ToolResponse;
export {};
//# sourceMappingURL=trace.d.ts.map