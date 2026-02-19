/**
 * Pure computation of model statistics.
 * Extracted from mfd-claude for reuse by mfd-visual and other consumers.
 */
import { DirectedGraph } from "./graph.js";
import { estimateTokens } from "./tokens.js";
function getDecoratorValue(decorators, name) {
    const dec = decorators?.find((d) => d.name === name);
    if (!dec || !dec.params[0])
        return null;
    return String(dec.params[0].value);
}
function getDecoratorValues(decorators, name) {
    const dec = decorators?.find((d) => d.name === name);
    if (!dec || dec.params.length === 0)
        return [];
    return dec.params.map((p) => String(p.value));
}
function countDecorator(model, name) {
    const all = [
        ...model.elements,
        ...model.entities,
        ...model.components,
        ...model.flows,
        ...model.events,
        ...model.signals,
        ...model.screens,
    ];
    return all.filter((c) => c.decorators?.some((d) => d.name === name)).length;
}
function countInheritanceRelations(model) {
    let count = 0;
    for (const el of model.elements) {
        if (el.extends)
            count++;
        count += el.implements.length;
    }
    for (const e of model.entities) {
        if (e.extends)
            count++;
        count += e.implements.length;
    }
    for (const c of model.components) {
        if (c.extends)
            count++;
        count += c.implements.length;
    }
    for (const f of model.flows) {
        if (f.extends)
            count++;
        count += f.implements.length;
    }
    for (const e of model.events) {
        if (e.extends)
            count++;
    }
    for (const s of model.signals) {
        if (s.extends)
            count++;
    }
    for (const s of model.screens) {
        if (s.extends)
            count++;
        count += s.implements.length;
    }
    return count;
}
export function computeStats(model, source) {
    const tokens = estimateTokens(source);
    const total = model.elements.length +
        model.entities.length +
        model.enums.length +
        model.flows.length +
        model.states.length +
        model.events.length +
        model.signals.length +
        model.apis.length +
        model.rules.length +
        model.screens.length +
        model.journeys.length +
        model.operations.length +
        model.actions.length;
    const counts = {
        systems: model.systems.length,
        components: model.components.length,
        elements: model.elements.length,
        entities: model.entities.length,
        enums: model.enums.length,
        flows: model.flows.length,
        states: model.states.length,
        events: model.events.length,
        signals: model.signals.length,
        apis: model.apis.length,
        rules: model.rules.length,
        deps: model.deps.length,
        secrets: model.secrets.length,
        screens: model.screens.length,
        journeys: model.journeys.length,
        operations: model.operations.length,
        actions: model.actions.length,
        total,
    };
    const details = {
        entityFields: model.entities.reduce((sum, e) => sum + e.fields.length, 0),
        elementProps: model.elements.reduce((sum, el) => sum + el.body.filter((i) => i.type === "PropDecl").length, 0),
        eventFields: model.events.reduce((sum, e) => sum + e.fields.length, 0),
        signalFields: model.signals.reduce((sum, s) => sum + s.fields.length, 0),
        enumValues: model.enums.reduce((sum, e) => sum + e.values.length, 0),
        apiEndpoints: model.apis.reduce((sum, a) => sum + a.endpoints.length, 0),
        streamEndpoints: model.apis.reduce((sum, a) => sum + a.endpoints.filter((ep) => ep.method === "STREAM").length, 0),
        externalApis: model.apis.filter((a) => a.decorators.some((d) => d.name === "external")).length,
        transitions: model.states.reduce((sum, s) => sum + s.transitions.length, 0),
        actionResults: model.actions.reduce((sum, a) => sum + a.body.filter((i) => i.type === "ActionResult").length, 0),
        screenForms: model.screens.reduce((sum, s) => sum + s.body.filter((i) => i.type === "FormDecl").length, 0),
        journeySteps: model.journeys.reduce((sum, j) => sum + j.body.filter((i) => i.type === "JourneyStep").length, 0),
        abstractConstructs: countDecorator(model, "abstract"),
        interfaceConstructs: countDecorator(model, "interface"),
        inheritanceRelations: countInheritanceRelations(model),
    };
    let dependencyGraph = null;
    if (model.components.length > 0) {
        const graph = new DirectedGraph();
        for (const comp of model.components) {
            graph.addNode(comp.name);
            for (const item of comp.body) {
                if (item.type === "DepDecl") {
                    graph.addEdge(comp.name, item.target);
                }
            }
        }
        const cycles = graph.findCycles();
        dependencyGraph = {
            nodes: graph.nodes.length,
            edges: graph.edges.length,
            maxDepth: graph.maxDepth(),
            cycles: cycles.length,
        };
    }
    const allConstructs = [
        ...model.elements,
        ...model.entities,
        ...model.flows,
        ...model.components,
        ...model.events,
        ...model.signals,
        ...model.rules,
        ...model.apis,
        ...model.screens,
        ...model.journeys,
        ...model.operations,
        ...model.actions,
    ];
    const withStatus = allConstructs.filter((c) => c.decorators?.some((d) => d.name === "status")).length;
    const withImpl = allConstructs.filter((c) => c.decorators?.some((d) => d.name === "impl")).length;
    const withTests = allConstructs.filter((c) => c.decorators?.some((d) => d.name === "tests")).length;
    const pct = (n, t) => (t === 0 ? 0 : Math.round((n / t) * 100));
    const completeness = {
        total: allConstructs.length,
        withStatus,
        withImpl,
        withTests,
        statusPct: pct(withStatus, allConstructs.length),
        implPct: pct(withImpl, allConstructs.length),
        testsPct: pct(withTests, allConstructs.length),
    };
    // Per-component completeness
    const componentCompleteness = model.components.map((comp) => {
        const status = getDecoratorValue(comp.decorators, "status");
        const constructs = [];
        for (const item of comp.body) {
            if (item.type === "ElementDecl" ||
                item.type === "EntityDecl" ||
                item.type === "FlowDecl" ||
                item.type === "ApiDecl" ||
                item.type === "RuleDecl" ||
                item.type === "StateDecl" ||
                item.type === "EventDecl" ||
                item.type === "SignalDecl" ||
                item.type === "ScreenDecl" ||
                item.type === "JourneyDecl" ||
                item.type === "OperationDecl" ||
                item.type === "ActionDecl") {
                constructs.push({
                    type: item.type.replace("Decl", ""),
                    name: item.name ?? "(anonymous)",
                    impl: getDecoratorValues(item.decorators, "impl"),
                    tests: getDecoratorValue(item.decorators, "tests"),
                });
            }
        }
        const implDone = constructs.filter((c) => c.impl.length > 0).length;
        const testsDone = constructs.filter((c) => c.tests !== null).length;
        return {
            name: comp.name,
            status,
            constructs,
            implDone,
            implTotal: constructs.length,
            testsDone,
            testsTotal: constructs.length,
        };
    });
    return {
        counts,
        details,
        tokens,
        dependencyGraph,
        completeness,
        componentCompleteness,
    };
}
//# sourceMappingURL=stats.js.map