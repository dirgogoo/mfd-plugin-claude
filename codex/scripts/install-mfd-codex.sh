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
  --bin-dir PATH   Diretório dos binários (padrao: ~/.local/bin)
  --force          Recria links mesmo se já existirem
  --no-deps        Pula instalacao de dependencias npm
  --help           Exibe esta mensagem
USAGE
}

FORCE=false
SKIP_DEPS=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --force)
      FORCE=true
      ;;
    --no-deps)
      SKIP_DEPS=true
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

if ! command -v node >/dev/null 2>&1; then
  echo "Erro: node nao encontrado. Instale Node.js antes de continuar." >&2
  exit 1
fi

if [ ! -d "$PLUGIN_DIR/dist" ]; then
  echo "Erro: distribui\u00e7\u00e3o ainda n\u00e3o compilada (dist/ ausente). Execute: npx tsx scripts/build-plugin.ts" >&2
  exit 1
fi

if [ "$SKIP_DEPS" = false ]; then
  if [ -f "$PLUGIN_DIR/package.json" ]; then
    if [ ! -d "$PLUGIN_DIR/node_modules" ]; then
      echo "Instalando dependencias do mfd (apenas production)..."
      npm install --omit=dev --prefix "$PLUGIN_DIR" --silent
    else
      echo "Dependencias ja instaladas."
    fi
  fi
fi

mkdir -p "$LOCAL_BIN"

LINKS=(
  "mfd:$PLUGIN_DIR/dist/core/cli/index.js"
  "mfd-mcp:$PLUGIN_DIR/bin/mfd-mcp"
  "mfd-lsp:$PLUGIN_DIR/dist/lsp/server.js"
)

for entry in "${LINKS[@]}"; do
  name="${entry%%:*}"
  target="${entry#*:}"

  if [ ! -f "$target" ]; then
    echo "Aviso: $target nao encontrado. Pulando $name."
    continue
  fi

  if [ -e "$LOCAL_BIN/$name" ] && [ "$FORCE" != true ]; then
    echo "Já existe: $LOCAL_BIN/$name (use --force para substituir)."
    continue
  fi

  ln -sf "$target" "$LOCAL_BIN/$name"
  chmod +x "$target"

  echo "Criado: $LOCAL_BIN/$name -> $target"

done

echo
if ! echo "$PATH" | tr ':' '\n' | grep -qx "$LOCAL_BIN"; then
  echo "Aten\u00e7\u00e3o: $LOCAL_BIN nao esta no PATH."
  echo "Adicione temporariamente:"
  echo "  export PATH=\"$LOCAL_BIN:\$PATH\""
fi

echo "Instalacao do MFD para Codex concluida."
