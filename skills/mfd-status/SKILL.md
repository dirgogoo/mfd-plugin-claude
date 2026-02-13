---
name: mfd-status
description: Show implementation progress and completeness metrics for an MFD model. Use when the user wants to see how much of the model is implemented.
user-invocable: true
---

# /mfd-status — Show MFD Model Status

Display comprehensive statistics and implementation progress for an MFD model.

## Arguments

`$ARGUMENTS` — Path to the .mfd file. If not provided, search for .mfd files in the project.

## Steps

1. **Run stats.** Execute:
   ```bash
   npx mfd stats "$ARGUMENTS"
   ```

   For multi-file models with `import` directives, the CLI auto-resolves imports. Simply pass the entry point (`main.mfd`).

2. **Run validation.** Execute:
   ```bash
   npx mfd validate "$ARGUMENTS"
   ```

3. **Present a summary.** Format the output into a clear status report:

   ```
   ## Model Status: [system name]

   ### Constructs
   - X entities, Y enums (Structure)
   - X flows, Y states, Z events (Behavior)
   - X APIs (Y endpoints), Z rules (Contracts)

   ### Completeness
   - @status: X/Y (Z%)
   - @impl: X/Y (Z%)
   - @tests: X/Y (Z%)

   ### Health
   - Validation: [pass/fail with error count]
   - Circular dependencies: [yes/no]
   - Token estimate: ~X tokens

   ### Recommendations
   - [Suggest what to work on next based on missing @impl/@tests]
   ```

4. **Recommend next steps.** Based on completeness:
   - If `@impl` is low: suggest which components to implement first
   - If `@tests` is low: suggest writing tests for implemented constructs
   - If `@status` is low: suggest reviewing and marking construct statuses
   - If there are validation warnings: suggest fixing them
