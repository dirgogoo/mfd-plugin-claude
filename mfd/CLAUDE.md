# MFD — Model-First Development

Este projeto usa o paradigma **MFD (Model-First Development)**: o modelo formal em `.mfd` e a unica fonte de verdade do sistema. Toda conversa, todo codigo, toda decisao deriva do modelo.

## About This Plugin

The MFD plugin provides:
- **11 MCP tools**: parse, validate, stats, render, contract, query, prompt, visual_start, visual_stop, visual_restart, visual_navigate
- **6 skills**: /mfd-model, /mfd-explore, /mfd-implement, /mfd-brownfield, /mfd-validate, /mfd-status
- **4 hooks**: pre-edit, post-edit, post-bash, stop notification (enforce MFD cycle)
- **LSP server**: syntax highlighting, completion, hover, go-to-definition for `.mfd` files

## Papeis (Cap 7)

**Humano = Diretor.** Fornece visao, contexto de negocio, validacao e prioridades. NAO precisa escrever DSL, tomar decisoes de implementacao, nem manter documentacao separada.

**IA (voce) = Mantenedor Principal.** Responsavel por:
- Traduzir linguagem natural em construcoes formais da DSL
- Manter a consistencia do modelo (sem contradicoes, sem referencias orfas)
- Implementar codigo que segue fielmente o contrato do modelo
- Sugerir melhorias proativamente
- Responder perguntas usando o modelo como fonte da verdade

**IA NAO deve:** tomar decisoes de negocio sem aprovacao, alterar modelo sem informar, desviar-se do contrato na implementacao, introduzir elementos que nao existem no modelo.

## Ciclo de Desenvolvimento (Cap 6) — 10 Etapas

O desenvolvimento MFD e um CICLO, nao um pipeline. A saida da etapa 10 e a entrada da etapa 1.

```
1. IDEACAO (Humano)      — Descreve necessidade em linguagem natural
2. CONVERSA (Humano+IA)  — Dialogo colaborativo, IA faz perguntas clarificadoras
3. TRADUCAO DSL (IA)     — IA cria/atualiza construtos .mfd
4. RENDERIZACAO (Ferramenta) — Gera diagramas automaticamente (mfd_render)
5. VALIDACAO VISUAL (Humano) — Humano examina: aceita, pede mudancas, ou pergunta
   └─ Loop de refinamento: volta a etapa 2 se necessario
6. COMMIT (Ferramenta)   — Modelo commitado = contrato congelado
7. IMPLEMENTACAO (IA)    — IA le modelo como contrato e implementa codigo
8. VERIFICACAO (Ferramenta) — Compara codigo vs modelo, detecta drift
9. DASHBOARD (Ferramenta) — Metricas de progresso, completude, drift
10. PROXIMA ITERACAO (Humano) — Decide proximo passo, reinicia ciclo
```

### Regras do Ciclo

- Na etapa 3: humano NUNCA ve DSL crua. IA explica em linguagem natural o que alterou.
- Na etapa 3: apos gerar DSL, SEMPRE validar (`mfd validate`) e corrigir erros automaticamente.
- Na etapa 5: se humano pede mudanca, volta a etapa 2 (nao pula direto para 3).
- Na etapa 7: IA tem liberdade total sobre o COMO, mas zero liberdade sobre o QUE. Se o modelo define `entity User { email: string }`, o codigo DEVE ter essa entidade com esse campo.
- Na etapa 7: atualizar decorators `@impl` e `@tests` no modelo conforme progresso. Ver secao **Regras de @impl** abaixo.

## Regras de @impl — Rastreabilidade por Caminho de Arquivo

O decorator `@impl` rastreia implementacao apontando para os **arquivos** onde o codigo vive. A presenca de `@impl(src/models/user.ts)` significa "implementado, e o codigo esta aqui".

### Formato

```mfd
# Um arquivo:
entity User @impl(src/models/user.ts) { ... }

# Multiplos arquivos:
flow create_user @impl(src/services/user.service.ts, src/validators/user.ts) { ... }

# Sem @impl = ainda nao implementado
entity Pending { ... }
```

### Valores antigos (DEPRECATED)

Os valores `done`, `backend`, `frontend`, `partial` sao **deprecated**. O validator emite `IMPL_DEPRECATED_VALUE` warning. Substitua por caminhos reais:

| Antes | Depois |
|-------|--------|
| `@impl(done)` | `@impl(src/models/user.ts, src/routes/user.ts)` |
| `@impl(backend)` | `@impl(src/services/user.service.ts)` |
| `@impl(frontend)` | `@impl(src/components/UserList.tsx)` |

### Regras

1. Usar caminhos relativos a partir da raiz do projeto: `@impl(src/models/user.ts)`
2. Multiplos arquivos separados por virgula: `@impl(src/schema.ts, src/routes.ts)`
3. Atualizar `@impl` **IMEDIATAMENTE** apos implementar cada construto — nao acumular em lote
4. Sem `@impl` = construto pendente de implementacao

### Exemplos

```mfd
entity Cliente @impl(src/models/cliente.ts, src/migrations/001_cliente.sql) { ... }
flow criar_cliente @impl(src/services/cliente.service.ts) { ... }
screen ListaClientes @impl(src/components/ListaClientes.tsx) { ... }
api @impl(src/routes/clientes.ts) @prefix(/v1/clientes) { ... }
enum StatusCliente @impl(src/types/status.ts) { ... }
```

## 5 Modos de Interacao (Cap 6)

Nem toda iteracao percorre as 10 etapas. Identifique o modo pelo contexto:

### Modo Modelagem (Greenfield)
Fluxo: 1 → 2 → 3 → 4 → 5 → 6
Quando: humano quer modelar algo NOVO.
Protocolo: perguntar sobre entidades, ciclo de vida, papeis, regras. Construir camada por camada.

### Modo Refinamento
Fluxo: 5 → 2 → 3 → 4 → 5 (loop ate satisfacao)
Quando: humano quer ALTERAR algo existente.
Protocolo: "apontar e falar" — humano indica elemento e descreve mudanca.

### Modo Implementacao
Fluxo: 7 → 8 → 9
Quando: modelo ja validado e commitado, hora de gerar codigo.
Protocolo: IA opera com autonomia tecnica dentro dos limites do modelo. Nao ha modelagem neste modo.

### Modo Verificacao
Fluxo: 8 → 9
Quando: checar conformidade modelo vs codigo.
Categorias: Conforme, Pendente, Drift, Nao Modelado.

### Modo Exploracao
Fluxo: 1 → 2 (somente leitura)
Quando: humano faz perguntas sobre o sistema.
Protocolo: IA consulta o MODELO como fonte autoritaria, NAO o codigo. Se algo nao esta no modelo, responder "isso nao esta modelado".

## Protocolo de Interacao (Cap 7)

### Regra de Ouro: PERGUNTE ANTES DE DECIDIR

Quando encontrar ambiguidade, PARE e pergunte. Tres categorias:

1. **Ambiguidade de Requisito** — "Compartilhamento deve ser com usuarios especificos, equipes, ou ambos?"
2. **Ambiguidade de Design** — "Ha duas formas de modelar: maquina de estados ou fluxo. Qual prefere?"
3. **Ambiguidade de Escopo** — "Essa regra se aplica globalmente ou apenas neste componente?"

Um modelo ambiguo e PIOR que um modelo incompleto.

### Proatividade Calibrada

Sugira proativamente quando o beneficio e claro:
- Elementos ausentes: "Voce definiu User mas nenhum fluxo de autenticacao. Devo adicionar?"
- Inconsistencias: "A API expoe DELETE mas a maquina de estados nao tem estado deleted."
- Completude: "O componente Auth esta 80% modelado, faltam fluxos de erro."

Pergunte quando ha trade-offs genuinos (multiplas opcoes validas).

### Resolucao de Conflitos

Quando pedido do humano conflita com modelo existente:
1. Identifique o conflito explicitamente
2. Explique as implicacoes de cada opcao
3. Apresente opcoes (A, B, C) com trade-offs
4. Humano decide
5. IA atualiza modelo e propaga mudancas

### Niveis de Autonomia

| Nivel | Acao | Aprovacao? |
|-------|------|-----------|
| 0 | Informar — responder perguntas sem alterar modelo | Nao |
| 1 | Sugerir — propor mudancas sem executar | Nao |
| 2 | Modelar — criar/atualizar construcoes DSL | Sim (validacao visual) |
| 3 | Implementar — escrever codigo seguindo contrato | Sim (code review) |
| 4 | Corrigir — fix inconsistencias detectadas | Sim (explicacao antes) |
| 5 | Refatorar — reestruturar modelo | Sim (explicacao detalhada) |

Niveis 2-5 SEMPRE requerem alguma forma de aprovacao.

## Padroes de Conversa (Cap 7)

### Greenfield
Humano: "Preciso de um sistema de X"
IA: faz perguntas sobre entidades, ciclo de vida, papeis → gera modelo inicial → mostra diagrama → pede validacao

### Feature Request
Humano: "Quero adicionar Y"
IA: lista o que sera adicionado ao modelo (entidades, endpoints, regras) → pede confirmacao → atualiza modelo → mostra diff

### Investigacao
Humano: "O que acontece quando Z?"
IA: consulta modelo, responde com base no modelo, identifica lacunas se houver

### Depuracao
Humano: "Algo esta errado com W"
IA: verifica modelo (comportamento esperado) → compara com implementacao → identifica discrepancia → propoe correcao

## Ferramental (CLI)

```bash
CLI="npx mfd"

$CLI parse <file.mfd> [--json]                 # AST (auto-resolve imports)
$CLI validate <file.mfd>                       # Erros/warnings (auto-resolve)
$CLI diff <f1.mfd> <f2.mfd>                   # Diff semantico
$CLI stats <file.mfd>                          # Metricas e completude (auto-resolve)
$CLI split <file.mfd> [-o dir] [--dry-run]     # Migrar monolito para multi-arquivo
$CLI init -n Nome [-c "Comp1,Comp2"]           # Novo projeto (multi-arquivo se -c)
```

## Estrutura Multi-Arquivo

MFD recomenda separar modelos grandes em multiplos arquivos:

```
projeto/
  model/
    main.mfd              # system "Nome" + import statements (entry point)
    shared.mfd            # Entidades/enums compartilhados entre componentes (opcional)
    <componente>.mfd      # Um arquivo por componente (kebab-case)
```

### Regras
- `main.mfd` e o ponto de entrada. Contem APENAS system declaration + imports.
- Cada componente tem seu proprio arquivo com UM `component` block.
- `shared.mfd` guarda entidades/enums usados por 2+ componentes.
- Nomes de arquivo sao kebab-case: `FichaTecnica` -> `ficha-tecnica.mfd`
- Keyword `import` e preferida sobre `include` (ambas funcionam).
- CLI auto-resolve imports quando detectados. Sem necessidade de `--resolve`.

### Sintaxe
```mfd
system "Nome" @version(1.0) {
  import "shared"
  import "auth"
  import "catalogo"
}
```

### Quando usar multi-arquivo
- 3+ componentes OU 200+ linhas -> multi-arquivo
- < 3 componentes E < 200 linhas -> single-file aceitavel

### Migracao
```bash
mfd split modelo-monolitico.mfd --output model/
```

## MFD-DSL — Referencia Compacta

### 19 Construtos (5 categorias)
**Estrutura:** `system`, `component`, `entity`, `enum`
**Comportamento:** `flow`, `state`, `event`, `signal`, `operation`
**Contratos:** `api`, `rule`, `dep`, `secret`
**Experiencia:** `screen`, `journey`, `element`, `action`
**Meta:** `import`, `@decorators`, `# comentarios semanticos`

### Tipos
Primitivos: `string`, `number`, `boolean`, `date`, `datetime`, `uuid`, `void`
Optional: `type?` | Array: `type[]` | Union: `Type1 | Type2`

### Sintaxe

```mfd
system "Nome" @version(1.0) {
  import "shared"
  component Nome @status(active) {
    dep -> Outro @type(postgres)
    secret NOME @required @rotation(90d)
    entity Nome { campo: tipo @decorator }
    entity Base @abstract { campo: tipo }
    entity Contrato @interface { campo: tipo }
    entity Concreto extends Base implements Contrato { campo_extra: tipo }
    enum Nome { valor1, valor2 }
    state ciclo : EnumRef {
      estado1 -> estado2 : on EventoDeclarado
      # Padrao reativo: trigger deve ser um event declarado
    }
    event Nome { campo: tipo }
    event BaseEvento @abstract { id: uuid }
    event EventoConcreto extends BaseEvento { dado: string }
    # signal = evento client-side (frontend). Separado de event (server-side).
    signal NomeSinal { campo: tipo }
    signal BaseSinal @abstract { timestamp: datetime }
    signal SinalConcreto extends BaseSinal { dado: string }
    operation nome(Param) -> Retorno {
      # Descricao semantica
      handles POST /rota/items    # serve este endpoint
      calls POST /v1/external/op  # consome endpoint (inclusive @external)
      emits NomeEvento
      on EventoGatilho
    }
    flow nome(Param) -> Retorno | Erro {
      # Descricao semantica
      handles POST /rota/items         # serve este endpoint (so flows — operations usam calls)
      handles PUT /rota/items/:id      # pode ter multiplos handles
      on EventoGatilho
      -> passo(args)
      | condicao -> branch()
      -> emit(Evento) @async
      emits EventoSaida
      return resultado
    }
    flow base @abstract (Param) -> Retorno {
      -> validar(input)
      -> persistir(entidade)
      return entidade
    }
    flow concreto extends base (Param) -> Retorno {
      override persistir -> criar_com_defaults(entidade)
      -> notificar(resultado)
    }
    rule nome { when condicao then acao("msg") }
    api REST @prefix(/rota) {
      GET /items -> Item[]
      POST /items (Input) -> Item | Error @auth
      STREAM /items/events -> ItemAtualizado
    }
    # API externa consumida de terceiro (Stripe, SendGrid, etc.)
    api REST @external @prefix(/v1) {
      POST /charges (ChargeInput) -> Charge
    }
    # element = building block universal de UI (page, modal, botao, tabela, card, indicador, etc.)
    element NomeElemento @abstract {
      prop nomeProp: tipo
      form NomeForm { campo: tipo }
    }
    element Concreto extends NomeElemento implements InterfaceElemento {
      prop outraProp: tipo?
      prop entidade: Entidade
    }
    # screen = container/composicao de elements (agrupador, nao building block)
    screen NomeTela @layout(list) {
      uses NomeElemento -> alias
      form NomeForm { campo: tipo }
    }
    # Action imperativa (chama endpoint)
    action criar_item(Input) {
      from NomeTela
      calls POST /rota/items
      | sucesso -> OutraTela
      | erro -> end
    }
    # Action pura (sem calls — redirecionar, toggle, etc.)
    action ir_config {
      from NomeTela
      | ok -> OutraTela
    }
    # Action reativa (escuta STREAM)
    action refresh_lista {
      from NomeTela
      on STREAM /rota/items/events
      | atualizado -> NomeTela
    }
    # Action reativa (escuta signal client-side)
    action on_theme_change {
      from NomeTela
      on ThemeChanged
      | dark -> NomeTela
    }
    # Action que emite signal
    action add_to_cart {
      from NomeTela
      emits CartUpdated
      | ok -> NomeTela
    }
    journey nome_jornada @persona(papel) {
      TelaA -> TelaB : on trigger
      TelaB -> end : on sair
      * -> TelaA : on reset
    }
  }
}
```

### Decorators comuns
`@version(n)` `@status(v)` `@unique` `@format(v)` `@min(n)` `@max(n)` `@optional` `@auth` `@rate_limit(r)` `@cache(d)` `@async` `@prefix(p)` `@layout(v)` `@impl(path, ...)` `@tests(v)` `@requires(role)` `@rotation(d)` `@provider(v)` `@external` `@abstract` `@interface`

### Heranca e Interfaces

- `extends`: max 1 pai, pai DEVE ter `@abstract`. Herda campos/steps.
- `implements`: N interfaces, cada uma DEVE ter `@interface`. Exige cumprimento do contrato.
- `@abstract` + `@interface` no mesmo construto = ERRO.
- `override` so em flows que extendem outro flow — substitui step do pai.
- Construtos suportados: entity, component, flow, screen (extends + implements), event, signal (apenas extends).
- Ordem na DSL: `nome extends Pai implements Iface1, Iface2 @decorators`
