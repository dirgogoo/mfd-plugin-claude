---
name: mfd-test
description: Generate and manage tests following an MFD model as the specification. Extracts test cases from journeys, flows, operations, APIs, and state machines.
user-invocable: true
---

# /mfd-test — Generate Tests from MFD Model

Generate tests that follow the MFD model as the specification. The model defines WHAT to test; you choose HOW to test.

## Arguments

`$ARGUMENTS` — Path to the .mfd file, optionally followed by test level (e2e, integration, unit, contract) and/or component name.

Examples:
- `/mfd-test model/main.mfd` — all test levels, all components
- `/mfd-test model/main.mfd e2e` — E2E tests only
- `/mfd-test model/main.mfd e2e Frontend` — E2E tests for Frontend component
- `/mfd-test model/main.mfd integration` — integration tests only

## Steps

0. **Load test rules.** Run:
   ```
   mfd_prompt get testes
   ```
   This loads the canonical mapping of MFD constructs to test patterns, fixture generation rules, and page object patterns. Follow these rules throughout test generation.

1. **Validate the model.** Run:
   ```
   mfd_validate file="$MFD_FILE"
   ```
   If there are errors, report them and stop. Tests should be generated from a valid model only.

2. **Generate the test contract.** Run:
   ```
   mfd_test_contract file="$MFD_FILE" level="$LEVEL" component="$COMPONENT"
   ```
   This returns a structured JSON with all test specifications extracted from the model.

3. **Discover the test framework.** Check the project for:
   - `playwright.config.ts` / `playwright.config.js` → Playwright (E2E)
   - `cypress.config.ts` / `cypress.config.js` → Cypress (E2E)
   - `vitest.config.ts` / `jest.config.ts` → Vitest/Jest (unit/integration)
   - `package.json` test dependencies

   If no framework is found, ask the user which to use. Default recommendation:
   - E2E: Playwright
   - Unit/Integration: Vitest
   - API/Contract: Vitest + supertest

4. **Plan the test structure.** Based on the test contract, determine:
   - File organization following the test contract's structure
   - Which page objects, fixtures, and helpers are needed
   - Show the plan to the user for approval

5. **Generate tests.** For each level requested:

   **E2E (from journeys):**
   - Create page object for each screen in `pageObjects`
   - Create fixture for each entity in `fixtures`
   - Create test suite for each journey in `e2eTests`
   - Map each step to navigation + action + assertion

   **Integration (from flows):**
   - Create test suite for each flow in `integrationTests`
   - Generate happy path test case
   - Generate error path test cases (one per branch)
   - Mock external dependencies, verify emitted events

   **Unit (from operations):**
   - Create test suite for each operation in `unitTests`
   - Test with valid inputs, invalid inputs
   - Verify handles/calls/emits behavior

   **Contract (from APIs):**
   - Create test suite for each API in `contractTests`
   - Test each endpoint for happy path, auth failures, validation errors
   - Verify request/response schemas match model

   **State transitions:**
   - For each state machine, test valid transitions succeed
   - Test invalid transitions are rejected

6. **Execute tests.** Run the test suite using the detected framework:
   ```bash
   npx playwright test           # E2E
   npx vitest run                # Unit/Integration
   ```

7. **Update the model.** For each generated test file, mark the model:
   ```
   mfd_trace file="$MFD_FILE" markTests={ construct: "journey_name", paths: ["tests/e2e/journey.spec.ts"] }
   ```

8. **Report coverage.** Run:
   ```
   mfd_stats file="$MFD_FILE"
   ```
   Show the updated `@tests%` metric.

## Key Rules

- **Model is the spec.** Every journey step, flow branch, API endpoint, and state transition in the model MUST have a corresponding test case.
- **Don't invent tests.** Only test what the model defines. If something isn't in the model, it doesn't need a test from this workflow.
- **Fixtures from entities.** All test data comes from entity field definitions with appropriate types.
- **Page objects from screens.** Screen layout, forms, and used elements define the page object structure.
- **Actions are the bridge.** Actions connect UI interactions to API calls — each action generates both a UI test step and an API assertion.
