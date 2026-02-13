#!/bin/bash
# Hook: PreToolUse para MFD MCP tools (render, visual_start, contract, query, stats)
# Valida o .mfd ANTES de renderizar/visualizar. Se tiver erros, bloqueia e instrui a corrigir.

# Extrair file do tool_input
FILE_PATH=$(python3 -c "
import json, sys
d = json.load(sys.stdin)
ti = d.get('tool_input', {})
print(ti.get('file', ''))
" 2>/dev/null)

# Se não tem file, deixa passar
if [[ -z "$FILE_PATH" || ! -f "$FILE_PATH" ]]; then
  exit 0
fi

# Resolve o CLI — tenta o bin do plugin primeiro, depois global
SOURCE="${BASH_SOURCE[0]}"
while [ -L "$SOURCE" ]; do
  DIR="$(cd "$(dirname "$SOURCE")" && pwd)"
  SOURCE="$(readlink "$SOURCE")"
  [[ "$SOURCE" != /* ]] && SOURCE="$DIR/$SOURCE"
done
HOOK_DIR="$(cd "$(dirname "$SOURCE")" && pwd)"
PLUGIN_DIR="$(cd "$HOOK_DIR/.." && pwd)"
MFD_CLI="$PLUGIN_DIR/bin/mfd"

if [[ ! -x "$MFD_CLI" ]]; then
  MFD_CLI="$(command -v mfd 2>/dev/null)"
fi

if [[ -z "$MFD_CLI" ]]; then
  exit 0
fi

# Rodar validação
VALIDATION=$("$MFD_CLI" validate "$FILE_PATH" 2>&1)
EXIT_CODE=$?

if [[ $EXIT_CODE -ne 0 ]]; then
  cat <<PROMPT
[MFD — Validacao Obrigatoria ANTES de renderizar/visualizar]

O arquivo $FILE_PATH tem ERROS de validacao. Voce DEVE corrigir antes de continuar.

NAO tente forcar a renderizacao/visualizacao. O parser vai falhar com os mesmos erros.

Erros encontrados:
$VALIDATION

ACAO OBRIGATORIA:
1. Corrija os erros no arquivo .mfd
2. Execute mfd_validate para confirmar que esta limpo
3. SO ENTAO tente renderizar/visualizar novamente
PROMPT
  exit 2
fi

exit 0
