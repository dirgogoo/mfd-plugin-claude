/**
 * Domain-scoped Mermaid diagram generators for v2.
 * Produces diagrams filtered to show only constructs belonging to a specific domain.
 */
import type { ModelSnapshot } from "../types.js";
export declare function renderDomainConceptDiagram(snapshot: ModelSnapshot, domainName: string): string | null;
export declare function renderDomainLifecycleDiagram(snapshot: ModelSnapshot, domainName: string): string | null;
export declare function renderDomainCapabilityDiagram(snapshot: ModelSnapshot, domainName: string): string | null;
export declare function renderDomainObjectiveDiagram(snapshot: ModelSnapshot, domainName: string): string | null;
export declare function renderDomainInvariantDiagram(snapshot: ModelSnapshot, domainName: string): string | null;
export declare function renderDomainPropertyDiagram(snapshot: ModelSnapshot, domainName: string): string | null;
export declare function renderDomainRelationshipDiagram(snapshot: ModelSnapshot, domainName: string): string | null;
//# sourceMappingURL=domain-diagrams.d.ts.map