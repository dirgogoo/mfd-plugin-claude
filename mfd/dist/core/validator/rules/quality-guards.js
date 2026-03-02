import { collectModel } from "../collect.js";
import { entityHasIdentification, getAllEntityFields } from "./shared-helpers.js";
/**
 * Quality guard rules for modeling best practices:
 *
 * ENTITY_NO_ID: Entity without an `id` field or any @unique field.
 *   Skip: @abstract, @interface, and DTO entities (by naming convention).
 *
 * ENTITY_TOO_MANY_FIELDS: Entity with 15+ fields.
 *   Skip: @abstract entities.
 *
 * FLOW_TOO_FEW_STEPS: Flow with < 3 FlowStep items.
 *   Skip: @abstract flows.
 *
 * FLOW_TOO_MANY_STEPS: Flow with > 7 FlowStep items.
 *   Skip: @abstract flows.
 */
const DTO_SUFFIXES = [
    "Input", "Output", "Dto", "DTO",
    "Request", "Response",
    "Params", "Filter", "Args",
    "Error", "Result", "Payload",
    "Config", "Options", "Settings",
];
function isDto(name) {
    return DTO_SUFFIXES.some((s) => name.endsWith(s));
}
export function qualityGuards(doc) {
    const model = collectModel(doc);
    const diagnostics = [];
    for (const entity of model.entities) {
        const isAbstract = entity.decorators.some((d) => d.name === "abstract");
        const isInterface = entity.decorators.some((d) => d.name === "interface");
        // ENTITY_NO_ID: skip @abstract, @interface, and DTOs
        // Check inherited fields (extends chain) for id/@unique
        if (!isAbstract && !isInterface && !isDto(entity.name)) {
            if (!entityHasIdentification(entity, model.entities)) {
                diagnostics.push({
                    code: "ENTITY_NO_ID",
                    severity: "warning",
                    message: `Entity '${entity.name}' has no identification field (id or @unique)`,
                    location: entity.loc,
                    help: `Add an 'id' field or mark a field with @unique. If this is a DTO, use a name ending with: ${DTO_SUFFIXES.join(", ")}`,
                });
            }
        }
        // ENTITY_EMPTY: skip @abstract and @interface (can be markers)
        // Check inherited fields too — entity extending a parent with fields is not empty
        if (!isAbstract && !isInterface) {
            const totalFields = getAllEntityFields(entity.name, model.entities).size;
            if (totalFields === 0) {
                diagnostics.push({
                    code: "ENTITY_EMPTY",
                    severity: "warning",
                    message: `Entity '${entity.name}' has no fields`,
                    location: entity.loc,
                    help: "Add fields to define the entity's structure, or use @abstract/@interface if it's a base type",
                });
            }
        }
        // ENTITY_DUPLICATE_FIELD: always check (concrete and abstract)
        const fieldNames = new Map();
        for (const field of entity.fields) {
            if (fieldNames.has(field.name)) {
                diagnostics.push({
                    code: "ENTITY_DUPLICATE_FIELD",
                    severity: "error",
                    message: `Entity '${entity.name}' has duplicate field '${field.name}' (first defined at line ${fieldNames.get(field.name)})`,
                    location: field.loc,
                    help: `Remove or rename one of the duplicate '${field.name}' fields`,
                });
            }
            else {
                fieldNames.set(field.name, field.loc.start.line);
            }
        }
        // ENTITY_TOO_MANY_FIELDS: skip @abstract, count inherited fields
        if (!isAbstract) {
            const totalFieldCount = getAllEntityFields(entity.name, model.entities).size;
            if (totalFieldCount >= 15) {
                diagnostics.push({
                    code: "ENTITY_TOO_MANY_FIELDS",
                    severity: "warning",
                    message: `Entity '${entity.name}' has ${totalFieldCount} fields (threshold: 15) — consider splitting`,
                    location: entity.loc,
                    help: "Extract related fields into separate entities to improve cohesion",
                });
            }
        }
    }
    for (const flow of model.flows) {
        const isAbstract = flow.decorators.some((d) => d.name === "abstract");
        if (isAbstract)
            continue;
        const stepCount = flow.body.filter((item) => item.type === "FlowStep").length;
        // FLOW_TOO_FEW_STEPS
        if (stepCount < 3) {
            diagnostics.push({
                code: "FLOW_TOO_FEW_STEPS",
                severity: "warning",
                message: `Flow '${flow.name}' has only ${stepCount} steps — consider using an operation instead`,
                location: flow.loc,
                help: "Flows with fewer than 3 steps may be better expressed as operations",
            });
        }
        // FLOW_TOO_MANY_STEPS
        if (stepCount > 7) {
            diagnostics.push({
                code: "FLOW_TOO_MANY_STEPS",
                severity: "warning",
                message: `Flow '${flow.name}' has ${stepCount} steps (threshold: 7) — consider decomposing`,
                location: flow.loc,
                help: "Extract sub-flows or operations to reduce complexity",
            });
        }
    }
    return diagnostics;
}
//# sourceMappingURL=quality-guards.js.map