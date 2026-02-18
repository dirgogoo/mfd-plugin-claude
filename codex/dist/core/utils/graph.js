/**
 * Directed graph utilities for dependency analysis.
 */
export class DirectedGraph {
    adjacency = new Map();
    addNode(node) {
        if (!this.adjacency.has(node)) {
            this.adjacency.set(node, new Set());
        }
    }
    addEdge(from, to) {
        this.addNode(from);
        this.addNode(to);
        this.adjacency.get(from).add(to);
    }
    get nodes() {
        return [...this.adjacency.keys()];
    }
    get edges() {
        const result = [];
        for (const [from, tos] of this.adjacency) {
            for (const to of tos) {
                result.push([from, to]);
            }
        }
        return result;
    }
    neighbors(node) {
        return [...(this.adjacency.get(node) ?? [])];
    }
    /** Detect all cycles in the graph */
    findCycles() {
        const visited = new Set();
        const inStack = new Set();
        const cycles = [];
        const dfs = (node, path) => {
            if (inStack.has(node)) {
                const cycleStart = path.indexOf(node);
                cycles.push([...path.slice(cycleStart), node]);
                return;
            }
            if (visited.has(node))
                return;
            visited.add(node);
            inStack.add(node);
            path.push(node);
            for (const next of this.neighbors(node)) {
                dfs(next, [...path]);
            }
            inStack.delete(node);
        };
        for (const node of this.nodes) {
            if (!visited.has(node)) {
                dfs(node, []);
            }
        }
        return cycles;
    }
    /** Maximum depth of the graph (longest path from any root) */
    maxDepth() {
        const memo = new Map();
        const depth = (node, visited) => {
            if (visited.has(node))
                return 0; // cycle protection
            if (memo.has(node))
                return memo.get(node);
            visited.add(node);
            const neighbors = this.neighbors(node);
            if (neighbors.length === 0) {
                memo.set(node, 0);
                return 0;
            }
            const maxChild = Math.max(...neighbors.map((n) => depth(n, new Set(visited))));
            const d = maxChild + 1;
            memo.set(node, d);
            return d;
        };
        let maxD = 0;
        for (const node of this.nodes) {
            maxD = Math.max(maxD, depth(node, new Set()));
        }
        return maxD;
    }
}
//# sourceMappingURL=graph.js.map