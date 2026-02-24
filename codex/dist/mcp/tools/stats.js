import { collectModel } from "../../core/validator/collect.js";
import { computeStats } from "../../core/utils/stats.js";
import { loadDocument } from "./common.js";
export function handleStats(args) {
    const { doc, source } = loadDocument(args.file, args.resolve_includes);
    const model = collectModel(doc);
    const stats = computeStats(model, source);
    const lines = [];
    lines.push("=== MFD Model Statistics ===\n");
    lines.push("Constructs:");
    lines.push(`  systems:     ${stats.counts.systems}`);
    lines.push(`  components:  ${stats.counts.components}`);
    lines.push(`  elements:    ${stats.counts.elements}`);
    lines.push(`  entities:    ${stats.counts.entities}`);
    lines.push(`  enums:       ${stats.counts.enums}`);
    lines.push(`  flows:       ${stats.counts.flows}`);
    lines.push(`  states:      ${stats.counts.states}`);
    lines.push(`  events:      ${stats.counts.events}`);
    lines.push(`  signals:     ${stats.counts.signals}`);
    lines.push(`  apis:        ${stats.counts.apis}`);
    lines.push(`  rules:       ${stats.counts.rules}`);
    lines.push(`  deps:        ${stats.counts.deps}`);
    lines.push(`  secrets:     ${stats.counts.secrets}`);
    lines.push(`  screens:     ${stats.counts.screens}`);
    lines.push(`  journeys:    ${stats.counts.journeys}`);
    lines.push(`  operations:  ${stats.counts.operations}`);
    lines.push(`  total:       ${stats.counts.total}`);
    lines.push(`\nTokens: ~${stats.tokens}`);
    lines.push(`\nDetails:`);
    lines.push(`  entity fields: ${stats.details.entityFields}`);
    lines.push(`  event fields:  ${stats.details.eventFields}`);
    lines.push(`  signal fields: ${stats.details.signalFields}`);
    lines.push(`  enum values:   ${stats.details.enumValues}`);
    lines.push(`  api endpoints: ${stats.details.apiEndpoints}`);
    if (stats.details.streamEndpoints > 0) {
        lines.push(`  stream endpoints: ${stats.details.streamEndpoints}`);
    }
    if (stats.details.externalApis > 0) {
        lines.push(`  external apis: ${stats.details.externalApis}`);
    }
    lines.push(`  transitions:   ${stats.details.transitions}`);
    if (stats.counts.screens > 0 || stats.counts.journeys > 0 || stats.counts.actions > 0) {
        lines.push(`  action results: ${stats.details.actionResults}`);
        lines.push(`  screen forms:   ${stats.details.screenForms}`);
        lines.push(`  journey steps:  ${stats.details.journeySteps}`);
    }
    if (stats.details.abstractConstructs > 0 || stats.details.interfaceConstructs > 0 || stats.details.inheritanceRelations > 0) {
        lines.push(`\nInheritance:`);
        lines.push(`  @abstract:  ${stats.details.abstractConstructs}`);
        lines.push(`  @interface: ${stats.details.interfaceConstructs}`);
        lines.push(`  relations:  ${stats.details.inheritanceRelations}`);
    }
    if (stats.dependencyGraph) {
        lines.push(`\nDependency Graph:`);
        lines.push(`  nodes: ${stats.dependencyGraph.nodes}`);
        lines.push(`  edges: ${stats.dependencyGraph.edges}`);
        lines.push(`  max depth: ${stats.dependencyGraph.maxDepth}`);
        if (stats.dependencyGraph.cycles > 0) {
            lines.push(`  cycles: ${stats.dependencyGraph.cycles} (WARNING)`);
        }
    }
    if (stats.completeness.total > 0) {
        const pct = (n, t) => t === 0 ? "0%" : Math.round((n / t) * 100) + "%";
        lines.push(`\nCompleteness:`);
        lines.push(`  @status: ${stats.completeness.withStatus}/${stats.completeness.total} (${pct(stats.completeness.withStatus, stats.completeness.total)})`);
        lines.push(`  @impl:   ${stats.completeness.withImpl}/${stats.completeness.total} (${pct(stats.completeness.withImpl, stats.completeness.total)})`);
        lines.push(`  @tests:  ${stats.completeness.withTests}/${stats.completeness.total} (${pct(stats.completeness.withTests, stats.completeness.total)})`);
        lines.push(`  @verified: ${stats.completeness.withVerified}/${stats.completeness.total} (${pct(stats.completeness.withVerified, stats.completeness.total)})`);
        lines.push(`  @live:     ${stats.completeness.withLive}/${stats.completeness.total} (${pct(stats.completeness.withLive, stats.completeness.total)})`);
    }
    return {
        content: [{ type: "text", text: lines.join("\n") }],
    };
}
//# sourceMappingURL=stats.js.map