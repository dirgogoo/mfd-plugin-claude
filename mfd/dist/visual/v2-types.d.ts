/**
 * V2 AST types for the visual layer.
 * These define the data structures for MFD v2 constructs:
 * concept, enum, capability, invariant, property, objective.
 *
 * When the real v2 parser is built, it should produce these same types.
 */
export interface SourceLoc {
    line: number;
    column: number;
    source?: string;
}
export interface Loc {
    start: SourceLoc;
    end?: SourceLoc;
}
export interface DecoratorV2 {
    name: string;
    params: {
        value: string | number;
    }[];
}
export type FieldTypeV2 = {
    type: "PrimitiveType";
    name: string;
} | {
    type: "ReferenceType";
    name: string;
} | {
    type: "OptionalType";
    inner: FieldTypeV2;
} | {
    type: "ArrayType";
    inner: FieldTypeV2;
} | {
    type: "UnionType";
    alternatives: FieldTypeV2[];
};
export interface FieldV2 {
    name: string;
    fieldType: FieldTypeV2;
    decorators: DecoratorV2[];
}
export interface LifecycleTransitionV2 {
    from: string;
    to: string;
    capability: string;
    requires?: string;
}
export interface LifecycleV2 {
    field: string;
    enumRef: string;
    transitions: LifecycleTransitionV2[];
}
export interface LocalInvariantV2 {
    name: string;
    expression: string;
}
export interface ConceptV2 {
    name: string;
    fields: FieldV2[];
    lifecycle?: LifecycleV2;
    invariants: LocalInvariantV2[];
    decorators: DecoratorV2[];
    comments: string[];
    loc?: Loc;
}
export interface EnumV2 {
    name: string;
    values: string[];
    decorators: DecoratorV2[];
    loc?: Loc;
}
export interface ParamV2 {
    name: string;
    fieldType: FieldTypeV2;
}
export interface GivenClauseV2 {
    type: "given";
    expression: string;
}
export interface ThenClauseV2 {
    type: "then";
    expression: string;
}
export interface AffectsClauseV2 {
    type: "affects";
    concept: string;
    where?: string;
    assignments: {
        field: string;
        expression: string;
    }[];
}
export interface RejectClauseV2 {
    type: "reject";
    reason: string;
    condition: string;
}
export interface EmitsClauseV2 {
    type: "emits";
    event: string;
}
export interface ViaClauseV2 {
    type: "via";
    method: string;
    path: string;
    decorators: DecoratorV2[];
}
export type CapabilityClauseV2 = GivenClauseV2 | ThenClauseV2 | AffectsClauseV2 | RejectClauseV2 | EmitsClauseV2 | ViaClauseV2;
export interface CapabilityV2 {
    name: string;
    params: ParamV2[];
    returnType: FieldTypeV2 | null;
    clauses: CapabilityClauseV2[];
    decorators: DecoratorV2[];
    comments: string[];
    loc?: Loc;
}
export interface InvariantV2 {
    name: string;
    expression: string;
    comments: string[];
    scope: "global" | "local";
    conceptName?: string;
    decorators: DecoratorV2[];
    loc?: Loc;
}
export interface NeverClauseV2 {
    type: "never";
    expression: string;
}
export interface EventuallyClauseV2 {
    type: "eventually";
    expression: string;
    where?: string;
}
export interface AlwaysClauseV2 {
    type: "always";
    expression: string;
}
export type PropertyClauseV2 = NeverClauseV2 | EventuallyClauseV2 | AlwaysClauseV2;
export interface PropertyV2 {
    name: string;
    clauses: PropertyClauseV2[];
    comments: string[];
    decorators: DecoratorV2[];
    loc?: Loc;
}
export interface ObjectiveTransitionV2 {
    from: string;
    to: string;
    trigger: string;
}
export interface ObjectiveV2 {
    name: string;
    persona?: string;
    transitions: ObjectiveTransitionV2[];
    comments: string[];
    decorators: DecoratorV2[];
    loc?: Loc;
}
export interface SystemV2 {
    name: string;
    version?: string;
    comments: string[];
    decorators: DecoratorV2[];
    imports: string[];
}
export interface CollectedModelV2 {
    systems: SystemV2[];
    concepts: ConceptV2[];
    enums: EnumV2[];
    capabilities: CapabilityV2[];
    invariants: InvariantV2[];
    properties: PropertyV2[];
    objectives: ObjectiveV2[];
}
//# sourceMappingURL=v2-types.d.ts.map