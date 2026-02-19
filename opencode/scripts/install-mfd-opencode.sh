#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
LOCAL_BIN="${HOME}/.local/bin"

usage() {
  cat <<'USAGE'
Usage: install-mfd-opencode.sh [options]

Instala a toolchain MFD para o ambiente OpenCode.

Options:
  --bin-dir PATH   Diretorio dos binarios (padrao: ~/.local/bin)
  --force          Recria links e sobrescreve tudo mesmo se ja existirem
  --no-deps        Pula instalacao de dependencias npm
  --no-mcp         Pula configuracao do MCP server no opencode.json
  --no-skills      Pula instalacao das skills em .opencode/skills/
  --no-plugins     Pula instalacao do plugin TypeScript em .opencode/plugins/
  --no-commands    Pula instalacao dos custom commands em .opencode/commands/
  --no-agents      Pula instalacao dos custom agents em .opencode/agents/
  --help           Exibe esta mensagem
USAGE
}

FORCE=false
SKIP_DEPS=false
SKIP_MCP=false
SKIP_SKILLS=false
SKIP_PLUGINS=false
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
    --no-plugins)
      SKIP_PLUGINS=true
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

# --- Dependencies ---

if [[ "$SKIP_DEPS" == false ]]; then
  if [[ -f "$PLUGIN_DIR/package.json" ]]; then
    if [[ ! -d "$PLUGIN_DIR/node_modules" ]]; then
      echo "Instalando dependencias do MFD (apenas production)..."
      npm install --omit=dev --prefix "$PLUGIN_DIR" --silent
    else
      echo "Dependencias ja instaladas."
    fi
  fi
fi

# --- Symlinks ---

mkdir -p "$LOCAL_BIN"

LINKS=(
  "mfd:$PLUGIN_DIR/bin/mfd"
  "mfd-mcp:$PLUGIN_DIR/bin/mfd-mcp"
)

for entry in "${LINKS[@]}"; do
  name="${entry%%:*}"
  target="${entry#*:}"

  if [[ ! -f "$target" ]]; then
    echo "Aviso: $target nao encontrado. Pulando $name."
    continue
  fi

  if [[ -e "$LOCAL_BIN/$name" ]] && [[ "$FORCE" != true ]]; then
    echo "Ja existe: $LOCAL_BIN/$name (use --force para substituir)."
    continue
  fi

  ln -sf "$target" "$LOCAL_BIN/$name"
  chmod +x "$target"
  echo "Criado: $LOCAL_BIN/$name -> $target"
done

# --- MCP Registration (opencode.json) ---

if [[ "$SKIP_MCP" == false ]]; then
  OPENCODE_JSON="opencode.json"
  MCP_SERVER_PATH="$PLUGIN_DIR/bin/mfd-mcp"

  if [[ -f "$OPENCODE_JSON" ]]; then
    # Check if mfd-tools already configured
    if grep -q "mfd-tools" "$OPENCODE_JSON" 2>/dev/null && [[ "$FORCE" != true ]]; then
      echo ""
      echo "MCP server 'mfd-tools' ja configurado em $OPENCODE_JSON (use --force para sobrescrever)."
    else
      echo ""
      echo "Adicionando MCP server ao $OPENCODE_JSON..."
      # Use node to merge JSON safely
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
      echo "MCP server 'mfd-tools' registrado em $OPENCODE_JSON."
    fi
  else
    echo ""
    echo "Criando $OPENCODE_JSON com MCP server..."
    cat > "$OPENCODE_JSON" <<EOCONFIG
{
  "mcp": {
    "mfd-tools": {
      "type": "local",
      "command": ["$MCP_SERVER_PATH"],
      "enabled": true
    }
  }
}
EOCONFIG
    echo "Criado: $OPENCODE_JSON"
  fi
fi

# --- OPENCODE.md ---

if [[ -f "$PLUGIN_DIR/OPENCODE.md" ]]; then
  OPENCODE_DEST="OPENCODE.md"
  if [[ -f "$OPENCODE_DEST" ]] && [[ "$FORCE" != true ]]; then
    echo ""
    echo "OPENCODE.md ja existe (use --force para sobrescrever)."
  else
    cp "$PLUGIN_DIR/OPENCODE.md" "$OPENCODE_DEST"
    echo ""
    echo "Copiado: OPENCODE.md -> $OPENCODE_DEST"
  fi
fi

# --- Skills (.opencode/skills/) ---

if [[ "$SKIP_SKILLS" == false ]]; then
  SKILLS_SRC="$PLUGIN_DIR/skills"
  SKILLS_DEST=".opencode/skills"

  if [[ -d "$SKILLS_SRC" ]]; then
    echo ""
    echo "Instalando skills em $SKILLS_DEST/..."
    mkdir -p "$SKILLS_DEST"

    INSTALLED=0
    for skill_dir in "$SKILLS_SRC"/*/; do
      [[ -d "$skill_dir" ]] || continue
      skill_name="$(basename "$skill_dir")"
      dest="$SKILLS_DEST/$skill_name"

      if [[ -d "$dest" ]] && [[ "$FORCE" != true ]]; then
        echo "  $skill_name: ja existe (use --force para sobrescrever)"
        continue
      fi

      rm -rf "$dest"
      cp -r "$skill_dir" "$dest"
      echo "  $skill_name: instalado"
      INSTALLED=$((INSTALLED + 1))
    done

    echo "Skills instaladas: $INSTALLED novas."
  else
    echo ""
    echo "Aviso: diretorio de skills nao encontrado em $SKILLS_SRC"
  fi
fi

# --- Plugin (.opencode/plugins/) ---

if [[ "$SKIP_PLUGINS" == false ]]; then
  PLUGINS_SRC="$PLUGIN_DIR/plugins"
  PLUGINS_DEST=".opencode/plugins"

  if [[ -d "$PLUGINS_SRC" ]]; then
    echo ""
    echo "Instalando plugins em $PLUGINS_DEST/..."
    mkdir -p "$PLUGINS_DEST"

    for plugin_file in "$PLUGINS_SRC"/*.ts; do
      [[ -f "$plugin_file" ]] || continue
      plugin_name="$(basename "$plugin_file")"
      dest="$PLUGINS_DEST/$plugin_name"

      if [[ -f "$dest" ]] && [[ "$FORCE" != true ]]; then
        echo "  $plugin_name: ja existe (use --force para sobrescrever)"
        continue
      fi

      cp "$plugin_file" "$dest"
      echo "  $plugin_name: instalado"
    done
  else
    echo ""
    echo "Aviso: diretorio de plugins nao encontrado em $PLUGINS_SRC"
  fi

  # Create .opencode/package.json with plugin dependency if not exists
  OPENCODE_PKG=".opencode/package.json"
  if [[ ! -f "$OPENCODE_PKG" ]] || [[ "$FORCE" == true ]]; then
    cat > "$OPENCODE_PKG" <<'EOPKG'
{
  "name": "opencode-mfd-plugins",
  "private": true,
  "type": "module",
  "dependencies": {}
}
EOPKG
    echo "  package.json: criado em .opencode/"
  fi
fi

# --- Commands (.opencode/commands/) ---

if [[ "$SKIP_COMMANDS" == false ]]; then
  COMMANDS_SRC="$PLUGIN_DIR/commands"
  COMMANDS_DEST=".opencode/commands"

  if [[ -d "$COMMANDS_SRC" ]]; then
    echo ""
    echo "Instalando commands em $COMMANDS_DEST/..."
    mkdir -p "$COMMANDS_DEST"

    for cmd_file in "$COMMANDS_SRC"/*.md; do
      [[ -f "$cmd_file" ]] || continue
      cmd_name="$(basename "$cmd_file")"
      dest="$COMMANDS_DEST/$cmd_name"

      if [[ -f "$dest" ]] && [[ "$FORCE" != true ]]; then
        echo "  $cmd_name: ja existe (use --force para sobrescrever)"
        continue
      fi

      cp "$cmd_file" "$dest"
      echo "  $cmd_name: instalado"
    done
  else
    echo ""
    echo "Aviso: diretorio de commands nao encontrado em $COMMANDS_SRC"
  fi
fi

# --- Agents (.opencode/agents/) ---

if [[ "$SKIP_AGENTS" == false ]]; then
  AGENTS_SRC="$PLUGIN_DIR/agents"
  AGENTS_DEST=".opencode/agents"

  if [[ -d "$AGENTS_SRC" ]]; then
    echo ""
    echo "Instalando agents em $AGENTS_DEST/..."
    mkdir -p "$AGENTS_DEST"

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
    done
  else
    echo ""
    echo "Aviso: diretorio de agents nao encontrado em $AGENTS_SRC"
  fi
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

echo "Verificando instalacao..."
ERRORS=0

if command -v mfd >/dev/null 2>&1; then
  echo "  mfd: OK"
else
  echo "  mfd: NAO ENCONTRADO (verifique o PATH)"
  ERRORS=$((ERRORS + 1))
fi

if command -v mfd-mcp >/dev/null 2>&1; then
  echo "  mfd-mcp: OK"
else
  echo "  mfd-mcp: NAO ENCONTRADO (verifique o PATH)"
  ERRORS=$((ERRORS + 1))
fi

# Count installed components
SKILLS_CHECK=".opencode/skills"
if [[ -d "$SKILLS_CHECK" ]]; then
  SKILL_COUNT=$(find "$SKILLS_CHECK" -maxdepth 1 -mindepth 1 -type d 2>/dev/null | wc -l)
  echo "  skills: $SKILL_COUNT em $SKILLS_CHECK/"
else
  echo "  skills: nenhuma instalada"
fi

PLUGINS_CHECK=".opencode/plugins"
if [[ -d "$PLUGINS_CHECK" ]]; then
  PLUGIN_COUNT=$(find "$PLUGINS_CHECK" -maxdepth 1 -name "*.ts" 2>/dev/null | wc -l)
  echo "  plugins: $PLUGIN_COUNT em $PLUGINS_CHECK/"
else
  echo "  plugins: nenhum instalado"
fi

COMMANDS_CHECK=".opencode/commands"
if [[ -d "$COMMANDS_CHECK" ]]; then
  CMD_COUNT=$(find "$COMMANDS_CHECK" -maxdepth 1 -name "*.md" 2>/dev/null | wc -l)
  echo "  commands: $CMD_COUNT em $COMMANDS_CHECK/"
else
  echo "  commands: nenhum instalado"
fi

AGENTS_CHECK=".opencode/agents"
if [[ -d "$AGENTS_CHECK" ]]; then
  AGENT_COUNT=$(find "$AGENTS_CHECK" -maxdepth 1 -name "*.md" 2>/dev/null | wc -l)
  echo "  agents: $AGENT_COUNT em $AGENTS_CHECK/"
else
  echo "  agents: nenhum instalado"
fi

echo ""
if [[ "$ERRORS" -eq 0 ]]; then
  echo "Instalacao do MFD para OpenCode concluida com sucesso."
else
  echo "Instalacao concluida com $ERRORS aviso(s). Verifique o PATH."
fi
