import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "../../parser/index.js";
import { resolveFile } from "../../resolver/index.js";
import { collectModel } from "../../validator/collect.js";
import { DirectedGraph } from "../../utils/graph.js";
import { estimateTokens } from "../../utils/tokens.js";
import { MfdParseError } from "../../parser/errors.js";
export function statsCommand(file, options) {
    const filePath = resolve(file);
    let source;
    try {
        source = readFileSync(filePath, "utf-8");
    }
    catch {
        console.error(`error: Cannot read file '${filePath}'`);
        process.exit(1);
    }
    const shouldResolve = options.resolve ?? /^\s*(import|include)\s+"/m.test(source);
    let doc;
    try {
        if (shouldResolve) {
            const result = resolveFile(filePath);
            if (result.errors.length > 0) {
                for (const err of result.errors) {
                    console.error(`error: ${err.message}`);
                }
            }
            doc = result.document;
        }
        else {
            doc = parse(source, { source: filePath });
        }
    }
    catch (err) {
        if (err instanceof MfdParseError) {
            console.error(err.format(source));
            process.exit(1);
        }
        throw err;
    }
    const model = collectModel(doc);
    const tokens = estimateTokens(source);
    // Count constructs
    console.log("=== MFD Model Statistics ===\n");
    console.log("Constructs:");
    console.log(`  systems:     ${model.systems.length}`);
    console.log(`  components:  ${model.components.length}`);
    if (model.nodes.length > 0) {
        console.log(`  nodes:       ${model.nodes.length}`);
    }
    console.log(`  elements:    ${model.elements.length}`);
    console.log(`  entities:    ${model.entities.length}`);
    console.log(`  enums:       ${model.enums.length}`);
    console.log(`  flows:       ${model.flows.length}`);
    console.log(`  states:      ${model.states.length}`);
    console.log(`  events:      ${model.events.length}`);
    console.log(`  signals:     ${model.signals.length}`);
    console.log(`  apis:        ${model.apis.length}`);
    console.log(`  rules:       ${model.rules.length}`);
    console.log(`  deps:        ${model.deps.length}`);
    console.log(`  secrets:     ${model.secrets.length}`);
    console.log(`  screens:     ${model.screens.length}`);
    console.log(`  journeys:    ${model.journeys.length}`);
    console.log(`  operations:  ${model.operations.length}`);
    console.log(`  actions:     ${model.actions.length}`);
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
    console.log(`  total:       ${total}`);
    // Token estimate
    console.log(`\nTokens: ~${tokens}`);
    // Field counts
    const entityFields = model.entities.reduce((sum, e) => sum + e.fields.length, 0);
    const eventFields = model.events.reduce((sum, e) => sum + e.fields.length, 0);
    const signalFields = model.signals.reduce((sum, s) => sum + s.fields.length, 0);
    const enumValues = model.enums.reduce((sum, e) => sum + e.values.length, 0);
    console.log(`\nDetails:`);
    console.log(`  entity fields: ${entityFields}`);
    console.log(`  event fields:  ${eventFields}`);
    console.log(`  signal fields: ${signalFields}`);
    console.log(`  enum values:   ${enumValues}`);
    // Endpoint count
    const endpoints = model.apis.reduce((sum, a) => sum + a.endpoints.length, 0);
    const streamEndpoints = model.apis.reduce((sum, a) => sum + a.endpoints.filter((ep) => ep.method === "STREAM").length, 0);
    console.log(`  api endpoints: ${endpoints}`);
    if (streamEndpoints > 0) {
        console.log(`  stream endpoints: ${streamEndpoints}`);
    }
    const externalApis = model.apis.filter((a) => a.decorators.some((d) => d.name === "external")).length;
    if (externalApis > 0) {
        console.log(`  external apis: ${externalApis}`);
    }
    // Transition count
    const transitions = model.states.reduce((sum, s) => sum + s.transitions.length, 0);
    console.log(`  transitions:   ${transitions}`);
    // Screen/Journey/Action details
    const actionResults = model.actions.reduce((sum, a) => sum + a.body.filter((i) => i.type === "ActionResult").length, 0);
    const screenForms = model.screens.reduce((sum, s) => sum + s.body.filter((i) => i.type === "FormDecl").length, 0);
    const journeySteps = model.journeys.reduce((sum, j) => sum + j.body.filter((i) => i.type === "JourneyStep").length, 0);
    if (model.screens.length > 0 || model.journeys.length > 0 || model.actions.length > 0) {
        console.log(`  action results: ${actionResults}`);
        console.log(`  screen forms:   ${screenForms}`);
        console.log(`  journey steps:  ${journeySteps}`);
    }
    // Inheritance
    const abstractCount = model.elements.concat(model.entities, model.flows, model.events, model.signals, model.screens, model.components)
        .filter((c) => c.decorators?.some((d) => d.name === "abstract")).length;
    const interfaceCount = model.elements.concat(model.entities, model.flows, model.screens, model.components)
        .filter((c) => c.decorators?.some((d) => d.name === "interface")).length;
    let inheritRelations = 0;
    for (const el of model.elements) {
        if (el.extends)
            inheritRelations++;
        inheritRelations += el.implements.length;
    }
    for (const e of model.entities) {
        if (e.extends)
            inheritRelations++;
        inheritRelations += e.implements.length;
    }
    for (const c of model.components) {
        if (c.extends)
            inheritRelations++;
        inheritRelations += c.implements.length;
    }
    for (const f of model.flows) {
        if (f.extends)
            inheritRelations++;
        inheritRelations += f.implements.length;
    }
    for (const e of model.events) {
        if (e.extends)
            inheritRelations++;
    }
    for (const s of model.signals) {
        if (s.extends)
            inheritRelations++;
    }
    for (const s of model.screens) {
        if (s.extends)
            inheritRelations++;
        inheritRelations += s.implements.length;
    }
    if (abstractCount > 0 || interfaceCount > 0 || inheritRelations > 0) {
        console.log(`\nInheritance:`);
        console.log(`  @abstract:  ${abstractCount}`);
        console.log(`  @interface: ${interfaceCount}`);
        console.log(`  relations:  ${inheritRelations}`);
    }
    // Dependency graph
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
        console.log(`\nDependency Graph:`);
        console.log(`  nodes: ${graph.nodes.length}`);
        console.log(`  edges: ${graph.edges.length}`);
        console.log(`  max depth: ${graph.maxDepth()}`);
        const cycles = graph.findCycles();
        if (cycles.length > 0) {
            console.log(`  cycles: ${cycles.length} (WARNING)`);
        }
    }
    // Deployment topology: components per node
    if (model.nodes.length > 0) {
        console.log(`\nDeployment Topology:`);
        for (const node of model.nodes) {
            const compsOnNode = model.components.filter((c) => c.decorators.some((d) => d.name === "node" && d.params[0]?.value === node.name));
            console.log(`  ${node.name}: ${compsOnNode.length} component(s)${compsOnNode.length > 0 ? ` (${compsOnNode.map((c) => c.name).join(", ")})` : ""}`);
        }
        const unassigned = model.components.filter((c) => !c.decorators.some((d) => d.name === "node"));
        if (unassigned.length > 0) {
            console.log(`  (unassigned): ${unassigned.length} (${unassigned.map((c) => c.name).join(", ")})`);
        }
    }
    // Completeness: % with @status, @impl, @tests
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
    const withVerified = allConstructs.filter((c) => c.decorators?.some((d) => d.name === "verified")).length;
    if (allConstructs.length > 0) {
        console.log(`\nCompleteness:`);
        console.log(`  @status:   ${withStatus}/${allConstructs.length} (${pct(withStatus, allConstructs.length)})`);
        console.log(`  @impl:     ${withImpl}/${allConstructs.length} (${pct(withImpl, allConstructs.length)})`);
        console.log(`  @tests:    ${withTests}/${allConstructs.length} (${pct(withTests, allConstructs.length)})`);
        if (withImpl > 0) {
            console.log(`  @verified: ${withVerified}/${withImpl} (${pct(withVerified, withImpl)}) of implemented`);
        }
    }
}
function pct(n, total) {
    if (total === 0)
        return "0%";
    return Math.round((n / total) * 100) + "%";
}
//# sourceMappingURL=stats.js.map