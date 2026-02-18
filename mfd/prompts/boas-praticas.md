---
name: boas-praticas
mode: best-practices
description: Prompt para boas praticas de modelagem MFD — padroes, anti-padroes e guidelines qualitativos
---

# Boas Praticas de Modelagem MFD

Padroes, anti-padroes e guidelines qualitativos para modelar bem com MFD-DSL.

## Design de Entities

- Toda entity deve ter campo de identificacao (`id: uuid` ou campo com `@unique`)
- Preferir entidades focadas: se tem 15+ campos, considerar separar (ex: `UserProfile` separado de `UserCredentials`)
- Campos opcionais (`tipo?`) devem ser excecao, nao regra — muitos opcionais indica que sao entidades diferentes
- Usar `@abstract` para campos comuns reutilizaveis (ex: `Timestamps { created_at, updated_at }`)
- Usar `@interface` para contratos de capacidade (ex: `Auditable { audit_log: AuditEntry[] }`)
- Entity com relacionamentos: preferir referencia por ID (`user_id: uuid`) a embedding direto

### Checklist

- [ ] Tem campo de identificacao?
- [ ] Menos de 15 campos?
- [ ] Campos opcionais sao realmente opcionais (nao mascarando entidades diferentes)?
- [ ] Usa `extends` para herdar campos comuns?
- [ ] Pertence ao componente correto (Principio de Propriedade)?

## Design de Flows

- **Flow ideal: 3-7 steps** (< 3 pode ser operation; > 7 deve ser decomposto)
- Todo flow com side effects deve ter branch de erro: `| erro -> tratamento`
- Steps `@async` para fire-and-forget (notificacoes, logging, analytics)
- Se um flow tem logica reutilizavel, extrair para operation
- Flows `@abstract` para template patterns (base com steps comuns, concretos com override)
- Um flow deveria ter um unico proposito claro — se o nome precisa de "e" (ex: "criar_e_notificar"), considerar separar

### Checklist

- [ ] Entre 3 e 7 steps?
- [ ] Tem branches de erro para steps que podem falhar?
- [ ] Steps @async para side-effects nao-criticos?
- [ ] Logica reutilizavel extraida em operations?
- [ ] Nome descreve claramente o proposito?
- [ ] Retorno inclui tipos de erro explicitos (`-> Result | Error`)?

## Design de Operations

- Operation = acao atomica, sem orquestracao
- Se precisa de multiplos steps sequenciais, provavelmente e um flow
- `handles METHOD /path` — operation serve este endpoint
- `calls METHOD /path` — operation consome endpoint externo ou de outro servico
- Boa operation: uma responsabilidade, input claro, output claro, testavel isoladamente

## Design de APIs

- RESTful: resources no plural (`/pedidos`, nao `/pedido`)
- Versionamento no prefix: `@prefix(/v1/pedidos)`
- Endpoints de leitura sem input body: `GET /items -> Item[]`
- Endpoints de escrita com input tipado: `POST /items (CreateItemInput) -> Item | Error`
- STREAM para real-time: `STREAM /items/events -> ItemAtualizado`
- `@auth` em todo endpoint que precisa de autenticacao (explicito > implicito)
- `@external` para APIs de terceiros consumidas (Stripe, SendGrid, etc.)
- `@rate_limit` para endpoints publicos ou de alto volume
- `@cache` para endpoints de leitura com dados estaveis

### Checklist

- [ ] Resources no plural?
- [ ] Prefix com versao?
- [ ] Endpoints de escrita tem input tipado?
- [ ] Retornos incluem tipos de erro?
- [ ] `@auth` explicito onde necessario?
- [ ] STREAM para dados real-time?

## Design de Events

- **Naming: verbo no passado** (`PedidoCriado`, `PagamentoAprovado`, `UsuarioDesativado`)
- Payload minimo: IDs + dados necessarios para o consumidor agir (nao duplicar entity inteira)
- Eventos sao imutaveis — uma vez emitidos, o payload nao muda
- `@abstract` para base events com metadata comum (ex: `BaseEvent { id: uuid, timestamp: datetime }`)
- Separar event (server-side/dominio) de signal (client-side/UI)
- Events de integracao (cross-component) no `component Protocol`
- Events internos no proprio componente

### Checklist

- [ ] Nome no passado (acao ja aconteceu)?
- [ ] Payload minimo e suficiente?
- [ ] Event ou signal? (server vs client)
- [ ] Integracao ou interno? (Protocol vs componente)
- [ ] Usa `@abstract` para metadata compartilhada?

## Design de Signals

- Signal = evento client-side (frontend) — separado de event (server-side)
- Naming: similar a events, mas para contexto de UI (`ThemeChanged`, `CartUpdated`, `FilterApplied`)
- Payload com dados relevantes para a UI reagir
- Actions podem emitir signals (`emits SignalName`) e reagir a signals (`on SignalName`)
- Usar `@abstract` para base signals com campos comuns

## Design de State Machines

- Todo estado deve ser alcancavel (pelo menos uma transicao leva a ele)
- Todo estado nao-terminal deve ter pelo menos uma transicao de saida
- Usar `* -> estado : on Evento` com moderacao — wildcard esconde complexidade
- Padrao reativo: flow emite event -> state reage via `on EventName`
- Estado terminal explicito (ex: `cancelado`, `arquivado`) — sem saida
- Enum de estados deve cobrir todo o ciclo de vida

### Checklist

- [ ] Todos os estados sao alcancaveis?
- [ ] Estados nao-terminais tem saida?
- [ ] Transicoes usam `on EventName` (padrao reativo)?
- [ ] Wildcards `*` sao realmente necessarios?
- [ ] Estados terminais sao explicitos?

## Design de Screens e Elements

- **Element** = building block reutilizavel (botao, card, tabela, modal, indicador)
- **Screen** = container que compoe elements (pagina, dashboard)
- Toda screen com form deveria ter action correspondente com `calls`
- Props tipadas: `prop usuario: User` em vez de dados genericos
- `@abstract` element para base components, concretos para variacoes
- `@layout` na screen indica intencao semantica (list, detail, form, dashboard, wizard)
- Screens nao devem ter logica — a logica vive nas actions e nos flows que as actions chamam

### Checklist

- [ ] Elements sao reutilizaveis (nao especificos de uma screen)?
- [ ] Screens compoem elements via `uses`?
- [ ] Forms tem actions correspondentes?
- [ ] Props sao tipadas com tipos do modelo?

## Design de Actions

- **Imperativa** (`calls METHOD /path`): para operacoes CRUD — botao que faz request
- **Reativa STREAM** (`on STREAM /path`): para real-time — listener de eventos do servidor
- **Reativa Signal** (`on SignalName`): para UI events — handler de evento client-side
- **Pura** (sem calls, sem on): para navegacao ou toggle local
- Toda action imperativa deveria ter `| erro -> tratamento` alem do caminho feliz
- `emits SignalName` para propagar mudancas de estado na UI

## Design de Journeys

- Journey = fluxo de navegacao do usuario (happy path + desvios)
- `@persona(papel)` indica quem realiza a jornada
- Toda journey deve ter `-> end` (conclusao explicita)
- `* -> TelaX : on trigger` para reset/fallback global (usar com moderacao)
- Journeys sao otimas para derivar testes E2E

## Anti-Padroes

| Anti-Padrao | Sintoma | Solucao |
|-------------|---------|---------|
| **God Core** | 60%+ construtos em um componente | Redistribuir por ownership (Principio de Propriedade) |
| **Anemic Model** | Entities so com dados, toda logica em flows gigantes | Mover validacoes para rules, decompor flows em operations |
| **Fat Flow** | Flow com 15+ steps e muitos branches | Extrair sub-operations, usar flow @abstract para template |
| **Leaky Entity** | Entity exposta diretamente na API sem DTO | Usar tipos de input/output distintos nos params de flows |
| **Phantom Dependency** | Componente A usa entity de B sem `dep` declarado | Adicionar `dep -> B` explicito |
| **Event Soup** | Tudo comunica por eventos, impossivel rastrear fluxo | Eventos para integracao assincrona, chamadas diretas para sincrono |
| **Over-modeling** | Modelar detalhes de implementacao (cache keys, table names) | Modelo descreve O QUE, nao COMO |
| **Under-modeling** | Modelo tao abstrato que nao guia implementacao | Todo construto deve ter campos/steps concretos suficientes |
| **Missing Error Path** | Flows sem branches de erro | Adicionar `| erro ->` para todo step que pode falhar |
| **Orphan Construct** | Construtos declarados mas nunca referenciados | Validador ja detecta (ORPHAN_EVENT, ORPHAN_FLOW, etc.) |

### Como detectar

- **God Core**: use `mfd stats` — se um componente tem mais construtos que todos os outros juntos
- **Fat Flow**: conte steps — mais de 7 indica decomposicao necessaria
- **Phantom Dependency**: `mfd validate` detecta referencias cruzadas sem `dep`
- **Orphan Construct**: `mfd validate` detecta construtos nao referenciados
- **Missing Error Path**: verifique se flows com `emits` ou `calls` tem branches `| erro ->`
