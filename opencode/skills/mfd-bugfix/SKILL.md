---
name: mfd-bugfix
description: Descoberta e correção sistemática de bugs — agrega validator, council, trace e testes num pipeline unificado de discovery + classificação + fix. Corrige modelo e código automaticamente.
---

# /mfd-bugfix — Descoberta e Correção Sistemática de Bugs

Pipeline unificado que agrega todas as fontes de detecção de problemas do MFD (validator, council/trace, testes), classifica cada issue em 12 categorias, e aplica fixes automaticamente dentro dos limites do modelo.

## Princípio Central: O Modelo É O Oráculo

**O modelo define o que é correto.** Bugs no código são corrigidos para conformar ao modelo. Bugs no modelo são corrigidos para refletir a intenção do sistema. Ambiguidades genuínas são reportadas ao humano.

## Modos de Execução

| Modo | Como ativar | Comportamento |
|------|------------|---------------|
| **Default** | sem flag | Fix autônomo para P0-P3. MODEL_IMPROVEMENT: reporta, pausa. NOT_MODELED: pergunta. |
| **Yolo** | `--yolo` | Fix autônomo para P0-P4. MODEL_IMPROVEMENT: atualiza modelo, continua. NOT_MODELED: adiciona ao modelo, continua. |

`CONTRACT_MISMATCH` é sempre reportado — em ambos os modos. Ambiguidade genuína exige decisão humana.

## Argumentos

`$ARGUMENTS` — Path ao arquivo .mfd (ou `main.mfd` para multi-file), opcionalmente seguido de flags.

Exemplos:
```
/mfd-bugfix model/main.mfd
/mfd-bugfix model/main.mfd --component Auth
/mfd-bugfix model/main.mfd --source validator
/mfd-bugfix model/main.mfd --source council --yolo
/mfd-bugfix model/main.mfd --component Catalogo --source tests
```

| Flag | Default | Descrição |
|------|---------|-----------|
| `<file.mfd>` | obrigatório | Modelo (ou `main.mfd` para multi-arquivo) |
| `--component <name>` | todos | Escopo por componente |
| `--source <src>` | `all` | Fontes: `validator`, `council`, `trace`, `tests`, `coverage`, `all` |
| `--yolo` | off | Auto-fix sem perguntar (exceto CONTRACT_MISMATCH) |

## Sistema de Classificação (12 categorias)

| Categoria | Origem | O que é | Fix | Prioridade |
|-----------|--------|---------|-----|------------|
| `MODEL_ERROR` | validator | Erro de sintaxe/semântica no .mfd | Corrigir .mfd | P0 |
| `CODE_MISSING` | trace | @impl aponta para arquivo que não existe | Remover @impl ou reimplementar | P1 |
| `CODE_DRIFT` | council | Código diverge do contrato do modelo | Corrigir código | P2 |
| `CODE_BUG` | tests | Teste falha por bug no código | Corrigir código | P2 |
| `TEST_FAILURE` | tests | Teste falha (teste errado ou código errado) | Comparar com modelo, corrigir o errado | P2 |
| `MODEL_WARNING` | validator | Quality guard (heurística) | Melhorar .mfd | P3 |
| `IMPL_DEPRECATED` | validator/trace | @impl com valor antigo (done/backend/etc) | Atualizar @impl com paths reais | P3 |
| `MODEL_GAP` | council | Modelo faltando detalhe que código tem | Corrigir .mfd | P3 |
| `MODEL_IMPROVEMENT` | council | Código melhor que modelo | Default: reportar. Yolo: atualizar .mfd | P4 |
| `NOT_MODELED` | council | Feature no código sem modelo | Default: perguntar. Yolo: adicionar ao .mfd | P4 |
| `CONTRACT_MISMATCH` | council | Ambiguidade genuína | Sempre reportar (nunca auto-fix) | P5 |
| `ENV_ISSUE` | qualquer | Problema de infra | Flag, skip | — |

## Protocolo Completo

### Fase 0 — Setup

1. **Parsear argumentos** de `$ARGUMENTS`:
   - Extrair `<file.mfd>` (obrigatório)
   - Extrair `--component <name>` (opcional, default: todos)
   - Extrair `--source <src>` (opcional, default: `all`)
   - Extrair `--yolo` (opcional, default: off)

2. **Carregar prompt de verificação:**
   ```
   mfd_prompt get verificacao
   ```

3. **Rodar validação (NÃO parar em erros — são bugs a corrigir):**
   ```bash
   npx tsx packages/mfd-core/src/cli/index.ts validate "<file.mfd>"
   ```
   Capturar erros e warnings — cada um será um bug a classificar.

4. **Rodar stats para overview:**
   ```bash
   npx tsx packages/mfd-core/src/cli/index.ts stats "<file.mfd>"
   ```

5. **Mostrar resumo inicial ao usuário:**
   ```
   Bugfix: <file.mfd>
   Componente: <name ou "todos">
   Fonte: <source>
   Modo: <default ou yolo>
   Modelo: N entidades, N flows, N% implementado
   ```

### Fase 1 — Discovery

Rodar cada coletor conforme `--source` (se `all`, rodar todos):

#### Fonte: `validator`
```bash
npx tsx packages/mfd-core/src/cli/index.ts validate "<file.mfd>"
```
Capturar cada erro/warning com: código, mensagem, localização (arquivo:linha), construto afetado.

#### Fonte: `trace`
```
mfd_trace file="<file.mfd>" resolve_includes=true
```
Identificar:
- Construtos com `@impl` onde `fileExists: false` → `CODE_MISSING`
- Construtos com valores deprecated (`done`, `backend`, `frontend`, `partial`) → `IMPL_DEPRECATED`

#### Fonte: `council`
```
mfd_verify list-pending file="<file.mfd>"
```
Se `--component` especificado:
```
mfd_verify list-pending file="<file.mfd>" component="<name>"
```
Para cada construto pendente com `@impl` mas sem `@verified`:
- Ler o contrato do modelo: `mfd_contract file="<file.mfd>" construct="<name>"`
- Ler o código fonte dos arquivos em `@impl`
- Comparar: código conforme? drift? extra útil? ambiguidade?

#### Fonte: `coverage`
```
mfd_coverage file="<file.mfd>" scan_dir="src/"
```
Identificar arquivos não referenciados por nenhum `@impl` no modelo → `NOT_MODELED` (P4).
Cada arquivo em `untracked[]` é uma implementação sem rastreabilidade.

#### Fonte: `tests`
Detectar e rodar testes do projeto:
```bash
# Detectar runner
if [ -f "vitest.config.ts" ] || [ -f "vitest.config.js" ]; then
  npx vitest run --reporter=json 2>&1
elif [ -f "jest.config.ts" ] || [ -f "jest.config.js" ]; then
  npx jest --json 2>&1
elif [ -f "playwright.config.ts" ]; then
  npx playwright test --reporter=json 2>&1
fi
```
Capturar falhas com: arquivo de teste, nome do teste, mensagem de erro, stack trace.

Se `--component` especificado, filtrar testes relevantes ao componente (por path ou nome).

### Fase 2 — Classificação

Para cada issue coletada, aplicar a árvore de decisão:

```
Issue é validator error?
  → MODEL_ERROR (P0)

Issue é validator warning com código IMPL_DEPRECATED_VALUE?
  → IMPL_DEPRECATED (P3)

Issue é validator warning (outro)?
  → MODEL_WARNING (P3)

Issue é trace com fileExists=false?
  → CODE_MISSING (P1)

Issue é trace com valor deprecated?
  → IMPL_DEPRECATED (P3)

Issue é verify list-pending?
  → Ler @impl paths + comparar código com modelo:
    código == modelo (conforme)?
      → NÃO é bug — marcar @verified e remover da lista
    código diverge do modelo?
      → CODE_DRIFT (P2)
    código tem extra útil que modelo não captura?
      → MODEL_GAP (P3) ou MODEL_IMPROVEMENT (P4)
    ambiguidade genuína (não é óbvio qual está certo)?
      → CONTRACT_MISMATCH (P5)
    feature no código sem correspondência no modelo?
      → NOT_MODELED (P4)

Issue é coverage untracked file?
  → NOT_MODELED (P4) — arquivo no código sem nenhum @impl

Issue é test failure?
  → Comparar com modelo:
    teste testa algo que modelo define e código implementa errado?
      → CODE_BUG (P2)
    teste testa algo e não é claro se teste ou código está errado?
      → TEST_FAILURE (P2)

Problema de infra (arquivo inacessível, tool falhou, permissão)?
  → ENV_ISSUE (—)
```

**Deduplicação:** Mesmo construto reportado por múltiplas fontes → 1 entrada (merge). Manter a prioridade mais alta e combinar detalhes.

### Fase 3 — Triage

1. **Ordenar bugs:** prioridade (P0 → P5) → dependências (pais antes de filhos) → alfabético.

2. **Contar auto-fixáveis vs decisão necessária:**
   - Auto-fixáveis: MODEL_ERROR, CODE_MISSING, CODE_DRIFT, CODE_BUG, TEST_FAILURE, MODEL_WARNING, IMPL_DEPRECATED, MODEL_GAP
   - Decisão em modo default: MODEL_IMPROVEMENT, NOT_MODELED
   - Sempre decisão: CONTRACT_MISMATCH

3. **Mostrar resumo ao usuário:**
   ```
   ## Triage

   | Prioridade | Categoria         | Qtd |
   |------------|-------------------|-----|
   | P0         | MODEL_ERROR       | 2   |
   | P1         | CODE_MISSING      | 1   |
   | P2         | CODE_DRIFT        | 3   |
   | P3         | MODEL_WARNING     | 4   |
   | Total: 10 bugs. 8 auto-fixáveis, 2 precisam decisão.
   ```

4. **Em modo default:** perguntar "Prosseguir com os fixes?" — **Em modo yolo:** prosseguir direto.

### Fase 4 — Fix Loop (max 3 rounds)

```
for round in 1..3:
  for each bug in priority order:
```

Para cada bug:

**4a. Mostrar o bug:**
```
[P0] MODEL_ERROR — entity User (auth.mfd:15)
Erro: Campo 'email' referencia tipo 'Email' não declarado
```

**4b. Determinar e aplicar fix por categoria:**

| Categoria | Ação de fix |
|-----------|-------------|
| `MODEL_ERROR` | Editar .mfd para corrigir o erro. Rodar `mfd_validate` após edição. |
| `CODE_MISSING` | Se construto precisa existir: reimplementar (usar `mfd_contract` como guia). Se construto foi removido: remover `@impl` do .mfd. Em modo default: perguntar qual ação. Em yolo: remover `@impl`. |
| `CODE_DRIFT` | Ler `mfd_contract` do construto. Ler código atual. Corrigir código para conformar ao modelo. Rodar teste específico se existir. |
| `CODE_BUG` | Ler erro do teste. Ler código. Corrigir código. Rodar teste novamente para confirmar fix. |
| `TEST_FAILURE` | Ler `mfd_contract` do construto. Comparar teste vs modelo vs código. Corrigir o que diverge do modelo (pode ser teste OU código). Rodar teste novamente. |
| `MODEL_WARNING` | Editar .mfd para resolver o warning. Rodar `mfd_validate` após edição. |
| `IMPL_DEPRECATED` | Usar `mfd_trace` para identificar paths reais dos arquivos de implementação. Atualizar `@impl` com paths corretos. |
| `MODEL_GAP` | Editar .mfd para adicionar o detalhe faltante. Rodar `mfd_validate` após edição. |
| `MODEL_IMPROVEMENT` | **Default:** reportar ao usuário com descrição da melhoria, pausar. **Yolo:** descrever melhoria, atualizar .mfd, validar, continuar. |
| `NOT_MODELED` | **Default:** perguntar ao usuário se deve adicionar ao modelo. **Yolo:** adicionar ao .mfd, validar, continuar. |
| `CONTRACT_MISMATCH` | **Sempre:** reportar com opções (A: ajustar modelo, B: ajustar código, C: ambos). Nunca auto-fix. |
| `ENV_ISSUE` | Flagrar no relatório, pular para próximo bug. |

**4c. Verificar fix:**
- Após editar .mfd → `mfd_validate` (deve passar sem o erro corrigido)
- Após editar código → rodar teste específico do construto (se existir)

**4d. Atualizar decorators:**
- Editou .mfd → `mfd_verify strip-all` (invalida todas as verificações — qualquer edição no modelo invalida @verified e @live)
- Fix em código com sucesso → `mfd_verify mark construct="<nome>"` (incrementa confiança)

**4e. Após processar todos os bugs do round:**
- Re-scan (rodar Fase 1 novamente, scoped às fontes usadas)
- Se 0 novos bugs encontrados → sair do loop
- Se novos bugs → iniciar próximo round com os novos

### Fase 5 — Relatório Final

```markdown
# Relatório Bugfix

**Modelo:** <file.mfd>
**Componente:** <name ou "todos">
**Fonte:** <source>
**Modo:** <default ou yolo>
**Data:** <data>
**Rounds:** <N>

## Resumo

| Métrica | Valor |
|---------|-------|
| Bugs encontrados | N |
| Bugs corrigidos | N |
| Pendentes (decisão) | N |
| Rounds necessários | N |

## Bugs Corrigidos

### MODEL_ERROR (P0)
- [x] entity User (auth.mfd:15) — tipo 'Email' não declarado → adicionado enum Email
- [x] flow login (auth.mfd:30) — referência órfã a 'AuthToken' → corrigido para 'Token'

### CODE_MISSING (P1)
- [x] entity Produto — @impl(src/models/produto.ts) não existia → @impl removido

### CODE_DRIFT (P2)
- [x] entity User — campo 'role' era string no código, enum no modelo → código corrigido

### IMPL_DEPRECATED (P3)
- [x] flow criar_pedido — @impl(done) → @impl(src/services/pedido.service.ts)

## Pendentes (Decisão Necessária)

### CONTRACT_MISMATCH (P5)
- [ ] flow checkout — modelo define 3 steps, código tem 2 → qual é correto?
  - Opção A: Atualizar modelo para 2 steps
  - Opção B: Adicionar step faltante no código
  - Opção C: Redesenhar o fluxo

### NOT_MODELED [modo default]
- [ ] Middleware rateLimiter — existe no código, não no modelo → adicionar ao modelo?

## Atualizações de Decorators

| Construto | Ação | Motivo |
|-----------|------|--------|
| User | @verified strip | .mfd editado |
| login | @verified mark(1) | código corrigido e conforme |
| Produto | @verified strip | @impl removido |

## Recomendações

- Rodar `/mfd-touchdown` para verificar fixes ao vivo
- Resolver os N items pendentes antes do próximo deploy
- Considerar council completo: `mfd_verify list-pending`
```

## Como distinguir categorias limítrofes

**MODEL_GAP vs MODEL_IMPROVEMENT:**
- `MODEL_GAP`: modelo falta detalhe factual — ex: código tem campo `updated_at` que modelo não declara, mas deveria.
- `MODEL_IMPROVEMENT`: código implementa algo de forma qualitativamente melhor — ex: modelo define 3 steps mas código faz em 2 de forma mais elegante.

**CODE_DRIFT vs CODE_BUG:**
- `CODE_DRIFT`: código funciona mas não confere com o modelo — ex: campo com tipo errado.
- `CODE_BUG`: código não funciona — ex: teste falha, runtime error.

**TEST_FAILURE vs CODE_BUG:**
- `CODE_BUG`: teste está correto (confere com modelo), código está errado.
- `TEST_FAILURE`: não é claro qual está errado — comparar ambos com o modelo para decidir.

**MODEL_IMPROVEMENT vs CONTRACT_MISMATCH:**
- `MODEL_IMPROVEMENT`: direção clara — código é melhor e modelo deve evoluir.
- `CONTRACT_MISMATCH`: ambiguidade genuína — não é óbvio qual está certo.

**Em caso de dúvida sobre a categoria:** tratar como `CONTRACT_MISMATCH` e reportar ao humano.
