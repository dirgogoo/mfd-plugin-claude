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
/**
 * Extract all reference type names from a FieldTypeV2.
 */
function extractTypeRefs(ft) {
    switch (ft.type) {
        case "PrimitiveType":
            return [];
        case "ReferenceType":
            return [ft.name];
        case "OptionalType":
        case "ArrayType":
            return extractTypeRefs(ft.inner);
        case "UnionType":
            return ft.alternatives.flatMap(extractTypeRefs);
    }
}
/**
 * Compute all relationships from a v2 model.
 */
export function computeRelationshipsV2(model) {
    const rels = [];
    const seen = new Set();
    const conceptNames = new Set(model.concepts.map((c) => c.name));
    const enumNames = new Set(model.enums.map((e) => e.name));
    function add(fromType, fromName, toType, toName, relation) {
        const key = `${fromType}:${fromName}->${toType}:${toName}:${relation}`;
        if (seen.has(key))
            return;
        seen.add(key);
        rels.push({
            from: { type: fromType, name: fromName },
            to: { type: toType, name: toName },
            relation,
        });
    }
    // 1. concept→concept and concept→enum from field types
    for (const concept of model.concepts) {
        for (const field of concept.fields) {
            const refs = extractTypeRefs(field.fieldType);
            for (const ref of refs) {
                if (conceptNames.has(ref) && ref !== concept.name) {
                    add("concept", concept.name, "concept", ref, "field_ref");
                }
                if (enumNames.has(ref)) {
                    add("concept", concept.name, "enum", ref, "field_ref");
                }
            }
        }
        // 2. concept→enum from lifecycle enumRef
        if (concept.lifecycle) {
            if (enumNames.has(concept.lifecycle.enumRef)) {
                add("concept", concept.name, "enum", concept.lifecycle.enumRef, "lifecycle");
            }
            // 3. lifecycle→capability from transition triggers
            for (const t of concept.lifecycle.transitions) {
                add("concept", concept.name, "capability", t.capability, "lifecycle");
            }
        }
    }
    // 4. capability→concept from affects clauses, and from given/then expressions
    for (const cap of model.capabilities) {
        for (const clause of cap.clauses) {
            switch (clause.type) {
                case "affects":
                    if (conceptNames.has(clause.concept)) {
                        add("capability", cap.name, "concept", clause.concept, "affects");
                    }
                    break;
                case "given":
                    for (const cName of conceptNames) {
                        if (clause.expression.includes(cName)) {
                            add("capability", cap.name, "concept", cName, "given");
                        }
                    }
                    break;
                case "then":
                    for (const cName of conceptNames) {
                        if (clause.expression.includes(cName)) {
                            add("capability", cap.name, "concept", cName, "then");
                        }
                    }
                    break;
                case "emits":
                    // Track emits as a relationship (capability→event name)
                    add("capability", cap.name, "event", clause.event, "emits");
                    break;
            }
        }
    }
    // 5. invariant→concept from expression text
    for (const inv of model.invariants) {
        for (const cName of conceptNames) {
            if (inv.expression.includes(cName)) {
                add("invariant", inv.name, "concept", cName, "invariant_ref");
            }
        }
    }
    // 6. property→concept from expression text in clauses
    for (const prop of model.properties) {
        for (const clause of prop.clauses) {
            for (const cName of conceptNames) {
                if (clause.expression.includes(cName)) {
                    add("property", prop.name, "concept", cName, "property_ref");
                }
            }
        }
    }
    // 7. objective→capability from transition triggers
    for (const obj of model.objectives) {
        for (const t of obj.transitions) {
            add("objective", obj.name, "capability", t.trigger, "objective_step");
        }
    }
    return rels;
}
//# sourceMappingURL=relationships.js.map