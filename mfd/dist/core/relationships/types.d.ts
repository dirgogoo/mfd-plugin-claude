export interface ConstructRef {
    component: string;
    type: "element" | "entity" | "enum" | "flow" | "api" | "state" | "event" | "signal" | "rule" | "screen" | "journey" | "operation" | "action";
    name: string;
}
export interface ApiRef {
    method: string;
    path: string;
    component: string;
}
export interface EntityFieldRef {
    entity: string;
    field: string;
    component: string;
}
export interface Relationships {
    usedByFlows: ConstructRef[];
    exposedByApi: ApiRef[];
    governedByStates: ConstructRef[];
    governedByRules: ConstructRef[];
    referencedByEntities: EntityFieldRef[];
    emitsEvents: ConstructRef[];
    actionSources: ConstructRef[];
    calledByActions: ConstructRef[];
    involvedEntities: ConstructRef[];
    involvedEvents: ConstructRef[];
    targetFlow: ConstructRef | null;
    enumRef: ConstructRef | null;
    triggeredByEvents: ConstructRef[];
    triggersStates: ConstructRef[];
    usesOperations: ConstructRef[];
    usedByOperations: ConstructRef[];
    triggeredByRules: ConstructRef[];
    triggersOperations: ConstructRef[];
    enforcesRules: ConstructRef[];
    enforcedByOperations: ConstructRef[];
    emitsSignals: ConstructRef[];
    onSignals: ConstructRef[];
    signalEmittedByActions: ConstructRef[];
    signalListenedByActions: ConstructRef[];
    handlesEndpoints: ApiRef[];
    callsEndpoints: ApiRef[];
    extendsParent: ConstructRef | null;
    extendedByChildren: ConstructRef[];
    implementsInterfaces: ConstructRef[];
    implementedByConcretes: ConstructRef[];
}
export declare function emptyRelationships(): Relationships;
//# sourceMappingURL=types.d.ts.map