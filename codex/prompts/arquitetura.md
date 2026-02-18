---
name: arquitetura
mode: architecture
description: Prompt para guideline arquitetural — mapear construtos MFD para camadas e padroes de implementacao
---

# Guideline Arquitetural MFD

Diretrizes para mapear construtos MFD para camadas de arquitetura, padroes de comunicacao e decisoes de design.

## Mapeamento Construtos -> Camadas

```
api          -> Boundary / Controllers / Routes
flow         -> Application / Use Cases / Orchestration
operation    -> Domain Services / Atomic Logic
entity       -> Domain Models / Aggregates
rule         -> Domain Invariants / Validators
event        -> Domain Events (server-side)
signal       -> UI Events (client-side)
screen       -> Views / Pages (containers)
element      -> UI Components (building blocks)
action       -> UI Commands / Handlers
dep          -> Infrastructure / Adapters
secret       -> Configuration / Environment
```

**Principio de camadas:** cada camada so conhece a camada imediatamente abaixo. `api` -> `flow` -> `operation` -> `entity`. Nunca pular camadas.

- Um endpoint de `api` delega para um `flow` ou `operation` — nunca acessa `entity` diretamente
- Um `flow` orquestra `operations` e acessa `entities` — nunca lida com HTTP
- Uma `operation` executa logica atomica sobre `entities` — sem orquestracao
- Uma `entity` e puro dominio — sem dependencia de infraestrutura

## Comunicacao por Topologia de Deploy

### Mesmo processo (monolito)

- Flow step chama operation/flow de outro componente diretamente
- `dep -> OutroComponente` documenta o acoplamento
- Sem HTTP, sem serializacao — chamada de funcao
- Entity pode ser passada diretamente entre componentes

### Processos separados (microservicos)

- Comunicacao sincrona: `calls METHOD /path` (operation consome API do outro)
- Comunicacao assincrona: `emits`/`on` (eventos de integracao)
- API do servico remoto modelada como `api @external`
- Entity NUNCA compartilhada — usar DTOs na fronteira

### Como saber qual topologia?

- `dep -> X @type(internal)` ou sem `@type` = mesmo processo
- `dep -> X @type(http)` / `@type(grpc)` = processo separado
- `dep -> X @type(postgres)` / `@type(redis)` = infraestrutura

## DTOs como Fronteira

- **Entity** = shape do dominio/banco (campos reais, relacoes, validacoes)
- **Input DTO** = parametro de flow/operation (o que a API recebe)
- **Output DTO** = retorno de flow/operation (o que a API devolve)

### Regras

1. Nunca expor entity crua na resposta da API se ela tem campos internos (ex: `password_hash`)
2. O tipo no parametro do flow/operation E o DTO — nao precisa criar construto separado, basta que o tipo do param nao seja a entity diretamente
3. Se `flow criar_pedido(CriarPedidoInput) -> Pedido`, o `CriarPedidoInput` e o DTO de entrada e `Pedido` e aceitavel como retorno se for a entity (simplificacao pragmatica)
4. Para transformacoes complexas, criar entity separada como DTO: `entity PedidoResumo { ... }`

### Exemplo

```mfd
# Entity com campos internos
entity User {
  id: uuid @unique
  email: string @format(email)
  password_hash: string        # campo interno — nao expor
  name: string
}

# DTO de entrada (param do flow)
flow criar_user(CreateUserInput) -> UserProfile | ValidationError {
  -> validar(input)
  -> persistir(user)
  -> emit(UserCriado) @async
  return profile
}

# Se necessario, DTO de saida como entity separada
entity UserProfile {
  id: uuid
  email: string
  name: string
  # Sem password_hash
}
```

## Componente = Bounded Context

- Cada `component` e potencialmente um bounded context DDD
- `dep` declara dependencias explicitas entre contextos
- Sem referencia cruzada implicita — se A usa algo de B, precisa de `dep -> B`
- Dentro do componente: coesao alta, tudo junto
- Entre componentes: acoplamento baixo, comunicacao via API ou eventos

### Quando dividir componentes

- Cada componente gerencia seu proprio ciclo de vida de entidades
- Se dois grupos de entidades mudam por razoes diferentes, provavelmente sao componentes diferentes
- Se um componente depende de outro apenas via 1-2 eventos, sao bons candidatos a separacao

## Direcao de Dependencias

```
screens/actions -> flows -> operations -> entities
                     |
               events (side effects)
                     |
            other components (via dep)
```

- **Flows orquestram**, operations executam
- **Entities nao dependem de nada** (puro dominio)
- **Events sao fire-and-forget** — emitidos como side-effect, consumidos reativamente
- **Rules sao guards** — chamadas dentro de flows, antes da logica
- **Screens compoem elements** — elements sao reutilizaveis, screens sao contextuais
- **Actions conectam UI a backend** — via `calls` (imperativo) ou `on` (reativo)

## Modelagem de Erros

### Principio: erros explicitos no contrato

- Modelar erros como tipos explicitos no retorno: `flow criar(Input) -> Output | ErroValidacao | ErroConflito`
- Cada tipo de erro e uma entity ou enum no modelo
- Nunca `-> void` com excecao implicita — o contrato deve declarar os caminhos de erro
- Branches no flow (`| erro ->`) correspondem a cada tipo de erro do retorno

### Exemplo

```mfd
enum ErroTipo { validacao, conflito, nao_encontrado }

entity ErroValidacao {
  tipo: ErroTipo
  campo: string
  mensagem: string
}

flow criar_pedido(CriarPedidoInput) -> Pedido | ErroValidacao | ErroConflito {
  -> validar(input)
  | invalido -> return ErroValidacao
  -> verificar_duplicidade(input)
  | duplicado -> return ErroConflito
  -> persistir(pedido)
  -> emit(PedidoCriado) @async
  return pedido
}
```

### Mapeamento erro -> HTTP status

| Tipo de Erro | HTTP Status | Quando |
|-------------|-------------|--------|
| Validacao | 400 Bad Request | Input invalido, formato errado |
| NaoEncontrado | 404 Not Found | Recurso nao existe |
| Conflito | 409 Conflict | Duplicidade, estado inconsistente |
| NaoAutorizado | 401 Unauthorized | Sem autenticacao |
| Proibido | 403 Forbidden | Sem permissao |
| Interno | 500 Internal Server Error | Erro inesperado |

## Padrao Reativo: Events e State Machines

### Fluxo

```
Flow executa logica
  -> emits EventName
    -> State machine reage: on EventName
    -> Outros flows reagem: on EventName
    -> Outros componentes reagem: on EventName (via Protocol)
```

### Regras

1. Flows emitem events como side-effects (`emits` ou `-> emit(Event) @async`)
2. State machines transitam via `on EventName` — nunca transicao direta
3. Outros flows podem reagir a events via `on EventName` (trigger reativo)
4. Events de integracao (cross-component) ficam no `component Protocol`
5. Events internos (single component) ficam no proprio componente
