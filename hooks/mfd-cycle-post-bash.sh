#!/bin/bash
# Hook: PostToolUse para Bash
# Apos executar comandos MFD, injeta instrucoes do proximo passo do ciclo.

# Ler stdin e extrair command e exit_code via python
eval $(python3 -c "
import json, sys, shlex
d = json.load(sys.stdin)
cmd = d.get('tool_input', {}).get('command', '')
ec = str(d.get('exit_code', 0))
# Escape para bash
print(f'COMMAND={shlex.quote(cmd)}')
print(f'EXIT_CODE={shlex.quote(ec)}')
" 2>/dev/null)

# --- Apos rodar mfd validate ---
if echo "$COMMAND" | grep -q "validate"; then
  if [[ "$EXIT_CODE" == "0" ]]; then
    cat <<'PROMPT'
[MFD Ciclo — Validacao OK]

O modelo esta valido! Proximos passos:
- Se ainda em modelagem (Etapa 3-5): gere diagrama e peca aprovacao visual ao humano
- Se humano ja aprovou: sugira commit do modelo (Etapa 6)
- Mostre stats (`mfd stats`) para dar visao de completude ao humano
PROMPT
  elif [[ "$EXIT_CODE" == "1" ]]; then
    cat <<'PROMPT'
[MFD Ciclo — Erros de Validacao]

O modelo tem ERROS. Voce DEVE corrigi-los antes de prosseguir:
- Analise cada erro e corrija no .mfd
- Valide novamente apos correcoes
- NAO mostre o modelo ao humano ate estar livre de erros
- Warnings sao aceitaveis, erros nao
PROMPT
  elif [[ "$EXIT_CODE" == "2" ]]; then
    cat <<'PROMPT'
[MFD Ciclo — Warnings de Validacao]

O modelo e valido mas tem warnings. Informe ao humano:
- Explique cada warning em linguagem natural
- Sugira correcoes se forem faceis
- Warnings nao bloqueiam — o humano decide se quer corrigir agora ou depois
PROMPT
  fi
  exit 0
fi

# --- Apos rodar mfd stats ---
if echo "$COMMAND" | grep -q "stats"; then
  cat <<'PROMPT'
[MFD Ciclo — Etapa 9: Dashboard]

Apresente as metricas ao humano de forma clara:
- Destaque a completude (@status, @impl, @tests)
- Se @impl esta baixo, sugira quais componentes implementar primeiro
- Se @tests esta baixo, sugira escrever testes para construtos implementados
- Se ha ciclos no grafo de dependencias, alerte
- Sugira o proximo passo baseado no estado atual
PROMPT
  exit 0
fi

# --- Apos rodar mfd diff ---
if echo "$COMMAND" | grep -q "diff"; then
  cat <<'PROMPT'
[MFD Ciclo — Diff Semantico]

Apresente as diferencas ao humano agrupadas por tipo:
- Adicionados: novos construtos no modelo
- Removidos: construtos que nao existem mais
- Modificados: construtos que mudaram (detalhe o que mudou)
Pergunte se as mudancas estao corretas antes de prosseguir.
PROMPT
  exit 0
fi

exit 0
