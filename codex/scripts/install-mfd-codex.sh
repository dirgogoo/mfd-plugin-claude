#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
LOCAL_BIN="${HOME}/.local/bin"

usage() {
  cat <<'USAGE'
Usage: install-mfd-codex.sh [options]

Instala a toolchain MFD para o ambiente atual do Codex.

Options:
  --bin-dir PATH   Diretorio dos binarios (padrao: ~/.local/bin)
  --force          Recria links mesmo se ja existirem
  --no-deps        Pula instalacao de dependencias npm
  --no-mcp         Pula registro do MCP server no Codex
  --no-agents      Pula copia do AGENTS.md para o projeto
  --help           Exibe esta mensagem
USAGE
}

FORCE=false
SKIP_DEPS=false
SKIP_MCP=false
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
  "mfd:$PLUGIN_DIR/dist/core/cli/index.js"
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

# --- MCP Registration ---

if [[ "$SKIP_MCP" == false ]]; then
  if command -v codex >/dev/null 2>&1; then
    echo ""
    echo "Registrando MCP server no Codex..."
    if codex mcp add mfd-tools -- node "$PLUGIN_DIR/dist/mcp/server.js" 2>/dev/null; then
      echo "MCP server 'mfd-tools' registrado com sucesso."
    else
      echo "Aviso: falha ao registrar MCP server. Registre manualmente:"
      echo "  codex mcp add mfd-tools -- node \"$PLUGIN_DIR/dist/mcp/server.js\""
    fi
  else
    echo ""
    echo "Aviso: 'codex' nao encontrado no PATH. Pule com --no-mcp ou registre manualmente:"
    echo "  codex mcp add mfd-tools -- node \"$PLUGIN_DIR/dist/mcp/server.js\""
  fi
fi

# --- AGENTS.md ---

if [[ "$SKIP_AGENTS" == false ]]; then
  if [[ -f "$PLUGIN_DIR/AGENTS.md" ]]; then
    AGENTS_DEST="${AGENTS_DEST:-.codex/AGENTS.md}"
    if [[ -f "$AGENTS_DEST" ]]; then
      echo ""
      echo "AGENTS.md ja existe em $AGENTS_DEST (nao sobrescrevendo)."
      echo "  Para atualizar, remova e rode novamente."
    else
      mkdir -p "$(dirname "$AGENTS_DEST")"
      cp "$PLUGIN_DIR/AGENTS.md" "$AGENTS_DEST"
      echo ""
      echo "Copiado: AGENTS.md -> $AGENTS_DEST"
    fi
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

echo ""
if [[ "$ERRORS" -eq 0 ]]; then
  echo "Instalacao do MFD para Codex concluida com sucesso."
else
  echo "Instalacao concluida com $ERRORS aviso(s). Verifique o PATH."
fi
