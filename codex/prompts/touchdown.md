---
name: touchdown
mode: touchdown
description: Prompt para Modo Touchdown — verificação ao vivo do sistema usando Chrome DevTools, guiado pelo modelo MFD como oráculo
---

# Modo Touchdown — Verificação Ao Vivo

O Modo Touchdown fecha o gap entre Council (verificação estática) e realidade: IA age como usuário real, guiada pelo modelo como oráculo, usando Chrome DevTools.

## Princípio Fundamental

**O modelo é o oráculo — mas o código pode ensiná-lo.** O que o modelo define é o que o sistema DEVE fazer. Se o sistema faz diferente: ou há um bug (CODE_BUG), ou o modelo não capturou um detalhe (MODEL_GAP), ou o código tem uma implementação genuinamente melhor (MODEL_IMPROVEMENT), ou há contradição real (CONTRACT_MISMATCH).

**Touchdown é E2E — tudo flui pela interface.** Cada verificação começa com uma ação do usuário na UI (navegar, clicar, preencher form). APIs, regras e flows são verificados como efeito colateral dessas ações — nunca chamados diretamente. Se não passa pela UI, não é Touchdown.

**Verificar comportamento, não só presença.** Não basta confirmar que um elemento existe — é preciso observar como a interface reage. Screenshot antes da ação, executa, screenshot depois: a UI mudou conforme o modelo define? Loading apareceu? Botão desabilitou? Mensagem de sucesso/erro exibiu? Dado atualizou? Navegação aconteceu? O comportamento da interface É o teste.

**Verificar logs após cada interação.** Após executar qualquer ação significativa (click, submit, navegação), consultar os logs do browser via `get_console_logs`. Erros de JS, exceptions não tratadas, chamadas com falha silenciosa e warnings críticos são bugs — mesmo que a UI aparente normalidade.

## Protocolo de Verificação por Tipo de Construto

### Journey
- **O que verificar:** Cada passo `TelaA -> TelaB : on trigger` deve ser navegável com comportamento correto
- **Como verificar:**
  1. Navegar para TelaA (via URL ou navegação interna)
  2. Screenshot do estado inicial de TelaA
  3. Executar o trigger (click, form submit, etc.)
  4. Observar mudanças de estado intermediárias (loading, spinner, botão desabilitado, feedback inline)
  5. Screenshot após o trigger — a UI reagiu? Houve transição visual?
  6. Verificar que TelaB é exibida (screenshot de destino)
  7. Verificar network calls disparados pela UI
- **PASS se:** Todas as transições navegam corretamente, UI reage visivelmente ao trigger, APIs respondem conforme modelo

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
- **O que verificar:** HTTP call correto + UI reage conforme o resultado
- **Como verificar:**
  1. Screenshot do estado inicial
  2. `list_network_requests` baseline
  3. Executar a ação (click/form)
  4. Observar feedback imediato da UI: botão desabilitou? loading apareceu? campos bloquearam?
  5. `list_network_requests` após — capturar request gerado pela UI
  6. Verificar: método HTTP, URL, body schema, response status e schema
  7. Screenshot do estado final — sucesso renderizou? erro exibiu? navegação aconteceu conforme `| resultado -> Tela`?
- **PASS se:** Call bate com `calls METHOD /path`, UI exibe feedback durante e após, resultado navega/mostra conforme o modelo

### Action (reativa — `on STREAM` ou `on Signal`)
- **O que verificar:** Atualização da UI quando evento chega
- **Como verificar:**
  1. Abrir tela que usa a action
  2. Disparar o evento (via outro cliente ou simulação)
  3. Verificar que a UI atualiza sem reload
- **PASS se:** UI reflete mudança conforme a transição do modelo

### API Endpoint
- **O que verificar:** Endpoint existe, método correto, response schema correto
- **Como verificar:** APIs são verificadas como efeito colateral de ações na UI — NUNCA via fetch direto
  1. Executar a action que dispara a chamada (click, form submit, etc.)
  2. `list_network_requests` para capturar o request que a UI gerou
  3. Comparar: método HTTP, URL, body schema, status e response schema vs modelo
- **PASS se:** Call disparado pela UI bate com `calls METHOD /path` do modelo, response schema correto
- **NUNCA usar:** `evaluate_script` para fetch direto — isso não é E2E, bypassa a interface

### Rule
- **O que verificar:** Violação da regra é rejeitada e a UI comunica isso ao usuário
- **Como verificar:**
  1. Submeter dados que violam a regra (via UI — preencher form, clicar submit)
  2. Verificar que sistema rejeita (4xx no network)
  3. Verificar que a UI exibe mensagem de erro/feedback visível — o usuário SABE que foi rejeitado
  4. Screenshot para evidenciar o estado de erro na interface
- **PASS se:** Sistema rejeita a violação E a UI comunica o erro de forma visível

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

## Observação de Mudança de Estado da UI

Em E2E, o que valida o comportamento é a sequência de estados da interface — não só o estado final. Para cada interação significativa, observar:

### Estados a verificar

| Momento | O que observar |
|---------|---------------|
| **Antes da ação** | Estado inicial está correto? Elementos habilitados/visíveis conforme esperado? |
| **Durante a ação** | Loading indicator apareceu? Botão desabilitou? Spinner rodando? Campo bloqueado? |
| **Após sucesso** | Dado atualizado na UI? Mensagem de confirmação exibiu? Navegação aconteceu? Estado voltou ao normal? |
| **Após erro** | Mensagem de erro visível? Campo destacado? Usuário pode corrigir e retentar? |
| **Transição de tela** | URL mudou conforme esperado? Tela destino renderizou completamente? Dados carregados? |

### Como observar

```
1. take_screenshot — captura estado inicial
2. Executar ação (click, fill, submit)
3. take_screenshot imediatamente — captura estado transitório (loading, disabled)
4. Aguardar resposta
5. take_screenshot — captura estado final
6. get_console_logs — verificar logs do browser
7. Comparar os 3 screenshots + logs: a sequência faz sentido com o que o modelo define?
```

### Verificação de Logs (get_console_logs)

Após cada interação significativa, consultar os logs do browser. O que procurar:

| Tipo de log | Significado | Categoria |
|-------------|-------------|-----------|
| `error` — JS exception não tratada | Bug no código | CODE_BUG |
| `error` — fetch/XHR falhou silenciosamente | UI não informou o usuário | CODE_BUG |
| `error` — component crash / render error | Elemento não renderizou | CODE_BUG |
| `warn` — prop inválida / type mismatch | Contrato quebrado entre componentes | CODE_BUG |
| `warn` — deprecated API usage | Dívida técnica (registrar, não bloquear) | NOT_MODELED |
| `error` — 401/403 inesperado | Problema de auth/permissão | ENV_ISSUE ou CODE_BUG |
| logs normais (`info`, `debug`) | Esperado — ignorar | — |

**Regra:** se a UI parece normal mas os logs têm `error`, é CODE_BUG — a interface está escondendo um problema. O usuário não sabe que algo falhou.

**Quando verificar logs:**
- Após cada submit de form
- Após cada navegação de tela
- Após cada action que dispara chamada de rede
- Após cada transição de journey

### Mapeamento modelo → estado visual

| O modelo define | A UI deve mostrar |
|----------------|-------------------|
| `action calls POST /x \| sucesso -> TelaY` | Após submit: feedback visual → navega para TelaY |
| `action calls POST /x \| erro -> end` | Após erro: mensagem de erro inline, usuário permanece na tela |
| `state ciclo: Status { pendente -> ativo }` | Badge/label muda de "Pendente" para "Ativo" após transição |
| `rule { when X then reject("msg") }` | Mensagem "msg" (ou equivalente) aparece na UI |
| `on STREAM /events -> atualizado` | Dado atualiza sem reload ao receber evento |
| `signal CartUpdated` | Contador/badge de carrinho atualiza sem navegação |

### Sinais de CODE_BUG por comportamento

- Loading nunca aparece (UX quebrada, mas não é requisito do modelo)
- Botão não desabilita durante submit → permite duplo-clique → CODE_BUG se causa duplicata
- Mensagem de sucesso não aparece → usuário não sabe se funcionou → CODE_BUG
- Erro silencioso (request falhou mas UI não informa) → CODE_BUG
- Navegação para tela errada após ação → CODE_BUG
- Dado na UI não reflete resposta da API → CODE_BUG

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

## Modos de Execução — Default vs Yolo

| Categoria | Default | Yolo |
|-----------|---------|------|
| `CODE_BUG` | Fix código → re-testa | Fix código → re-testa |
| `MODEL_GAP` | Fix modelo (notifica) → re-testa | Fix modelo → re-testa |
| `MODEL_IMPROVEMENT` | Reporta → pausa | Atualiza modelo → continua |
| `CONTRACT_MISMATCH` | Reporta → volta ao Council | Reporta → volta ao Council |
| `NOT_MODELED` | Pergunta ao usuário | Adiciona ao modelo → continua |
| `ENV_ISSUE` | Flagra → continua | Flagra → continua |

`CONTRACT_MISMATCH` é sempre reportado — em ambos os modos. Ambiguidade genuína exige decisão humana.

## Classificação de Falhas — Critério de Autonomia

### CODE_BUG (autônomo — ambos os modos)
**Critério:** O modelo está correto, o código está errado.
- Exemplo: Model define `POST /pedidos → 201`, código retorna `200`
- Exemplo: Element renderiza campo com nome errado
- Exemplo: Form não valida campo `@required`
- Exemplo: Botão habilitado quando deveria estar desabilitado
**Ação:** Fix autônomo no código → re-testa imediatamente

### MODEL_GAP — Micro-ajuste (autônomo com notificação — ambos os modos)
**Critério:** Intenção do modelo está correta, mas detalhe cosmético difere.
- Exemplos PERMITIDOS: label de botão, ordem de campos em form, nome de campo UI, mensagem de erro
- Exemplos NÃO PERMITIDOS: adicionar/remover entidades, mudar API endpoints, alterar semântica de fluxos
**Ação:** Atualizar modelo (sem council) → notificar usuário → re-testa

### MODEL_IMPROVEMENT (default: pausa / yolo: autônomo)
**Critério:** O código implementa algo genuinamente melhor que o modelo define. Há uma direção clara: o modelo deve evoluir para refletir a implementação real.
- Exemplo: modelo define journey com 3 passos, código usa 2 passos mais coesos e funcionais
- Exemplo: modelo não captura estado de validação inline que o código trata corretamente
- Exemplo: código navega para uma tela mais adequada ao contexto do que o modelo define
- Exemplo: modelo define entidade com campo que o código não usa por boas razões de UX

**Como distinguir de CONTRACT_MISMATCH:** em MODEL_IMPROVEMENT, é óbvio que o código está certo e o modelo deve ser atualizado. Em CONTRACT_MISMATCH, há ambiguidade — não é claro qual está certo. Em dúvida: tratar como CONTRACT_MISMATCH.

**Ação em Default:** Reportar com evidência: "o código faz X que é melhor que Y do modelo porque Z. Devo atualizar o modelo?" → pausa
**Ação em Yolo:**
1. Descrever a melhoria (código faz X, modelo dizia Y, razão: Z)
2. Atualizar o `.mfd` para refletir a implementação real
3. Validar modelo após edição (`mfd_validate`)
4. Registrar no relatório como MODEL_IMPROVEMENT aplicado
5. Continuar

### CONTRACT_MISMATCH (reportar — ambos os modos)
**Critério:** Comportamento real contradiz semanticamente o contrato do modelo, sem direção clara.
- Exemplo: Journey define `Carrinho -> Checkout`, mas sistema vai direto para Home
- Exemplo: API define retorno `User | Error`, mas sistema nunca retorna erro (swallow)
**Ação:** Documentar no relatório → volta ao Council → não marcar @live

### NOT_MODELED (default: pergunta / yolo: adiciona ao modelo)
**Critério:** Feature/tela existe no sistema mas não existe no modelo.
- Exemplo: Tela `/perfil/avancado` existe mas não está em nenhum screen do modelo
**Ação Default:** Perguntar ao usuário: modelar? ignorar? remover feature?
**Ação Yolo:** Adicionar ao modelo os constructs que fazem sentido → validar → continuar

### ENV_ISSUE (flagrar e continuar — ambos os modos)
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
