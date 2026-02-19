---
name: testes
mode: testing
description: Prompt para modo teste — gerar testes a partir do contrato MFD
---

# Modo Teste

O modelo MFD contem toda a especificacao necessaria para gerar testes. Cada construto MFD mapeia diretamente para um padrao de teste.

## Regra Fundamental

**Zero liberdade sobre O QUE testar (modelo define), total liberdade sobre COMO testar (framework, assertions, fixtures).**

Se o modelo define `journey buscar_e_emprestar @persona(usuario)`, os testes DEVEM cobrir esse journey com esse persona. A escolha de Playwright vs Cypress vs outro framework e sua.

## Piramide de Testes Derivada do Modelo

| Nivel | Construto MFD | Tipo de Teste | Prioridade |
|-------|--------------|---------------|------------|
| Base | `operation` | Unit tests | 1 (primeiro) |
| Integracao | `flow` | Integration tests | 2 |
| Contrato | `api` endpoints | Contract/API tests | 3 |
| E2E | `journey` | End-to-end tests | 4 (ultimo) |

## Mapping Construto -> Padrao de Teste

### journey -> Test Suite E2E

```mfd
journey buscar_e_emprestar @persona(usuario) {
  CatalogoPesquisa -> DetalheDoLivro : on selecionar_livro
  DetalheDoLivro -> MeusEmprestimos : on emprestar_livro
  MeusEmprestimos -> end : on sair
}
```

**Mapeamento:**
- `journey` = `test.describe('journey_name')`
- `@persona(X)` = setup de autenticacao (storageState, token, etc.)
- Cada step `A -> B : on trigger` = um `test('from A to B on trigger')`
- `-> end` = fim do cenario, assertions de cleanup

**Playwright:**
```typescript
test.describe('journey: buscar_e_emprestar', () => {
  test.use({ storageState: authAs('usuario') });

  test('CatalogoPesquisa -> DetalheDoLivro on selecionar_livro', async ({ page }) => {
    const catalogo = new CatalogoPesquisaPage(page);
    await catalogo.goto();
    await catalogo.selecionarLivro(fixture.livroId);
    const detalhe = new DetalheDoLivroPage(page);
    await detalhe.assertVisible();
  });
});
```

### action -> Test Step (ponte UI <-> API)

```mfd
action acao_emprestar(EmprestimoInput) {
  from DetalheDoLivro
  calls POST /biblioteca/emprestimos
  | sucesso -> MeusEmprestimos
  | erro -> DetalheDoLivro
}
```

**Mapeamento:**
- `from DetalheDoLivro` = precondition: usuario esta nesta tela
- `calls POST /path` = `page.waitForResponse('**/path')` / API call assertion
- `| sucesso -> MeusEmprestimos` = assertion: navega para tela no sucesso
- `| erro -> DetalheDoLivro` = assertion: permanece na tela no erro

**Gera 2 test cases minimo:** happy path (sucesso) + error path (erro).

### screen + form -> Page Object

```mfd
screen CatalogoPesquisa @layout(list) {
  uses CardLivro -> card
  form BuscaForm { termo: string }
}
```

**Mapeamento:**
- `screen` = Page Object class
- `@layout(list)` = hint de layout (lista, form, detail, etc.)
- `uses CardLivro -> card` = componente disponivel na pagina
- `form BuscaForm { campo: tipo }` = `page.fill('[name="campo"]', value)`

**Playwright:**
```typescript
class CatalogoPesquisaPage {
  constructor(private page: Page) {}

  async goto() { await this.page.goto('/catalogo'); }
  async assertVisible() { await expect(this.page.locator('[data-page="CatalogoPesquisa"]')).toBeVisible(); }

  get buscaForm() {
    return {
      preencher: async (data: { termo: string }) => {
        await this.page.fill('[name="termo"]', data.termo);
      }
    };
  }
}
```

### flow -> Integration Test Spec

```mfd
flow emprestar_livro(EmprestimoInput) -> Emprestimo | Erro {
  -> autenticar(usuario)
  | nao_autorizado -> return erro_auth
  -> validar(input)
  | invalido -> return erro_validacao
  -> verificar_disponibilidade(livro_id)
  | indisponivel -> return erro_disponibilidade
  -> salvar(Emprestimo)
  -> emit(EmprestimoRealizado) @async
  return emprestimo
}
```

**Mapeamento:**
- 1 happy path (caminho sem branches) = test case positivo
- Cada `| condicao -> return erro` = 1 test case negativo
- `-> emit(Evento) @async` = mock/spy no event emitter

**Total: 1 happy path + N error branches = N+1 cenarios minimo.**

### state -> Matriz de Transicoes

```mfd
state ciclo_emprestimo : StatusEmprestimo {
  ativo -> devolvido : on EmprestimoDevolvido
  ativo -> atrasado : on EmprestimoAtrasado
  atrasado -> devolvido : on EmprestimoDevolvido
}
```

**Mapeamento:**
- Transicoes declaradas = testes positivos (deve transitar)
- Combinacoes NAO declaradas = testes negativos (deve rejeitar)
- Exemplo: `devolvido -> ativo` nao esta declarada = teste de que essa transicao e rejeitada

### rule -> Assertion Direta

```mfd
rule limite_emprestimo {
  when emprestimos_ativos(usuario) >= 5
  then rejeitar("Limite de emprestimos atingido")
}
```

**Mapeamento:**
- `when` = setup do teste (criar estado que satisfaca a condicao)
- `then` = assertion (verificar que a acao e executada)

### operation -> Unit Test

```mfd
operation calcular_multa(Emprestimo) -> number {
  # Calcula multa por atraso: R$1,00/dia
  handles GET /emprestimos/:id/multa
  on EmprestimoAtrasado
}
```

**Mapeamento:**
- Cada operation = 1 test suite unitario
- Testar com inputs validos e invalidos
- Testar que `handles` responde no endpoint correto
- Testar que `on Event` reage ao evento

### api -> Contract/API Test

```mfd
api REST @prefix(/biblioteca) {
  GET /livros -> Livro[]
  POST /emprestimos (EmprestimoInput) -> Emprestimo | Erro @auth
  STREAM /emprestimos/events -> EmprestimoAtualizado
}
```

**Mapeamento:**
- Cada endpoint = 1+ test cases de contrato
- `@auth` = testar com e sem autenticacao
- Input types = schema de request body
- Response types = schema de response body
- `STREAM` = testar conexao SSE/WebSocket

### element -> Component Test

```mfd
element CardLivro extends CardBase {
  prop livro: Livro
  prop onSelect: void
}
```

**Mapeamento:**
- Props tipadas = test fixtures
- Events (callbacks) = spy assertions
- `extends` = testar comportamento herdado

## Geracao de Fixtures

Fixtures sao gerados a partir dos tipos de `entity` e `enum`:

### Regras de Fixture por Tipo

| Tipo MFD | Valor de Fixture |
|----------|-----------------|
| `string` | `"test_<fieldName>"` |
| `string @format(email)` | `"test@example.com"` |
| `string @format(url)` | `"https://example.com"` |
| `number` | `42` (ou respeitar @min/@max) |
| `boolean` | `true` |
| `uuid` | `"00000000-0000-0000-0000-000000000001"` |
| `date` | `"2024-01-01"` |
| `datetime` | `"2024-01-01T00:00:00Z"` |
| `EnumRef` | Primeiro valor do enum |
| `Type?` (optional) | `null` para teste negativo, valor para positivo |
| `Type[]` (array) | `[fixture_for_Type]` |

### Regras de Fixture por Decorator

| Decorator | Efeito no Fixture |
|-----------|------------------|
| `@min(N)` | Valor >= N |
| `@max(N)` | Valor <= N |
| `@unique` | Sufixo unico (timestamp ou counter) |
| `@format(email)` | Email valido |
| `@format(url)` | URL valida |

## Estrategia para Testes Reativos

### STREAM endpoints
```mfd
action refresh_lista {
  from NomeTela
  on STREAM /rota/items/events
  | atualizado -> NomeTela
}
```
- Testar que a pagina se inscreve no stream
- Simular evento do servidor
- Assertar que a UI reage ao evento

### Signals (client-side)
```mfd
action on_theme_change {
  from NomeTela
  on ThemeChanged
  | dark -> NomeTela
}
```
- Emitir signal programaticamente
- Assertar que a action e disparada
- Assertar resultado esperado

## Workflow de Geracao

1. **Obter contrato de teste:** `mfd_test_contract file="model.mfd" level="e2e"`
2. **Para cada journey:** criar arquivo de teste + page objects + fixtures
3. **Para cada flow:** criar arquivo de teste de integracao
4. **Para cada operation:** criar arquivo de teste unitario
5. **Para cada api:** criar arquivo de teste de contrato
6. **Executar testes:** framework escolhido pelo usuario
7. **Atualizar modelo:** `@tests(path/to/test.ts)` via `mfd_trace`

## Estrutura de Arquivos de Teste

```
tests/
  e2e/
    journeys/
      buscar-e-emprestar.spec.ts      # 1 arquivo por journey
    pages/
      catalogo-pesquisa.page.ts        # 1 page object por screen
      detalhe-do-livro.page.ts
    fixtures/
      emprestimo.fixture.ts            # 1 fixture por entity usada
  integration/
    flows/
      emprestar-livro.test.ts          # 1 arquivo por flow
  unit/
    operations/
      calcular-multa.test.ts           # 1 arquivo por operation
  api/
    biblioteca.test.ts                 # 1 arquivo por api block
```

## Atualizacao do @tests

Apos gerar e executar testes, atualizar o modelo com os caminhos dos arquivos:

```mfd
# Formato recomendado (file paths):
journey buscar_e_emprestar @tests(tests/e2e/journeys/buscar-e-emprestar.spec.ts) { ... }
flow emprestar_livro @tests(tests/integration/flows/emprestar-livro.test.ts) { ... }
operation calcular_multa @tests(tests/unit/operations/calcular-multa.test.ts) { ... }
```
