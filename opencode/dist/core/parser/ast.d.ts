/** Source location for every AST node */
export interface SourceLocation {
    line: number;
    column: number;
    offset: number;
    source?: string;
}
export interface SourceRange {
    start: SourceLocation;
    end: SourceLocation;
}
export interface BaseNode {
    type: string;
    loc: SourceRange;
    leadingComments?: SemanticComment[];
    trailingDecorators?: Decorator[];
}
export type PrimitiveType = "string" | "number" | "boolean" | "date" | "datetime" | "uuid" | "void";
/** Type expression: primitives, references, optional (?), array ([]), union (|) */
export type TypeExpr = PrimitiveTypeExpr | ReferenceTypeExpr | OptionalTypeExpr | ArrayTypeExpr | UnionTypeExpr | InlineObjectTypeExpr;
export interface PrimitiveTypeExpr extends BaseNode {
    type: "PrimitiveType";
    name: PrimitiveType;
}
export interface ReferenceTypeExpr extends BaseNode {
    type: "ReferenceType";
    name: string;
}
export interface OptionalTypeExpr extends BaseNode {
    type: "OptionalType";
    inner: TypeExpr;
}
export interface ArrayTypeExpr extends BaseNode {
    type: "ArrayType";
    inner: TypeExpr;
}
export interface UnionTypeExpr extends BaseNode {
    type: "UnionType";
    alternatives: TypeExpr[];
}
export interface InlineObjectTypeExpr extends BaseNode {
    type: "InlineObjectType";
    fields: FieldDecl[];
}
export type DecoratorValue = {
    kind: "string";
    value: string;
} | {
    kind: "number";
    value: number;
} | {
    kind: "identifier";
    value: string;
} | {
    kind: "duration";
    value: number;
    unit: "s" | "min" | "h" | "d";
} | {
    kind: "rate";
    value: number;
    unit: string;
};
export interface Decorator extends BaseNode {
    type: "Decorator";
    name: string;
    params: DecoratorValue[];
}
export interface SemanticComment extends BaseNode {
    type: "SemanticComment";
    text: string;
}
export interface FieldDecl extends BaseNode {
    type: "FieldDecl";
    name: string;
    fieldType: TypeExpr;
    decorators: Decorator[];
    leadingComments?: SemanticComment[];
}
export interface SystemDecl extends BaseNode {
    type: "SystemDecl";
    name: string;
    decorators: Decorator[];
    body: SystemBodyItem[];
}
export type SystemBodyItem = IncludeDecl | ComponentDecl | SemanticComment | ErrorNode;
export interface IncludeDecl extends BaseNode {
    type: "IncludeDecl";
    path: string;
}
export interface ComponentDecl extends BaseNode {
    type: "ComponentDecl";
    name: string;
    extends: string | null;
    implements: string[];
    decorators: Decorator[];
    body: ComponentBodyItem[];
}
export type ComponentBodyItem = DepDecl | SecretDecl | ElementDecl | EntityDecl | EnumDecl | FlowDecl | StateDecl | EventDecl | SignalDecl | ApiDecl | RuleDecl | ScreenDecl | JourneyDecl | OperationDecl | ActionDecl | SemanticComment | ErrorNode;
export interface DepDecl extends BaseNode {
    type: "DepDecl";
    target: string;
    decorators: Decorator[];
}
export interface SecretDecl extends BaseNode {
    type: "SecretDecl";
    name: string;
    decorators: Decorator[];
}
export interface EntityDecl extends BaseNode {
    type: "EntityDecl";
    name: string;
    extends: string | null;
    implements: string[];
    decorators: Decorator[];
    fields: FieldDecl[];
}
export interface EnumDecl extends BaseNode {
    type: "EnumDecl";
    name: string;
    decorators: Decorator[];
    values: EnumValue[];
}
export interface EnumValue extends BaseNode {
    type: "EnumValue";
    name: string;
}
export interface ElementDecl extends BaseNode {
    type: "ElementDecl";
    name: string;
    extends: string | null;
    implements: string[];
    decorators: Decorator[];
    body: ElementBodyItem[];
}
export type ElementBodyItem = PropDecl | FormDecl | SemanticComment;
export interface PropDecl extends BaseNode {
    type: "PropDecl";
    name: string;
    propType: TypeExpr;
    decorators: Decorator[];
}
export interface FlowDecl extends BaseNode {
    type: "FlowDecl";
    name: string;
    extends: string | null;
    implements: string[];
    params: TypeExpr[];
    returnType: TypeExpr | null;
    decorators: Decorator[];
    body: FlowBodyItem[];
}
export type FlowBodyItem = FlowStep | FlowOverrideStep | OnClause | EmitsClause | OperationHandlesClause | SemanticComment;
export interface FlowStep extends BaseNode {
    type: "FlowStep";
    hasArrow: boolean;
    action: string;
    args: string | null;
    decorators: Decorator[];
    branches: FlowBranch[];
}
export interface FlowBranch extends BaseNode {
    type: "FlowBranch";
    condition: string;
    action: string;
}
export interface FlowOverrideStep extends BaseNode {
    type: "FlowOverrideStep";
    target: string;
    action: string;
    args: string | null;
    decorators: Decorator[];
}
export interface StateDecl extends BaseNode {
    type: "StateDecl";
    name: string;
    enumRef: string;
    decorators: Decorator[];
    transitions: StateTransition[];
    comments: SemanticComment[];
}
export interface StateTransition extends BaseNode {
    type: "StateTransition";
    from: string;
    to: string;
    event: string | null;
    decorators: Decorator[];
    trailingComment?: SemanticComment;
}
export interface EventDecl extends BaseNode {
    type: "EventDecl";
    name: string;
    extends: string | null;
    decorators: Decorator[];
    fields: FieldDecl[];
}
export interface SignalDecl extends BaseNode {
    type: "SignalDecl";
    name: string;
    extends: string | null;
    decorators: Decorator[];
    fields: FieldDecl[];
}
export type ApiStyle = "REST" | "GraphQL" | "gRPC";
export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "STREAM";
export interface ApiDecl extends BaseNode {
    type: "ApiDecl";
    name: string | null;
    style: ApiStyle;
    decorators: Decorator[];
    endpoints: ApiEndpoint[];
    comments: SemanticComment[];
}
/** Simple endpoint: METHOD /path (InputType) -> ReturnType @decorators */
export interface ApiEndpointSimple extends BaseNode {
    type: "ApiEndpointSimple";
    method: HttpMethod;
    path: string;
    inputType: TypeExpr | null;
    returnType: TypeExpr | null;
    decorators: Decorator[];
}
/** Expanded endpoint with body:/response:/query: */
export interface ApiEndpointExpanded extends BaseNode {
    type: "ApiEndpointExpanded";
    method: HttpMethod;
    path: string;
    body: TypeExpr | null;
    response: TypeExpr | null;
    query: TypeExpr | null;
    decorators: Decorator[];
}
export type ApiEndpoint = ApiEndpointSimple | ApiEndpointExpanded;
export interface RuleDecl extends BaseNode {
    type: "RuleDecl";
    name: string;
    decorators: Decorator[];
    body: RuleBodyItem[];
}
export type RuleBodyItem = WhenClause | ThenClause | ElseIfClause | ElseClause | SemanticComment;
export interface WhenClause extends BaseNode {
    type: "WhenClause";
    expression: string;
}
export interface ThenClause extends BaseNode {
    type: "ThenClause";
    action: string;
}
export interface ElseIfClause extends BaseNode {
    type: "ElseIfClause";
    condition: string;
    action: string;
}
export interface ElseClause extends BaseNode {
    type: "ElseClause";
    action: string;
}
export interface ScreenDecl extends BaseNode {
    type: "ScreenDecl";
    name: string;
    extends: string | null;
    implements: string[];
    decorators: Decorator[];
    body: ScreenBodyItem[];
}
export type ScreenBodyItem = UsesDecl | FormDecl | SemanticComment;
export interface FormDecl extends BaseNode {
    type: "FormDecl";
    name: string | null;
    fields: FieldDecl[];
}
export interface UsesDecl extends BaseNode {
    type: "UsesDecl";
    element: string;
    alias: string;
    decorators: Decorator[];
}
export interface ActionDecl extends BaseNode {
    type: "ActionDecl";
    name: string;
    params: TypeExpr[];
    decorators: Decorator[];
    body: ActionBodyItem[];
}
export type ActionBodyItem = ActionFromClause | ActionCallsClause | ActionOnStreamClause | ActionOnSignalClause | ActionEmitsSignalClause | ActionResult | SemanticComment;
export interface ActionFromClause extends BaseNode {
    type: "ActionFromClause";
    screen: string;
}
export interface ActionCallsClause extends BaseNode {
    type: "ActionCallsClause";
    method: string;
    path: string;
}
export interface ActionOnStreamClause extends BaseNode {
    type: "ActionOnStreamClause";
    path: string;
}
export interface ActionOnSignalClause extends BaseNode {
    type: "ActionOnSignalClause";
    signal: string;
}
export interface ActionEmitsSignalClause extends BaseNode {
    type: "ActionEmitsSignalClause";
    signal: string;
}
export interface ActionResult extends BaseNode {
    type: "ActionResult";
    outcome: string;
    screen: string;
    decorators: Decorator[];
}
export interface JourneyDecl extends BaseNode {
    type: "JourneyDecl";
    name: string;
    decorators: Decorator[];
    body: JourneyBodyItem[];
}
export type JourneyBodyItem = JourneyStep | SemanticComment;
export interface JourneyStep extends BaseNode {
    type: "JourneyStep";
    from: string;
    to: string;
    trigger: string;
    decorators: Decorator[];
}
export interface OperationDecl extends BaseNode {
    type: "OperationDecl";
    name: string;
    params: TypeExpr[];
    returnType: TypeExpr | null;
    decorators: Decorator[];
    body: OperationBodyItem[];
}
export type OperationBodyItem = OperationHandlesClause | OperationCallsClause | EmitsClause | OnClause | EnforcesClause | SemanticComment;
export interface EmitsClause extends BaseNode {
    type: "EmitsClause";
    event: string;
}
export interface OnClause extends BaseNode {
    type: "OnClause";
    event: string;
}
export interface EnforcesClause extends BaseNode {
    type: "EnforcesClause";
    rule: string;
}
export interface OperationHandlesClause extends BaseNode {
    type: "OperationHandlesClause";
    method: string;
    path: string;
}
export interface OperationCallsClause extends BaseNode {
    type: "OperationCallsClause";
    method: string;
    path: string;
}
export interface ErrorNode extends BaseNode {
    type: "ErrorNode";
    raw: string;
    context: string;
}
/** A parsed MFD file — may contain a system or top-level constructs */
export interface MfdDocument extends BaseNode {
    type: "MfdDocument";
    body: TopLevelItem[];
}
export type TopLevelItem = SystemDecl | ComponentDecl | ElementDecl | EntityDecl | EnumDecl | FlowDecl | StateDecl | EventDecl | SignalDecl | ApiDecl | RuleDecl | DepDecl | SecretDecl | ScreenDecl | JourneyDecl | OperationDecl | ActionDecl | IncludeDecl | SemanticComment | ErrorNode;
//# sourceMappingURL=ast.d.ts.map