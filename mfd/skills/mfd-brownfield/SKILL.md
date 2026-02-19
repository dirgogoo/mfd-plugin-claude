---
name: mfd-brownfield
description: Reverse-engineer an MFD model from existing code. Use when you have a codebase without a model and want to create one.
user-invocable: true
---

# /mfd-brownfield — Extract MFD Model from Existing Code

Reverse-engineer an MFD model from an existing codebase. Scans code structure, extracts constructs (entities, flows, APIs, etc.), and generates a `.mfd` file with `@impl` pre-populated pointing to the source files.

## Arguments

`$ARGUMENTS` — Optional:
- `<path>` — Root directory of the project to scan (default: current working directory)
- `--output <path>` — Where to save the .mfd (default: `model/main.mfd` or `model.mfd`)
- `--stack <name>` — Force tech stack (skip auto-detect): `express`, `nestjs`, `django`, `rails`, `spring`, `nextjs`, `fastapi`, `fastify`

## Protocol

### Step 1: Detect Tech Stack

Identify the project's technology stack by reading manifest files:

| File | Stack indicator |
|------|----------------|
| `package.json` | Node.js — check dependencies for express, fastify, nestjs, next, nuxt, react, vue, angular |
| `requirements.txt` / `pyproject.toml` / `Pipfile` | Python — check for django, fastapi, flask |
| `go.mod` | Go — check for gin, echo, fiber |
| `Cargo.toml` | Rust |
| `pom.xml` / `build.gradle` | Java/Kotlin — check for spring-boot |
| `Gemfile` | Ruby — check for rails, sinatra |
| `*.prisma` | Prisma ORM (Node.js) |
| `docker-compose*` | Infrastructure services |

If `--stack` argument is provided, skip auto-detection and use that stack.

Output a summary: "Detected: **Node.js** with **Express** + **Prisma** + **React**"

### Step 2: Structural Scan

Using Glob patterns adapted to the detected tech stack (see brownfield prompt for full table):

1. **Map directories to layers:**
   - `data`: models, entities, schemas, migrations, types
   - `behavior`: services, usecases, handlers, controllers
   - `contracts`: routes, api definitions, middleware
   - `experience`: components, pages, views, screens
   - `infra`: config, env, docker, dependencies

2. **Identify component boundaries** from top-level source directories:
   - Monorepo packages → 1 component per package
   - Feature-based dirs (e.g., `src/auth/`, `src/orders/`) → 1 component per feature
   - Layer-based dirs (e.g., `src/models/`, `src/services/`) → group by entity domain

3. Present the directory → component mapping to the user for confirmation before proceeding.

### Step 3: Deep Extraction (layer by layer)

Load the extraction protocol:
```
mfd_prompt get brownfield
```

For each layer, read source files and extract constructs in this order:

**3a. Entities and Enums** (data layer)
- Read ORM models, DB schemas, type definitions
- Extract field names, types, constraints
- Identify enums (TypeScript enums, Python Enums, string unions, DB enums)
- Classify each: Capturado / Ambiguo / Inferido / Ignorado

**3b. Flows and Operations** (behavior layer)
- Read service files, use-case handlers
- Multi-step functions → `flow` with steps
- Single-responsibility functions → `operation`
- Map function params and return types

**3c. APIs** (contracts layer)
- Read route definitions
- Extract: HTTP method, path, input type, return type
- Detect auth middleware → `@auth`
- Detect rate limiting → `@rate_limit`
- Group under `@prefix` by common base path
- External API clients (Stripe, SendGrid wrappers) → `api @external`

**3d. Events and State Machines** (behavior layer)
- Event handlers, pub/sub, message queue consumers → `event`
- Client-side event emitters → `signal`
- Status enums + transition logic → `state`

**3e. UI Components** (experience layer)
- Pages/routes → `screen`
- Reusable components → `element`
- Form submissions, click handlers → `action`
- Navigation flows → `journey`

**3f. Infrastructure** (infra layer)
- Database connections, caches, queues → `dep`
- Environment variables → `secret`

### Step 4: Resolve Ambiguities

Present ambiguous and inferred items to the user:

```
I found these items that need your input:

**Ambiguous:**
1. `src/utils/mailer.ts` — Is this a dependency (`dep`) or should I model it as an operation?
2. `src/models/BaseModel.ts` — Model it as `entity @abstract` or ignore (implementation detail)?

**Inferred:**
3. `User.status` field with values `active/inactive/banned` + `activate()`/`ban()` methods → State machine `user_lifecycle`?
4. Routes group `/api/v1/admin/*` → Separate `Admin` component or part of each feature component?
```

Wait for user decisions before proceeding.

### Step 5: Generate MFD Model

Decide structure based on complexity:
- **1-2 components AND < 200 estimated lines** → single file `model.mfd`
- **3+ components OR > 200 estimated lines** → multi-file:
  ```
  model/
    main.mfd           # system declaration + imports
    shared.mfd         # shared enums, @abstract entities (if any)
    protocolo.mfd      # integration events (if any)
    <component>.mfd    # one per component (kebab-case)
  ```

Generate the `.mfd` DSL with:
- `@impl(path/to/source.ts)` on every construct
- Semantic comments (`#`) explaining key decisions
- Ignored files listed as comments at the top: `# Ignorado: utils/helpers.ts, config/webpack.config.js`

### Step 6: Validate and Fix

Run validation:
```
mfd_validate on the generated file(s)
```

If errors are found:
1. Fix automatically (type mismatches, missing references, syntax issues)
2. Re-validate until clean
3. If a fix requires a design decision, ask the user

Run stats:
```
mfd_stats on the generated file(s)
```

### Step 7: Present Results

Show a structured summary:

**1. Tech Stack:**
```
Language: TypeScript
Framework: Express + Prisma
UI: React
```

**2. Extraction Summary:**
```
Components: 4 (Auth, Products, Orders, Payments)
Entities: 12 (10 captured, 2 inferred)
Enums: 5
Flows: 8
Operations: 3
APIs: 4 blocks, 22 endpoints
Events: 4
State machines: 2 (inferred)
Screens: 6
Ignored: 15 files (utils, configs, test helpers)
```

**3. Traceability Table:**
| Construct | Type | Component | @impl |
|-----------|------|-----------|-------|
| User | entity | Auth | src/models/user.ts |
| Order | entity | Orders | src/models/order.ts |
| create_order | flow | Orders | src/services/order.service.ts |
| ... | ... | ... | ... |

**4. Next Steps:**
- Review the model visually — run `mfd_render` for diagrams
- Use `/mfd-model` to refine: add missing business rules, adjust component boundaries
- Use `/mfd-validate` to check completeness
- Once satisfied, commit the model — it becomes the source of truth going forward

## Important Rules

- NEVER invent constructs that don't exist in the code — this is extraction, not design
- ALWAYS ask when classification is ambiguous
- ALWAYS include `@impl` on every extracted construct
- Prefer under-extraction over over-extraction — it's easier to add than to remove
- The generated model is a starting point for the human to review, NOT a final product
- After brownfield, the project enters the normal MFD cycle (refinement → validation → commit)
