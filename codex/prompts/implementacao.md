---
name: implementacao
mode: implementation
description: Prompt para modo implementacao — gerar codigo a partir do contrato MFD
---

# Modo Implementacao

O modelo MFD esta validado e commitado. Hora de gerar codigo que segue fielmente o contrato.

## Regra Fundamental

**Zero liberdade sobre o QUE, total liberdade sobre o COMO.**

Se o modelo define `entity User { email: string }`, o codigo DEVE ter essa entidade com esse campo. A escolha de ORM, framework, linguagem e sua.

## Estrategia para Modelos Multi-Arquivo

Quando o modelo usa `import` (multiplos arquivos `.mfd`):

1. **Leia `main.mfd` primeiro** para entender a estrutura geral e quais componentes existem
2. **Leia APENAS o arquivo do componente sendo implementado** (ex: `auth.mfd` se implementando Auth)
3. **Leia `shared.mfd` somente se necessario** para tipos do Vocabulario Compartilhado (enums, @abstract, @interface)
4. **Leia componentes compartilhados** (ex: `protocolo.mfd`) se o componente consome ou emite events/signals de integracao
5. **NAO leia todos os arquivos** — foque no escopo do componente atual
6. **Para validacao/parse, passe `main.mfd`** — o CLI auto-resolve imports

### Identificando Componentes Compartilhados

- `shared.mfd` **sem** `component` block = Vocabulario Compartilhado (enums, tipos base)
- Arquivo **com** `component Protocol` (ou similar) = Protocolo de integracao (events, signals, state machines de integracao)
- Se o componente sendo implementado usa `on EventName` ou `emits EventName`, verifique se o event esta no componente Protocol

## Mapping Construto -> Padrao de Codigo

### entity -> Modelo/Schema de Dados
- Cada campo do entity vira propriedade/coluna
- Decorators mapeiam para validacoes:
  - `@unique` -> constraint UNIQUE / indice unico
  - `@format(email)` -> validacao de formato
  - `@min(n)` / `@max(n)` -> validacao de range
  - `@optional` -> campo nullable
- Tipos array (`type[]`) -> relacao one-to-many ou campo JSON array
- Tipos referencia (`User`) -> foreign key ou embedded

### enum -> Enum/Constantes
- Cada valor do enum vira membro do enum na linguagem alvo
- Usado em validacoes, filtros, e state machines

### operation -> Funcao/Handler
- Cada operation vira uma funcao/metodo isolado (acao atomica)
- Params -> parametros da funcao
- Return type -> tipo de retorno
- `emits EventName` -> a funcao emite o evento apos execucao
- `on EventName` -> registrar handler/listener que invoca esta funcao quando o evento ocorre
- `handles METHOD /path` -> esta operation serve (e o handler de) este endpoint da API
- `calls METHOD /path` -> esta operation consome este endpoint (inclusive @external)
- Operations sao os blocos de construcao atomicos; flows os compoem

### flow -> Service/UseCase/Handler
- Cada flow vira uma funcao/metodo
- Params do flow -> parametros da funcao
- Return type -> tipo de retorno
- Cada step `->` -> chamada interna (pode ser metodo privado)
- Cada branch `|` -> condicional / early return
- Steps `@async` -> chamada assincrona / event dispatch
- `on EventName` -> registrar handler/listener que invoca este flow quando o evento ocorre (trigger reativo)
- `emits EventName` -> o flow emite o evento como side-effect apos execucao

### state -> State Machine
- Enum ref define os estados possiveis
- Cada transicao vira metodo ou handler
- Wildcard `*` -> "de qualquer estado"
- `@requires(role)` -> check de permissao antes da transicao
- Trigger `on EventName` -> registrar listener/handler para o evento
- Implementar padrao reativo: flow chama emit(Event) -> event handler dispara transicao de state
- Garantir que cada transicao de estado so ocorre via o evento correspondente (nao diretamente)

### event -> Evento de Dominio (server-side)
- Campos do event -> payload do evento
- Evento emitido por flow steps com `emit()`, ou por `emits EventName` em flows/operations

### signal -> Evento Client-Side (frontend)
- Campos do signal -> payload do sinal
- Implementar como custom event, event bus, observable, ou state management dispatch
- `@abstract` -> tipo base de sinal (nao usar diretamente)
- `extends BaseSignal` -> herda campos do pai
- Signals sao separados de events: signal = frontend/UI, event = backend/domain

### api -> Controller/Router
- `@prefix` -> prefixo de rota
- Cada endpoint -> handler de rota
- `@auth` -> middleware de autenticacao
- `@rate_limit` -> middleware de rate limiting
- `@cache` -> headers/middleware de cache
- Input type `(Type)` -> validacao de request body
- Return type `-> Type` -> formato de resposta
- `STREAM /path -> EventType` -> handler WebSocket ou SSE que entrega eventos ao cliente (sem input, read-only)
- `@external` -> API consumida de terceiro (Stripe, SendGrid, etc.): implementar como wrapper/adapter que chama o provider externo, NAO como route handler exposto

### rule -> Validacao de Negocio
- `when` -> condicao de guarda
- `then` -> acao (rejeitar, notificar, etc.)
- Implementar como middleware, decorator, ou validacao inline

### element -> Componente UI Reutilizavel (Building Block Universal)
O `element` e o building block universal de interface. Pode representar qualquer componente visual: pagina, modal, botao, tabela, card, indicador, timer, formulario.
- `prop nome: tipo` -> prop/attribute do componente
- `form NomeForm { ... }` -> formulario embutido (inputs)
- `@abstract` -> componente base (nao instanciavel diretamente)
- `@interface` -> contrato que outros elements devem implementar
- `extends Base` -> herda props e comportamento do pai
- `implements Interface` -> garante cumprimento do contrato

### screen -> Container de Elements
Screen e um container/composicao de elements, nao o nó principal de UI.
- `uses NomeElement -> alias` -> inclui element na tela
- `@layout(list|detail|form|dashboard|wizard)` -> intencao semantica do layout
- Screens agrupam elements; a logica visual vive nos elements

### action -> Interacao do Usuario
Quatro padroes mutuamente exclusivos:
- **Imperativa** (`calls METHOD /path`) -> botao/link que faz HTTP request ao endpoint
- **Reativa STREAM** (`on STREAM /path`) -> listener/subscription que reage a eventos em tempo real do STREAM endpoint
- **Reativa Signal** (`on SignalName`) -> handler que reage a sinal client-side (custom event, observable, etc.)
- **Pura** (sem calls, sem on) -> acao local como redirecionar, toggle estado, navegar
- `from ScreenName` -> tela de origem da acao
- `emits SignalName` -> action emite um sinal client-side apos executar
- `| outcome -> Screen` -> navegacao pos-resultado

### journey -> Rotas/Navegacao
- Cada step define uma transicao de tela
- `from -> to : on trigger` -> rota ou link de navegacao

### dep -> Dependencia Externa
- `@type(postgres)` -> configuracao de conexao
- `@optional` -> fallback quando indisponivel

### secret -> Variavel de Ambiente
- `@required` -> falhar no startup se ausente
- `@rotation(90d)` -> lembrete de rotacao

## Heranca e Interfaces — Mapping para Codigo

### @abstract -> Classe Base / Template
- `entity @abstract` -> classe base, schema abstrato, ou type com campos compartilhados (NAO instanciar diretamente)
- `flow @abstract` -> funcao/metodo base com steps reutilizaveis (template method pattern)
- `event @abstract` -> tipo de evento base com campos de metadata
- `signal @abstract` -> tipo de sinal base com campos compartilhados (frontend)
- `screen @abstract` -> componente base / layout template

### @interface -> Contrato / Interface
- `entity @interface` -> TypeScript interface, Go interface, ou abstract class puramente de contrato
- `component @interface` -> contrato de capacidade (ex: PaymentProvider)
- `flow @interface` -> assinatura + clausulas obrigatorias (on/emits) sem implementacao
- `screen @interface` -> contrato de elementos obrigatorios (forms)

### extends -> Heranca
- Filho herda todos os campos/steps do pai
- **Usar `resolvedFields` do contrato** (nao apenas `fields`) para obter campos herdados + proprios
- **Usar `resolvedSteps` do contrato** para obter steps herdados + proprios (com overrides aplicados)
- `override` em flow -> substituir metodo/funcao especifica do pai

### implements -> Implementacao de Interface
- Construto concreto DEVE fornecer todos os campos/operacoes declarados na interface
- `entity implements Timestamped` -> entidade DEVE ter `created_at` e `updated_at`
- `component implements PaymentProvider` -> DEVE ter `operation charge(...)`

## Fronteira de DTOs

Entity = dominio/persistencia. Parametro de flow/operation = DTO de entrada. Retorno = DTO de saida.

### Regras

- Na camada da API, nunca retornar entity crua se ela tem campos internos (ex: `password_hash`, `internal_score`)
- Se o modelo define `flow criar(Input) -> Output`, `Input` e `Output` sao os contratos — implementar tipos correspondentes
- Para listas: se API retorna `-> Item[]`, implementar com paginacao real mas tipo de item conforme modelo
- Se Input/Output e uma entity do modelo, OK — a simplificacao pragmatica e valida quando a entity nao tem campos internos
- Se precisa filtrar campos, criar tipo/interface dedicado na implementacao (nao precisa estar no modelo como entity separada)

### Exemplo

```typescript
// Modelo: flow criar_user(CreateUserInput) -> UserProfile | ValidationError

// DTO de entrada — corresponde a CreateUserInput do modelo
interface CreateUserInput {
  email: string;
  name: string;
  password: string;
}

// DTO de saida — corresponde a UserProfile do modelo (sem password_hash)
interface UserProfile {
  id: string;
  email: string;
  name: string;
}

// Entity no banco — campos internos nao expostos
interface User {
  id: string;
  email: string;
  name: string;
  password_hash: string;  // nunca retornado na API
}
```

## Modelagem de Erros na Implementacao

Tipo union no retorno (`-> Result | Error`) deve ser implementado com tratamento explicito de cada caminho de erro.

### Estrategias por linguagem

- **TypeScript**: discriminated unions, Result types (`{ ok: true, data } | { ok: false, error }`)
- **Go**: multiple returns (`result, err`)
- **Rust**: `Result<T, E>` nativo
- **Python**: exceptions tipadas ou Result pattern

### Regras

- Cada branch `| erro ->` no flow corresponde a um caminho de erro no codigo
- Rules (`when/then`) -> implementar como validacao que retorna o erro especifico, nao excecao generica
- Mapear erros do modelo para HTTP status codes na camada de API:

| Erro no Modelo | HTTP Status | Exemplo |
|----------------|-------------|---------|
| ErroValidacao | 400 Bad Request | Campo invalido, formato errado |
| ErroNaoEncontrado | 404 Not Found | Recurso nao existe |
| ErroConflito | 409 Conflict | Duplicidade, estado inconsistente |
| ErroNaoAutorizado | 401 Unauthorized | Token ausente/invalido |
| ErroProibido | 403 Forbidden | Sem permissao para acao |

### Exemplo

```typescript
// Modelo: flow criar_pedido(Input) -> Pedido | ErroValidacao | ErroConflito
// Branch: | invalido -> return ErroValidacao
// Branch: | duplicado -> return ErroConflito

type CriarPedidoResult =
  | { ok: true; data: Pedido }
  | { ok: false; error: ErroValidacao }
  | { ok: false; error: ErroConflito };

async function criarPedido(input: CriarPedidoInput): Promise<CriarPedidoResult> {
  const validacao = validar(input);
  if (!validacao.ok) return { ok: false, error: validacao.error }; // branch | invalido

  const duplicidade = await verificarDuplicidade(input);
  if (duplicidade) return { ok: false, error: new ErroConflito() }; // branch | duplicado

  const pedido = await persistir(input);
  await emit(new PedidoCriado(pedido));  // @async side-effect
  return { ok: true, data: pedido };
}

// Na camada da API: mapear para HTTP
app.post("/v1/pedidos", async (req, res) => {
  const result = await criarPedido(req.body);
  if (!result.ok) {
    if (result.error instanceof ErroValidacao) return res.status(400).json(result.error);
    if (result.error instanceof ErroConflito) return res.status(409).json(result.error);
  }
  return res.status(201).json(result.data);
});
```

## Piramide de Testes Derivada do Modelo

O modelo MFD define naturalmente a piramide de testes. Cada tipo de construto mapeia para um nivel de teste.

### Niveis

| Nivel | Construto MFD | Tipo de Teste | Prioridade |
|-------|--------------|---------------|------------|
| Base | `operation` | Unit tests | 1 (primeiro) |
| Integracao | `flow` | Integration tests | 2 |
| Contrato | `api` endpoints | Contract/API tests | 3 |
| E2E | `journey` | End-to-end tests | 4 (ultimo) |

### Detalhamento

- **Unit tests (operations)**: cada `operation` testada isoladamente — input -> output, sem dependencias externas. Mock de tudo. Rapidos, muitos.
- **Integration tests (flows)**: cada `flow` testado com sequence de steps real — dependencias de infra mockadas mas logica de orquestracao real. Valida branches de erro.
- **Contract tests (api)**: cada endpoint de `api` testado via HTTP — request -> response conforme modelo. Valida status codes, formatos, `@auth`, `@rate_limit`.
- **E2E tests (journeys)**: cada `journey` como cenario de teste — navegacao completa do usuario. Validam fluxo de ponta a ponta.

### Regras e state machines

- `rule` -> implementar como assertion/validacao dentro dos unit tests das operations que usam a rule
- `state` machine -> testar cada transicao valida E testar que transicoes invalidas sao rejeitadas

### Cobertura derivada do modelo

- Contar operations sem teste = gap em unit tests
- Contar flows sem teste = gap em integration tests
- Contar endpoints sem teste = gap em contract tests
- Contar journeys sem teste = gap em E2E

## Regras de Fidelidade ao Contrato

1. **Nao adicionar** campos, endpoints, ou fluxos que nao estao no modelo
2. **Nao omitir** nada que esta no modelo
3. **Nao renomear** — usar exatamente os nomes do modelo
4. **Decorators de validacao** devem ser implementados (nao ignorar @unique, @format, etc.)
5. **Tipos union** (`A | B`) devem ser representados (discriminated union, Result type, etc.)

## Apos Implementar — Regras de @impl

### Formato: caminhos de arquivo

O `@impl` aponta para os **arquivos** onde a implementacao vive. Sem `@impl` = construto pendente.

```mfd
entity User @impl(src/models/user.ts, src/migrations/001_user.sql) { ... }
flow create_user @impl(src/services/user.service.ts) { ... }
screen UserList @impl(src/components/UserList.tsx) { ... }
api @impl(src/routes/users.ts) @prefix(/v1/users) { ... }
enum Status @impl(src/types/status.ts) { ... }
```

- `@tests(unit)` — quando testes unitarios existem
- `@tests(integration)` — quando testes de integracao existem

### Valores antigos (DEPRECATED)

`done`, `backend`, `frontend`, `partial` sao deprecated. O validator emite `IMPL_DEPRECATED_VALUE` warning.
Substitua por caminhos reais: `@impl(done)` -> `@impl(src/models/user.ts, src/routes/user.ts)`

### Regras

1. Usar caminhos relativos a partir da raiz do projeto
2. Multiplos arquivos separados por virgula
3. Atualizar `@impl` **IMEDIATAMENTE** apos implementar cada construto — nao acumular em lote
4. O path deve apontar para o arquivo de implementacao real, nao definicoes de tipo ou wrappers

### Exemplo completo

```mfd
entity Cliente @impl(src/models/cliente.ts, src/migrations/001_cliente.sql) {
  id: uuid @unique
  nome: string
}

flow criar_cliente @impl(src/services/cliente.service.ts) {
  -> validar(input)
  -> persistir(cliente)
  return cliente
}

screen ListaClientes @impl(src/components/ListaClientes.tsx) {
  uses ClienteCard -> card
}

rule validar_email @impl(src/validators/email.ts) {
  when email is invalid
  then reject("Email invalido")
}

# Sem @impl = ainda nao implementado
api @prefix(/v1/clientes) {
  GET /clientes -> Cliente[]
}
```
