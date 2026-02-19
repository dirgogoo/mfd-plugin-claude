# MFD Plugin for OpenCode

**Model-First Development** tooling for [OpenCode](https://github.com/opencode-ai/opencode) — the open-source AI coding CLI.

## What's Included

| Component | Description |
|-----------|-------------|
| **11 MCP tools** | parse, validate, stats, render, contract, query, context, prompt, trace, visual |
| **9 skills** | /mfd-model, /mfd-explore, /mfd-implement, /mfd-brownfield, /mfd-validate, /mfd-status, /mfd-test, /mfd-install, /council |
| **TS plugin** | Hooks for MFD cycle enforcement (pre-edit, post-edit, session, stop) |
| **2 commands** | /mfd-cycle (full iteration), /mfd-quick-validate (fast check) |
| **2 agents** | mfd-modeler (modeling specialist), mfd-reviewer (read-only explorer) |
| **CLI** | `mfd` command for parse, validate, diff, stats, split, init |

## Quick Install

### 1. Clone the plugin

```bash
git clone https://github.com/dirgogoo/mfd-plugin-opencode.git ~/.mfd-opencode
```

### 2. Install dependencies

```bash
cd ~/.mfd-opencode
npm install --omit=dev
```

### 3. Run the install script in your project

```bash
cd /your/project
bash ~/.mfd-opencode/scripts/install-mfd-opencode.sh
```

This will:
- Create `mfd` and `mfd-mcp` symlinks in `~/.local/bin/`
- Configure MCP server in `opencode.json`
- Copy skills to `.opencode/skills/`
- Copy the TS hooks plugin to `.opencode/plugins/`
- Copy custom commands to `.opencode/commands/`
- Copy custom agents to `.opencode/agents/`
- Copy `OPENCODE.md` to project root

### 4. Verify

```bash
mfd --help
mfd-mcp --help
```

## Manual MCP Configuration

If you prefer manual setup, add to your `opencode.json`:

```json
{
  "mcp": {
    "mfd-tools": {
      "type": "local",
      "command": ["~/.mfd-opencode/bin/mfd-mcp"],
      "enabled": true
    }
  }
}
```

## Updating

```bash
bash ~/.mfd-opencode/scripts/update-mfd-opencode.sh
```

## Install Flags

```
--bin-dir PATH   Custom binary directory (default: ~/.local/bin)
--force          Overwrite existing files
--no-deps        Skip npm install
--no-mcp         Skip opencode.json configuration
--no-skills      Skip skills installation
--no-plugins     Skip TS plugin installation
--no-commands    Skip custom commands installation
--no-agents      Skip custom agents installation
```

## MFD-DSL Overview

MFD (Model-First Development) uses a formal `.mfd` model as the single source of truth. The model defines entities, flows, APIs, state machines, events, screens, and journeys — and code is implemented to match the model contract.

Key concepts:
- **19 construct types** across 5 categories (Structure, Behavior, Contracts, Experience, Meta)
- **10-step development cycle** (Ideation → Conversation → DSL Translation → Rendering → Visual Validation → Commit → Implementation → Verification → Dashboard → Next Iteration)
- **@impl decorator** tracks which files implement each construct
- **Multi-file models** for projects with 3+ components

See `OPENCODE.md` for the full methodology reference.
