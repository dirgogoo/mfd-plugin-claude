import { collectModel } from "../collect.js";
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function hasDecorator(decorators, name) {
    return decorators.some((d) => d.name === name);
}
function typeToString(t) {
    switch (t.type) {
        case "PrimitiveType":
            return t.name;
        case "ReferenceType":
            return t.name;
        case "OptionalType":
            return `${typeToString(t.inner)}?`;
        case "ArrayType":
            return `${typeToString(t.inner)}[]`;
        case "UnionType":
            return t.alternatives.map(typeToString).join(" | ");
        case "InlineObjectType":
            return `{ ${t.fields.map((f) => `${f.name}: ${typeToString(f.fieldType)}`).join(", ")} }`;
    }
}
function buildMap(items) {
    const map = new Map();
    for (const item of items) {
        map.set(item.name, item);
    }
    return map;
}
// ---------------------------------------------------------------------------
// Main validation
// ---------------------------------------------------------------------------
export function inheritanceValidation(doc) {
    const model = collectModel(doc);
    const diagnostics = [];
    const elementMap = buildMap(model.elements);
    const entityMap = buildMap(model.entities);
    const componentMap = buildMap(model.components);
    const flowMap = buildMap(model.flows);
    const eventMap = buildMap(model.events);
    const signalMap = buildMap(model.signals);
    const screenMap = buildMap(model.screens);
    // --- 1. INHERIT_REF: extends/implements references must resolve ----------
    function checkRef(kind, constructName, refName, refKind, loc, lookupMap) {
        if (!lookupMap.has(refName)) {
            const available = [...lookupMap.keys()].sort();
            diagnostics.push({
                code: "INHERIT_REF",
                severity: "error",
                message: `${kind} '${constructName}' ${refKind} '${refName}' which is not declared`,
                location: loc,
                help: available.length > 0
                    ? `Available ${kind} names: ${available.join(", ")}`
                    : `No ${kind} declarations found`,
            });
            return false;
        }
        return true;
    }
    function validateInheritableRefs(kind, items, lookupMap) {
        for (const item of items) {
            if (item.extends) {
                const exists = checkRef(kind, item.name, item.extends, "extends", item.loc, lookupMap);
                // --- 2. INHERIT_NOT_ABSTRACT ---
                if (exists) {
                    const target = lookupMap.get(item.extends);
                    if (!hasDecorator(target.decorators, "abstract")) {
                        diagnostics.push({
                            code: "INHERIT_NOT_ABSTRACT",
                            severity: "error",
                            message: `${kind} '${item.name}' extends '${item.extends}' which is not marked @abstract`,
                            location: item.loc,
                            help: `A construct must be marked @abstract to be extended. Fix:

  ${kind} ${item.extends} @abstract {
    /* shared fields/behavior */
  }

  ${kind} ${item.name} extends ${item.extends} {
    /* additional fields */
  }`,
                        });
                    }
                }
            }
            for (const iface of item.implements) {
                const exists = checkRef(kind, item.name, iface, "implements", item.loc, lookupMap);
                // --- 3. INHERIT_NOT_INTERFACE ---
                if (exists) {
                    const target = lookupMap.get(iface);
                    if (!hasDecorator(target.decorators, "interface")) {
                        diagnostics.push({
                            code: "INHERIT_NOT_INTERFACE",
                            severity: "error",
                            message: `${kind} '${item.name}' implements '${iface}' which is not marked @interface`,
                            location: item.loc,
                            help: `A construct must be marked @interface to be implemented. Fix:

  ${kind} ${iface} @interface {
    /* contract fields that implementors must provide */
  }

  ${kind} ${item.name} implements ${iface} {
    /* must include all fields from ${iface} */
  }

  Note: @abstract and @interface cannot coexist on the same construct.`,
                        });
                    }
                }
            }
        }
    }
    // Events/signals only have extends, no implements — cast to InheritableConstruct with empty implements
    const eventsAsInheritable = model.events.map((e) => ({
        name: e.name,
        extends: e.extends,
        implements: [],
        decorators: e.decorators,
        loc: e.loc,
    }));
    const signalsAsInheritable = model.signals.map((s) => ({
        name: s.name,
        extends: s.extends,
        implements: [],
        decorators: s.decorators,
        loc: s.loc,
    }));
    validateInheritableRefs("element", model.elements, elementMap);
    validateInheritableRefs("entity", model.entities, entityMap);
    validateInheritableRefs("component", model.components, componentMap);
    validateInheritableRefs("flow", model.flows, flowMap);
    validateInheritableRefs("event", eventsAsInheritable, eventMap);
    validateInheritableRefs("signal", signalsAsInheritable, signalMap);
    validateInheritableRefs("screen", model.screens, screenMap);
    // --- 4. INHERIT_CIRCULAR: cycle detection in extends chains --------------
    function detectCycle(kind, items, lookupMap) {
        for (const item of items) {
            if (!item.extends)
                continue;
            const visited = new Set();
            visited.add(item.name);
            let current = item.extends;
            while (current) {
                if (visited.has(current)) {
                    diagnostics.push({
                        code: "INHERIT_CIRCULAR",
                        severity: "error",
                        message: `Circular inheritance detected: ${kind} '${item.name}' has a cycle through '${current}'`,
                        location: item.loc,
                        help: `Inheritance chain: ${[...visited].join(" -> ")} -> ${current}`,
                    });
                    break;
                }
                visited.add(current);
                const parent = lookupMap.get(current);
                current = parent?.extends ?? null;
            }
        }
    }
    detectCycle("element", model.elements, elementMap);
    detectCycle("entity", model.entities, entityMap);
    detectCycle("component", model.components, componentMap);
    detectCycle("flow", model.flows, flowMap);
    detectCycle("event", model.events, eventMap);
    detectCycle("signal", model.signals, signalMap);
    detectCycle("screen", model.screens, screenMap);
    // --- 5. INHERIT_FIELD_CONFLICT: diamond problem for entity/event --------
    function checkFieldConflicts(kind, items, lookupMap) {
        for (const item of items) {
            if (item.implements.length < 2)
                continue;
            // Collect fields from all implemented interfaces
            const fieldsByName = new Map();
            for (const iface of item.implements) {
                const target = lookupMap.get(iface);
                if (!target)
                    continue; // unresolved ref, caught by INHERIT_REF
                if (!hasDecorator(target.decorators, "interface"))
                    continue;
                for (const field of target.fields) {
                    const typeStr = typeToString(field.fieldType);
                    const existing = fieldsByName.get(field.name) ?? [];
                    existing.push({ type: typeStr, source: iface });
                    fieldsByName.set(field.name, existing);
                }
            }
            // Check for conflicting types
            for (const [fieldName, sources] of fieldsByName) {
                if (sources.length < 2)
                    continue;
                const types = new Set(sources.map((s) => s.type));
                if (types.size > 1) {
                    const details = sources.map((s) => `'${s.source}' defines it as ${s.type}`).join(", ");
                    diagnostics.push({
                        code: "INHERIT_FIELD_CONFLICT",
                        severity: "warning",
                        message: `${kind} '${item.name}' has conflicting types for field '${fieldName}' from multiple interfaces`,
                        location: item.loc,
                        help: details,
                    });
                }
            }
        }
    }
    checkFieldConflicts("entity", model.entities, entityMap);
    checkFieldConflicts("event", eventsAsInheritable, eventMap);
    // --- 6. INHERIT_OVERRIDE_MISSING: override targets must exist in parent --
    for (const flow of model.flows) {
        if (!flow.extends)
            continue;
        const parent = flowMap.get(flow.extends);
        if (!parent)
            continue; // unresolved ref, caught by INHERIT_REF
        // Collect parent step action names (only FlowStep, not FlowOverrideStep)
        const parentStepNames = new Set();
        for (const item of parent.body) {
            if (item.type === "FlowStep") {
                parentStepNames.add(item.action.trim());
            }
        }
        for (const item of flow.body) {
            if (item.type === "FlowOverrideStep") {
                if (!parentStepNames.has(item.target.trim())) {
                    diagnostics.push({
                        code: "INHERIT_OVERRIDE_MISSING",
                        severity: "error",
                        message: `Flow '${flow.name}' overrides step '${item.target}' which does not exist in parent flow '${flow.extends}'`,
                        location: item.loc,
                        help: parentStepNames.size > 0
                            ? `Available steps in '${flow.extends}': ${[...parentStepNames].join(", ")}`
                            : `Parent flow '${flow.extends}' has no steps`,
                    });
                }
            }
        }
    }
    // --- 7. INHERIT_MISSING_REQUIREMENT: interface contract fulfillment ------
    // 8a. Entity: all fields from interface must be present
    for (const entity of model.entities) {
        for (const iface of entity.implements) {
            const target = entityMap.get(iface);
            if (!target || !hasDecorator(target.decorators, "interface"))
                continue;
            const concreteFields = new Set(entity.fields.map((f) => f.name));
            const missing = [];
            for (const field of target.fields) {
                if (!concreteFields.has(field.name)) {
                    missing.push(field.name);
                }
            }
            if (missing.length > 0) {
                diagnostics.push({
                    code: "INHERIT_MISSING_REQUIREMENT",
                    severity: "warning",
                    message: `Entity '${entity.name}' implements '${iface}' but is missing fields: ${missing.join(", ")}`,
                    location: entity.loc,
                    help: `Add the missing fields to satisfy the interface contract`,
                });
            }
        }
    }
    // 8b. Component: operations and events from interface must be present
    for (const comp of model.components) {
        for (const iface of comp.implements) {
            const target = componentMap.get(iface);
            if (!target || !hasDecorator(target.decorators, "interface"))
                continue;
            const concreteOps = new Set();
            const concreteEvents = new Set();
            for (const item of comp.body) {
                if (item.type === "OperationDecl")
                    concreteOps.add(item.name);
                if (item.type === "EventDecl")
                    concreteEvents.add(item.name);
            }
            const missingOps = [];
            const missingEvents = [];
            for (const item of target.body) {
                if (item.type === "OperationDecl" && !concreteOps.has(item.name)) {
                    missingOps.push(item.name);
                }
                if (item.type === "EventDecl" && !concreteEvents.has(item.name)) {
                    missingEvents.push(item.name);
                }
            }
            const missing = [
                ...missingOps.map((n) => `operation ${n}`),
                ...missingEvents.map((n) => `event ${n}`),
            ];
            if (missing.length > 0) {
                diagnostics.push({
                    code: "INHERIT_MISSING_REQUIREMENT",
                    severity: "warning",
                    message: `Component '${comp.name}' implements '${iface}' but is missing: ${missing.join(", ")}`,
                    location: comp.loc,
                    help: `Add the missing constructs to satisfy the interface contract`,
                });
            }
        }
    }
    // 8c. Flow: on/emits clauses from interface must be present
    for (const flow of model.flows) {
        for (const iface of flow.implements) {
            const target = flowMap.get(iface);
            if (!target || !hasDecorator(target.decorators, "interface"))
                continue;
            const concreteOn = new Set();
            const concreteEmits = new Set();
            for (const item of flow.body) {
                if (item.type === "OnClause")
                    concreteOn.add(item.event);
                if (item.type === "EmitsClause")
                    concreteEmits.add(item.event);
            }
            const missingOn = [];
            const missingEmits = [];
            for (const item of target.body) {
                if (item.type === "OnClause" && !concreteOn.has(item.event)) {
                    missingOn.push(item.event);
                }
                if (item.type === "EmitsClause" && !concreteEmits.has(item.event)) {
                    missingEmits.push(item.event);
                }
            }
            const missing = [
                ...missingOn.map((n) => `on ${n}`),
                ...missingEmits.map((n) => `emits ${n}`),
            ];
            if (missing.length > 0) {
                diagnostics.push({
                    code: "INHERIT_MISSING_REQUIREMENT",
                    severity: "warning",
                    message: `Flow '${flow.name}' implements '${iface}' but is missing clauses: ${missing.join(", ")}`,
                    location: flow.loc,
                    help: `Add the missing on/emits clauses to satisfy the interface contract`,
                });
            }
        }
    }
    // 8d. Screen: all forms from interface must be present
    for (const screen of model.screens) {
        for (const iface of screen.implements) {
            const target = screenMap.get(iface);
            if (!target || !hasDecorator(target.decorators, "interface"))
                continue;
            const concreteForms = new Set();
            for (const item of screen.body) {
                if (item.type === "FormDecl" && item.name) {
                    concreteForms.add(item.name);
                }
            }
            const missingForms = [];
            for (const item of target.body) {
                if (item.type === "FormDecl" && item.name && !concreteForms.has(item.name)) {
                    missingForms.push(item.name);
                }
            }
            if (missingForms.length > 0) {
                diagnostics.push({
                    code: "INHERIT_MISSING_REQUIREMENT",
                    severity: "warning",
                    message: `Screen '${screen.name}' implements '${iface}' but is missing forms: ${missingForms.join(", ")}`,
                    location: screen.loc,
                    help: `Add the missing form declarations to satisfy the interface contract`,
                });
            }
        }
    }
    // 8e. Element: all props from interface must be present
    for (const element of model.elements) {
        for (const iface of element.implements) {
            const target = elementMap.get(iface);
            if (!target || !hasDecorator(target.decorators, "interface"))
                continue;
            const concreteProps = new Set();
            for (const item of element.body) {
                if (item.type === "PropDecl") {
                    concreteProps.add(item.name);
                }
            }
            const missingProps = [];
            for (const item of target.body) {
                if (item.type === "PropDecl" && !concreteProps.has(item.name)) {
                    missingProps.push(item.name);
                }
            }
            if (missingProps.length > 0) {
                diagnostics.push({
                    code: "INHERIT_MISSING_REQUIREMENT",
                    severity: "warning",
                    message: `Element '${element.name}' implements '${iface}' but is missing props: ${missingProps.join(", ")}`,
                    location: element.loc,
                    help: `Add the missing prop declarations to satisfy the interface contract`,
                });
            }
        }
    }
    return diagnostics;
}
//# sourceMappingURL=inheritance-validation.js.map