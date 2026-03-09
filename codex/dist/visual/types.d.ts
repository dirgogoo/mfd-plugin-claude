import type { CollectedModelV2 } from "./v2-types.js";
export type DiagramType = "domain" | "concept" | "lifecycle" | "capability" | "objective" | "invariant" | "property";
export type ConstructType = "concept" | "enum" | "capability" | "invariant" | "property" | "objective";
export interface DiagramSet {
    domain: string;
    concept: string;
    lifecycle: string;
    capability: string;
    objective: string;
    invariant: string;
    property: string;
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
export interface DomainInfo {
    name: string;
    filePath: string;
    constructCounts: Record<string, number>;
    implDone: number;
    implTotal: number;
    verifiedDone: number;
    verifiedTotal: number;
}
export interface ModelSnapshot {
    systemName: string;
    systemVersion: string | null;
    model: CollectedModelV2;
    diagrams: DiagramSet;
    stats: StatsV2;
    validation: ValidationResult;
    domains: DomainInfo[];
    /** Maps "type:name" (e.g. "concept:User") → domain name. */
    constructDomainMap: Map<string, string>;
    timestamp: number;
    filePath: string;
}
/** Simplified stats for v2 models. */
export interface StatsV2 {
    counts: {
        concepts: number;
        enums: number;
        capabilities: number;
        invariants: number;
        properties: number;
        objectives: number;
        total: number;
    };
    completeness: {
        total: number;
        withImpl: number;
        implPct: number;
        withVerified: number;
        verifiedPct: number;
    };
    domainCompleteness: DomainCompleteness[];
}
export interface DomainCompleteness {
    name: string;
    constructs: {
        type: string;
        name: string;
        impl: string[];
        verified: number;
    }[];
    implDone: number;
    implTotal: number;
    verifiedDone: number;
    verifiedTotal: number;
}
//# sourceMappingURL=types.d.ts.map