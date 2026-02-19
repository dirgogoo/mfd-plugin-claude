import type { CollectedModel } from "../validator/collect.js";
/**
 * Build a map from "type:name" to component name.
 *
 * Strategy:
 * 1. Direct nesting: constructs inside comp.body -> direct assignment
 * 2. API name matching: "AuthAPI" -> "Auth", "PostsAPI" -> "Posts"
 * 3. Heuristic: assign entities/flows/events/rules/states to components
 *    based on which component's APIs, flows, or rules reference them most.
 * 4. Fallback: if still unassigned, use text-matching heuristics.
 */
export declare function buildConstructComponentMap(model: CollectedModel): Map<string, string>;
export declare function declTypeToType(declType: string): string | null;
/**
 * Generate a unique map key for an API declaration.
 * APIs often have name=null (e.g. `api REST @prefix(/auth)` where "REST" is the style, not name).
 * We use style + @prefix to build a unique key: "api:REST:/clientes", "api:REST:/auth", etc.
 */
export declare function apiMapKey(api: any): string;
export declare function collectAllConstructNames(model: CollectedModel): string[];
export declare function extractTypeRefs(typeExpr: any): string[];
//# sourceMappingURL=component-map.d.ts.map