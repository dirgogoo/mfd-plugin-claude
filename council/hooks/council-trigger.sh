#!/bin/bash
# Hook: Stop
# Dispara o council de revisao multi-agente quando ha .mfd files no projeto.
# Silencio total quando nao ha .mfd files (nao e um projeto MFD).
# O skill /council decide a fase (modeling vs implementation) baseado no estado do git.

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"

# 1. Encontrar .mfd files no projeto
MFD_FILES=$(find "$PROJECT_DIR" -maxdepth 4 -name "*.mfd" \
  -not -path "*/node_modules/*" \
  -not -path "*/test*" \
  -not -path "*/plugin/*" \
  -not -path "*/dist/*" \
  -not -path "*/build/*" 2>/dev/null)

# Se nao ha .mfd files → silencio (nao e um projeto MFD)
if [[ -z "$MFD_FILES" ]]; then
  exit 0
fi

# 2. Capturar git status (pode estar vazio se nao for repo git)
GIT_STATUS=$(git -C "$PROJECT_DIR" status --porcelain 2>/dev/null || true)

# 3. Detectar tipo de mudancas
if [[ -n "$GIT_STATUS" ]]; then
  MFD_CHANGES=$(echo "$GIT_STATUS" | grep '\.mfd$' | wc -l)
  CODE_CHANGES=$(echo "$GIT_STATUS" \
    | grep -E '\.(ts|tsx|js|jsx|py|go|rs|rb|java|kt|cs)$' \
    | grep -vE '(\.test\.|\.spec\.|__test|\.config\.|\.d\.ts)' \
    | grep -vE '(dist/|build/|node_modules/)' \
    | grep -vE '(packages/mfd-|plugin/)' \
    | wc -l)
else
  MFD_CHANGES=0
  CODE_CHANGES=0
fi

# Verificar se ha construtos com @impl (indica projeto em fase de implementacao)
# shellcheck disable=SC2086
HAS_IMPL=$(grep -l '@impl(' $MFD_FILES 2>/dev/null | head -1)

# 4. Determinar fase sugerida
PHASE=""
if [[ "$MFD_CHANGES" -gt 0 ]]; then
  PHASE="modeling"
fi
if [[ "$CODE_CHANGES" -gt 0 ]] && [[ -n "$HAS_IMPL" ]]; then
  if [[ -n "$PHASE" ]]; then
    PHASE="modeling"  # Ambas mudancas: priorizar modelagem
  else
    PHASE="implementation"
  fi
fi

# Sem git ou sem mudancas relevantes: auto-detectar pela presenca de @impl
if [[ -z "$PHASE" ]]; then
  if [[ -n "$HAS_IMPL" ]]; then
    PHASE="implementation"
  else
    PHASE="modeling"
  fi
fi

# 5. Output instrucoes
echo ""
echo "[MFD Council — Revisao Multi-Agente]"
echo ""

if [[ "$PHASE" == "modeling" ]]; then
  echo "Mudancas estruturais detectadas em ${MFD_CHANGES} arquivo(s) .mfd."
  echo "Recomendado: revisao de modelo por 3 perspectivas (arquitetura, backend, fullstack)."
else
  echo "Mudancas de implementacao detectadas em ${CODE_CHANGES} arquivo(s) de codigo."
  echo "Recomendado: verificacao de conformidade codigo vs modelo."
fi

echo ""
echo "Para iniciar revisao: /council --phase ${PHASE}"
echo "Ou automaticamente:   /council (detecta fase)"

exit 0
