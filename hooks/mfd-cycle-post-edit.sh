#!/bin/bash
# Hook: PostToolUse para Edit|Write
# Apos editar um .mfd, lembra de validar e renderizar.

FILE_PATH=$(python3 -c "
import json, sys
d = json.load(sys.stdin)
ti = d.get('tool_input', {})
print(ti.get('file_path', '') or ti.get('filePath', ''))
" 2>/dev/null)

# --- Acabou de editar .mfd → Proximos passos ---
if [[ "$FILE_PATH" == *.mfd ]]; then
  cat <<'PROMPT'
[MFD Ciclo — Pos-Edicao de Modelo]

Voce acabou de editar um arquivo .mfd. Proximos passos OBRIGATORIOS:

1. VALIDAR: Execute `mfd validate` neste arquivo. Se erros, corrija agora.
2. RENDERIZAR: Gere diagrama com `mfd_render` para o humano ver visualmente.
3. EXPLICAR: Resuma em linguagem natural o que mudou e por que.
4. PEDIR APROVACAO: Pergunte ao humano se o modelo esta correto (Etapa 5).
   - Se aceitar → sugira commit (Etapa 6)
   - Se pedir mudancas → volte a conversar (Etapa 2), nao edite direto
   - Se perguntar → responda usando o modelo como fonte da verdade
PROMPT
  exit 0
fi

# --- Acabou de editar codigo → Lembrete de @impl ---
case "$FILE_PATH" in
  *.ts|*.tsx|*.js|*.jsx|*.py|*.go|*.rs|*.java|*.kt|*.rb|*.php)
    PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
    MFD_EXISTS=$(find "$PROJECT_DIR" -maxdepth 4 -name "*.mfd" -not -path "*/node_modules/*" -not -path "*/test*" 2>/dev/null | head -1)
    if [[ -n "$MFD_EXISTS" ]]; then
      cat <<'PROMPT'
[MFD Ciclo — Pos-Edicao de Codigo]

Voce acabou de editar codigo. Checklist de @impl:

1. Qual construto MFD voce acabou de implementar? (entity, flow, api, rule, screen, etc.)
2. Atualize o .mfd agora com @impl apontando para o arquivo:
   - @impl(src/models/user.ts) — caminho relativo do arquivo implementado
   - Multiplos arquivos: @impl(src/schema.ts, src/routes.ts)
   - Sem @impl = construto pendente
3. Valores DEPRECATED (nao usar): done, backend, frontend, partial
4. Ao escrever testes, atualize: @tests(unit) ou @tests(integration)
PROMPT
    fi
    ;;
esac

exit 0
