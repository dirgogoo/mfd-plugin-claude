import type { CollectedModel } from "../validator/collect.js";
export interface ImplementationContract {
    version: string;
    elements: ElementContract[];
    entities: EntityContract[];
    enums: EnumContract[];
    flows: FlowContract[];
    states: StateContract[];
    events: EventContract[];
    signals: SignalContract[];
    apis: ApiContract[];
    rules: RuleContract[];
    screens: ScreenContract[];
    journeys: JourneyContract[];
    operations: OperationContract[];
    actions: ActionContract[];
    deps: DepContract[];
    secrets: SecretContract[];
}
export interface ElementContract {
    name: string;
    extends: string | null;
    implements: string[];
    abstract: boolean;
    interface: boolean;
    props: PropContract[];
    resolvedProps: PropContract[];
    forms: Array<{
        name: string | null;
        fields: FieldContract[];
    }>;
    usedBy: string[];
    decorators: string[];
}
export interface PropContract {
    name: string;
    type: string;
    decorators: string[];
    inheritedFrom: string | null;
}
export interface EntityContract {
    name: string;
    extends: string | null;
    implements: string[];
    abstract: boolean;
    interface: boolean;
    fields: FieldContract[];
    resolvedFields: FieldContract[];
    decorators: string[];
}
export interface FieldContract {
    name: string;
    type: string;
    decorators: string[];
    relation?: {
        cardinality: string;
        targetEntity: string;
    };
}
export interface EnumContract {
    name: string;
    values: string[];
    decorators: string[];
}
export interface FlowContract {
    name: string;
    extends: string | null;
    implements: string[];
    abstract: boolean;
    interface: boolean;
    params: string[];
    returnType: string | null;
    trigger: string | null;
    emits: string[];
    handles: Array<{
        method: string;
        path: string;
    }>;
    decorators: string[];
    steps: FlowStepContract[];
    resolvedSteps: FlowStepContract[];
    overrides: string[];
}
export interface FlowStepContract {
    action: string;
    args: string | null;
    branches: Array<{
        condition: string;
        action: string;
    }>;
    decorators: string[];
}
export interface StateContract {
    name: string;
    enumRef: string;
    transitions: Array<{
        from: string;
        to: string;
        event: string | null;
        decorators: string[];
    }>;
    decorators: string[];
}
export interface EventContract {
    name: string;
    extends: string | null;
    abstract: boolean;
    fields: FieldContract[];
    resolvedFields: FieldContract[];
    decorators: string[];
}
export interface SignalContract {
    name: string;
    extends: string | null;
    abstract: boolean;
    fields: FieldContract[];
    decorators: string[];
}
export interface ApiContract {
    name: string | null;
    style: string;
    prefix: string | null;
    external: boolean;
    endpoints: EndpointContract[];
    decorators: string[];
}
export interface EndpointContract {
    method: string;
    path: string;
    input: string | null;
    response: string | null;
    decorators: string[];
}
export interface RuleContract {
    name: string;
    when: string | null;
    then: string | null;
    elseIf: Array<{
        condition: string;
        action: string;
    }>;
    else: string | null;
    decorators: string[];
}
export interface ScreenContract {
    name: string;
    extends: string | null;
    implements: string[];
    abstract: boolean;
    interface: boolean;
    forms: Array<{
        name: string | null;
        fields: FieldContract[];
    }>;
    decorators: string[];
}
export interface ActionContract {
    name: string;
    params: string[];
    from: string | null;
    calls: {
        method: string;
        path: string;
    } | null;
    onStream: string | null;
    onSignal: string | null;
    emitsSignals: string[];
    results: Array<{
        outcome: string;
        screen: string;
    }>;
    decorators: string[];
}
export interface JourneyContract {
    name: string;
    steps: Array<{
        from: string;
        to: string;
        trigger: string;
    }>;
    decorators: string[];
}
export interface DepContract {
    target: string;
    decorators: string[];
}
export interface SecretContract {
    name: string;
    decorators: string[];
}
export interface OperationContract {
    name: string;
    params: string[];
    returnType: string | null;
    emits: string[];
    on: string[];
    enforces: string[];
    handles: Array<{
        method: string;
        path: string;
    }>;
    calls: Array<{
        method: string;
        path: string;
    }>;
    decorators: string[];
}
export declare function generateContract(model: CollectedModel): ImplementationContract;
export declare function serializeContract(contract: ImplementationContract): string;
//# sourceMappingURL=index.d.ts.map