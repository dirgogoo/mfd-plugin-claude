/**
 * Normalize a path for comparison: remove trailing slashes.
 */
export function normalizePath(p) {
    return p.replace(/\/+$/, "") || "/";
}
/**
 * Extract the base type name from a TypeExpr for comparison purposes.
 * Returns null for primitives (no mismatch check needed).
 */
export function baseTypeName(t) {
    if (!t)
        return null;
    switch (t.type) {
        case "ReferenceType":
            return t.name;
        case "ArrayType":
        case "OptionalType":
            return baseTypeName(t.inner);
        case "UnionType":
            return t.alternatives
                .map((a) => baseTypeName(a))
                .filter(Boolean)
                .sort()
                .join(" | ");
        default:
            return null; // PrimitiveType, InlineObjectType — skip comparison
    }
}
/**
 * Extract path parameters from a URL path (e.g. /users/:id -> ["id"])
 */
export function extractPathParams(path) {
    const params = [];
    const regex = /:(\w+)/g;
    let match;
    while ((match = regex.exec(path)) !== null) {
        params.push(match[1]);
    }
    return params;
}
/**
 * Get field names from an entity by looking it up in the model.
 */
export function getEntityFields(typeName, entities) {
    const entity = entities.find((e) => e.name === typeName);
    if (!entity)
        return null;
    return new Set(entity.fields.map((f) => f.name));
}
/**
 * Resolve all API endpoints from the model into a Map of "METHOD fullPath" -> type info.
 */
export function resolveApiEndpoints(model) {
    const endpoints = new Map();
    for (const api of model.apis) {
        const prefixDeco = api.decorators.find((d) => d.name === "prefix");
        const prefixVal = prefixDeco?.params[0]
            ? String(prefixDeco.params[0].value)
            : "";
        for (const ep of api.endpoints) {
            const fullPath = normalizePath(prefixVal + ep.path);
            const key = `${ep.method} ${fullPath}`;
            const inputType = ep.type === "ApiEndpointSimple" ? ep.inputType : ep.body;
            const returnType = ep.type === "ApiEndpointSimple" ? ep.returnType : ep.response;
            endpoints.set(key, { inputType: inputType ?? null, returnType: returnType ?? null });
        }
    }
    return endpoints;
}
//# sourceMappingURL=shared-helpers.js.map