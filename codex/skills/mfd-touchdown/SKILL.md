---
name: mfd-touchdown
description: Modo Touchdown — verificação ao vivo do sistema usando Chrome DevTools, guiado pelo modelo MFD como oráculo. Navega journeys reais como usuário, verifica screens/elements, ações e API calls. Marca @live em construtos verificados.
user-invocable: true
---

# /mfd-touchdown — Verificação Ao Vivo (Touchdown Mode)

Age como usuário real guiado pelo modelo MFD como oráculo. Usa Chrome DevTools para navegar o sistema ao vivo, sem scripts pré-escritos.

## Argumentos

`$ARGUMENTS` — Path ao arquivo .mfd (ou `main.mfd` para multi-file), opcionalmente seguido da URL base (ex: `model/main.mfd http://localhost:3000`).

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
mfd_query file="<arquivo.mfd>" type="action" resolve_includes=true
mfd_query file="<arquivo.mfd>" type="api" resolve_includes=true
```

### Passo 2 — Confirmar URL Base

Se não fornecida nos argumentos, perguntar ao usuário:
- URL base da aplicação (ex: `http://localhost:3000`)
- Credenciais para cada `@persona` das journeys

### Passo 3 — Para Cada Journey com @impl

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

### Passo 4 — Classificação de Falhas

| Categoria | Critério | Autonomia |
|-----------|---------|-----------|
| `CODE_BUG` | Comportamento diferente do esperado pelo modelo, mas modelo está correto | Autônomo: fix código → re-testa |
| `MODEL_GAP` | Modelo não captura detalhe real mas intenção está correta | Micro-ajuste: atualizar modelo sem council → re-testa |
| `CONTRACT_MISMATCH` | Comportamento real contradiz contrato do modelo (semanticamente) | Reportar → volta ao Council |
| `NOT_MODELED` | Tela/fluxo real não existe no modelo | DECISION_REQUIRED → pergunta ao usuário |
| `ENV_ISSUE` | Problema de ambiente (servidor down, auth expirou, dados faltando) | Flagra → continua próxima journey |

**Regra de autonomia:**
- CODE_BUG: IA age autonomamente para corrigir o código
- MODEL_GAP "micro-ajuste": mudança de detalhe (texto de campo, label de botão, ordem de step) sem alterar semântica do contrato
- Qualquer mudança semântica ao modelo → DECISION_REQUIRED antes de alterar

### Passo 5 — Marcar @live e @verified

Após cada journey que passou completamente:
```
mfd_live mark file="<arquivo.mfd>" construct="<journey_name>"
mfd_verify mark file="<arquivo.mfd>" construct="<journey_name>"
```

Touchdown é uma forma adicional de confiança: incrementa tanto `@live` quanto `@verified`.

### Passo 6 — Relatório Final

```markdown
# Relatório Touchdown

**Modelo:** <arquivo.mfd>
**URL:** <url_base>
**Data:** <data>

## Resumo

| Journey | Status | @live | Observações |
|---------|--------|-------|-------------|
| buscar_produto | PASS | @live(1) | — |
| checkout | FAIL | — | CONTRACT_MISMATCH: API retorna 404 |

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

## Pendentes (DECISION_REQUIRED)
- Tela `/perfil/avancado` existe no sistema mas não está modelada
```

## Tabela de Verificação por Construto

| Construto | O que verificar |
|-----------|----------------|
| `journey` | Cada transição (TelaA→TelaB:trigger) executada com sucesso |
| `screen` | Elementos visíveis na tela, forms presentes |
| `action` | Network call corresponde ao `calls`, resultado navega para tela correta |
| `api` | Endpoint existe, método correto, response schema corresponde ao modelo |
| `rule` | Violação da regra é rejeitada pelo sistema |
| `element` | Props do modelo estão renderizadas |
| `flow` | Fluxo executado de ponta a ponta sem erros |
