/**
 * Pure computation of model statistics.
 * Extracted from mfd-claude for reuse by mfd-visual and other consumers.
 */
import type { CollectedModel } from "../validator/collect.js";
export interface ConstructCounts {
    systems: number;
    components: number;
    nodes: number;
    elements: number;
    entities: number;
    enums: number;
    flows: number;
    states: number;
    events: number;
    signals: number;
    apis: number;
    rules: number;
    deps: number;
    secrets: number;
    screens: number;
    journeys: number;
    operations: number;
    actions: number;
    total: number;
}
export interface DetailCounts {
    entityFields: number;
    elementProps: number;
    eventFields: number;
    signalFields: number;
    enumValues: number;
    apiEndpoints: number;
    streamEndpoints: number;
    externalApis: number;
    transitions: number;
    actionResults: number;
    screenForms: number;
    journeySteps: number;
    abstractConstructs: number;
    interfaceConstructs: number;
    inheritanceRelations: number;
}
export interface DependencyGraphStats {
    nodes: number;
    edges: number;
    maxDepth: number;
    cycles: number;
}
export interface CompletenessStats {
    total: number;
    withStatus: number;
    withImpl: number;
    withTests: number;
    withVerified: number;
    withLive: number;
    statusPct: number;
    implPct: number;
    testsPct: number;
    verifiedPct: number;
    livePct: number;
}
export interface ComponentCompleteness {
    name: string;
    status: string | null;
    constructs: {
        type: string;
        name: string;
        impl: string[];
        tests: string | null;
        verified: string | null;
    }[];
    implDone: number;
    implTotal: number;
    testsDone: number;
    testsTotal: number;
    verifiedDone: number;
    verifiedTotal: number;
}
export interface ModelStats {
    counts: ConstructCounts;
    details: DetailCounts;
    tokens: number;
    dependencyGraph: DependencyGraphStats | null;
    completeness: CompletenessStats;
    componentCompleteness: ComponentCompleteness[];
}
export declare function computeStats(model: CollectedModel, source: string): ModelStats;
//# sourceMappingURL=stats.d.ts.map