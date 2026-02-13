#!/bin/bash
# Hook: PreToolUse para Edit|Write
# Injeta instrucoes do ciclo MFD baseado no tipo de arquivo sendo editado.

# Ler stdin e extrair file_path via python
FILE_PATH=$(python3 -c "
import json, sys
d = json.load(sys.stdin)
ti = d.get('tool_input', {})
print(ti.get('file_path', '') or ti.get('filePath', ''))
" 2>/dev/null)

# --- Editando arquivo .mfd → Etapa 3 (Traducao DSL) ---
if [[ "$FILE_PATH" == *.mfd ]]; then
  cat <<'PROMPT'
[MFD Ciclo — Etapa 3: Traducao DSL]

Voce esta editando um arquivo .mfd. Siga o protocolo:

1. NUNCA mostre DSL crua ao humano. Explique em linguagem natural o que vai alterar e por que.
2. Apos salvar, OBRIGATORIAMENTE valide: execute `mfd validate` no arquivo.
3. Se houver erros de validacao, corrija automaticamente antes de mostrar ao humano.
4. Se houver warnings, informe ao humano mas nao bloqueie.
5. Apos validacao, gere diagrama com `mfd_render` (Etapa 4) e peca aprovacao visual ao humano (Etapa 5).
6. Se o humano pedir mudancas, volte a Etapa 2 (conversa) — nao pule direto para editar.

Lembre: um modelo ambiguo e PIOR que um modelo incompleto. Se algo nao esta claro, PERGUNTE antes de editar.
PROMPT
  exit 0
fi

# --- Editando codigo quando existem arquivos .mfd no projeto → Etapa 7 ---
case "$FILE_PATH" in
  *.ts|*.tsx|*.js|*.jsx|*.py|*.go|*.rs|*.java|*.kt|*.rb|*.php)
    PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
    MFD_EXISTS=$(find "$PROJECT_DIR" -maxdepth 4 -name "*.mfd" -not -path "*/node_modules/*" -not -path "*/test*" 2>/dev/null | head -1)
    if [[ -n "$MFD_EXISTS" ]]; then
      cat <<'PROMPT'
[MFD Ciclo — Etapa 7: Implementacao]

Voce esta escrevendo codigo em um projeto com modelo MFD. O modelo e o CONTRATO:

- Liberdade total sobre o COMO (algoritmos, estruturas, organizacao de codigo)
- ZERO liberdade sobre o QUE (entidades, campos, APIs, regras devem corresponder ao modelo)
- Se o modelo define `entity User { email: string }`, o codigo DEVE ter esse campo
- Se encontrar ambiguidade no modelo, PERGUNTE ao humano — nao assuma

REGRAS DE @impl — Rastreabilidade por caminho de arquivo:

  @impl aponta para os ARQUIVOS onde o codigo vive.
  Exemplo: entity User @impl(src/models/user.ts) { ... }
  Multiplos arquivos: flow criar @impl(src/services/user.ts, src/validators/user.ts) { ... }
  Sem @impl = construto pendente de implementacao.

  Valores DEPRECATED (nao usar): done, backend, frontend, partial
  Use caminhos relativos: @impl(src/models/user.ts)

  Atualize @impl IMEDIATAMENTE apos cada construto — nao acumule para marcar em lote.
  Ao escrever testes, atualize: @tests(unit) ou @tests(integration)
PROMPT
    fi
    ;;
esac

exit 0
