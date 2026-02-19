/**
 * Re-export relationship engine from mfd-core.
 * All logic has been moved to packages/mfd-core/src/relationships/.
 */
export type { ConstructRef, ApiRef, EntityFieldRef, Relationships } from "../core/relationships/index.js";
export { emptyRelationships, computeRelationships, makeKey, addUnique } from "../core/relationships/index.js";
//# sourceMappingURL=relationships.d.ts.map