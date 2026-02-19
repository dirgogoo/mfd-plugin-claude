import { collectModel } from "../collect.js";
/**
 * CIRCULAR_DEP: Checks that the dependency graph between components is a DAG.
 */
export function circularDeps(doc) {
    const model = collectModel(doc);
    const diagnostics = [];
    // Build adjacency list: component -> deps
    const componentNames = new Set(model.components.map((c) => c.name));
    const graph = new Map();
    const componentLocs = new Map();
    for (const comp of model.components) {
        componentLocs.set(comp.name, comp);
        const deps = [];
        for (const item of comp.body) {
            if (item.type === "DepDecl" && componentNames.has(item.target)) {
                deps.push(item.target);
            }
        }
        graph.set(comp.name, deps);
    }
    // Detect cycles using DFS
    const visited = new Set();
    const inStack = new Set();
    const cycles = [];
    function dfs(node, path) {
        if (inStack.has(node)) {
            const cycleStart = path.indexOf(node);
            const cycle = path.slice(cycleStart);
            cycle.push(node);
            cycles.push(cycle);
            return;
        }
        if (visited.has(node))
            return;
        visited.add(node);
        inStack.add(node);
        path.push(node);
        for (const dep of graph.get(node) ?? []) {
            dfs(dep, [...path]);
        }
        inStack.delete(node);
    }
    for (const name of componentNames) {
        if (!visited.has(name)) {
            dfs(name, []);
        }
    }
    // Report unique cycles
    const reported = new Set();
    for (const cycle of cycles) {
        const sorted = [...cycle.slice(0, -1)].sort().join(" -> ");
        if (reported.has(sorted))
            continue;
        reported.add(sorted);
        const comp = componentLocs.get(cycle[0]);
        diagnostics.push({
            code: "CIRCULAR_DEP",
            severity: "error",
            message: `Circular dependency: ${cycle.join(" -> ")}`,
            location: comp?.loc ?? {
                start: { line: 1, column: 1, offset: 0 },
                end: { line: 1, column: 1, offset: 0 },
            },
            help: "Break the cycle by extracting shared types or using events for decoupling",
        });
    }
    return diagnostics;
}
//# sourceMappingURL=circular-deps.js.map