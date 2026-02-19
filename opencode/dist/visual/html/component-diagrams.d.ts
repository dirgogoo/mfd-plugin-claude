/**
 * Component-scoped Mermaid diagram generators.
 * Produces diagrams filtered to show only constructs belonging to a specific component.
 */
import type { ModelSnapshot } from "../types.js";
export declare function renderComponentEntityDiagram(snapshot: ModelSnapshot, compName: string): string | null;
export declare function renderComponentStateDiagram(snapshot: ModelSnapshot, compName: string): string | null;
export declare function renderComponentFlowDiagram(snapshot: ModelSnapshot, compName: string): string | null;
export declare function renderComponentScreenDiagram(snapshot: ModelSnapshot, compName: string): string | null;
export declare function renderComponentJourneyDiagram(snapshot: ModelSnapshot, compName: string): string | null;
export declare function renderComponentDepDiagram(snapshot: ModelSnapshot, compName: string): string | null;
/**
 * Generates a relationship diagram showing ALL constructs in a component
 * and how they connect to each other. Uses the precomputed relationships
 * from the RelationshipEngine.
 */
export declare function renderComponentRelationshipDiagram(snapshot: ModelSnapshot, compName: string): string | null;
//# sourceMappingURL=component-diagrams.d.ts.map