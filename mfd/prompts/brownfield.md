---
name: brownfield
mode: brownfield
description: Prompt para modo brownfield — extrair modelo MFD de codigo existente
---

# Modo Brownfield — Extrair Modelo MFD de Codigo Existente

Voce esta no modo brownfield. O objetivo e analisar um codebase existente (sem modelo MFD) e gerar um modelo `.mfd` descritivo com `@impl` pre-populado apontando para os arquivos de origem.

**Diferenca fundamental:** O modelo gerado e *descritivo* (o que o codigo faz agora), nao *prescritivo* (o que deveria fazer). O humano revisa e decide o que manter.

## Protocolo de Scan

Escanear o codebase camada por camada, na ordem abaixo:

| Ordem | O que procurar | Onde procurar (Glob patterns) | Construto MFD |
|-------|----------------|-------------------------------|---------------|
| 1 | DB schemas, ORM models, type definitions, interfaces | `**/models/**`, `**/entities/**`, `**/types/**`, `**/schema*`, `**/*.prisma`, `**/migrations/**` | `entity`, `enum` |
| 2 | Services, use-cases, handlers | `**/services/**`, `**/usecases/**`, `**/handlers/**`, `**/controllers/**` | `flow`, `operation` |
| 3 | Routes, API definitions | `**/routes/**`, `**/api/**`, `**/router*`, `**/controllers/**` | `api` |
| 4 | Event types, message payloads, pub/sub | `**/events/**`, `**/messages/**`, `**/subscribers/**`, `**/listeners/**` | `event`, `signal` |
| 5 | State machines, status transitions | (dentro de services/models — procurar patterns: `switch status`, state machine libs, enum de status com transicoes) | `state` |
| 6 | UI components | `**/components/**`, `**/pages/**`, `**/views/**`, `**/screens/**` | `screen`, `element`, `action` |
| 7 | Config, env vars, deps | `.env*`, `docker-compose*`, `package.json` (dependencies), config files | `dep`, `secret` |
| 8 | Directory structure = component boundaries | Top-level `src/` subdirs, monorepo packages, module dirs | `component` |

### Adaptacao por Tech Stack

- **Express/Fastify**: routes em `**/routes/**`, middleware em `**/middleware/**`
- **NestJS**: modules em `**/*.module.ts`, controllers em `**/*.controller.ts`, services em `**/*.service.ts`, DTOs em `**/*.dto.ts`
- **Django**: models em `**/models.py`, views em `**/views.py`, serializers em `**/serializers.py`, urls em `**/urls.py`
- **Rails**: models em `app/models/**`, controllers em `app/controllers/**`, routes em `config/routes.rb`
- **Spring**: entities em `**/*Entity.java`, controllers em `**/*Controller.java`, services em `**/*Service.java`
- **Next.js/Nuxt**: pages em `**/pages/**` ou `**/app/**`, API routes em `**/api/**`
- **FastAPI**: routers em `**/*router*.py`, models em `**/*model*.py` ou `**/*schema*.py`

## Regras de Extracao

### entity
- Extrair campo por campo do schema/model
- Mapear tipos da linguagem para tipos MFD:
  - `string`, `varchar`, `text`, `char` → `string`
  - `int`, `integer`, `float`, `double`, `decimal`, `bigint` → `number`
  - `boolean`, `bool` → `boolean`
  - `Date` (sem hora) → `date`
  - `Date` (com hora), `timestamp`, `datetime` → `datetime`
  - `uuid`, `UUID`, `ObjectId` → `uuid`
- Campos opcionais (`?` em TS, `Optional` em Python, `nullable` em DB) → `tipo?`
- Decorators: `@unique` para unique constraints, `@format(email)` para validacoes de email/url

### enum
- Extrair valores literais
- Manter nomes originais
- Se enum e usado por 2+ modulos → vai para `shared.mfd`

### flow vs operation
- Funcao com multiplos passos/chamadas sequenciais → `flow` (extrair steps como `-> nome_passo(args)`)
- Funcao atomica (1 responsabilidade, wrapper fino) → `operation`
- Se funcao chama endpoints externos → `operation` com `calls`
- Se funcao serve endpoint HTTP → `flow` com `handles`

### api
- Extrair de route definitions: metodo HTTP + path + input type + return type
- `@auth` se tem middleware de autenticacao
- `@prefix` do base path comum
- WebSocket/SSE endpoints → `STREAM`
- APIs de terceiros consumidas (Stripe, SendGrid) → `api @external`

### state
- Procurar enums de status + funcoes de transicao
- Patterns: `switch (status)`, libs de state machine (xstate, etc), campo `status` com validacao de transicao
- Mapear transicoes permitidas

### event / signal
- Event handlers, pub/sub patterns, message queues → `event`
- Client-side events (React context, event emitters no frontend) → `signal`

### screen / element / action
- Paginas/rotas de UI → `screen`
- Componentes reutilizaveis → `element`
- Handlers de interacao (submit, click → API call) → `action`

### component
- Cada modulo/dominio logico do projeto = 1 componente
- Usar estrutura de diretorios como guia principal
- Se ambiguo, perguntar ao humano

### dep / secret
- Dependencies em package.json/requirements.txt (apenas infra: DB, cache, queue) → `dep`
- Variaveis de ambiente em `.env*` → `secret`

### @impl — Pre-popular SEMPRE
Cada construto extraido DEVE ter `@impl` apontando para o arquivo de origem. Este e o diferencial do brownfield — o modelo ja nasce rastreado.

```mfd
entity User @impl(src/models/user.ts) { ... }
flow create_user @impl(src/services/user.service.ts) { ... }
api REST @impl(src/routes/users.ts) @prefix(/v1/users) { ... }
```

## Categorias de Extracao

Cada item encontrado no scan deve ser classificado:

| Categoria | Significado | Acao |
|-----------|-------------|------|
| **Capturado** | Extraido com confianca para um construto MFD | Incluir no modelo com `@impl` |
| **Ambiguo** | Encontrado no codigo mas classificacao incerta | Perguntar ao humano antes de incluir |
| **Inferido** | Construto nao explicito no codigo mas implicito nas relacoes (ex: state machine inferida de campo `status` + metodos de transicao) | Incluir com comentario `# Inferido de <arquivo>` |
| **Ignorado** | Detalhe de implementacao, nao pertence ao modelo (helpers, utils, configs de build, tipos internos) | Listar em comentario no topo do arquivo |

## Checklist de Completude

Apos extracao, verificar:

- [ ] Toda entidade tem pelo menos `id` ou campo @unique
- [ ] Todo enum referenciado por state existe
- [ ] Todos os estados nas transicoes pertencem ao enum
- [ ] Todo flow tem pelo menos um step
- [ ] Toda API tem @prefix definido
- [ ] Todo endpoint protegido tem @auth
- [ ] Todo STREAM endpoint tem tipo de retorno (evento declarado)
- [ ] Todo STREAM endpoint NAO tem input type (read-only)
- [ ] Todo dep tem @type definido
- [ ] Todo secret critico tem @required
- [ ] Entidades gerenciadas ficam no componente gerenciador (Principio de Propriedade)
- [ ] Nenhum componente e God Core (60%+ dos construtos centralizados)

## Estrutura Multi-Arquivo

Para projetos com 3+ componentes ou modelo com 200+ linhas, gerar estrutura multi-arquivo:

```
model/
  main.mfd              # system "Nome" + imports (entry point)
  shared.mfd            # Vocabulario Compartilhado: enums, @abstract, @interface (opcional)
  protocolo.mfd         # Componente Protocolo: events de integracao (opcional)
  <componente>.mfd      # Um arquivo por componente (kebab-case)
```

### Padroes de Compartilhamento

```
enum compartilhado?              -> shared.mfd (sem component)
entity @abstract ou @interface?  -> shared.mfd (sem component)
entity concreta (gerenciada)?    -> <componente-gerenciador>.mfd
event/signal de integracao?      -> protocolo.mfd (component Protocol)
event/signal interno?            -> <componente>.mfd
state machine de integracao?     -> protocolo.mfd (component Protocol)
state machine local?             -> <componente>.mfd
flow/operation/rule/api?         -> SEMPRE <componente>.mfd
screen/action/journey/element?   -> SEMPRE <componente>.mfd
```

## Padrao de Resposta

1. Resumo do tech stack detectado
2. Mapa de componentes identificados (diretorio → componente)
3. Construtos extraidos por categoria (Capturado / Ambiguo / Inferido / Ignorado)
4. Resolucao de ambiguidades com o humano
5. Modelo .mfd gerado com `@impl` pre-populado
6. Validacao automatica (`mfd validate`) + correcao
7. Stats (`mfd stats`)
8. Tabela de rastreabilidade: construto → arquivo @impl
9. Sugestoes de proximos passos
