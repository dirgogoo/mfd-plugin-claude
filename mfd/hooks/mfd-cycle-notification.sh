#!/bin/bash
# Hook: Stop
# Verificacao pos-implementacao concreta do ciclo MFD.
# Detecta: drift estrutural (@impl -> arquivo inexistente),
#          @impl faltando (codigo modificado sem rastreamento),
#          e instrui a IA a fazer verificacao semantica.
# Silencio total quando nao ha .mfd ou nao ha mudancas.

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"

# 1. Encontrar .mfd files no projeto
MFD_FILES=$(find "$PROJECT_DIR" -maxdepth 4 -name "*.mfd" \
  -not -path "*/node_modules/*" \
  -not -path "*/test*" \
  -not -path "*/plugin/*" \
  -not -path "*/dist/*" \
  -not -path "*/build/*" 2>/dev/null)

# Se nao ha .mfd → silencio
if [[ -z "$MFD_FILES" ]]; then
  exit 0
fi

# 2. Capturar git status (pode estar vazio se nao for repo git)
GIT_STATUS=$(git -C "$PROJECT_DIR" status --porcelain 2>/dev/null || true)

# 3. Extrair TODOS os caminhos @impl dos .mfd files
# shellcheck disable=SC2086
IMPL_RAW=$(grep -ohP '@impl\([^)]+\)' $MFD_FILES 2>/dev/null)

# Parse: extrair paths individuais, separar deprecated values
DEPRECATED_VALUES="done|backend|frontend|partial"
IMPL_PATHS=""
DEPRECATED_LINES=""
if [[ -n "$IMPL_RAW" ]]; then
  ALL_VALUES=$(echo "$IMPL_RAW" \
    | sed 's/@impl(//;s/)//;' \
    | tr ',' '\n' \
    | sed 's/^ *//;s/ *$//' \
    | sort -u)

  # Separar: paths reais vs deprecated
  IMPL_PATHS=$(echo "$ALL_VALUES" | grep -vE "^($DEPRECATED_VALUES)$")
  DEPRECATED_FOUND=$(echo "$ALL_VALUES" | grep -E "^($DEPRECATED_VALUES)$")

  # Para cada deprecated value, identificar TODOS os construtos que usam
  if [[ -n "$DEPRECATED_FOUND" ]]; then
    while IFS= read -r dep_val; do
      [[ -z "$dep_val" ]] && continue
      # shellcheck disable=SC2086
      while IFS= read -r dep_line; do
        dep_construto=$(echo "$dep_line" | grep -oP '(entity|flow|api|enum|screen|event|signal|state|operation|action|element|journey|rule)\s+\S+' | head -1)
        dep_file=$(echo "$dep_line" | cut -d: -f1 | sed "s|$PROJECT_DIR/||")
        if [[ -n "$dep_construto" ]]; then
          DEPRECATED_LINES="${DEPRECATED_LINES}  - @impl(${dep_val}) em ${dep_construto} (${dep_file})\n"
        else
          DEPRECATED_LINES="${DEPRECATED_LINES}  - @impl(${dep_val}) em ${dep_file}\n"
        fi
      done < <(grep -n "@impl($dep_val)" $MFD_FILES 2>/dev/null)
    done <<< "$DEPRECATED_FOUND"
  fi
fi

# 4. Checar DRIFT: @impl apontando para arquivo inexistente
DRIFT_LINES=""
if [[ -n "$IMPL_PATHS" ]]; then
  while IFS= read -r impl_path; do
    [[ -z "$impl_path" ]] && continue
    full_path="$PROJECT_DIR/$impl_path"
    if [[ ! -f "$full_path" ]]; then
      # Identificar qual construto referencia esse path
      # shellcheck disable=SC2086
      construto_line=$(grep -n "$impl_path" $MFD_FILES 2>/dev/null | head -1)
      if [[ -n "$construto_line" ]]; then
        # Extrair nome do construto (ex: "entity User", "flow create_user")
        construto_name=$(echo "$construto_line" | grep -oP '(entity|flow|api|enum|screen|event|signal|state|operation|action|element|journey|rule)\s+\S+' | head -1)
        if [[ -n "$construto_name" ]]; then
          DRIFT_LINES="${DRIFT_LINES}  - ${impl_path} (referenciado em: ${construto_name})\n"
        else
          DRIFT_LINES="${DRIFT_LINES}  - ${impl_path}\n"
        fi
      else
        DRIFT_LINES="${DRIFT_LINES}  - ${impl_path}\n"
      fi
    fi
  done <<< "$IMPL_PATHS"
fi

# 5. Filtrar arquivos de codigo modificados do git status
# Incluir: .ts .tsx .js .jsx .py .go .rs .rb .java .kt .cs
# Excluir: test/spec, config, .d.ts, dist/build, node_modules, packages/mfd-*, plugin/
CODE_FILES=""
if [[ -n "$GIT_STATUS" ]]; then
  CODE_FILES=$(echo "$GIT_STATUS" \
    | grep -E '\.(ts|tsx|js|jsx|py|go|rs|rb|java|kt|cs)$' \
    | grep -vE '(\.test\.|\.spec\.|__test|\.config\.|\.d\.ts)' \
    | grep -vE '(dist/|build/|node_modules/)' \
    | grep -vE '(packages/mfd-|plugin/)' \
    | awk '{print $NF}')
fi

# 6. Checar IMPL FALTANDO: codigo modificado que nao aparece em nenhum @impl
MISSING_IMPL_LINES=""
if [[ -n "$CODE_FILES" ]]; then
  while IFS= read -r code_file; do
    [[ -z "$code_file" ]] && continue
    # Checar se esse arquivo aparece em algum @impl
    if [[ -n "$IMPL_PATHS" ]]; then
      match=$(echo "$IMPL_PATHS" | grep -F "$code_file")
    else
      match=""
    fi
    if [[ -z "$match" ]]; then
      MISSING_IMPL_LINES="${MISSING_IMPL_LINES}  - ${code_file}\n"
    fi
  done <<< "$CODE_FILES"
fi

# 7. Contar mudancas por tipo
if [[ -n "$GIT_STATUS" ]]; then
  MFD_COUNT=$(echo "$GIT_STATUS" | grep '\.mfd$' | wc -l)
else
  MFD_COUNT=0
fi
if [[ -n "$CODE_FILES" ]]; then
  CODE_COUNT=$(echo "$CODE_FILES" | wc -l)
else
  CODE_COUNT=0
fi
if [[ -n "$GIT_STATUS" ]]; then
  TOTAL_COUNT=$(echo "$GIT_STATUS" | wc -l)
else
  TOTAL_COUNT=0
fi

# 8. Montar output
HAS_PROBLEMS=false
if [[ -n "$DRIFT_LINES" ]] || [[ -n "$MISSING_IMPL_LINES" ]] || [[ -n "$DEPRECATED_LINES" ]]; then
  HAS_PROBLEMS=true
fi

echo ""
echo "[MFD Ciclo — Verificacao Pos-Implementacao]"
echo ""

if [[ -n "$DEPRECATED_LINES" ]]; then
  echo "DEPRECATED — @impl com valores obsoletos (substituir por caminhos de arquivo):"
  echo -e "$DEPRECATED_LINES"
fi

if [[ -n "$DRIFT_LINES" ]]; then
  echo "DRIFT — @impl aponta para arquivos que NAO existem:"
  echo -e "$DRIFT_LINES"
fi

if [[ -n "$MISSING_IMPL_LINES" ]]; then
  echo "IMPL FALTANDO — Codigo modificado sem @impl no modelo:"
  echo -e "$MISSING_IMPL_LINES"
fi

if [[ "$HAS_PROBLEMS" == "false" ]]; then
  echo "@impl OK — sem drift estrutural detectado."
fi

# Resumo de mudancas
CHANGE_PARTS=""
if [[ "$CODE_COUNT" -gt 0 ]]; then
  CHANGE_PARTS="${CODE_COUNT} arquivo(s) de codigo"
fi
if [[ "$MFD_COUNT" -gt 0 ]]; then
  if [[ -n "$CHANGE_PARTS" ]]; then
    CHANGE_PARTS="${CHANGE_PARTS}, ${MFD_COUNT} arquivo(s) .mfd"
  else
    CHANGE_PARTS="${MFD_COUNT} arquivo(s) .mfd"
  fi
fi
if [[ -z "$CHANGE_PARTS" ]]; then
  CHANGE_PARTS="${TOTAL_COUNT} arquivo(s)"
fi

echo "Mudancas nao commitadas: ${CHANGE_PARTS}."
echo ""

# 9. Instrucoes para a IA
echo "OBRIGATORIO:"

STEP=1
if [[ -n "$DEPRECATED_LINES" ]]; then
  echo "${STEP}. DEPRECATED: substituir valores obsoletos por caminhos reais de arquivo. Ex: @impl(done) -> @impl(src/models/user.ts)"
  STEP=$((STEP + 1))
fi

if [[ -n "$DRIFT_LINES" ]]; then
  echo "${STEP}. DRIFT: corrigir os caminhos @impl no modelo (remover ou atualizar para o caminho correto)."
  STEP=$((STEP + 1))
fi

if [[ -n "$MISSING_IMPL_LINES" ]]; then
  echo "${STEP}. IMPL FALTANDO: identificar o construto do modelo correspondente e adicionar @impl com o caminho."
  STEP=$((STEP + 1))
fi

cat <<SEMANTIC
${STEP}. VERIFICACAO SEMANTICA: Para cada construto com @impl cujo arquivo foi modificado nesta sessao:
   a. Rodar: mfd_trace file="<mfd_file>" para obter construtos com @impl
   b. Rodar: mfd_query file="<mfd_file>" name="<construto>" para obter o contrato
   c. Ler o arquivo @impl referenciado
   d. Comparar:
      - entity: campos do contrato existem no codigo? tipos compativeis?
      - flow: funcao existe? passos do contrato refletidos?
      - api: endpoints declarados existem como rotas?
      - enum: valores do contrato batem com o codigo?
   e. Se divergencia: reportar "DRIFT SEMANTICO em [tipo] [nome]: [descricao]"
   f. Se OK: confirmar "Verificacao semantica OK"
SEMANTIC

STEP=$((STEP + 1))
echo "${STEP}. COMMIT: Apos resolver todos os problemas acima, commitar automaticamente todas as alteracoes (modelo + codigo) com mensagem descritiva."

exit 0
