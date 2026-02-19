---
description: Quick validate and show stats for an MFD model
---

# /mfd-quick-validate — Quick Validate + Stats

Fast validation and overview of an MFD model. This command:

1. **Locate**: Find `.mfd` files in the project (prefer `main.mfd`)
2. **Validate**: Run `mfd_validate` with `resolve_includes=true`
3. **Interpret**:
   - Exit 0 → Model is valid, show green status
   - Exit 1 → ERRORs found, list each with explanation and fix suggestion
   - Exit 2 → WARNINGs only, list each but note they don't block
4. **Stats**: Run `mfd_stats` with `resolve_includes=true`
5. **Summary**: Present a compact overview:
   - Validation status (pass/fail/warnings)
   - Construct counts by type
   - Completeness percentages (@status, @impl, @tests)
   - Token estimate

## Usage

```
/mfd-quick-validate [path-to-mfd-file]
```

If no path provided, auto-detect from project structure.
