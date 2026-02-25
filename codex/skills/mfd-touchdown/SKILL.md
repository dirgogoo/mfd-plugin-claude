---
name: mfd-touchdown
description: Modo Touchdown — verificação ao vivo do sistema usando Chrome DevTools, guiado pelo modelo MFD como oráculo. Navega journeys reais como usuário, verifica screens/elements, ações e API calls. Marca @live em construtos verificados.
user-invocable: true
---

# /mfd-touchdown — Verificação Ao Vivo (Touchdown Mode)

Age como usuário real guiado pelo modelo MFD como oráculo. Usa Chrome DevTools para navegar o sistema ao vivo, sem scripts pré-escritos.

## Princípio Central: O Modelo É O Oráculo

**O modelo define o que é correto. O código é que se conforma ao modelo — salvo quando o código revela uma implementação melhor.**

Quando algo diverge:
- Código retorna `404` onde modelo define `201` → **código está errado** → fix código
- Botão "Confirmar" ausente onde modelo define que existe → **código está incompleto** → fix código
- Código implementa fluxo em 2 passos mais elegantes onde modelo define 3 → **modelo pode melhorar** → `MODEL_IMPROVEMENT`
- Contradição semântica sem direção clara → **ambiguidade real** → reportar, aguardar humano

## Modos de Execução

| Modo | Como ativar | Comportamento |
|------|------------|---------------|
| **Default** | sem flag | Fix CODE_BUG autônomo. MODEL_IMPROVEMENT: reporta, pausa. NOT_MODELED: pergunta. |
| **Yolo** | `--yolo` | Fix CODE_BUG autônomo. MODEL_IMPROVEMENT: atualiza modelo, continua. NOT_MODELED: adiciona ao modelo, continua. |

`CONTRACT_MISMATCH` é sempre reportado — em ambos os modos. Ambiguidade genuína exige decisão humana.

## Argumentos

`$ARGUMENTS` — Path ao arquivo .mfd (ou `main.mfd` para multi-file), opcionalmente seguido da URL base e flags.

Exemplos:
```
/mfd-touchdown model/main.mfd http://localhost:3000
/mfd-touchdown model/main.mfd http://localhost:3000 --yolo
```

**Flag `--yolo`:** Modo autônomo completo. Fix de bugs no código e melhorias de modelo aplicados na hora, sem pausar para confirmação. Ver tabela de modos acima.

## Pré-requisitos

- Sistema rodando localmente (ou URL acessível)
- Chrome DevTools MCP disponível (`mcp__chrome-devtools__*`)
- Modelo com `@impl` nos construtos a verificar

## Protocolo Completo

### Passo 1 — Carregar Prompt e Modelo

```
mfd_prompt get touchdown
```

Então carregar o modelo:
```
mfd_query file="<arquivo.mfd>" type="journey" resolve_includes=true
mfd_query file="<arquivo.mfd>" type="screen" resolve_includes=true
mfd_query file="<arquivo.mfd>" type="element" resolve_includes=true
mfd_query file="<arquivo.mfd>" type="action" resolve_includes=true
mfd_query file="<arquivo.mfd>" type="api" resolve_includes=true
```

### Passo 2 — Confirmar URL Base

Se não fornecida nos argumentos, perguntar ao usuário:
- URL base da aplicação (ex: `http://localhost:3000`)
- Credenciais para cada `@persona` das journeys

### Passo 3 — Fase 1: Para Cada Journey com @impl

Manter um set `visitadosPorJourney = {}` de screens verificadas durante as journeys.

Para cada journey (prioridade: journeys com `@impl` mas sem `@live`):

**a. Autenticar como @persona**
- Identificar o papel (ex: `@persona(admin)`, `@persona(user)`)
- Navegar para a tela de login e autenticar com credenciais do persona

**b. Para cada passo da journey (TelaA -> TelaB : on trigger)**:
1. Navegar para a tela de origem (`mcp__chrome-devtools__navigate_page`)
2. Tirar screenshot para verificar (`mcp__chrome-devtools__take_screenshot`)
3. Verificar elementos da tela conforme o modelo:
   - Screens do modelo definem estrutura esperada
   - Elements definem componentes/props presentes
   - Actions definem interações possíveis
4. Executar o trigger via DevTools:
   - `mcp__chrome-devtools__click` para cliques
   - `mcp__chrome-devtools__fill` para formulários
   - `mcp__chrome-devtools__fill_form` para forms completos
5. Verificar transição de tela (screenshot pós-ação)
6. Verificar network calls vs modelo:
   - `mcp__chrome-devtools__list_network_requests`
   - API calls devem corresponder ao `calls` das actions
   - Respostas devem corresponder aos tipos da API do modelo
7. Registrar PASS ou FAIL com evidência
8. **Adicionar ao set:** `visitadosPorJourney.add(step.from)` e `visitadosPorJourney.add(step.to)`

### Passo 3.5 — Construir Grafo de Navegação

Após todas as journeys, construir um mapa de adjacência com as actions carregadas no Passo 1:

```
Para cada action com @impl:
  action { from ScreenA | resultado -> ScreenB } = edge ScreenA → ScreenB

Resultado: mapa adjacência { ScreenA: [ScreenB, ScreenC], ... }
```

Este grafo será usado na Fase 2 para encontrar caminhos até screens não cobertas pelas journeys.

### Passo 4 — Fase 2: Screen/Element Sweep

```
screens pendentes = screens com @impl e sem @live − visitadosPorJourney
```

Para obter a lista:
```
mfd_live list-pending file="<arquivo.mfd>" component="<Comp>"
```
(filtrar resultados para type=screen e type=element)

**Para cada screen pendente:**

1. **Encontrar caminho via grafo de navegação:**
   - BFS a partir do root (URL base = ponto de entrada)
   - Encontrado → navegar step-by-step pelas actions que formam o caminho
   - Não encontrado → pedir URL direta ao usuário
   - Usuário não sabe → `NAVIGATION_UNKNOWN` → pular, registrar no relatório

2. Navegar para a URL da screen (`mcp__chrome-devtools__navigate_page`)

3. `mcp__chrome-devtools__take_screenshot`

4. **Para cada `uses ElementName -> alias` na screen:**
   a. Obter props do element (já em memória do Passo 1)
   b. Verificar no DOM: element renderizado? (`take_snapshot` + busca pelo nome)
   c. Se element `@abstract`: pular (não é renderizado diretamente)
   d. Se element sem `@impl`: registrar `IMPL_MISSING` → screen fica PARTIAL
   e. Para cada prop não-opcional do element: dados visíveis no DOM?
   f. Para forms do element: campos existem como inputs?
   g. PASS → `mfd_live mark` + `mfd_verify mark` no element (somente no primeiro PASS; se já tem @live, não re-verificar)
   h. FAIL → classificar (CODE_BUG / CONTRACT_MISMATCH)

5. **Para cada form declarado diretamente na screen:** verificar que campos existem como inputs

6. **Determinar status da screen:**
   - **PASS** (todos os `uses` passaram, sem IMPL_MISSING):
     ```
     mfd_live mark file="<arquivo.mfd>" construct="<screen_name>"
     mfd_verify mark file="<arquivo.mfd>" construct="<screen_name>"
     ```
   - **PARTIAL** (algum element sem `@impl`): NÃO marcar `@live` — registrar no relatório
   - **FAIL** (element falhou na verificação): NÃO marcar `@live`

**Regras de element:**
- Element `@abstract`: pular (não renderizado diretamente)
- Element já com `@live`: não re-verificar (skip)
- Prop opcional (`tipo?`): ausência é aceitável — não falhar
- `@impl` path como hint: nome do arquivo = nome do componente a buscar no DOM (ex: `BookCard.tsx` → buscar componente BookCard)
- Entity reference prop: ao menos um campo da entidade deve estar renderizado

### Passo 5 — Classificação e Ação por Modo

| Categoria | Critério | Default | Yolo |
|-----------|---------|---------|------|
| `CODE_BUG` | Código diverge do modelo; modelo está certo | Fix código → re-testa | Fix código → re-testa |
| `MODEL_GAP` | Detalhe cosmético não capturado (label, ordem visual) | Fix modelo (notifica) → re-testa | Fix modelo → re-testa |
| `MODEL_IMPROVEMENT` | Código implementa algo melhor que o modelo define | Reporta → pausa | Atualiza modelo → continua |
| `CONTRACT_MISMATCH` | Contradição semântica genuína, sem direção clara | Reporta → volta ao Council | Reporta → volta ao Council |
| `NOT_MODELED` | Funcionalidade real sem correspondência no modelo | Pergunta ao usuário | Adiciona ao modelo → continua |
| `ENV_ISSUE` | Problema de ambiente (servidor down, auth expirou) | Flagra → continua | Flagra → continua |

**Como distinguir MODEL_IMPROVEMENT de CONTRACT_MISMATCH:**
- `MODEL_IMPROVEMENT`: há uma direção clara — o código faz mais sentido e o modelo deve evoluir para refletir isso. Ex: modelo define 3 passos de checkout mas código tem 2 mais coesos; modelo não captura estado de loading que o código trata corretamente.
- `CONTRACT_MISMATCH`: ambiguidade genuína — não é óbvio qual está certo. Ex: modelo define navegação para TelaA após sucesso, código vai para TelaB — qual é a intenção do produto?

**Em modo Yolo, ao aplicar MODEL_IMPROVEMENT:**
1. Descrever a melhoria ("código faz X que é melhor que Y do modelo porque Z")
2. Atualizar o `.mfd` para refletir a implementação real
3. Validar modelo após edição (`mfd_validate`)
4. Registrar no relatório como `MODEL_IMPROVEMENT` aplicado
5. Continuar — não pausar

**Em caso de dúvida sobre a categoria:** tratar como `CONTRACT_MISMATCH` e reportar.

### Passo 6 — Marcar @live e @verified (Fase 1)

Após cada journey que passou completamente:
```
mfd_live mark file="<arquivo.mfd>" construct="<journey_name>"
mfd_verify mark file="<arquivo.mfd>" construct="<journey_name>"
```

Touchdown é uma forma adicional de confiança: incrementa tanto `@live` quanto `@verified`.

(Fase 2: marcar screens e elements individualmente conforme Passo 4.)

### Passo 7 — Relatório Final

```markdown
# Relatório Touchdown

**Modelo:** <arquivo.mfd>
**URL:** <url_base>
**Data:** <data>

## Resumo — Fase 1 (Journeys)

| Journey | Status | @live | Observações |
|---------|--------|-------|-------------|
| buscar_produto | PASS | @live(1) | — |
| checkout | FAIL | — | CONTRACT_MISMATCH: API retorna 404 |

## Fase 2 — Screen/Element Sweep

| Screen | Status | @live | Elementos | Obs |
|--------|--------|-------|-----------|-----|
| AdminPanel | PASS | @live(1) | UserTable(PASS), StatsCard(PASS) | — |
| ProfileEdit | PARTIAL | — | AvatarUpload(IMPL_MISSING) | sem @impl |
| SettingsPanel | NAVIGATION_UNKNOWN | — | — | fornecer URL direta |

### Elementos Verificados
| Element | Status | @live | Verificado em | Obs |
|---------|--------|-------|---------------|-----|
| UserTable | PASS | @live(1) | AdminPanel | props id,name,email visíveis |
| StatsCard | PASS | @live(1) | AdminPanel | props count,label visíveis |

### Screens Não Alcançadas
| Screen | Razão | Ação necessária |
|--------|-------|-----------------|
| SettingsPanel | NAVIGATION_UNKNOWN | fornecer URL direta |

## Detalhes

### PASS
- [x] buscar_produto — todos os passos verificados, API calls corretos

### FAIL
- [ ] checkout — step "ConfirmarPedido -> Sucesso" falhou
  - Esperado: POST /pedidos → 201
  - Real: POST /pedidos → 404
  - Categoria: CONTRACT_MISMATCH
  - Ação: reportado para refinamento do modelo

## Fixes Aplicados (CODE_BUG)
- src/pages/Buscar.tsx linha 42: campo `query` estava com typo `queyr`

## Melhorias de Modelo Aplicadas (MODEL_IMPROVEMENT) [yolo only]
- journey checkout: modelo definia 3 passos, código usa 2 passos mais coesos → modelo atualizado

## Pendentes (DECISION_REQUIRED / CONTRACT_MISMATCH)
- checkout: modelo diz navegar para Sucesso, código vai para Home → qual é correto?
- Tela `/perfil/avancado` existe no sistema mas não está modelada [default: aguardando decisão]
```

## Tabela de Verificação por Construto

| Construto | O que verificar |
|-----------|----------------|
| `journey` | Cada transição (TelaA→TelaB:trigger) executada com sucesso |
| `screen` | **(Fase 1)** verificado durante journey; **(Fase 2)** todos `uses` elements renderizados, forms corretos |
| `element` | Todos `resolvedProps` não-opcionais visíveis; forms presentes; @impl path como hint de busca no DOM |
| `action` | Network call corresponde ao `calls`, resultado navega para tela correta; signals disparam |
| `api` | Endpoint existe, método correto, response schema corresponde ao modelo |
| `rule` | Violação da regra é rejeitada pelo sistema |
| `flow` | Fluxo executado de ponta a ponta sem erros |
