/**
 * Relationship Engine — computes bidirectional links between constructs.
 *
 * Analyzes the CollectedModel to build a graph of references:
 * - Entity fields with ReferenceType -> entity<->entity
 * - Action `from Screen` + `calls API` -> action->screen, action->api
 * - API endpoint input/output types -> api->entity (detail-level only, NOT overview graph)
 * - Flow/Operation `handles` endpoint -> flow->api, operation->api
 * - State `enumRef` -> state->enum
 * - Flow steps with entity/event names -> flow->entity, flow->event
 *
 * Connection model: API -> Flow/Operation (via handles) -> Entity (via params/return).
 * APIs do NOT connect directly to entities in the overview graph.
 * Only operations can consume endpoints (calls); flows can only serve them (handles).
 *
 * Uses the central constructComponentMap to resolve which component owns each construct.
 */
import type { CollectedModel } from "../validator/collect.js";
import type { ConstructRef, Relationships } from "./types.js";
export declare function makeKey(component: string, type: string, name: string): string;
export declare function addUnique(arr: ConstructRef[], ref: ConstructRef): void;
export declare function computeRelationships(model: CollectedModel, constructComponentMap: Map<string, string>): Map<string, Relationships>;
//# sourceMappingURL=compute.d.ts.map