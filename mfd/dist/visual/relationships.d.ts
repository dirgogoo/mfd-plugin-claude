/**
 * Relationship Engine — computes bidirectional links between constructs.
 *
 * Analyzes the CollectedModel to build a graph of references:
 * - Entity fields with ReferenceType → entity↔entity
 * - Action `from Screen` + `calls API` → action→screen, action→api
 * - API endpoint input/output types → api→entity (detail-level only, NOT overview graph)
 * - Flow/Operation `handles` endpoint → flow→api, operation→api
 * - State `enumRef` → state→enum
 * - Flow steps with entity/event names → flow→entity, flow→event
 *
 * Connection model: API → Flow/Operation (via handles) → Entity (via params/return).
 * APIs do NOT connect directly to entities in the overview graph.
 * Only operations can consume endpoints (calls); flows can only serve them (handles).
 *
 * Uses the central constructComponentMap to resolve which component owns each construct.
 */
import type { CollectedModel } from "../core/validator/collect.js";
export interface ConstructRef {
    component: string;
    type: "element" | "entity" | "enum" | "flow" | "api" | "state" | "event" | "signal" | "rule" | "screen" | "journey" | "operation" | "action";
    name: string;
}
export interface ApiRef {
    method: string;
    path: string;
    component: string;
}
export interface EntityFieldRef {
    entity: string;
    field: string;
    component: string;
}
export interface Relationships {
    usedByFlows: ConstructRef[];
    exposedByApi: ApiRef[];
    governedByStates: ConstructRef[];
    governedByRules: ConstructRef[];
    referencedByEntities: EntityFieldRef[];
    emitsEvents: ConstructRef[];
    actionSources: ConstructRef[];
    calledByActions: ConstructRef[];
    involvedEntities: ConstructRef[];
    involvedEvents: ConstructRef[];
    targetFlow: ConstructRef | null;
    enumRef: ConstructRef | null;
    triggeredByEvents: ConstructRef[];
    triggersStates: ConstructRef[];
    usesOperations: ConstructRef[];
    usedByOperations: ConstructRef[];
    triggeredByRules: ConstructRef[];
    triggersOperations: ConstructRef[];
    enforcesRules: ConstructRef[];
    enforcedByOperations: ConstructRef[];
    emitsSignals: ConstructRef[];
    onSignals: ConstructRef[];
    signalEmittedByActions: ConstructRef[];
    signalListenedByActions: ConstructRef[];
    handlesEndpoints: ApiRef[];
    callsEndpoints: ApiRef[];
    extendsParent: ConstructRef | null;
    extendedByChildren: ConstructRef[];
    implementsInterfaces: ConstructRef[];
    implementedByConcretes: ConstructRef[];
}
declare function makeKey(component: string, type: string, name: string): string;
export declare function computeRelationships(model: CollectedModel, constructComponentMap: Map<string, string>): Map<string, Relationships>;
export { makeKey };
//# sourceMappingURL=relationships.d.ts.map