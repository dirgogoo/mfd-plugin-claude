---
name: touchdown
mode: touchdown
description: Prompt para Modo Touchdown — verificação ao vivo do sistema usando Chrome DevTools, guiado pelo modelo MFD como oráculo
---

# Modo Touchdown — Verificação Ao Vivo

O Modo Touchdown fecha o gap entre Council (verificação estática) e realidade: IA age como usuário real, guiada pelo modelo como oráculo, usando Chrome DevTools.

## Princípio Fundamental

**O modelo é o oráculo.** O que o modelo define é o que o sistema DEVE fazer. Se o sistema faz diferente, ou há um bug (CODE_BUG), ou o modelo está incompleto (MODEL_GAP), ou há contradição real (CONTRACT_MISMATCH).

## Protocolo de Verificação por Tipo de Construto

### Journey
- **O que verificar:** Cada passo `TelaA -> TelaB : on trigger` deve ser navegável
- **Como verificar:**
  1. Navegar para TelaA (via URL ou navegação interna)
  2. Verificar que TelaA está renderizada (screenshot)
  3. Executar o trigger (click, form submit, etc.)
  4. Verificar que TelaB é exibida (screenshot)
  5. Verificar network calls intermediários
- **PASS se:** Todas as transições navegam corretamente, elementos presentes, APIs respondem conforme modelo

### Screen
- **O que verificar (Fase 1 — durante journey):** Elementos visíveis durante a navegação, forms renderizados
- **O que verificar (Fase 2 — sweep direto):** Cada `uses ElementName -> alias` renderizado, forms corretos
- **Como verificar:**
  1. Navegar para a URL da tela
  2. `take_screenshot`
  3. Verificar que cada `uses ElementoX` está visível
  4. Verificar que forms declarados existem (campos corretos)
- **PASS se:** Todos os `uses` elements passaram, sem IMPL_MISSING
- **PARTIAL se:** Algum element usado não tem `@impl` → NÃO marcar `@live`
- **FAIL se:** Um ou mais elements falharam na verificação

### Action (imperativa — `calls`)
- **O que verificar:** HTTP call correto ao executar a ação
- **Como verificar:**
  1. `list_network_requests` antes da ação (baseline)
  2. Executar a ação (click/form)
  3. `list_network_requests` após (capturar novo request)
  4. Verificar: método HTTP, URL, body schema, response status e schema
- **PASS se:** Call bate com `calls METHOD /path` do modelo, response schema correto

### Action (reativa — `on STREAM` ou `on Signal`)
- **O que verificar:** Atualização da UI quando evento chega
- **Como verificar:**
  1. Abrir tela que usa a action
  2. Disparar o evento (via outro cliente ou simulação)
  3. Verificar que a UI atualiza sem reload
- **PASS se:** UI reflete mudança conforme a transição do modelo

### API Endpoint
- **O que verificar:** Endpoint existe, método correto, response schema correto
- **Como verificar:**
  1. `evaluate_script` para fazer fetch direto, ou monitorar network calls
  2. Comparar response com tipo declarado no modelo
- **PASS se:** Status HTTP, schema de response e headers batem com o modelo

### Rule
- **O que verificar:** Violação da regra é rejeitada
- **Como verificar:**
  1. Submeter dados que violam a regra
  2. Verificar que sistema rejeita (4xx, mensagem de erro)
- **PASS se:** Sistema rejeita a violação com resposta apropriada

### Element
- **O que verificar:** Props não-opcionais renderizadas, forms presentes, comportamento correto
- **Como verificar:**
  1. Navegar para tela que usa o element (via Fase 2 sweep ou incidentalmente em Fase 1)
  2. `take_snapshot` e buscar element pelo nome (hint: `@impl` path = nome do componente)
  3. Verificar props por tipo (ver seção "Element — Verificação por Prop" abaixo)
  4. Verificar forms declarados: campos existem como inputs?
- **PASS se:** Todos os `resolvedProps` não-opcionais visíveis, forms corretos
- **Element `@abstract`:** pular (não é renderizado diretamente)
- **Element já com `@live`:** pular (não re-verificar)

## Screen — Verificação Fase 2 (Sweep Direto)

Após a Fase 1 (journeys), verificar screens com `@impl` que não foram cobertas pelas journeys.

**Quando usar:**
- Screen tem `@impl` mas não aparece em nenhuma journey verificada
- `mfd_live list-pending` lista a screen como pendente

**Como navegar até a screen:**
1. Usar o grafo de navegação construído a partir das actions:
   - `action { from ScreenA | ok -> ScreenB }` = edge ScreenA → ScreenB
   - BFS a partir do root (URL base)
2. Caminho encontrado → navegar step-by-step pelas actions intermediárias
3. Caminho não encontrado → pedir URL direta ao usuário
4. Usuário não sabe → `NAVIGATION_UNKNOWN` → pular e reportar

**O que verificar:**
- Para cada `uses ElementName -> alias` na screen:
  - Element renderizado no DOM?
  - Props não-opcionais visíveis?
  - Forms declarados no element presentes como inputs?
- Para cada form declarado diretamente na screen: campos existem?

**Critérios de status:**
- **PASS:** todos `uses` passaram, sem IMPL_MISSING → `mfd_live mark` + `mfd_verify mark`
- **PARTIAL:** algum element sem `@impl` (IMPL_MISSING) → NÃO marcar `@live`, reportar
- **FAIL:** element falhou na verificação → NÃO marcar `@live`

## Element — Verificação por Prop

Ao verificar um element, verificar cada prop por tipo semântico:

| Tipo de prop | O que verificar |
|-------------|----------------|
| `string`, `number` | Texto/valor visível no DOM (qualquer representação) |
| `boolean` | Estado visual presente: toggle ligado/desligado, badge, ícone condicional |
| Entity reference (ex: `prop user: User`) | Ao menos um campo da entidade renderizado (ex: `user.name`) |
| Array (ex: `prop items: Item[]`) | Ao menos um item renderizado; lista/tabela presente |
| Prop opcional (`tipo?`) | Ausência é aceitável — não falhar |

**`@impl` path como hint de busca no DOM:**
- `@impl(src/components/BookCard.tsx)` → procurar componente "BookCard" no snapshot/DOM
- Usar `take_snapshot` e buscar pelo nome do componente no a11y tree

**Element `@abstract`:** pular — não é instanciado diretamente, não verificar

**Element em múltiplas screens:** marcar `@live` somente no primeiro PASS; se já tem `@live`, pular

## Tracking de Screens Cobertas (Fase 1 → Fase 2)

```
Durante Fase 1 — para cada JourneyStep verificado:
  visitadosPorJourney.add(step.from)
  visitadosPorJourney.add(step.to)

Início da Fase 2:
  screens pendentes = screens com @impl e sem @live − visitadosPorJourney

  Para obter lista: mfd_live list-pending (filtrar type=screen e type=element)
```

Este mecanismo garante que a Fase 2 não re-verifica screens já cobertas incidentalmente pelas journeys.

## Classificação de Falhas — Critério de Autonomia

### CODE_BUG (autônomo)
**Critério:** O modelo está correto, o código está errado.
- Exemplo: Model define `POST /pedidos → 201`, código retorna `200`
- Exemplo: Element renderiza campo com nome errado
- Exemplo: Form não valida campo `@required`
**Ação:** Fix autônomo no código → re-testa imediatamente

### MODEL_GAP — Micro-ajuste (autônomo com notificação)
**Critério:** Intenção do modelo está correta, mas detalhe real difere.
- Exemplos de micro-ajuste PERMITIDO: label de botão, ordem de campos em form, nome de campo UI
- Exemplos de micro-ajuste NÃO PERMITIDO: adicionar/remover entidades, mudar API endpoints, alterar semântica de fluxos
**Ação:** Atualizar modelo (sem council necessário) → notificar usuário → re-testa

### CONTRACT_MISMATCH (reportar)
**Critério:** Comportamento real contradiz semanticamente o contrato do modelo.
- Exemplo: Journey define `Carrinho -> Checkout`, mas sistema vai direto para Home
- Exemplo: API define retorno `User | Error`, mas sistema nunca retorna erro (swallow)
**Ação:** Documentar no relatório → volta ao Council → não marcar @live

### NOT_MODELED (DECISION_REQUIRED)
**Critério:** Feature/tela existe no sistema mas não existe no modelo.
- Exemplo: Tela `/perfil/avancado` existe mas não está em nenhum screen do modelo
**Ação:** Perguntar ao usuário: modelar? ignorar? remover feature?

### ENV_ISSUE (flagrar e continuar)
**Critério:** Problema de ambiente, não de código ou modelo.
- Exemplo: Servidor down, banco sem dados seed, auth expirou
**Ação:** Flagrar no relatório → continuar próxima journey

## Critério de "Micro-ajuste" vs Refinamento Completo

| É micro-ajuste | É refinamento completo |
|---------------|----------------------|
| Label de botão diferente | Nova tela no fluxo |
| Campo com nome ligeiramente diferente | Campo com tipo diferente |
| Ordem de steps no form | Novo step de validação |
| URL com slug diferente do esperado | Endpoint com método diferente |
| Mensagem de erro com texto diferente | Semântica da regra diferente |

Micro-ajuste: IA atualiza modelo autonomamente, notifica usuário, continua.
Refinamento: Para, explica o conflito, aguarda decisão do usuário.

## Atualização de @live e @verified

**Fase 1 — Journeys:**

Após cada journey PASS completa:
1. `mfd_live mark` → incrementa @live(N) no construto journey
2. `mfd_verify mark` → incrementa @verified(N) no mesmo construto

**Fase 2 — Screens e Elements:**

Após screen PASS (todos `uses` passaram, sem IMPL_MISSING):
1. `mfd_live mark` + `mfd_verify mark` no construto `screen`

Após element PASS (primeira screen em que foi verificado):
1. `mfd_live mark` + `mfd_verify mark` no construto `element`

Screen PARTIAL (algum element sem `@impl`) → NÃO marcar `@live`
Element sem `@impl` → IMPL_MISSING → não bloqueia a screen inteira, mas torna-a PARTIAL

Touchdown é validação ao vivo = forma adicional de confiança → incrementa ambos.

Após CODE_BUG fixado e re-testado com sucesso → marcar @live normalmente.
Após MODEL_GAP micro-ajuste → marcar @live (o modelo foi atualizado para refletir a realidade).
CONTRACT_MISMATCH → NÃO marcar @live (volta ao Council).
NOT_MODELED → NÃO marcar @live (aguarda decisão).
ENV_ISSUE → NÃO marcar @live (testar depois que ambiente estiver correto).
