#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
LOCAL_BIN="${HOME}/.local/bin"
OPENCODE_CONFIG="${HOME}/.config/opencode"

usage() {
  cat <<'USAGE'
Usage: install-mfd-opencode.sh [options]

Instala a toolchain MFD para o ambiente OpenCode.
Instala globalmente em ~/.config/opencode/ (config padrao do OpenCode).

Componentes:
  - MCP server mfd-tools (11 tools)
  - 9 skills (mfd-model, mfd-explore, mfd-validate, etc.)
  - 2 custom commands (/mfd-cycle, /mfd-quick-validate)
  - 2 custom agents (mfd-modeler, mfd-reviewer)

Options:
  --bin-dir PATH   Diretorio dos binarios (padrao: ~/.local/bin)
  --force          Recria links e sobrescreve tudo mesmo se ja existirem
  --no-deps        Pula instalacao de dependencias npm
  --no-mcp         Pula configuracao do MCP server no opencode.json
  --no-skills      Pula instalacao das skills em ~/.config/opencode/skills/
  --no-commands    Pula instalacao dos custom commands em ~/.config/opencode/command/
  --no-agents      Pula instalacao dos custom agents em ~/.config/opencode/agent/
  --help           Exibe esta mensagem
USAGE
}

FORCE=false
SKIP_DEPS=false
SKIP_MCP=false
SKIP_SKILLS=false
SKIP_COMMANDS=false
SKIP_AGENTS=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --force)
      FORCE=true
      ;;
    --no-deps)
      SKIP_DEPS=true
      ;;
    --no-mcp)
      SKIP_MCP=true
      ;;
    --no-skills)
      SKIP_SKILLS=true
      ;;
    --no-commands)
      SKIP_COMMANDS=true
      ;;
    --no-agents)
      SKIP_AGENTS=true
      ;;
    --bin-dir)
      if [[ -z "${2:-}" || "${2:-}" == --* ]]; then
        echo "Erro: --bin-dir exige um caminho." >&2
        exit 1
      fi
      LOCAL_BIN="$2"
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Argumento desconhecido: $1" >&2
      usage
      exit 1
      ;;
  esac
  shift
done

# --- Pre-checks ---

if ! command -v node >/dev/null 2>&1; then
  echo "Erro: node nao encontrado. Instale Node.js >= 18 antes de continuar." >&2
  exit 1
fi

NODE_MAJOR="$(node -e 'console.log(process.versions.node.split(".")[0])')"
if [[ "$NODE_MAJOR" -lt 18 ]]; then
  echo "Erro: Node.js >= 18 necessario (encontrado: v$(node -v))." >&2
  exit 1
fi

if [[ ! -d "$PLUGIN_DIR/dist" ]]; then
  echo "Erro: distribuicao ainda nao compilada (dist/ ausente)." >&2
  echo "Execute: npx tsx scripts/build-plugin.ts" >&2
  exit 1
fi

if [[ ! -d "$OPENCODE_CONFIG" ]]; then
  echo "Erro: diretorio de configuracao do OpenCode nao encontrado em $OPENCODE_CONFIG." >&2
  echo "Instale e execute o OpenCode ao menos uma vez antes de instalar o MFD." >&2
  exit 1
fi

echo "=== MFD para OpenCode — Instalacao ==="
echo "Plugin source: $PLUGIN_DIR"
echo "OpenCode config: $OPENCODE_CONFIG"
echo ""

# --- Dependencies ---

if [[ "$SKIP_DEPS" == false ]]; then
  if [[ -f "$PLUGIN_DIR/package.json" ]]; then
    if [[ ! -d "$PLUGIN_DIR/node_modules" ]] || [[ "$FORCE" == true ]]; then
      echo "[1/6] Instalando dependencias do MFD (apenas production)..."
      npm install --omit=dev --prefix "$PLUGIN_DIR" --silent
    else
      echo "[1/6] Dependencias ja instaladas."
    fi
  fi
else
  echo "[1/6] Dependencias: pulado (--no-deps)."
fi

# --- Symlinks ---

echo ""
echo "[2/6] Criando symlinks em $LOCAL_BIN/..."
mkdir -p "$LOCAL_BIN"

LINKS=(
  "mfd:$PLUGIN_DIR/bin/mfd"
  "mfd-mcp:$PLUGIN_DIR/bin/mfd-mcp"
)

for entry in "${LINKS[@]}"; do
  name="${entry%%:*}"
  target="${entry#*:}"

  if [[ ! -f "$target" ]]; then
    echo "  Aviso: $target nao encontrado. Pulando $name."
    continue
  fi

  if [[ -e "$LOCAL_BIN/$name" ]] && [[ "$FORCE" != true ]]; then
    echo "  $name: ja existe (use --force para substituir)."
    continue
  fi

  ln -sf "$target" "$LOCAL_BIN/$name"
  chmod +x "$target"
  echo "  $name -> $target"
done

# --- MCP Registration (opencode.json global) ---

echo ""
if [[ "$SKIP_MCP" == false ]]; then
  OPENCODE_JSON="$OPENCODE_CONFIG/opencode.json"
  MCP_SERVER_PATH="$PLUGIN_DIR/bin/mfd-mcp"

  if [[ -f "$OPENCODE_JSON" ]]; then
    if grep -q "mfd-tools" "$OPENCODE_JSON" 2>/dev/null && [[ "$FORCE" != true ]]; then
      echo "[3/6] MCP server 'mfd-tools' ja configurado (use --force para sobrescrever)."
    else
      echo "[3/6] Adicionando MCP server ao $OPENCODE_JSON..."
      node -e "
        const fs = require('fs');
        const config = JSON.parse(fs.readFileSync('$OPENCODE_JSON', 'utf-8'));
        if (!config.mcp) config.mcp = {};
        config.mcp['mfd-tools'] = {
          type: 'local',
          command: ['$MCP_SERVER_PATH'],
          enabled: true
        };
        fs.writeFileSync('$OPENCODE_JSON', JSON.stringify(config, null, 2) + '\n');
      "
      echo "  MCP server 'mfd-tools' registrado."
    fi
  else
    echo "[3/6] Criando $OPENCODE_JSON com MCP server..."
    cat > "$OPENCODE_JSON" <<EOCONFIG
{
  "\$schema": "https://opencode.ai/config.json",
  "mcp": {
    "mfd-tools": {
      "type": "local",
      "command": ["$MCP_SERVER_PATH"],
      "enabled": true
    }
  }
}
EOCONFIG
    echo "  Criado: $OPENCODE_JSON"
  fi
else
  echo "[3/6] MCP: pulado (--no-mcp)."
fi

# --- Skills (~/.config/opencode/skills/<name>/SKILL.md) ---

echo ""
if [[ "$SKIP_SKILLS" == false ]]; then
  SKILLS_SRC="$PLUGIN_DIR/skills"
  SKILLS_DEST="$OPENCODE_CONFIG/skills"

  if [[ -d "$SKILLS_SRC" ]]; then
    echo "[4/6] Instalando skills em $SKILLS_DEST/..."
    mkdir -p "$SKILLS_DEST"

    INSTALLED=0
    for skill_dir in "$SKILLS_SRC"/*/; do
      [[ -d "$skill_dir" ]] || continue
      skill_name="$(basename "$skill_dir")"
      skill_file="$skill_dir/SKILL.md"

      [[ -f "$skill_file" ]] || continue

      dest_dir="$SKILLS_DEST/$skill_name"

      if [[ -d "$dest_dir" ]] && [[ "$FORCE" != true ]]; then
        echo "  $skill_name: ja existe (use --force para sobrescrever)"
        continue
      fi

      # Copy entire skill directory (SKILL.md + any supporting files)
      rm -rf "$dest_dir"
      cp -r "$skill_dir" "$dest_dir"
      echo "  $skill_name: instalado"
      INSTALLED=$((INSTALLED + 1))
    done

    echo "  Total: $INSTALLED skills instaladas."
  else
    echo "[4/6] Aviso: diretorio de skills nao encontrado em $SKILLS_SRC"
  fi
else
  echo "[4/6] Skills: pulado (--no-skills)."
fi

# --- Custom commands (~/.config/opencode/command/<name>.md) ---

echo ""
if [[ "$SKIP_COMMANDS" == false ]]; then
  CMDS_SRC="$PLUGIN_DIR/commands"
  COMMANDS_DEST="$OPENCODE_CONFIG/command"

  if [[ -d "$CMDS_SRC" ]]; then
    echo "[5/6] Instalando custom commands em $COMMANDS_DEST/..."
    mkdir -p "$COMMANDS_DEST"

    INSTALLED=0
    for cmd_file in "$CMDS_SRC"/*.md; do
      [[ -f "$cmd_file" ]] || continue
      cmd_name="$(basename "$cmd_file")"
      dest="$COMMANDS_DEST/$cmd_name"

      if [[ -f "$dest" ]] && [[ "$FORCE" != true ]]; then
        echo "  $cmd_name: ja existe (use --force para sobrescrever)"
        continue
      fi

      cp "$cmd_file" "$dest"
      echo "  $cmd_name: instalado"
      INSTALLED=$((INSTALLED + 1))
    done

    echo "  Total: $INSTALLED commands instalados."
  else
    echo "[5/6] Aviso: diretorio de commands nao encontrado em $CMDS_SRC"
  fi
else
  echo "[5/6] Commands: pulado (--no-commands)."
fi

# --- Agents (~/.config/opencode/agent/<name>.md) ---

echo ""
if [[ "$SKIP_AGENTS" == false ]]; then
  AGENTS_SRC="$PLUGIN_DIR/agents"
  AGENTS_DEST="$OPENCODE_CONFIG/agent"

  if [[ -d "$AGENTS_SRC" ]]; then
    echo "[6/6] Instalando agents em $AGENTS_DEST/..."
    mkdir -p "$AGENTS_DEST"

    INSTALLED=0
    for agent_file in "$AGENTS_SRC"/*.md; do
      [[ -f "$agent_file" ]] || continue
      agent_name="$(basename "$agent_file")"
      dest="$AGENTS_DEST/$agent_name"

      if [[ -f "$dest" ]] && [[ "$FORCE" != true ]]; then
        echo "  $agent_name: ja existe (use --force para sobrescrever)"
        continue
      fi

      cp "$agent_file" "$dest"
      echo "  $agent_name: instalado"
      INSTALLED=$((INSTALLED + 1))
    done

    echo "  Total: $INSTALLED agents instalados."
  else
    echo "[6/6] Aviso: diretorio de agents nao encontrado em $AGENTS_SRC"
  fi
else
  echo "[6/6] Agents: pulado (--no-agents)."
fi

# --- PATH check ---

echo ""
if ! echo "$PATH" | tr ':' '\n' | grep -qx "$LOCAL_BIN"; then
  echo "Atencao: $LOCAL_BIN nao esta no PATH."
  echo "Adicione ao seu shell profile:"
  echo "  export PATH=\"$LOCAL_BIN:\$PATH\""
  echo ""
fi

# --- Verification ---

echo "=== Verificacao ==="

ERRORS=0

if command -v mfd >/dev/null 2>&1; then
  echo "  mfd CLI: OK"
else
  echo "  mfd CLI: NAO ENCONTRADO (verifique o PATH)"
  ERRORS=$((ERRORS + 1))
fi

if command -v mfd-mcp >/dev/null 2>&1; then
  echo "  mfd-mcp: OK"
else
  echo "  mfd-mcp: NAO ENCONTRADO (verifique o PATH)"
  ERRORS=$((ERRORS + 1))
fi

# Check MCP config
if [[ -f "$OPENCODE_CONFIG/opencode.json" ]] && grep -q "mfd-tools" "$OPENCODE_CONFIG/opencode.json" 2>/dev/null; then
  echo "  MCP config: OK (mfd-tools em opencode.json)"
else
  echo "  MCP config: NAO CONFIGURADO"
  ERRORS=$((ERRORS + 1))
fi

# Count installed skills
SKILL_COUNT=0
for d in "$OPENCODE_CONFIG/skills"/*/; do
  [[ -f "${d}SKILL.md" ]] && SKILL_COUNT=$((SKILL_COUNT + 1))
done
echo "  Skills: $SKILL_COUNT em $OPENCODE_CONFIG/skills/"

# Count MFD commands
MFD_CMD_COUNT=0
for f in "$OPENCODE_CONFIG/command"/mfd-*.md; do
  [[ -f "$f" ]] && MFD_CMD_COUNT=$((MFD_CMD_COUNT + 1))
done
echo "  Commands MFD: $MFD_CMD_COUNT em $OPENCODE_CONFIG/command/"

# Count MFD agents
MFD_AGENT_COUNT=0
for f in "$OPENCODE_CONFIG/agent"/mfd-*.md; do
  [[ -f "$f" ]] && MFD_AGENT_COUNT=$((MFD_AGENT_COUNT + 1))
done
echo "  Agents MFD: $MFD_AGENT_COUNT em $OPENCODE_CONFIG/agent/"

echo ""
if [[ "$ERRORS" -eq 0 ]]; then
  echo "Instalacao do MFD para OpenCode concluida com sucesso!"
  echo ""
  echo "Skills disponiveis (carregadas automaticamente pelo agente):"
  echo "  mfd-model, mfd-explore, mfd-validate, mfd-implement,"
  echo "  mfd-brownfield, mfd-status, mfd-test, mfd-install, council"
  echo ""
  echo "Slash commands:"
  echo "  /mfd-cycle            Ciclo completo de desenvolvimento"
  echo "  /mfd-quick-validate   Validacao rapida + stats"
  echo ""
  echo "MCP tools (11): mfd_parse, mfd_validate, mfd_render, mfd_query,"
  echo "  mfd_contract, mfd_context, mfd_stats, mfd_diff, mfd_trace,"
  echo "  mfd_prompt, mfd_visual_start"
else
  echo "Instalacao concluida com $ERRORS aviso(s). Verifique acima."
fi
