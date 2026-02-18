#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
INSTALL_SCRIPT="$SCRIPT_DIR/install-mfd-codex.sh"

usage() {
  cat <<'USAGE'
Usage: update-mfd-codex.sh [options]

Atualiza a toolchain MFD para a versao mais recente.

Options:
  --force    Forcar pull (stash + pull + pop se working tree dirty)
  --help     Exibe esta mensagem
USAGE
}

FORCE=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --force)
      FORCE=true
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

# --- Detect current version ---

PREV_HEAD="$(git -C "$PLUGIN_DIR" rev-parse HEAD 2>/dev/null || echo "unknown")"

# --- Git pull ---

echo "Atualizando repositorio MFD..."

if ! git -C "$PLUGIN_DIR" diff --quiet 2>/dev/null || ! git -C "$PLUGIN_DIR" diff --cached --quiet 2>/dev/null; then
  if [[ "$FORCE" == true ]]; then
    echo "Working tree dirty. Salvando mudancas com stash..."
    git -C "$PLUGIN_DIR" stash push -m "mfd-update-$(date +%Y%m%d-%H%M%S)"
    STASHED=true
  else
    echo "Erro: working tree tem mudancas nao commitadas." >&2
    echo "Use --force para stash automatico, ou commite/descarte manualmente." >&2
    exit 1
  fi
else
  STASHED=false
fi

if ! git -C "$PLUGIN_DIR" pull --ff-only; then
  echo "Erro: fast-forward pull falhou. Resolva conflitos manualmente." >&2
  if [[ "$STASHED" == true ]]; then
    echo "Restaurando stash..."
    git -C "$PLUGIN_DIR" stash pop
  fi
  exit 1
fi

if [[ "$STASHED" == true ]]; then
  echo "Restaurando mudancas do stash..."
  if ! git -C "$PLUGIN_DIR" stash pop; then
    echo "Aviso: conflito ao restaurar stash. Resolva com: git -C \"$PLUGIN_DIR\" stash show -p"
  fi
fi

# --- Dependencies ---

echo ""
echo "Atualizando dependencias..."
if [[ -f "$PLUGIN_DIR/package.json" ]]; then
  npm install --omit=dev --prefix "$PLUGIN_DIR" --silent
  echo "Dependencias atualizadas."
else
  echo "Aviso: package.json nao encontrado."
fi

# --- Re-link ---

echo ""
echo "Re-criando symlinks..."
if [[ -f "$INSTALL_SCRIPT" ]]; then
  bash "$INSTALL_SCRIPT" --force --no-deps --no-mcp --no-agents
else
  echo "Aviso: script de instalacao nao encontrado em $INSTALL_SCRIPT" >&2
  echo "Symlinks nao foram atualizados." >&2
fi

# --- Verification ---

echo ""
echo "Verificando instalacao..."
if command -v mfd >/dev/null 2>&1; then
  echo "  mfd: OK"
else
  echo "  mfd: NAO ENCONTRADO"
fi

if command -v mfd-mcp >/dev/null 2>&1; then
  echo "  mfd-mcp: OK"
else
  echo "  mfd-mcp: NAO ENCONTRADO"
fi

# --- Summary ---

NEW_HEAD="$(git -C "$PLUGIN_DIR" rev-parse HEAD 2>/dev/null || echo "unknown")"

echo ""
if [[ "$PREV_HEAD" != "$NEW_HEAD" && "$PREV_HEAD" != "unknown" ]]; then
  echo "Commits novos:"
  git -C "$PLUGIN_DIR" log --oneline "${PREV_HEAD}..${NEW_HEAD}" 2>/dev/null || true
  echo ""
fi

echo "Atualizacao do MFD para Codex concluida."
