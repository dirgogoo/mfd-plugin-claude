import type { TypeExpr } from "../../parser/ast.js";
import type { CollectedModel } from "../collect.js";
/**
 * Normalize a path for comparison: remove trailing slashes.
 */
export declare function normalizePath(p: string): string;
/**
 * Extract the base type name from a TypeExpr for comparison purposes.
 * Returns null for primitives (no mismatch check needed).
 */
export declare function baseTypeName(t: TypeExpr | null | undefined): string | null;
/**
 * Extract path parameters from a URL path (e.g. /users/:id -> ["id"])
 */
export declare function extractPathParams(path: string): string[];
/**
 * Get field names from an entity by looking it up in the model.
 */
export declare function getEntityFields(typeName: string, entities: {
    name: string;
    fields: {
        name: string;
    }[];
}[]): Set<string> | null;
/**
 * Collect all type names referenced by TypeExpr nodes across the entire model.
 * Walks entity fields, element props/forms, flow params/return, operation params/return,
 * API endpoint types, screen forms, event/signal fields, and inline object fields recursively.
 */
export declare function collectAllTypeReferences(model: CollectedModel): Set<string>;
/**
 * Resolve all API endpoints from the model into a Map of "METHOD fullPath" -> type info.
 */
export declare function resolveApiEndpoints(model: CollectedModel): Map<string, {
    inputType: TypeExpr | null;
    returnType: TypeExpr | null;
}>;
//# sourceMappingURL=shared-helpers.d.ts.map