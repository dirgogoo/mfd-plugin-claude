import { collectModel } from "../../core/validator/collect.js";
import { type ToolResponse } from "./common.js";
type Model = ReturnType<typeof collectModel>;
export declare function handleRender(args: {
    file: string;
    diagram_type: string;
    resolve_includes?: boolean;
}): ToolResponse;
export declare function renderComponentDiagram(model: Model): string;
export declare function renderEntityDiagram(model: Model): string;
export declare function renderStateDiagram(model: Model): string;
export declare function renderFlowDiagram(model: Model): string;
export declare function renderScreenDiagram(model: Model): string;
export declare function renderJourneyDiagram(model: Model): string;
export declare function renderDeploymentDiagram(model: Model): string;
export {};
//# sourceMappingURL=render.d.ts.map