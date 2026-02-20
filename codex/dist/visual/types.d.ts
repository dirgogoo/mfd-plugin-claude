import type { CollectedModel } from "../core/validator/collect.js";
import type { ModelStats } from "../core/utils/stats.js";
import type { Relationships } from "../core/relationships/index.js";
export type DiagramType = "component" | "entity" | "state" | "flow" | "screen" | "journey";
export type ConstructType = "element" | "entity" | "enum" | "flow" | "api" | "state" | "event" | "signal" | "rule" | "screen" | "journey" | "operation" | "action";
export interface DiagramSet {
    component: string;
    entity: string;
    state: string;
    flow: string;
    screen: string;
    journey: string;
}
export interface ValidationResult {
    errors: {
        message: string;
        line?: number;
        column?: number;
    }[];
    warnings: {
        message: string;
        line?: number;
        column?: number;
    }[];
}
export interface ComponentInfo {
    name: string;
    status: string | null;
    constructCounts: Record<string, number>;
    implDone: number;
    implTotal: number;
    verifiedDone: number;
    verifiedTotal: number;
}
export interface ModelSnapshot {
    systemName: string;
    systemVersion: string | null;
    model: CollectedModel;
    diagrams: DiagramSet;
    stats: ModelStats;
    validation: ValidationResult;
    relationships: Map<string, Relationships>;
    components: ComponentInfo[];
    /** Maps "type:name" (e.g. "entity:User") → component name. Handles both nested and top-level constructs. */
    constructComponentMap: Map<string, string>;
    timestamp: number;
    filePath: string;
}
//# sourceMappingURL=types.d.ts.map