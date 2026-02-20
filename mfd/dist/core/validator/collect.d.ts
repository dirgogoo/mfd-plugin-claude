import type { MfdDocument, SystemDecl, ComponentDecl, ElementDecl, EntityDecl, EnumDecl, FlowDecl, StateDecl, EventDecl, SignalDecl, ApiDecl, RuleDecl, DepDecl, SecretDecl, ScreenDecl, JourneyDecl, OperationDecl, ActionDecl, NodeDecl } from "../parser/ast.js";
export interface CollectedModel {
    elements: ElementDecl[];
    entities: EntityDecl[];
    enums: EnumDecl[];
    flows: FlowDecl[];
    states: StateDecl[];
    events: EventDecl[];
    signals: SignalDecl[];
    apis: ApiDecl[];
    rules: RuleDecl[];
    deps: DepDecl[];
    secrets: SecretDecl[];
    components: ComponentDecl[];
    systems: SystemDecl[];
    screens: ScreenDecl[];
    journeys: JourneyDecl[];
    operations: OperationDecl[];
    actions: ActionDecl[];
    nodes: NodeDecl[];
}
/**
 * Collect all constructs from a document recursively,
 * flattening the hierarchy for validation purposes.
 */
export declare function collectModel(doc: MfdDocument): CollectedModel;
/**
 * Get all known type names (entities + enums + events + primitive types).
 * Events are included because STREAM endpoints return event types.
 */
export declare function getKnownTypes(model: CollectedModel): Set<string>;
/**
 * Get all known construct names (entities, enums, flows, events, components).
 */
export declare function getKnownNames(model: CollectedModel): Set<string>;
//# sourceMappingURL=collect.d.ts.map