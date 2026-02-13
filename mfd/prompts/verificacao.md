---
name: verificacao
mode: verification
description: Prompt para modo verificacao — comparar modelo MFD com implementacao
---

# Modo Verificacao

Compare o modelo MFD (fonte da verdade) com a implementacao existente.

## Categorias de Classificacao

### Conforme
O codigo implementa exatamente o que o modelo define.
- Entidade existe com todos os campos e tipos corretos
- Flow existe com todos os steps
- API endpoint existe com metodo, rota, e tipos corretos
- Validacoes dos decorators estao implementadas

### Pendente
O modelo define algo que o codigo ainda nao implementa.
- Entidade definida mas sem model/schema no codigo
- Flow definido mas sem handler/service
- Endpoint definido mas sem rota
- Decorator de validacao sem implementacao correspondente

### Drift
O codigo diverge do que o modelo define.
- Campo existe no codigo mas nao no modelo (ou vice-versa)
- Tipo diferente entre modelo e codigo
- Endpoint com metodo ou rota diferente
- Validacao diferente da especificada pelo decorator

### Nao Modelado
O codigo tem elementos que nao existem no modelo.
- Entidade no codigo sem correspondente no .mfd
- Endpoint sem correspondente na API do modelo
- Funcionalidade que nao aparece em nenhum flow

## Procedimento de Verificacao

### 1. Carregar o Modelo
```
mfd parse <arquivo.mfd> --json
```
Ou usar `mfd_parse` via MCP.

### 2. Listar Construtos do Modelo
Para cada tipo de construto, listar o que o modelo define:
- Entidades e seus campos
- Flows e seus steps
- APIs e seus endpoints
- Regras e suas condicoes
- Screens e suas acoes

### 3. Buscar Correspondencias no Codigo
Para cada construto, procurar no codigo:
- Arquivos de model/schema -> correspondem a entities
- Arquivos de service/handler -> correspondem a flows
- Arquivos de route/controller -> correspondem a APIs
- Arquivos de validacao -> correspondem a rules

### 4. Comparar Campo a Campo
Para cada correspondencia encontrada, verificar:
- Nomes batem?
- Tipos batem?
- Validacoes (decorators) estao implementadas?
- Steps/endpoints estao todos presentes?

### 5. Identificar Orfaos
Elementos no codigo sem correspondencia no modelo.

## Template de Relatorio

```markdown
# Relatorio de Verificacao

**Modelo:** <arquivo.mfd>
**Data:** <data>

## Resumo

| Categoria     | Qtd |
|---------------|-----|
| Conforme      | N   |
| Pendente      | N   |
| Drift         | N   |
| Nao Modelado  | N   |

## Detalhes

### Conforme
- [x] Entity User — todos os campos implementados
- [x] Flow login — todos os steps implementados

### Pendente
- [ ] Entity Notification — model nao criado
- [ ] Flow reset_password — handler nao implementado

### Drift
- Entity User.status — modelo: `UserStatus`, codigo: `string`
- API POST /users — modelo: retorna `User | ValidationError`, codigo: retorna `User`

### Nao Modelado
- Middleware `rateLimiter` — nao aparece no modelo
- Endpoint GET /health — nao definido na API
```

## Acoes Recomendadas

Para cada categoria:

| Categoria     | Acao |
|---------------|------|
| Pendente      | Implementar ou remover do modelo se nao necessario |
| Drift         | Alinhar codigo ao modelo OU atualizar modelo se a mudanca e intencional |
| Nao Modelado  | Adicionar ao modelo OU remover do codigo se nao necessario |
