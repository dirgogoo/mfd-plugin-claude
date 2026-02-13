---
name: mfd-explore
description: Explore and query an MFD model as the authoritative source of truth. Use when the user wants to understand the system, ask questions about architecture, behavior, or progress.
user-invocable: true
---

# /mfd-explore — Explore MFD Model

Query the MFD model to answer questions about the system. The model is the single source of truth — never infer from code.

## Arguments

`$ARGUMENTS` — The question or topic to explore. Optionally prefix with a path to the .mfd file.

## Steps

0. **Load exploration protocol.** Run:
   ```
   mfd_prompt get exploracao
   ```
   This loads the 5 question categories (structure, behavior, contracts, experience, progress) and response patterns. Use this to structure your answer.

1. **Locate the model.** Find the .mfd file:
   - If path provided in `$ARGUMENTS`, use it
   - Otherwise, search for .mfd files in the project

2. **Parse and gather context.** Use the appropriate tool based on the question scope:

   For **targeted queries** (specific component, type, or construct name), use `mfd_query` to get only the relevant subset:
   ```
   mfd_query file="$MFD_FILE" component="Auth"        # all constructs in Auth
   mfd_query file="$MFD_FILE" type="entity"            # all entities
   mfd_query file="$MFD_FILE" name="User"              # constructs matching "User"
   ```

   For **broad exploration** (full model context), use CLI:
   ```bash
   npx mfd parse "$MFD_FILE" --json
   npx mfd stats "$MFD_FILE"
   ```

   For multi-file models with `import` directives, the CLI auto-resolves imports. Simply pass the entry point (`main.mfd`).

3. **Answer from the model ONLY.** Using the parsed AST and stats:
   - Identify which constructs are relevant to the question
   - Cite the model directly (entity names, field types, flow steps, etc.)
   - If the information is not in the model, say: **"Isso nao esta modelado."**

4. **Identify gaps.** If the question reveals something that should be modeled but isn't:
   - Note the gap explicitly
   - Suggest what could be added (entity, flow, rule, etc.)
   - Offer to switch to modeling mode (`/mfd-model`) to fill the gap

5. **Format the response.** Present findings clearly:

   ```
   ## [Answer summary]

   [Details from the model]

   ### Source
   - Component: [name]
   - Construct: [type and name]

   ### Gaps (if any)
   - [What's missing and why it matters]
   ```

## Important Rules

- **Read-only mode** — Never modify the model. Only suggest changes.
- **Model is truth** — Never answer from code files, only from the .mfd model.
- **Don't guess** — If it's not in the model, it's not modeled. Say so.
- **Suggest modeling** — When gaps are found, offer to model them.
