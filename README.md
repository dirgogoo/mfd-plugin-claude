# MFD — Model-First Development Plugin

MFD is a development paradigm where a formal model (`.mfd` files) is the single source of truth for your system. The AI reads the model as a contract and implements code that conforms to it — entities, APIs, flows, state machines, screens, and business rules are all defined in one place.

## Installation

```bash
# From GitHub (recommended)
claude plugin install github:dirgogoo/mfd-plugin-claude

# Or via the /plugin command in Claude Code
/plugin
# Then: Discover → Add from GitHub → dirgogoo/mfd-plugin-claude
```

### Prerequisites

The MFD MCP tools and CLI require the `mfd-tools` npm package:

```bash
npm install -g mfd-tools
```

## Quick Start

```bash
# Create a new MFD project
npx mfd init -n MyProject

# Create a multi-file project with components
npx mfd init -n MyProject -c "Auth,Catalog,Orders"

# Validate a model
npx mfd validate model.mfd

# See stats and completeness
npx mfd stats model.mfd
```

## Available MCP Tools (11)

| Tool | Description |
|------|-------------|
| `mfd_parse` | Parse `.mfd` file into AST (JSON) |
| `mfd_validate` | Validate syntax and semantics with error locations |
| `mfd_stats` | Model metrics: construct counts, completeness, dependencies |
| `mfd_render` | Generate Mermaid diagrams (component, entity, state, flow, screen, journey) |
| `mfd_contract` | Generate implementation contract (JSON) for code generation |
| `mfd_query` | Query specific constructs by component, type, or name |
| `mfd_prompt` | Access the MFD prompt library (modelagem, implementacao, verificacao, etc.) |
| `mfd_visual_start` | Start interactive diagram viewer and dashboard |
| `mfd_visual_stop` | Stop the visual server |
| `mfd_visual_restart` | Restart the visual server (picks up changes) |
| `mfd_visual_navigate` | Navigate to a specific view in the dashboard |

## Available Skills (5)

| Skill | Description |
|-------|-------------|
| `/mfd-model` | Create or edit an MFD model through natural language conversation |
| `/mfd-explore` | Query the model as the authoritative source of truth |
| `/mfd-implement` | Implement code following the model as a contract |
| `/mfd-validate` | Validate a model file and show errors with fix suggestions |
| `/mfd-status` | Show implementation progress and completeness metrics |

## Hooks

The plugin includes 4 hooks that enforce the MFD development cycle:

- **Pre-Edit**: When editing `.mfd` files, injects modeling protocol reminders. When editing code in MFD projects, injects contract fidelity rules.
- **Post-Edit**: After editing `.mfd` files, reminds to validate and render. After editing code, reminds to update `@impl` decorators.
- **Post-Bash**: After running `mfd validate/stats/diff`, injects next-step guidance.
- **Stop**: Checkpoint reminder to verify cycle compliance before ending.

## CLI Commands

```bash
npx mfd parse <file.mfd> [--json]              # Parse to AST
npx mfd validate <file.mfd>                    # Validate model
npx mfd stats <file.mfd>                       # Metrics and completeness
npx mfd diff <file1.mfd> <file2.mfd>           # Semantic diff
npx mfd split <file.mfd> [-o dir] [--dry-run]  # Split monolith to multi-file
npx mfd init -n Name [-c "Comp1,Comp2"]        # Create new project
```

## LSP Server

The plugin includes a Language Server Protocol implementation for `.mfd` files:

- Syntax error diagnostics
- Completion for keywords, types, and references
- Hover information for constructs
- Go-to-definition for type references
- Document symbols

## Learn More

The full MFD specification (214 pages) covers the paradigm in depth: development cycles, interaction protocols, the 19 DSL constructs, verification, and more.
