// ---------------------------------------------------------------------------
// Type expression serialization
// ---------------------------------------------------------------------------
function serializeType(t) {
    switch (t.type) {
        case "PrimitiveType":
            return t.name;
        case "ReferenceType":
            return t.name;
        case "OptionalType":
            return `${serializeType(t.inner)}?`;
        case "ArrayType":
            return `${serializeType(t.inner)}[]`;
        case "UnionType":
            return t.alternatives.map(serializeType).join(" | ");
        case "InlineObjectType":
            return `{ ${t.fields.map((f) => `${f.name}: ${serializeType(f.fieldType)}`).join(", ")} }`;
    }
}
// ---------------------------------------------------------------------------
// Decorator serialization
// ---------------------------------------------------------------------------
function serializeDecoratorValue(v) {
    switch (v.kind) {
        case "string":
            return v.value;
        case "number":
            return String(v.value);
        case "identifier":
            return v.value;
        case "duration":
            return `${v.value}${v.unit}`;
        case "rate":
            return `${v.value}${v.unit}`;
    }
}
function serializeDecorators(decorators) {
    return decorators.map((d) => {
        if (d.params.length === 0)
            return `@${d.name}`;
        const params = d.params.map(serializeDecoratorValue).join(", ");
        return `@${d.name}(${params})`;
    });
}
// ---------------------------------------------------------------------------
// Relation extraction helper
// ---------------------------------------------------------------------------
/** Unwrap ArrayType / OptionalType to get the base type name. */
function unwrapTypeForContract(t) {
    switch (t.type) {
        case "ReferenceType": return t.name;
        case "ArrayType": return unwrapTypeForContract(t.inner);
        case "OptionalType": return unwrapTypeForContract(t.inner);
        default: return null;
    }
}
// ---------------------------------------------------------------------------
// Decorator helpers
// ---------------------------------------------------------------------------
function hasDecorator(decorators, name) {
    return decorators.some((d) => d.name === name);
}
// ---------------------------------------------------------------------------
// Inheritance resolution helpers
// ---------------------------------------------------------------------------
function resolveEntityFields(entityName, entityMap, visited = new Set()) {
    const entity = entityMap.get(entityName);
    if (!entity || visited.has(entityName))
        return [];
    visited.add(entityName);
    const inherited = [];
    // Fields from parent (extends)
    if (entity.extends) {
        inherited.push(...resolveEntityFields(entity.extends, entityMap, new Set(visited)));
    }
    // Fields from interfaces (implements)
    for (const iface of entity.implements) {
        const ifaceFields = resolveEntityFields(iface, entityMap, new Set(visited));
        for (const f of ifaceFields) {
            if (!inherited.some((e) => e.name === f.name)) {
                inherited.push(f);
            }
        }
    }
    // Own fields (override inherited with same name)
    const ownFields = entity.fields.map(contractField);
    for (const own of ownFields) {
        const idx = inherited.findIndex((f) => f.name === own.name);
        if (idx >= 0) {
            inherited[idx] = own;
        }
        else {
            inherited.push(own);
        }
    }
    return inherited;
}
function resolveEventFields(eventName, eventMap, visited = new Set()) {
    const event = eventMap.get(eventName);
    if (!event || visited.has(eventName))
        return [];
    visited.add(eventName);
    const inherited = [];
    if (event.extends) {
        inherited.push(...resolveEventFields(event.extends, eventMap, new Set(visited)));
    }
    const ownFields = event.fields.map((f) => ({
        name: f.name,
        type: serializeType(f.fieldType),
        decorators: serializeDecorators(f.decorators),
    }));
    for (const own of ownFields) {
        const idx = inherited.findIndex((f) => f.name === own.name);
        if (idx >= 0) {
            inherited[idx] = own;
        }
        else {
            inherited.push(own);
        }
    }
    return inherited;
}
function resolveFlowSteps(flowName, flowMap, visited = new Set()) {
    const flow = flowMap.get(flowName);
    if (!flow || visited.has(flowName))
        return [];
    visited.add(flowName);
    // Get parent steps
    let parentSteps = [];
    if (flow.extends) {
        parentSteps = resolveFlowSteps(flow.extends, flowMap, new Set(visited));
    }
    // Apply overrides from this flow
    const overrideMap = new Map();
    for (const item of flow.body) {
        if (item.type === "FlowOverrideStep") {
            overrideMap.set(item.target.trim(), {
                action: item.action,
                args: item.args,
                branches: [],
                decorators: serializeDecorators(item.decorators),
            });
        }
    }
    const resolved = parentSteps.map((step) => {
        const override = overrideMap.get(step.action.trim());
        return override ?? step;
    });
    // Append own steps
    for (const item of flow.body) {
        if (item.type === "FlowStep") {
            resolved.push({
                action: item.action,
                args: item.args,
                branches: item.branches.map((b) => ({
                    condition: b.condition,
                    action: b.action,
                })),
                decorators: serializeDecorators(item.decorators),
            });
        }
    }
    return resolved;
}
// ---------------------------------------------------------------------------
// Field contract helper
// ---------------------------------------------------------------------------
function contractField(f) {
    const field = {
        name: f.name,
        type: serializeType(f.fieldType),
        decorators: serializeDecorators(f.decorators),
    };
    const relationDeco = f.decorators.find((d) => d.name === "relation");
    if (relationDeco && relationDeco.params[0]?.kind === "identifier") {
        const targetEntity = unwrapTypeForContract(f.fieldType);
        if (targetEntity) {
            field.relation = {
                cardinality: relationDeco.params[0].value,
                targetEntity,
            };
        }
    }
    return field;
}
// ---------------------------------------------------------------------------
// Contract generation
// ---------------------------------------------------------------------------
function contractEntity(e, entityMap) {
    return {
        name: e.name,
        extends: e.extends,
        implements: e.implements,
        abstract: hasDecorator(e.decorators, "abstract"),
        interface: hasDecorator(e.decorators, "interface"),
        fields: e.fields.map(contractField),
        resolvedFields: resolveEntityFields(e.name, entityMap),
        decorators: serializeDecorators(e.decorators),
    };
}
function contractEnum(e) {
    return {
        name: e.name,
        values: e.values.map((v) => v.name),
        decorators: serializeDecorators(e.decorators),
    };
}
function contractFlow(f, flowMap) {
    let trigger = null;
    const emits = [];
    const handles = [];
    const overrides = [];
    for (const item of f.body) {
        if (item.type === "OnClause")
            trigger = item.event;
        if (item.type === "EmitsClause")
            emits.push(item.event);
        if (item.type === "OperationHandlesClause")
            handles.push({ method: item.method, path: item.path });
        if (item.type === "FlowOverrideStep")
            overrides.push(item.target);
    }
    return {
        name: f.name,
        extends: f.extends,
        implements: f.implements,
        abstract: hasDecorator(f.decorators, "abstract"),
        interface: hasDecorator(f.decorators, "interface"),
        params: f.params.map(serializeType),
        returnType: f.returnType ? serializeType(f.returnType) : null,
        trigger,
        emits,
        handles,
        decorators: serializeDecorators(f.decorators),
        steps: f.body
            .filter((item) => item.type === "FlowStep")
            .map((step) => {
            if (step.type !== "FlowStep")
                throw new Error("unreachable");
            return {
                action: step.action,
                args: step.args,
                branches: step.branches.map((b) => ({
                    condition: b.condition,
                    action: b.action,
                })),
                decorators: serializeDecorators(step.decorators),
            };
        }),
        resolvedSteps: resolveFlowSteps(f.name, flowMap),
        overrides,
    };
}
function contractState(s) {
    return {
        name: s.name,
        enumRef: s.enumRef,
        transitions: s.transitions.map((t) => ({
            from: t.from,
            to: t.to,
            event: t.event,
            decorators: serializeDecorators(t.decorators),
        })),
        decorators: serializeDecorators(s.decorators),
    };
}
function contractEvent(e, eventMap) {
    return {
        name: e.name,
        extends: e.extends,
        abstract: hasDecorator(e.decorators, "abstract"),
        fields: e.fields.map((f) => ({
            name: f.name,
            type: serializeType(f.fieldType),
            decorators: serializeDecorators(f.decorators),
        })),
        resolvedFields: resolveEventFields(e.name, eventMap),
        decorators: serializeDecorators(e.decorators),
    };
}
function contractSignal(s) {
    return {
        name: s.name,
        extends: s.extends,
        abstract: hasDecorator(s.decorators, "abstract"),
        fields: s.fields.map((f) => ({
            name: f.name,
            type: serializeType(f.fieldType),
            decorators: serializeDecorators(f.decorators),
        })),
        decorators: serializeDecorators(s.decorators),
    };
}
function contractApi(a) {
    const prefixDeco = a.decorators.find((d) => d.name === "prefix");
    const prefix = prefixDeco?.params[0]
        ? serializeDecoratorValue(prefixDeco.params[0])
        : null;
    const external = a.decorators.some((d) => d.name === "external");
    return {
        name: a.name,
        style: a.style,
        prefix,
        external,
        endpoints: a.endpoints.map((ep) => {
            if (ep.type === "ApiEndpointSimple") {
                return {
                    method: ep.method,
                    path: ep.path,
                    input: ep.inputType ? serializeType(ep.inputType) : null,
                    response: ep.returnType ? serializeType(ep.returnType) : null,
                    decorators: serializeDecorators(ep.decorators),
                };
            }
            // ApiEndpointExpanded
            return {
                method: ep.method,
                path: ep.path,
                input: ep.body ? serializeType(ep.body) : null,
                response: ep.response ? serializeType(ep.response) : null,
                decorators: serializeDecorators(ep.decorators),
            };
        }),
        decorators: serializeDecorators(a.decorators),
    };
}
function contractRule(r) {
    let when = null;
    let then = null;
    const elseIf = [];
    let elseAction = null;
    for (const item of r.body) {
        if (item.type === "WhenClause")
            when = item.expression;
        if (item.type === "ThenClause")
            then = item.action;
        if (item.type === "ElseIfClause")
            elseIf.push({ condition: item.condition, action: item.action });
        if (item.type === "ElseClause")
            elseAction = item.action;
    }
    return {
        name: r.name,
        when,
        then,
        elseIf,
        else: elseAction,
        decorators: serializeDecorators(r.decorators),
    };
}
function contractScreen(s) {
    const forms = [];
    for (const item of s.body) {
        if (item.type === "FormDecl") {
            forms.push({
                name: item.name,
                fields: item.fields.map((f) => ({
                    name: f.name,
                    type: serializeType(f.fieldType),
                    decorators: serializeDecorators(f.decorators),
                })),
            });
        }
    }
    return {
        name: s.name,
        extends: s.extends,
        implements: s.implements,
        abstract: hasDecorator(s.decorators, "abstract"),
        interface: hasDecorator(s.decorators, "interface"),
        forms,
        decorators: serializeDecorators(s.decorators),
    };
}
function contractAction(a) {
    let from = null;
    let calls = null;
    let onStream = null;
    let onSignal = null;
    const emitsSignals = [];
    const results = [];
    for (const item of a.body) {
        if (item.type === "ActionFromClause")
            from = item.screen;
        if (item.type === "ActionCallsClause")
            calls = { method: item.method, path: item.path };
        if (item.type === "ActionOnStreamClause")
            onStream = item.path;
        if (item.type === "ActionOnSignalClause")
            onSignal = item.signal;
        if (item.type === "ActionEmitsSignalClause")
            emitsSignals.push(item.signal);
        if (item.type === "ActionResult")
            results.push({ outcome: item.outcome, screen: item.screen });
    }
    return {
        name: a.name,
        params: a.params.map(serializeType),
        from,
        calls,
        onStream,
        onSignal,
        emitsSignals,
        results,
        decorators: serializeDecorators(a.decorators),
    };
}
function contractJourney(j) {
    return {
        name: j.name,
        steps: j.body
            .filter((item) => item.type === "JourneyStep")
            .map((step) => {
            if (step.type !== "JourneyStep")
                throw new Error("unreachable");
            return {
                from: step.from,
                to: step.to,
                trigger: step.trigger,
            };
        }),
        decorators: serializeDecorators(j.decorators),
    };
}
function contractDep(d) {
    return {
        target: d.target,
        decorators: serializeDecorators(d.decorators),
    };
}
function contractSecret(s) {
    return {
        name: s.name,
        decorators: serializeDecorators(s.decorators),
    };
}
function contractOperation(op) {
    const emits = [];
    const on = [];
    const enforces = [];
    const handles = [];
    const calls = [];
    for (const item of op.body) {
        if (item.type === "EmitsClause")
            emits.push(item.event);
        if (item.type === "OnClause")
            on.push(item.event);
        if (item.type === "EnforcesClause")
            enforces.push(item.rule);
        if (item.type === "OperationHandlesClause")
            handles.push({ method: item.method, path: item.path });
        if (item.type === "OperationCallsClause")
            calls.push({ method: item.method, path: item.path });
    }
    return {
        name: op.name,
        params: op.params.map(serializeType),
        returnType: op.returnType ? serializeType(op.returnType) : null,
        emits,
        on,
        enforces,
        handles,
        calls,
        decorators: serializeDecorators(op.decorators),
    };
}
function resolveElementProps(elementName, elementMap, visited = new Set()) {
    const element = elementMap.get(elementName);
    if (!element || visited.has(elementName))
        return [];
    visited.add(elementName);
    const inherited = [];
    if (element.extends) {
        for (const prop of resolveElementProps(element.extends, elementMap, new Set(visited))) {
            inherited.push({ ...prop, inheritedFrom: prop.inheritedFrom ?? element.extends });
        }
    }
    for (const iface of element.implements) {
        const ifaceProps = resolveElementProps(iface, elementMap, new Set(visited));
        for (const prop of ifaceProps) {
            if (!inherited.some((p) => p.name === prop.name)) {
                inherited.push({ ...prop, inheritedFrom: prop.inheritedFrom ?? iface });
            }
        }
    }
    for (const item of element.body) {
        if (item.type === "PropDecl") {
            const own = {
                name: item.name,
                type: serializeType(item.propType),
                decorators: serializeDecorators(item.decorators),
                inheritedFrom: null,
            };
            const idx = inherited.findIndex((p) => p.name === own.name);
            if (idx >= 0) {
                inherited[idx] = own;
            }
            else {
                inherited.push(own);
            }
        }
    }
    return inherited;
}
function contractElement(e, elementMap, screenNames) {
    const props = [];
    const forms = [];
    for (const item of e.body) {
        switch (item.type) {
            case "PropDecl":
                props.push({
                    name: item.name,
                    type: serializeType(item.propType),
                    decorators: serializeDecorators(item.decorators),
                    inheritedFrom: null,
                });
                break;
            case "FormDecl":
                forms.push({
                    name: item.name,
                    fields: item.fields.map(contractField),
                });
                break;
        }
    }
    // Find screens that use this element
    const usedBy = screenNames;
    return {
        name: e.name,
        extends: e.extends,
        implements: e.implements,
        abstract: hasDecorator(e.decorators, "abstract"),
        interface: hasDecorator(e.decorators, "interface"),
        props,
        resolvedProps: resolveElementProps(e.name, elementMap),
        forms,
        usedBy,
        decorators: serializeDecorators(e.decorators),
    };
}
// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
export function generateContract(model) {
    const elementMap = new Map(model.elements.map((e) => [e.name, e]));
    const entityMap = new Map(model.entities.map((e) => [e.name, e]));
    const flowMap = new Map(model.flows.map((f) => [f.name, f]));
    const eventMap = new Map(model.events.map((e) => [e.name, e]));
    // Build element usedBy map: which screens use each element
    const elementUsedBy = new Map();
    for (const screen of model.screens) {
        for (const item of screen.body) {
            if (item.type === "UsesDecl") {
                const list = elementUsedBy.get(item.element) ?? [];
                list.push(screen.name);
                elementUsedBy.set(item.element, list);
            }
        }
    }
    return {
        version: "1.0",
        elements: model.elements.map((e) => contractElement(e, elementMap, elementUsedBy.get(e.name) ?? [])),
        entities: model.entities.map((e) => contractEntity(e, entityMap)),
        enums: model.enums.map(contractEnum),
        flows: model.flows.map((f) => contractFlow(f, flowMap)),
        states: model.states.map(contractState),
        events: model.events.map((e) => contractEvent(e, eventMap)),
        signals: model.signals.map(contractSignal),
        apis: model.apis.map(contractApi),
        rules: model.rules.map(contractRule),
        screens: model.screens.map(contractScreen),
        journeys: model.journeys.map(contractJourney),
        operations: model.operations.map(contractOperation),
        actions: model.actions.map(contractAction),
        deps: model.deps.map(contractDep),
        secrets: model.secrets.map(contractSecret),
    };
}
export function serializeContract(contract) {
    return JSON.stringify(contract, null, 2);
}
//# sourceMappingURL=index.js.map