---
name: council
description: Multi-agent review council for MFD models. Dispatches specialized reviewers for model quality (3 perspectives) or code conformity (drift detection). Use when the user wants a thorough review of their MFD model or implementation.
user-invocable: true
---

# /council — MFD Review Council

Multi-agent review council that reviews MFD models from multiple perspectives (modeling phase) or verifies code conformity against the model contract (implementation phase).

## Arguments

`$ARGUMENTS` — Optional flags:
- `--phase modeling` — Force modeling phase (3-perspective model review)
- `--phase implementation` — Force implementation phase (code vs model drift detection)
- `<path>` — Path to the .mfd file (auto-detected if omitted)

If no `--phase` is specified, the phase is auto-detected from git status.

## Phase Detection

If `--phase` is not provided, detect automatically:

1. Run `git status --porcelain` to get changed files
2. Check for `.mfd` file changes (excluding test/plugin/dist paths)
3. Check for code file changes in files referenced by `@impl`
4. Decision:
   - `.mfd` files changed → **modeling** phase
   - Only code files changed AND `@impl` exists in model → **implementation** phase
   - Both changed → **modeling** phase (model review first, then implementation)
   - Neither → Report "No relevant changes detected" and exit

## Step 1: Locate the MFD File

If a path is provided in `$ARGUMENTS`, use it. Otherwise, search for `.mfd` files:

```
Glob pattern: **/*.mfd
```

Exclude: `node_modules/`, `test*/`, `plugin/`, `dist/`, `build/`

For multi-file models, use the entry point (`main.mfd`). If multiple `.mfd` files exist, prefer `main.mfd` or `model/main.mfd`.

## Step 2: Pre-validate

Run `mfd_validate` on the file. If there are ERRORs, fix them first before proceeding. WARNINGs are acceptable.

## Phase: MODELING (3 Subagents, Max 3 Iterations)

### Step M1: Gather Context

Run these MFD tools to gather model context:

```
mfd_stats file="<path>" resolve_includes=true
mfd_contract file="<path>" compact=true resolve_includes=true
```

### Step M2: Review Loop (max 3 iterations)

For each iteration:

**a) Dispatch 3 subagents IN PARALLEL using the Task tool:**

Each subagent receives:
- The .mfd file path
- The perspective prompt (from `prompts/` directory in this plugin)
- The council protocol (verdict format)
- Instructions to use MFD MCP tools (`mfd_contract`, `mfd_query`, `mfd_validate`, `mfd_stats`, `mfd_render`)

Dispatch all 3 simultaneously:

1. **Architect Reviewer** — `architect-reviewer` subagent type
   - Read the architect prompt: `${CLAUDE_PLUGIN_ROOT}/prompts/architect.md`
   - Read the protocol: `${CLAUDE_PLUGIN_ROOT}/prompts/council-protocol.md`
   - Task prompt: Include both prompts + the .mfd file path + instruct to use MFD MCP tools and return verdict

2. **Backend Reviewer** — `backend-developer` subagent type
   - Read the backend prompt: `${CLAUDE_PLUGIN_ROOT}/prompts/backend.md`
   - Read the protocol: `${CLAUDE_PLUGIN_ROOT}/prompts/council-protocol.md`
   - Task prompt: Include both prompts + the .mfd file path + instruct to use MFD MCP tools and return verdict

3. **Fullstack Reviewer** — `fullstack-developer` subagent type
   - Read the fullstack prompt: `${CLAUDE_PLUGIN_ROOT}/prompts/fullstack.md`
   - Read the protocol: `${CLAUDE_PLUGIN_ROOT}/prompts/council-protocol.md`
   - Task prompt: Include both prompts + the .mfd file path + instruct to use MFD MCP tools and return verdict

**IMPORTANT:** Read the prompt files BEFORE dispatching subagents. Include the full prompt content in each Task call so subagents have the complete instructions. Subagents inherit MCP tools and can call `mfd_contract`, `mfd_query`, etc. directly.

**MODEL:** Always use `model: "sonnet"` for all subagents. Do NOT use haiku — council reviews require the depth of Sonnet 4.6.

**b) Collect verdicts:**

Parse each subagent's response for the structured verdict format.

**c) Evaluate:**

- If ALL 3 return `VERDICT: APPROVED` → **Consensus reached.** Proceed to final report.
- If ANY return `VERDICT: ISSUES_FOUND`:
  1. Consolidate all issues from all reviewers
  2. Deduplicate (same construct + same problem = 1 issue)
  3. Apply fixes to the .mfd file:
     - Use `DSL_CHANGE` when provided (prefer this — it's concrete DSL)
     - Use `SUGGESTION` as fallback guidance
  4. Re-validate with `mfd_validate` after applying fixes
  5. If validation fails, fix syntax errors
  6. Increment iteration counter and loop back to (a)

**d) Max iterations reached (3):**

If after 3 iterations there are still ISSUES_FOUND, report the remaining issues to the user and stop. Do NOT continue indefinitely.

### Step M3: Final Report (Modeling)

Display a summary table:

```
## MFD Council — Modeling Review

| Perspective   | Iteration 1 | Iteration 2 | Iteration 3 |
|---------------|-------------|-------------|-------------|
| Architecture  | ISSUES (2)  | APPROVED    | —           |
| Backend       | APPROVED    | APPROVED    | —           |
| Fullstack     | ISSUES (1)  | APPROVED    | —           |

**Result:** Consensus reached in 2 iterations.
**Changes applied:** 3 issues fixed automatically.
```

List the changes made to the model (if any).

## Phase: IMPLEMENTATION (1 Subagent, Loop Until Conforming)

### Step I1: Gather Context

```
mfd_contract file="<path>" compact=true resolve_includes=true
mfd_trace file="<path>" resolve_includes=true
```

From `mfd_trace`, extract the list of constructs with `@impl` and their file paths.

If no constructs have `@impl`, report "No @impl decorators found — nothing to verify" and exit.

### Step I2: Review Loop

For each iteration:

**a) Dispatch 1 subagent:**

- **Code Reviewer** — `code-reviewer` subagent type, `model: "sonnet"`
  - Read the code-review prompt: `${CLAUDE_PLUGIN_ROOT}/prompts/code-review.md`
  - Read the protocol: `${CLAUDE_PLUGIN_ROOT}/prompts/council-protocol.md`
  - Task prompt: Include both prompts + the .mfd file path + the list of constructs with @impl paths + instruct to use MFD MCP tools and Read tool to compare code vs model

**b) Evaluate verdict:**

- If `VERDICT: CONFORMING` → **All code aligns with model.** Proceed to final report.
  - Parse the `CONFORMING_CONSTRUCTS:` section from the subagent's response
  - For each construct in CONFORMING_CONSTRUCTS, extract the name (last word of each line, e.g. `entity User` → `User`)
  - Call `mfd_verify({ file: "<path>", action: "mark", construct: "<CONSTRUCT_NAME>" })`
  - This increments @verified(N) to @verified(N+1) as evidence of council approval
- If `VERDICT: DRIFT_FOUND`:
  1. For each drift item (each CONSTRUCT in the DRIFT section):
     - Read the file mentioned in `FILE`
     - Apply the fix described in `FIX`
     - The fix targets the **CODE**, never the model
     - Call `mfd_verify({ file: "<path>", action: "strip", construct: "<CONSTRUCT_NAME>" })` to remove any existing @verified
  2. After all fixes, re-run the subagent to verify
  3. On re-verification: if CONFORMING, call `mfd_verify mark` for each previously-drifted construct

**c) Safety limit:** Maximum 5 iterations. If drift persists after 5 iterations, report remaining drift to the user.

### Step I3: Final Report (Implementation)

```
## MFD Council — Implementation Review

**Constructs verified:** 12
**Files checked:** 8
**Iterations:** 2
**@verified updated:** 12 constructs marked with @verified(N)

| Construct         | File                        | Status       | @verified |
|-------------------|-----------------------------|--------------|-----------|
| entity User       | src/models/user.ts          | Conforming   | @verified(1) |
| flow create_order | src/services/order.ts       | Fixed → OK   | @verified(1) |
| api REST /orders  | src/routes/orders.ts        | Conforming   | @verified(2) |

**Result:** All code conforms to model after 1 fix. @verified updated on all constructs.
```

## Notes

- This skill works best AFTER `mfd_validate` has passed (no syntax errors)
- Modeling phase reviews the MODEL quality (design decisions, patterns, completeness)
- Implementation phase reviews CODE conformity (does code match the model contract)
- The two phases are complementary and can be run sequentially
- Subagents have full access to MFD MCP tools — they can query the model directly
