/**
 * V2 relationships — simplified.
 * V2 relationships are inferred from:
 * - concept field references (concept→concept, concept→enum)
 * - concept lifecycle references (concept→enum for lifecycle enumRef, lifecycle→capability for triggers)
 * - capability affects/given/then references (capability→concept)
 * - invariant expression references (invariant→concept)
 * - property expression references (property→concept)
 * - objective transitions (objective→capability)
 * - capability emits clauses (capability→event name)
 */
import type { CollectedModelV2 } from "./v2-types.js";
export interface RelationshipV2 {
    from: {
        type: string;
        name: string;
    };
    to: {
        type: string;
        name: string;
    };
    relation: string;
}
/**
 * Compute all relationships from a v2 model.
 */
export declare function computeRelationshipsV2(model: CollectedModelV2): RelationshipV2[];
//# sourceMappingURL=relationships.d.ts.map