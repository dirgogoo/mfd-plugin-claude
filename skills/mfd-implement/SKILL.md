---
name: mfd-implement
description: Implement code following an MFD model as the contract. Reads the .mfd file and generates corresponding code. Use when the user wants to turn a model into working code.
user-invocable: true
---

# /mfd-implement — Implement Code from MFD Model

Read an MFD model and generate implementation code that follows the model as a contract.

## Arguments

`$ARGUMENTS` — Path to the .mfd file, optionally followed by what to implement (e.g., "entities", "api", "flows", component name).

## Steps

0. **Load implementation rules.** Run:
   ```
   mfd_prompt get implementacao
   ```
   This loads the canonical mapping of MFD constructs to code patterns, @impl rules, and fidelity requirements. Follow these rules throughout implementation.

1. **Parse the model.** Run:
   ```bash
   npx mfd parse "$MFD_FILE" --json
   ```

   **Multi-file models:** If the model uses `import` statements (multiple `.mfd` files):
   - Read `main.mfd` first to understand overall structure and imports
   - Read ONLY the component file being implemented (e.g., `auth.mfd` if implementing Auth)
   - Read `shared.mfd` only if you need shared entities/enums referenced by the component
   - The CLI auto-resolves imports — pass `main.mfd` to get the full resolved AST

2. **Validate first.** Run:
   ```bash
   npx mfd validate "$MFD_FILE"
   ```
   If there are errors, fix them before implementing. For multi-file models, validate from `main.mfd` (auto-resolve handles imports).

3. **Show stats for context.** Run:
   ```bash
   npx mfd stats "$MFD_FILE"
   ```

4. **Plan the implementation.** Based on the model, determine:
   - What tech stack to use (ask user if not clear)
   - File structure and naming conventions
   - What to implement in what order

5. **Implement following the model.** The MFD model is the CONTRACT. Every construct maps to code:

   | MFD Construct | Typical Implementation |
   |--------------|----------------------|
   | `entity` | Database model/schema, TypeScript interface |
   | `enum` | TypeScript enum or union type |
   | `flow` | Service method / use case function. `on EventName` → event-triggered handler. `emits EventName` → emit event as side-effect. |
   | `state` | State machine (transitions become the allowed mutations). Triggers (`on EventName`) map to event handlers. Reactive pattern: flow emits event, state machine reacts. |
   | `event` | Event type + handler registration |
   | `api` | Route handlers / controller endpoints. STREAM endpoints → WebSocket or SSE handler delivering events to clients. `@external` → wrapper/adapter calling third-party provider (not a route handler). |
   | `rule` | Validation middleware or domain service |
   | `operation` | Service function / handler. `emits` → emit event after execution. `on` → register event listener/handler. |
   | `signal` | Client-side event type + handler. Similar to event but scoped to frontend (e.g., ThemeChanged, CartUpdated). |
   | `action` | UI interaction handler. Imperative (`calls`) → HTTP request. Reactive (`on STREAM`/`on Signal`) → event listener. Pure → navigation/toggle. |
   | `element` | Reusable UI building block (component). `@abstract` → base component. `implements` → fulfills interface contract. Props become component props. |
   | `journey` | User flow / navigation map. Each transition maps to a route change or navigation action. |
   | `secret` | Environment variable / secret config. Maps to env var loading with validation for `@required`. |
   | `dep` | Module imports / dependency injection |

6. **Track progress with @impl.** After implementing each construct, update the model IMMEDIATELY (not in batch) with the **file path** where the implementation lives:

   ```mfd
   entity User @impl(src/models/user.ts, src/migrations/001_user.sql) { ... }
   flow create_user @impl(src/services/user.service.ts) { ... }
   screen UserList @impl(src/components/UserList.tsx) { ... }
   api @impl(src/routes/users.ts) @prefix(/v1/users) { ... }
   ```

   - Use relative paths from the project root
   - Multiple files separated by commas
   - No `@impl` = construct not yet implemented
   - `@tests(unit)` or `@tests(integration)` on tested constructs

   **DEPRECATED:** `@impl(done)`, `@impl(backend)`, `@impl(frontend)`, `@impl(partial)` — use file paths instead.

## @impl Rules

- Update `@impl` IMMEDIATELY after implementing each construct — do not batch at the end
- The path should point to the actual implementation file(s), not type definitions or wrappers
- Without `@impl` means the construct is still pending implementation

## Implementation Rules

- **Entity fields are the schema.** Every field in the entity MUST appear in the implementation.
- **Flow steps are the algorithm.** Each step in a flow maps to a line/block of code.
- **API endpoints are the routes.** HTTP method, path, request/response types must match exactly.
- **Rules are validations.** Each rule's when/then becomes a validation check.
- **State transitions are the guard.** Only the declared transitions are allowed.
- **Events are side effects.** Emit them at the points specified in flows.
- **Decorators are metadata.** `@unique` becomes a unique constraint, `@min`/`@max` become validations, etc.
- **STREAM endpoints deliver events.** Implement as WebSocket or Server-Sent Events (SSE) handlers. No input, only output (the event type).
- **Actions have two patterns.** Imperative (`calls METHOD /path`) = HTTP request. Reactive (`on STREAM /path`) = event subscription/listener in the UI.

## Inheritance Implementation Rules

- **`@abstract` entities/flows/screens** are base classes/templates — implement as abstract base classes, shared utility functions, or base components. They should NOT be instantiated directly.
- **`@interface` entities/components/flows/screens** are contracts — implement as TypeScript interfaces or abstract classes that define the required API. Concrete implementations MUST fulfill the contract.
- **`extends` maps to class inheritance.** The child entity/flow/screen inherits all fields/steps from the parent and can add or override them.
- **`implements` maps to interface implementation.** The concrete construct MUST provide all fields/operations/forms declared in the interface.
- **`override` in flows** substitutes a parent step. Implement by overriding the specific method/function from the parent.
- **`resolvedFields` in the contract** gives the complete field list (inherited + own). Use this as the implementation schema, not just `fields`.
- **`resolvedSteps` in the contract** gives the complete step sequence with overrides applied. Use this as the implementation algorithm.
