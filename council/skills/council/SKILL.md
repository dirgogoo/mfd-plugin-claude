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
- `--component <name>` — Restrict implementation review to a single component (e.g. `--component Auth`)
- `--yolo` — Skip mode selection question and run in Yolo mode (see below)
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

## Step 2.5: Mode Selection

If `--yolo` is present in `$ARGUMENTS`, set **YOLO MODE = true** and skip this step.

Otherwise, ask the user:

> **Council mode?**
> - **Normal** — When a construct has extra code not in the model but with clear business value, I'll pause and ask you: "Add to model or remove from code?"
> - **Yolo** — Fully autonomous. I'll update the model myself when the code has something worth keeping, and remove from code when it doesn't. No interruptions.

Store the user's choice as `YOLO_MODE` (true/false) for use throughout the session.

### Yolo Mode — Decision Policy

When `YOLO_MODE = true` and a DECISION_REQUIRED item is found during implementation review:

1. **If the field/behavior has business value** (DECISION_REQUIRED was set because it's semantically meaningful and actively used):
   - Update the model: edit the .mfd file to add the missing field or construct using valid MFD-DSL
   - Run `mfd_validate` to confirm no errors introduced
   - Log: `[YOLO] Updated model: added <field> to <construct> — reason: <DECISION_REASON>`
   - Treat the construct as conforming (code was right, model was incomplete)

2. **If the field/behavior is vestigial** (debug, temp, or unused — DECISION_REQUIRED should not have been set, but if it was):
   - Remove from code (standard drift fix)
   - Log: `[YOLO] Removed from code: <field> on <construct> — vestigial, no business value`

When `YOLO_MODE = true`, never pause for user input mid-session.

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

## Phase: IMPLEMENTATION (Round-Robin Batched Review)

### Step I1: Gather Context

```
mfd_contract file="<path>" compact=true resolve_includes=true
mfd_trace file="<path>" resolve_includes=true
```

From `mfd_trace`, confirm that at least one construct has `@impl`. If none, report "No @impl decorators found — nothing to verify" and exit.

Extract `COMPONENT_FILTER` from `$ARGUMENTS` if `--component <name>` was provided (e.g. `--component Auth` → `COMPONENT_FILTER = "Auth"`). Otherwise `COMPONENT_FILTER = null`.

Initialize: `round = 1`, `batchCount = 0`.

### Step I2: Round-Robin Loop

**CRITICAL: SEQUENTIAL. Each component batch must fully complete before the next begins. Do NOT parallelize.**

**Each batch = one full component.** The tool groups pending constructs by component and returns them ready to iterate. One subagent receives all constructs of a component together — full context, better drift detection.

**Threshold is automatic.** The tool computes `threshold = min(verifiedCount) + 1` across all @impl constructs in scope. This means:
- Round 1: all constructs are at verifiedCount=0 → threshold=1 → all appear.
- After marking: conforming constructs reach verifiedCount=1 → exit queue (1 < 1 = false).
- After stripping (drift): constructs reset to verifiedCount=0 → stay in queue at top priority.
- Round 2+: only drift survivors appear (verifiedCount=0 < auto-threshold=1). No re-verification of already-conforming constructs.

```
while round <= 5:
  call mfd_verify(file, action="list-pending", group_by="component",
                  component=COMPONENT_FILTER, resolve_includes=true)
  // threshold is omitted → auto-computed by tool

  if summary.total_pending == 0:
    → EXIT LOOP ✓ (all conforming)

  for each component_name in groups (alphabetical order):
    constructs = groups[component_name]
    → DISPATCH SUBAGENT for this component (step a below)
    → WAIT for verdict (step b)
    → PROCESS RESULT (step c)
    → batchCount++

  round++

if round > 5 and total_pending > 0:
  → EXIT LOOP (partial): report remaining as "unresolved after 5 rounds"
```

**a) Dispatch 1 subagent** (`subagent_type: "general-purpose"`, `model: "sonnet"`):

- Read the code-review prompt: `${CLAUDE_PLUGIN_ROOT}/prompts/code-review.md`
- Read the protocol: `${CLAUDE_PLUGIN_ROOT}/prompts/council-protocol.md`
- Task prompt includes:
  - Both prompts above
  - The .mfd file path
  - A `CONSTRUCTS_TO_REVIEW:` list with the constructs from `pending` (name + @impl file paths)
  - Instruction: review ONLY the provided constructs
- **NEVER use `subagent_type: "code-reviewer"`** — use `general-purpose` only.

**b) Wait for the subagent to return.**

**c) Immediately after the subagent returns:**

1. Parse `CONFORMING_CONSTRUCTS:` (always present)
   - For each construct → call `mfd_verify mark` **right now**
   - Extract name as last word of each line (e.g. `entity User` → `User`)

2. Parse `DRIFT:` (present only if drift found)
   - For each drifted construct:
     - **If DECISION_REQUIRED: true and YOLO_MODE = false** → pause, ask the user:
       > "**[construct]** has [what was found] not in the model. [DECISION_REASON]. What should I do?
       > (A) Add to model — I'll update the .mfd file now
       > (B) Remove from code — aligns to current model"
       Wait for answer. If (A): update model, run `mfd_validate`, call `mfd_verify mark`. If (B): apply removal, call `mfd_verify strip`.
     - **If DECISION_REQUIRED: true and YOLO_MODE = true** → apply Yolo Decision Policy from Step 2.5.
     - **If no DECISION_REQUIRED** → apply the fix, call `mfd_verify strip`.
     - After fix/strip: the construct's `verifiedCount` resets to 0 — it will appear at the **top** of the next round's priority queue automatically.

**Why this works:** `list-pending` re-reads the .mfd file on every call. `mfd_verify mark` writes `@verified(1)` → construct exits the queue. `mfd_verify strip` removes `@verified` → construct re-enters at the top of the queue (verifiedCount=0 = highest priority). Round 2+ is automatically scoped to drift survivors only — no wasted passes over already-conforming constructs. The loop exits when `total_pending == 0`.

### Step I3: Final Report (Implementation)

```
## MFD Council — Implementation Review

**Mode:** Normal | Yolo
**Rounds completed:** 2
**Batches processed:** 7
**Constructs verified:** 12
**Fixes applied:** 2
**Unresolved drift:** 0

| Construct         | File                        | Status              | @verified    |
|-------------------|-----------------------------|---------------------|--------------|
| entity User       | src/models/user.ts          | Conforming          | @verified(1) |
| flow create_order | src/services/order.ts       | Fixed → OK          | @verified(1) |
| entity Result     | src/types.ts                | [YOLO] Model updated| @verified(1) |
| api REST /orders  | src/routes/orders.ts        | Conforming          | @verified(2) |

**Yolo decisions:** (only in Yolo mode)
  - entity CommandResult: added `executed_at?: datetime` — timestamp of agent execution, actively used in CommandLog

**Result:** All constructs conforming after 2 rounds. @verified updated on all.
```

## Notes

- This skill works best AFTER `mfd_validate` has passed (no syntax errors)
- Modeling phase reviews the MODEL quality (design decisions, patterns, completeness)
- Implementation phase reviews CODE conformity (does code match the model contract)
- The two phases are complementary and can be run sequentially
- Subagents have full access to MFD MCP tools — they can query the model directly
