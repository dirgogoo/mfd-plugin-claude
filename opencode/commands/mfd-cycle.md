---
description: Run full MFD development cycle iteration on a model file
---

# /mfd-cycle — Full MFD Cycle Iteration

Run a complete MFD development cycle check on the current model. This command:

1. **Locates the model**: Find `.mfd` files in the project (prefer `main.mfd` or `model/main.mfd`)
2. **Validates**: Run `mfd_validate` — fix any errors automatically
3. **Stats**: Run `mfd_stats` to show completeness metrics
4. **Diagrams**: Run `mfd_render` with `diagram_type="component"` for system overview
5. **Check @impl**: Run `mfd_trace` to list constructs with implementation status
6. **Drift detection**: For each `@impl` path, verify the file exists
7. **Next steps**: Based on completeness, suggest what to do next:
   - Low @impl → suggest implementing specific constructs
   - Low @tests → suggest writing tests
   - Validation warnings → suggest fixes
   - All green → suggest commit or next iteration

Present results as a structured dashboard to the user.

## Usage

```
/mfd-cycle [path-to-mfd-file]
```

If no path provided, auto-detect from project structure.
