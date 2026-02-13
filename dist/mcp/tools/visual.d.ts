/**
 * MCP tools for MFD Scope — visual server management
 * mfd_visual_start, mfd_visual_stop, mfd_visual_navigate
 */
import type { ToolResponse } from "./common.js";
export declare function handleVisualStart(args: {
    file: string;
    port?: number;
    open?: boolean;
    resolve_includes?: boolean;
}): Promise<ToolResponse>;
export declare function handleVisualStop(): Promise<ToolResponse>;
export declare function handleVisualRestart(): Promise<ToolResponse>;
export declare function handleVisualNavigate(args: {
    view: "overview" | "component" | "entity" | "state" | "flow" | "screen" | "journey" | "dashboard";
    name?: string;
}): Promise<ToolResponse>;
//# sourceMappingURL=visual.d.ts.map