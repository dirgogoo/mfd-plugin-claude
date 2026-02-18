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
 * Collect all type names referenced by TypeExpr nodes across the entire model.
 * Walks entity fields, element props/forms, flow params/return, operation params/return,
 * API endpoint types, screen forms, event/signal fields, and inline object fields recursively.
 */
export function collectAllTypeReferences(model) {
    const refs = new Set();
    function walkType(t) {
        if (!t)
            return;
        switch (t.type) {
            case "ReferenceType":
                refs.add(t.name);
                break;
            case "ArrayType":
            case "OptionalType":
                walkType(t.inner);
                break;
            case "UnionType":
                for (const alt of t.alternatives)
                    walkType(alt);
                break;
            case "InlineObjectType":
                for (const f of t.fields)
                    walkType(f.fieldType);
                break;
        }
    }
    // Entity fields
    for (const e of model.entities) {
        for (const f of e.fields)
            walkType(f.fieldType);
    }
    // Enum — no TypeExpr refs
    // Event fields
    for (const e of model.events) {
        for (const f of e.fields)
            walkType(f.fieldType);
    }
    // Signal fields
    for (const s of model.signals) {
        for (const f of s.fields)
            walkType(f.fieldType);
    }
    // Flow params + return
    for (const f of model.flows) {
        for (const p of f.params)
            walkType(p);
        walkType(f.returnType);
    }
    // Operation params + return
    for (const o of model.operations) {
        for (const p of o.params)
            walkType(p);
        walkType(o.returnType);
    }
    // API endpoints
    for (const api of model.apis) {
        for (const ep of api.endpoints) {
            if (ep.type === "ApiEndpointSimple") {
                walkType(ep.inputType);
                walkType(ep.returnType);
            }
            else {
                walkType(ep.body);
                walkType(ep.response);
                walkType(ep.query);
            }
        }
    }
    // Element props + forms
    for (const el of model.elements) {
        for (const item of el.body) {
            if (item.type === "PropDecl")
                walkType(item.propType);
            if (item.type === "FormDecl") {
                for (const f of item.fields)
                    walkType(f.fieldType);
            }
        }
    }
    // Screen forms
    for (const s of model.screens) {
        for (const item of s.body) {
            if (item.type === "FormDecl") {
                for (const f of item.fields)
                    walkType(f.fieldType);
            }
        }
    }
    return refs;
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