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

Dispatch all 3 simultaneously. **ALL THREE must use `subagent_type: "general-purpose"`** — no exceptions.

1. **MFD Council — Architecture Perspective** (`subagent_type: "general-purpose"`)
   - Read the architect prompt: `${CLAUDE_PLUGIN_ROOT}/prompts/architect.md`
   - Read the protocol: `${CLAUDE_PLUGIN_ROOT}/prompts/council-protocol.md`
   - Task prompt: Include both prompts + the .mfd file path + instruct to use MFD MCP tools and return verdict

2. **MFD Council — Backend Perspective** (`subagent_type: "general-purpose"`)
   - Read the backend prompt: `${CLAUDE_PLUGIN_ROOT}/prompts/backend.md`
   - Read the protocol: `${CLAUDE_PLUGIN_ROOT}/prompts/council-protocol.md`
   - Task prompt: Include both prompts + the .mfd file path + instruct to use MFD MCP tools and return verdict

3. **MFD Council — Fullstack Perspective** (`subagent_type: "general-purpose"`)
   - Read the fullstack prompt: `${CLAUDE_PLUGIN_ROOT}/prompts/fullstack.md`
   - Read the protocol: `${CLAUDE_PLUGIN_ROOT}/prompts/council-protocol.md`
   - Task prompt: Include both prompts + the .mfd file path + instruct to use MFD MCP tools and return verdict

**CRITICAL — SUBAGENT TYPE:** Always use `subagent_type: "general-purpose"` for ALL council agents. NEVER use `architect-reviewer`, `backend-developer`, `fullstack-developer`, `code-reviewer`, or any other typed agent — they do NOT have MCP tool access and will fail to use `mfd_contract`, `mfd_query`, `mfd_verify`, etc.

**MODEL:** Always use `model: "sonnet"` for all subagents. Do NOT use haiku — council reviews require the depth of Sonnet 4.6.

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

## Phase: IMPLEMENTATION (Batched Review, Priority Ordering, Immediate Marking)

### Step I1: Gather Context + Build Priority Queue

```
mfd_contract file="<path>" compact=true resolve_includes=true
mfd_trace file="<path>" resolve_includes=true
mfd_verify file="<path>" action="list-pending" threshold=100 resolve_includes=true
```

From `mfd_trace`, extract the list of constructs with `@impl` and their file paths.

If no constructs have `@impl`, report "No @impl decorators found — nothing to verify" and exit.

From `mfd_verify list-pending` (threshold=100 returns all constructs with their `verifiedCount`), build a **priority queue**: sort all @impl constructs ascending by `verifiedCount` (0 = never verified comes first, then 1, then 2...).

If `list-pending` returns empty (all constructs verified above threshold), still proceed — re-verification is valid; treat all constructs as verifiedCount=0 for ordering purposes.

### Step I2: Batched Review Loop

**CRITICAL — SEQUENTIAL EXECUTION:** Batches MUST be processed one at a time, in order. **NEVER dispatch multiple batches in parallel.** The reason: each batch must complete, be marked, and have drift fixed before the next batch starts. Parallelizing batches defeats the entire purpose of immediate marking.

Divide the full priority queue into groups of 5. **ALL constructs in the priority queue must be reviewed** — there is no cap on the number of batches. If there are 161 constructs, that is ~33 batches. Process every single one.

Track a `batchCount` counter starting at 1.

**For each batch (one at a time, sequentially):**

**a) Dispatch 1 subagent** (`subagent_type: "general-purpose"`, `model: "sonnet"`):

- Read the code-review prompt: `${CLAUDE_PLUGIN_ROOT}/prompts/code-review.md`
- Read the protocol: `${CLAUDE_PLUGIN_ROOT}/prompts/council-protocol.md`
- Task prompt includes:
  - Both prompts above
  - The .mfd file path
  - A `CONSTRUCTS_TO_REVIEW:` list with **only the constructs in this batch** (name + @impl file paths)
  - Instruction: review ONLY the provided constructs, not all @impl constructs found via mfd_trace
- **NEVER use `subagent_type: "code-reviewer"`** — use `general-purpose` only.

**b) Wait for this subagent to return. Do NOT start the next batch yet.**

**c) Immediately after the subagent returns** — regardless of overall VERDICT:

1. Parse the `CONFORMING_CONSTRUCTS:` section (always present per updated code-review.md format)
   - For each construct listed → call `mfd_verify({ file: "<path>", action: "mark", construct: "<NAME>" })` **right now** (do not defer to end)
   - Extract construct name as the last word of each line (e.g. `entity User` → `User`)

2. Parse the `DRIFT:` section (present only if any drift found)
   - For each drifted construct:
     - Read the file mentioned in `FILE`
     - Apply the fix described in `FIX` (fixes target **CODE**, never the model)
     - Call `mfd_verify({ file: "<path>", action: "strip", construct: "<NAME>" })` to remove any existing @verified
     - Add the construct to a **re-verification list**

**d)** Increment `batchCount`. Only then move to the next batch.

**e) Re-verification pass:** After ALL batches have been processed, if the re-verification list is non-empty, process those constructs through the same sequential batched loop (batches of 5). Apply same immediate marking logic. This counts as additional batches toward `batchCount`.

**Safety limit (per-construct, not per-session):** Each individual construct may be re-verified at most 5 times total across all passes. If a specific construct still drifts after 5 attempts, skip it and report as "unresolved drift". This limit does NOT cap the number of batches — it only prevents infinite loops on a single construct.

### Step I3: Final Report (Implementation)

```
## MFD Council — Implementation Review

**Constructs verified:** 12
**Files checked:** 8
**Batches processed:** 3
**@verified updated:** 12 constructs marked with @verified(N)

| Construct         | File                        | Status       | @verified    |
|-------------------|-----------------------------|--------------|--------------|
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
