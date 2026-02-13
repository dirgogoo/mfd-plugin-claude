/**
 * Directed graph utilities for dependency analysis.
 */
export declare class DirectedGraph<T = string> {
    private adjacency;
    addNode(node: T): void;
    addEdge(from: T, to: T): void;
    get nodes(): T[];
    get edges(): Array<[T, T]>;
    neighbors(node: T): T[];
    /** Detect all cycles in the graph */
    findCycles(): T[][];
    /** Maximum depth of the graph (longest path from any root) */
    maxDepth(): number;
}
//# sourceMappingURL=graph.d.ts.map