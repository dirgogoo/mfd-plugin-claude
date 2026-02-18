---
name: mfd-validate
description: Validate an MFD model file and show errors/warnings with precise locations. Use when the user wants to check if a .mfd file is correct.
user-invocable: true
---

# /mfd-validate — Validate MFD Model

Validate an MFD-DSL file for syntax and semantic correctness.

## Arguments

`$ARGUMENTS` — Path to the .mfd file to validate. If not provided, search for .mfd files in the current project.

## Steps

1. **Find the file.** If `$ARGUMENTS` is provided, use it. Otherwise, look for `.mfd` files in the project root and common locations.

2. **Run validation.** Execute:
   ```bash
   npx mfd validate "$ARGUMENTS"
   ```

   For multi-file models with `import` (or `include`) directives, the CLI auto-resolves imports when detected. Simply pass the entry point (`main.mfd`) and all imported files will be resolved automatically. No `--resolve` flag needed.

3. **Interpret results.**
   - **Exit 0:** Model is valid. Report success.
   - **Exit 1:** Model has errors. Show each error with explanation and suggest fixes.
   - **Exit 2:** Model has warnings only. Show warnings and explain implications.

4. **Validation rules checked:**
   - `REF_UNRESOLVED` — References to undefined types (entity/enum)
   - `CIRCULAR_DEP` — Circular dependency chains between components
   - `STATE_INVALID` — State transitions reference non-existent states
   - `TYPE_UNKNOWN` — Fields use types that aren't declared
   - `DECORATOR_INVALID` — Invalid decorator parameters
   - `DUPLICATE_NAME` — Duplicate construct names in same scope
   - `FLOW_REF` — Flow steps reference undefined constructs
   - `RULE_INCOMPLETE` — Rules missing when/then clauses
   - `STATE_TRIGGER_UNRESOLVED` — State transition trigger doesn't match any declared event or flow
   - `OPERATION_EVENT_UNRESOLVED` — Operation emits/on references undeclared event
   - `FLOW_STEP_UNRESOLVED` — Flow step doesn't reference a declared operation (strict, when >=1 operation exists)
   - `FLOW_BRANCH_UNRESOLVED` — Flow branch action doesn't reference a declared operation
   - `RULE_ACTION_UNRESOLVED` — Rule then clause doesn't reference a declared operation or flow
   - `STREAM_HAS_INPUT` — STREAM endpoint has input type (subscriptions are read-only)
   - `STREAM_INVALID_RETURN` — STREAM endpoint return type is not a declared event
   - `STREAM_MISSING_RETURN` — STREAM endpoint has no return type (must specify the event it delivers)
   - `ACTION_ON_STREAM_UNRESOLVED` — Action `on STREAM /path` references a STREAM endpoint not declared in any API
   - `ACTION_MIXED_PATTERNS` — Action has both `calls` (imperative) and `on STREAM` (reactive) — must choose one
   - `FLOW_TRIGGER_UNRESOLVED` — Flow `on EventName` references an undeclared event
   - `FLOW_EMITS_UNRESOLVED` — Flow `emits EventName` references an undeclared event
   - `INHERIT_REF` — `extends` or `implements` references a non-existent construct
   - `INHERIT_NOT_ABSTRACT` — `extends` target is not marked `@abstract`
   - `INHERIT_NOT_INTERFACE` — `implements` target is not marked `@interface`
   - `INHERIT_CIRCULAR` — Circular inheritance chain detected (A extends B extends A)
   - `INHERIT_FIELD_CONFLICT` — Diamond problem: multiple interfaces define same field with different types
   - `INHERIT_OVERRIDE_MISSING` — `override` targets a step that doesn't exist in parent flow
   - `INHERIT_MISSING_REQUIREMENT` — Entity/flow/screen implements interface but misses required members
   - `DECORATOR_CONFLICT` — `@abstract` and `@interface` on same construct
   - `DECORATOR_INVALID_TARGET` — `@abstract`/`@interface` on unsupported construct type
   - `ELEMENT_USES_UNRESOLVED` — Element `uses` references an undeclared element
   - `ACTION_ON_SIGNAL_UNRESOLVED` — Action `on SignalName` references an undeclared signal
   - `ACTION_EMITS_SIGNAL_UNRESOLVED` — Action `emits SignalName` references an undeclared signal
   - `OPERATION_CALLS_UNRESOLVED` — Operation `calls METHOD /path` references an undeclared API endpoint
   - `OPERATION_HANDLES_UNRESOLVED` — Operation `handles METHOD /path` references an undeclared API endpoint
   - `FLOW_HANDLES_UNRESOLVED` — Flow `handles METHOD /path` references an undeclared API endpoint
   - `FLOW_CALLS_FORBIDDEN` — Flow uses `calls` which is not allowed. Only operations can consume endpoints with `calls`; flows can only serve them with `handles`
   - `API_ENDPOINT_ORPHAN` — API endpoint has no flow or operation handling it. Every non-@external endpoint needs a `handles METHOD /path` in the responsible flow or operation
   - `HANDLES_INPUT_MISMATCH` — Flow/operation input type differs from the API endpoint's expected input type
   - `HANDLES_RETURN_MISMATCH` — Flow/operation return type differs from the API endpoint's declared return type
   - `IMPL_DEPRECATED_VALUE` — `@impl` uses deprecated label (done/backend/frontend/partial) instead of file path
   - `IMPL_INVALID_VALUE` — `@impl` value is not a file path or known label

5. **For each error, suggest a fix.** For example:
   - `REF_UNRESOLVED` for `UserRole` → "Add `enum UserRole { ... }` or check the name"
   - `CIRCULAR_DEP` → "Break the cycle by extracting shared types or using events"
   - `STATE_INVALID` → "Add the missing state to the referenced enum"
   - `STATE_TRIGGER_UNRESOLVED` → "Declare an event with that name, or rename the trigger to match an existing event"
   - `STREAM_HAS_INPUT` → "Remove the input type: `STREAM /path -> EventType`"
   - `STREAM_INVALID_RETURN` → "Declare `event Name { ... }` or reference an existing event"
   - `ACTION_MIXED_PATTERNS` → "Split into two actions: one imperative (calls) and one reactive (on STREAM)"
   - `FLOW_TRIGGER_UNRESOLVED` → "Declare `event Name { ... }` or check the event name in the `on` clause"
   - `FLOW_EMITS_UNRESOLVED` → "Declare `event Name { ... }` or check the event name in the `emits` clause"
   - `INHERIT_REF` → "Declare the referenced entity/flow/component, or check the name"
   - `INHERIT_NOT_ABSTRACT` → "Add `@abstract` to the parent, or remove the `extends` clause"
   - `INHERIT_NOT_INTERFACE` → "Add `@interface` to the target, or remove the `implements` clause"
   - `INHERIT_CIRCULAR` → "Break the cycle by removing one extends relationship"
   - `INHERIT_OVERRIDE_MISSING` → "Check available step names in the parent flow"
   - `DECORATOR_CONFLICT` → "A construct can be @abstract OR @interface, not both"
   - `ELEMENT_USES_UNRESOLVED` → "Declare the referenced element, or check the name in `uses`"
   - `ACTION_ON_SIGNAL_UNRESOLVED` → "Declare `signal Name { ... }` or check the signal name"
   - `ACTION_EMITS_SIGNAL_UNRESOLVED` → "Declare `signal Name { ... }` or check the signal name"
   - `OPERATION_CALLS_UNRESOLVED` → "Declare the endpoint in an api block, or check the METHOD /path"
   - `OPERATION_HANDLES_UNRESOLVED` → "Declare the endpoint in an api block, or check the METHOD /path"
   - `FLOW_HANDLES_UNRESOLVED` → "Declare the endpoint in an api block, or check the METHOD /path"
   - `FLOW_CALLS_FORBIDDEN` → "Move 'calls' to an operation, or use 'handles' if this flow serves the endpoint"
   - `API_ENDPOINT_ORPHAN` → "Add 'handles METHOD /path' inside the flow or operation that serves this endpoint"
   - `HANDLES_INPUT_MISMATCH` → "Align the flow/operation parameter with the endpoint input type, or update the API endpoint"
   - `HANDLES_RETURN_MISMATCH` → "Align the flow/operation return type with the endpoint return type, or update the API endpoint"
   - `IMPL_DEPRECATED_VALUE` → "Replace @impl(done) with @impl(src/path/to/file.ts) pointing to the actual implementation"
   - `IMPL_INVALID_VALUE` → "Use a relative file path like @impl(src/models/user.ts)"

6. **After validation passes**, if the user wants to verify implementation conformity (model vs code), load the verification protocol:
   ```
   mfd_prompt get verificacao
   ```
