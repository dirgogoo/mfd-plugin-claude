/**
 * Test contract generator — produces structured test specifications from MFD models.
 *
 * Similar to the implementation contract (index.ts) but optimized for test generation.
 * Extracts journeys as E2E tests, actions as test steps, screens as page objects,
 * flows for integration tests, state machines for transition tests, rules as assertions.
 */
// ---------------------------------------------------------------------------
// Serialization helpers (same as contract/index.ts)
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
function serializeDecorators(decorators) {
    return decorators.map((d) => {
        if (d.params.length === 0)
            return `@${d.name}`;
        const params = d.params.map(serializeDecoratorValue).join(", ");
        return `@${d.name}(${params})`;
    });
}
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
function getDecoratorValue(decorators, name) {
    const deco = decorators.find((d) => d.name === name);
    if (!deco || deco.params.length === 0)
        return null;
    return serializeDecoratorValue(deco.params[0]);
}
function hasDecorator(decorators, name) {
    return decorators.some((d) => d.name === name);
}
// ---------------------------------------------------------------------------
// E2E test extraction (from journeys + actions + screens)
// ---------------------------------------------------------------------------
function extractE2eTests(model, actionMap) {
    return model.journeys.map((j) => extractJourneyTest(j, actionMap));
}
function extractJourneyTest(journey, actionMap) {
    const persona = getDecoratorValue(journey.decorators, "persona");
    const screens = new Set();
    const requiredFixtures = new Set();
    const steps = [];
    let order = 0;
    for (const item of journey.body) {
        if (item.type !== "JourneyStep")
            continue;
        order++;
        screens.add(item.from);
        if (item.to !== "end")
            screens.add(item.to);
        // Find matching action for this step
        const action = findActionForStep(item.from, item.to, item.trigger, actionMap);
        if (action) {
            // Collect fixtures from action params
            for (const p of action.params) {
                const typeName = serializeType(p);
                if (!isPrimitiveType(typeName)) {
                    requiredFixtures.add(typeName);
                }
            }
        }
        steps.push({
            order,
            fromScreen: item.from,
            toScreen: item.to,
            trigger: item.trigger,
            action: action ? extractActionTest(action) : null,
        });
    }
    return {
        id: `e2e:${journey.name}`,
        journey: journey.name,
        persona,
        steps,
        requiredFixtures: [...requiredFixtures],
        screens: [...screens],
    };
}
function findActionForStep(from, to, trigger, actionMap) {
    // First, try to match by trigger name (action name matches trigger)
    if (actionMap.has(trigger)) {
        const action = actionMap.get(trigger);
        const actionFrom = action.body.find((i) => i.type === "ActionFromClause");
        if (actionFrom && actionFrom.type === "ActionFromClause" && actionFrom.screen === from) {
            return action;
        }
    }
    // Fallback: search all actions for one that goes from->to
    for (const [, action] of actionMap) {
        const actionFrom = action.body.find((i) => i.type === "ActionFromClause");
        if (!actionFrom || actionFrom.type !== "ActionFromClause" || actionFrom.screen !== from)
            continue;
        const results = action.body.filter((i) => i.type === "ActionResult");
        const matchesTo = results.some((r) => r.type === "ActionResult" && r.screen === to);
        if (matchesTo)
            return action;
    }
    return null;
}
function extractActionTest(action) {
    let calls = null;
    let onStream = null;
    let onSignal = null;
    const emitsSignals = [];
    const outcomes = [];
    for (const item of action.body) {
        if (item.type === "ActionCallsClause")
            calls = { method: item.method, path: item.path };
        if (item.type === "ActionOnStreamClause")
            onStream = item.path;
        if (item.type === "ActionOnSignalClause")
            onSignal = item.signal;
        if (item.type === "ActionEmitsSignalClause")
            emitsSignals.push(item.signal);
        if (item.type === "ActionResult") {
            outcomes.push({ condition: item.outcome, expectedScreen: item.screen });
        }
    }
    return {
        name: action.name,
        calls,
        onStream,
        onSignal,
        emitsSignals,
        inputType: action.params.length > 0 ? serializeType(action.params[0]) : null,
        outcomes,
    };
}
// ---------------------------------------------------------------------------
// Integration test extraction (from flows)
// ---------------------------------------------------------------------------
function extractIntegrationTests(model) {
    return model.flows
        .filter((f) => !hasDecorator(f.decorators, "abstract"))
        .map(extractFlowTest);
}
function extractFlowTest(flow) {
    let trigger = null;
    const emits = [];
    const happySteps = [];
    const errorPaths = [];
    for (const item of flow.body) {
        if (item.type === "OnClause")
            trigger = item.event;
        if (item.type === "EmitsClause")
            emits.push(item.event);
        if (item.type === "FlowStep") {
            happySteps.push(item.action);
            // Each branch is a potential error path
            for (const branch of item.branches) {
                const isError = branch.action.startsWith("return") ||
                    branch.action.includes("error") ||
                    branch.action.includes("erro") ||
                    branch.action.includes("reject");
                if (isError) {
                    errorPaths.push({
                        name: branch.condition,
                        steps: [...happySteps.slice(0, -1), `${item.action} | ${branch.condition}`],
                        result: branch.action,
                    });
                }
            }
        }
    }
    // Extract return value from last step or explicit return
    let happyResult = null;
    for (const item of flow.body) {
        if (item.type === "FlowStep" && item.action.startsWith("return")) {
            happyResult = item.action;
        }
    }
    return {
        id: `integration:${flow.name}`,
        flow: flow.name,
        params: flow.params.map(serializeType),
        returnType: flow.returnType ? serializeType(flow.returnType) : null,
        trigger,
        emits,
        happyPath: {
            name: "happy_path",
            steps: happySteps,
            result: happyResult,
        },
        errorPaths,
        totalScenarios: 1 + errorPaths.length,
    };
}
// ---------------------------------------------------------------------------
// Unit test extraction (from operations)
// ---------------------------------------------------------------------------
function extractUnitTests(model) {
    return model.operations.map(extractOperationTest);
}
function extractOperationTest(op) {
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
        id: `unit:${op.name}`,
        operation: op.name,
        params: op.params.map(serializeType),
        returnType: op.returnType ? serializeType(op.returnType) : null,
        handles,
        calls,
        emits,
        on,
        enforces,
    };
}
// ---------------------------------------------------------------------------
// Contract test extraction (from APIs)
// ---------------------------------------------------------------------------
function extractContractTests(model) {
    return model.apis.map(extractApiTest);
}
function extractApiTest(api) {
    const prefix = getDecoratorValue(api.decorators, "prefix");
    const external = hasDecorator(api.decorators, "external");
    return {
        id: `contract:${api.name ?? api.style}`,
        apiName: api.name,
        style: api.style,
        prefix,
        external,
        endpoints: api.endpoints.map((ep) => {
            const auth = hasDecorator(ep.decorators, "auth");
            const inputType = "inputType" in ep && ep.inputType
                ? serializeType(ep.inputType)
                : "body" in ep && ep.body
                    ? serializeType(ep.body)
                    : null;
            const responseType = "returnType" in ep && ep.returnType
                ? serializeType(ep.returnType)
                : "response" in ep && ep.response
                    ? serializeType(ep.response)
                    : null;
            const scenarios = ["happy_path"];
            if (auth) {
                scenarios.push("unauthorized");
                scenarios.push("forbidden");
            }
            if (inputType) {
                scenarios.push("invalid_input");
            }
            if (ep.method === "STREAM") {
                scenarios.push("stream_connection");
                scenarios.push("stream_disconnect");
            }
            return {
                method: ep.method,
                path: ep.path,
                inputType,
                responseType,
                auth,
                scenarios,
            };
        }),
    };
}
// ---------------------------------------------------------------------------
// Page object extraction (from screens)
// ---------------------------------------------------------------------------
function extractPageObjects(model, actionMap) {
    return model.screens
        .filter((s) => !hasDecorator(s.decorators, "abstract") && !hasDecorator(s.decorators, "interface"))
        .map((s) => extractPageObject(s, actionMap));
}
function extractPageObject(screen, actionMap) {
    const layout = getDecoratorValue(screen.decorators, "layout");
    const uses = [];
    const forms = [];
    for (const item of screen.body) {
        if (item.type === "UsesDecl") {
            uses.push({ element: item.element, alias: item.alias });
        }
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
    // Find actions that originate from this screen
    const availableActions = [];
    for (const [name, action] of actionMap) {
        const from = action.body.find((i) => i.type === "ActionFromClause");
        if (from && from.type === "ActionFromClause" && from.screen === screen.name) {
            availableActions.push(name);
        }
    }
    return {
        screen: screen.name,
        layout,
        uses,
        forms,
        availableActions,
    };
}
// ---------------------------------------------------------------------------
// Fixture extraction (from entities referenced in tests)
// ---------------------------------------------------------------------------
function extractFixtures(model, referencedTypes) {
    const entityMap = new Map(model.entities.map((e) => [e.name, e]));
    const fixtures = [];
    for (const typeName of referencedTypes) {
        const entity = entityMap.get(typeName);
        if (entity) {
            fixtures.push({
                entity: entity.name,
                fields: entity.fields.map((f) => ({
                    name: f.name,
                    type: serializeType(f.fieldType),
                    decorators: serializeDecorators(f.decorators),
                })),
            });
        }
    }
    return fixtures;
}
// ---------------------------------------------------------------------------
// State transition test extraction
// ---------------------------------------------------------------------------
function extractStateTransitionTests(model) {
    const enumMap = new Map(model.enums.map((e) => [e.name, e]));
    return model.states.map((state) => {
        const enumDecl = enumMap.get(state.enumRef);
        const allValues = enumDecl ? enumDecl.values.map((v) => v.name) : [];
        const validTransitions = state.transitions.map((t) => ({
            from: t.from,
            to: t.to,
            trigger: t.event,
        }));
        // Build set of valid transitions for quick lookup
        const validSet = new Set(state.transitions.map((t) => `${t.from}->${t.to}`));
        // Generate invalid transitions (all combinations not declared)
        const invalidTransitions = [];
        for (const from of allValues) {
            for (const to of allValues) {
                if (from === to)
                    continue; // Self-transitions: skip
                if (!validSet.has(`${from}->${to}`)) {
                    invalidTransitions.push({
                        from,
                        to,
                        reason: "transition not declared in state machine",
                    });
                }
            }
        }
        return {
            name: state.name,
            enumRef: state.enumRef,
            validTransitions,
            invalidTransitions,
        };
    });
}
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const PRIMITIVE_TYPES = new Set([
    "string", "number", "boolean", "date", "datetime", "uuid", "void",
]);
function isPrimitiveType(type) {
    // Remove optional/array markers
    const clean = type.replace(/[?\[\]]/g, "").trim();
    return PRIMITIVE_TYPES.has(clean);
}
// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
export function generateTestContract(model, level = "all") {
    const actionMap = new Map(model.actions.map((a) => [a.name, a]));
    // Collect all referenced types for fixture generation
    const referencedTypes = new Set();
    // Extract by level
    const e2eTests = (level === "all" || level === "e2e")
        ? extractE2eTests(model, actionMap)
        : [];
    const integrationTests = (level === "all" || level === "integration")
        ? extractIntegrationTests(model)
        : [];
    const unitTests = (level === "all" || level === "unit")
        ? extractUnitTests(model)
        : [];
    const contractTests = (level === "all" || level === "contract")
        ? extractContractTests(model)
        : [];
    const pageObjects = (level === "all" || level === "e2e")
        ? extractPageObjects(model, actionMap)
        : [];
    const stateTransitionTests = (level === "all" || level === "integration")
        ? extractStateTransitionTests(model)
        : [];
    // Gather referenced types from e2e tests
    for (const test of e2eTests) {
        for (const f of test.requiredFixtures)
            referencedTypes.add(f);
    }
    // Gather referenced types from integration tests (flow params)
    for (const test of integrationTests) {
        for (const p of test.params) {
            if (!isPrimitiveType(p))
                referencedTypes.add(p);
        }
    }
    // Gather referenced types from unit tests (operation params)
    for (const test of unitTests) {
        for (const p of test.params) {
            if (!isPrimitiveType(p))
                referencedTypes.add(p);
        }
    }
    // Gather referenced types from contract tests (API input types)
    for (const test of contractTests) {
        for (const ep of test.endpoints) {
            if (ep.inputType && !isPrimitiveType(ep.inputType)) {
                referencedTypes.add(ep.inputType);
            }
        }
    }
    const fixtures = extractFixtures(model, referencedTypes);
    return {
        version: "1.0",
        level,
        e2eTests,
        integrationTests,
        unitTests,
        contractTests,
        pageObjects,
        fixtures,
        stateTransitionTests,
    };
}
export function serializeTestContract(contract) {
    return JSON.stringify(contract, null, 2);
}
//# sourceMappingURL=test-contract.js.map