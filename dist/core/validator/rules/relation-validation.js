import { collectModel, getKnownTypes } from "../collect.js";
const VALID_CARDINALITIES = new Set([
    "one_to_one",
    "one_to_many",
    "many_to_one",
    "many_to_many",
]);
const PRIMITIVES = new Set([
    "string", "number", "boolean", "date", "datetime", "uuid", "void",
]);
/** Unwrap ArrayType / OptionalType to get the inner base type. */
function unwrapType(t) {
    if (t.type === "ArrayType") {
        return { base: t.inner, isArray: true };
    }
    if (t.type === "OptionalType") {
        return unwrapType(t.inner);
    }
    return { base: t, isArray: false };
}
/** Human-readable description of a type shape. */
function describeType(t) {
    switch (t.type) {
        case "PrimitiveType": return t.name;
        case "ReferenceType": return t.name;
        case "OptionalType": return `${describeType(t.inner)}?`;
        case "ArrayType": return `${describeType(t.inner)}[]`;
        case "UnionType": return t.alternatives.map(describeType).join(" | ");
        case "InlineObjectType": return "{ ... }";
    }
}
/**
 * RELATION_INVALID: Validates @relation decorator usage on entity fields.
 *
 * 1. Cardinality value must be valid (one_to_one | one_to_many | many_to_one | many_to_many)
 * 2. @relation can only appear on fields whose type references an entity (not primitives)
 * 3. Cardinality must be coherent with the type form:
 *    - one_to_many / many_to_many → requires Entity[]
 *    - one_to_one / many_to_one → requires Entity (singular)
 */
export function relationValidation(doc) {
    const model = collectModel(doc);
    const knownTypes = getKnownTypes(model);
    const entityNames = new Set(model.entities.map((e) => e.name));
    const diagnostics = [];
    for (const entity of model.entities) {
        for (const field of entity.fields) {
            const relationDeco = field.decorators.find((d) => d.name === "relation");
            if (!relationDeco)
                continue;
            // 1. Validate cardinality value
            const cardParam = relationDeco.params[0];
            if (!cardParam || cardParam.kind !== "identifier") {
                diagnostics.push({
                    code: "RELATION_INVALID",
                    severity: "error",
                    message: `@relation requires a cardinality parameter`,
                    location: relationDeco.loc,
                    help: `Valid values: ${[...VALID_CARDINALITIES].join(", ")}`,
                });
                continue;
            }
            const cardinality = cardParam.value;
            if (!VALID_CARDINALITIES.has(cardinality)) {
                diagnostics.push({
                    code: "RELATION_INVALID",
                    severity: "error",
                    message: `Invalid cardinality '${cardinality}' in @relation`,
                    location: relationDeco.loc,
                    help: `Valid values: ${[...VALID_CARDINALITIES].join(", ")}`,
                });
                continue;
            }
            // 2. Check that the field type references an entity (not a primitive)
            const { base, isArray } = unwrapType(field.fieldType);
            const typeName = base.type === "ReferenceType" ? base.name
                : base.type === "PrimitiveType" ? base.name
                    : null;
            if (!typeName || PRIMITIVES.has(typeName)) {
                diagnostics.push({
                    code: "RELATION_INVALID",
                    severity: "error",
                    message: `@relation on field '${field.name}' of type '${describeType(field.fieldType)}': type must reference an entity, not a primitive`,
                    location: relationDeco.loc,
                    help: `@relation is only valid on fields whose type is an entity reference (e.g. User, Order)`,
                });
                continue;
            }
            // 3. Check cardinality coherence with type form
            const isMultiple = cardinality === "one_to_many" || cardinality === "many_to_many";
            if (isMultiple && !isArray) {
                diagnostics.push({
                    code: "RELATION_INVALID",
                    severity: "error",
                    message: `@relation(${cardinality}) on field '${field.name}' requires array type (${typeName}[]), but got ${describeType(field.fieldType)}`,
                    location: relationDeco.loc,
                    help: `Change type to ${typeName}[] or use one_to_one/many_to_one for singular references`,
                });
            }
            else if (!isMultiple && isArray) {
                diagnostics.push({
                    code: "RELATION_INVALID",
                    severity: "error",
                    message: `@relation(${cardinality}) on field '${field.name}' requires singular type (${typeName}), but got ${describeType(field.fieldType)}`,
                    location: relationDeco.loc,
                    help: `Change type to ${typeName} or use one_to_many/many_to_many for array references`,
                });
            }
        }
    }
    return diagnostics;
}
//# sourceMappingURL=relation-validation.js.map