/**
 * Test contract generator — produces structured test specifications from MFD models.
 *
 * Similar to the implementation contract (index.ts) but optimized for test generation.
 * Extracts journeys as E2E tests, actions as test steps, screens as page objects,
 * flows for integration tests, state machines for transition tests, rules as assertions.
 */
import type { CollectedModel } from "../validator/collect.js";
export type TestLevel = "e2e" | "integration" | "unit" | "contract";
export interface TestContract {
    version: string;
    level: TestLevel | "all";
    e2eTests: E2eTestSpec[];
    integrationTests: IntegrationTestSpec[];
    unitTests: UnitTestSpec[];
    contractTests: ContractTestSpec[];
    pageObjects: PageObjectSpec[];
    fixtures: FixtureSpec[];
    stateTransitionTests: StateTransitionTestSpec[];
}
export interface E2eTestSpec {
    id: string;
    journey: string;
    persona: string | null;
    steps: E2eStepSpec[];
    requiredFixtures: string[];
    screens: string[];
}
export interface E2eStepSpec {
    order: number;
    fromScreen: string;
    toScreen: string;
    trigger: string;
    action: ActionTestSpec | null;
}
export interface ActionTestSpec {
    name: string;
    calls: {
        method: string;
        path: string;
    } | null;
    onStream: string | null;
    onSignal: string | null;
    emitsSignals: string[];
    inputType: string | null;
    outcomes: Array<{
        condition: string;
        expectedScreen: string;
    }>;
}
export interface IntegrationTestSpec {
    id: string;
    flow: string;
    params: string[];
    returnType: string | null;
    trigger: string | null;
    emits: string[];
    happyPath: FlowPathSpec;
    errorPaths: FlowPathSpec[];
    totalScenarios: number;
}
export interface FlowPathSpec {
    name: string;
    steps: string[];
    result: string | null;
}
export interface UnitTestSpec {
    id: string;
    operation: string;
    params: string[];
    returnType: string | null;
    handles: Array<{
        method: string;
        path: string;
    }>;
    calls: Array<{
        method: string;
        path: string;
    }>;
    emits: string[];
    on: string[];
    enforces: string[];
}
export interface ContractTestSpec {
    id: string;
    apiName: string | null;
    style: string;
    prefix: string | null;
    external: boolean;
    endpoints: EndpointTestSpec[];
}
export interface EndpointTestSpec {
    method: string;
    path: string;
    inputType: string | null;
    responseType: string | null;
    auth: boolean;
    scenarios: string[];
}
export interface PageObjectSpec {
    screen: string;
    layout: string | null;
    uses: Array<{
        element: string;
        alias: string;
    }>;
    forms: Array<{
        name: string | null;
        fields: FieldSpec[];
    }>;
    availableActions: string[];
}
export interface FieldSpec {
    name: string;
    type: string;
    decorators: string[];
}
export interface FixtureSpec {
    entity: string;
    fields: FieldSpec[];
}
export interface StateTransitionTestSpec {
    name: string;
    enumRef: string;
    validTransitions: Array<{
        from: string;
        to: string;
        trigger: string | null;
    }>;
    invalidTransitions: Array<{
        from: string;
        to: string;
        reason: string;
    }>;
}
export declare function generateTestContract(model: CollectedModel, level?: TestLevel | "all"): TestContract;
export declare function serializeTestContract(contract: TestContract): string;
//# sourceMappingURL=test-contract.d.ts.map