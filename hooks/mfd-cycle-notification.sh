#!/bin/bash
# Hook: Stop
# Injeta lembrete do ciclo quando o Claude para de agir.

# Verifica se existem arquivos .mfd no projeto
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
MFD_EXISTS=$(find "$PROJECT_DIR" -maxdepth 4 -name "*.mfd" -not -path "*/node_modules/*" -not -path "*/test*" 2>/dev/null | head -1)

if [[ -n "$MFD_EXISTS" ]]; then
  cat <<'PROMPT'
[MFD Ciclo — Checkpoint]

Antes de encerrar, verifique em qual etapa do ciclo voce esta:
- Se editou .mfd: validou? renderizou diagrama? pediu aprovacao ao humano?
- Se implementou codigo: atualizou @impl/@tests no modelo?
- Se o humano fez uma pergunta: respondeu usando o MODELO como fonte da verdade?
- Sugira proativamente o proximo passo do ciclo ao humano.

Verificacao de @impl:
- @impl deve apontar para caminhos de arquivo: @impl(src/models/user.ts)
- Sem @impl = construto pendente de implementacao
- Valores DEPRECATED (nao usar): done, backend, frontend, partial
PROMPT
fi

exit 0
