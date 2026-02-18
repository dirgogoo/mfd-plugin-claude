import { collectModel, getKnownTypes } from "../collect.js";
/**
 * TYPE_UNKNOWN: Checks that all field types are either primitive or declared.
 * (This overlaps with referential-integrity but focuses specifically on entity/event fields)
 */
export function typeConsistency(doc) {
    const model = collectModel(doc);
    const knownTypes = getKnownTypes(model);
    const diagnostics = [];
    function checkFieldType(typeExpr, fieldName, parentName) {
        switch (typeExpr.type) {
            case "ReferenceType":
                if (!knownTypes.has(typeExpr.name)) {
                    diagnostics.push({
                        code: "TYPE_UNKNOWN",
                        severity: "error",
                        message: `Field '${parentName}.${fieldName}' uses unknown type '${typeExpr.name}'`,
                        location: typeExpr.loc,
                    });
                }
                break;
            case "OptionalType":
                checkFieldType(typeExpr.inner, fieldName, parentName);
                break;
            case "ArrayType":
                checkFieldType(typeExpr.inner, fieldName, parentName);
                break;
            case "UnionType":
                for (const alt of typeExpr.alternatives) {
                    checkFieldType(alt, fieldName, parentName);
                }
                break;
            case "InlineObjectType":
                for (const f of typeExpr.fields) {
                    checkFieldType(f.fieldType, f.name, parentName);
                }
                break;
        }
    }
    for (const entity of model.entities) {
        for (const field of entity.fields) {
            checkFieldType(field.fieldType, field.name, entity.name);
        }
    }
    for (const event of model.events) {
        for (const field of event.fields) {
            checkFieldType(field.fieldType, field.name, event.name);
        }
    }
    return diagnostics;
}
//# sourceMappingURL=type-consistency.js.map