/**
 * MFD v2 Render Functions
 *
 * Generates Mermaid diagrams from a CollectedModelV2:
 *   domain, concept, lifecycle, capability, objective, invariant, property
 *
 * V1 rendering is no longer supported. Files using v1 constructs
 * will receive an error prompting migration to v2.
 */
import type { ToolResponse } from "./common.js";
import type { CollectedModelV2 } from "../../visual/v2-types.js";
/**
 * Mermaid `graph LR` grouping constructs by source file.
 * - Concepts: rectangles
 * - Capabilities: hexagons {{}}
 * - Enums: ovals ([])
 * - Concepts with lifecycle get a star indicator
 * - Edges: field refs, lifecycle->enum (dotted), affects refs
 */
export declare function renderDomainDiagram(model: CollectedModelV2): string;
/**
 * Mermaid `erDiagram` showing concepts with fields, types, and relationships.
 * - PK annotation for @unique fields
 * - Relationships inferred from field types referencing other concepts
 * - Lifecycle field annotated with "(lifecycle)"
 */
export declare function renderConceptDiagram(model: CollectedModelV2): string;
/**
 * Mermaid `stateDiagram-v2` showing lifecycle state machines from concepts.
 * - Initial state [*] for first transition's "from"
 * - Transitions labeled with capability triggers
 * - Guards shown as notes
 */
export declare function renderLifecycleDiagram(model: CollectedModelV2): string;
/**
 * Mermaid `graph TD` showing capability contracts.
 * - Each capability gets a subgraph with signature as title
 * - Inside: GIVEN, THEN, AFFECTS, REJECT sections as sub-subgraphs
 * - Outside: META section with emits/via info
 */
export declare function renderCapabilityDiagram(model: CollectedModelV2): string;
/**
 * Mermaid `graph LR` showing objectives as navigation graphs.
 * - Nodes are capabilities (referenced by trigger)
 * - * -> ANY[*], end -> END((end))
 * - @persona badge in section comment
 */
export declare function renderObjectiveDiagram(model: CollectedModelV2): string;
/**
 * Mermaid `graph TD` showing invariants with cross-references to concepts.
 * - Invariant nodes with their names
 * - Concept nodes as rectangles
 * - Dotted edges from invariants to referenced concepts
 * - Local invariants show their parent concept connection
 */
export declare function renderInvariantDiagram(model: CollectedModelV2): string;
/**
 * Mermaid `graph LR` showing temporal properties.
 * - Each property becomes a subgraph
 * - Clauses are nodes inside, color-coded by classDef:
 *     never -> neverNode (red), eventually -> eventuallyNode (yellow), always -> alwaysNode (green)
 * - Dotted edges from clause nodes to referenced concepts
 */
export declare function renderPropertyDiagram(model: CollectedModelV2): string;
/**
 * Main entry point for the mfd_render MCP tool.
 * Dispatches to v2 diagram renderers. V1 files receive an error message.
 */
export declare function handleRender(args: {
    file: string;
    diagram_type: string;
    resolve_includes?: boolean;
}): ToolResponse;
//# sourceMappingURL=render.d.ts.map