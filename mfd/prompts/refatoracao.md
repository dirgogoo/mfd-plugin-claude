---
name: refatoracao
mode: refactoring
description: Prompt para refatoracao de modelo MFD — reestruturar sem quebrar contratos
---

# Modo Refatoracao

Reestruturar o modelo MFD mantendo a integridade semantica.

## Principio

Refatorar modelo e como refatorar codigo: mudar a estrutura sem mudar o comportamento. O sistema descrito ANTES e DEPOIS da refatoracao deve ser semanticamente equivalente.

## Checklist de Impacto (Cascading Changes)

Antes de refatorar, avalie o impacto cascata:

### Renomear Entidade
- [ ] Atualizar todos os campos que referenciam essa entidade como tipo
- [ ] Atualizar `shows` em screens que mostram essa entidade
- [ ] Atualizar flows que usam essa entidade como param ou retorno
- [ ] Atualizar APIs que recebem/retornam essa entidade
- [ ] Atualizar regras que mencionam essa entidade
- [ ] Atualizar eventos que referenciam essa entidade

### Renomear Enum
- [ ] Atualizar `state` que usa esse enum como referencia
- [ ] Atualizar campos de entidade que usam esse enum como tipo
- [ ] Atualizar flows que usam esse enum

### Mover Construto entre Components
- [ ] Verificar que deps estao atualizados
- [ ] Verificar que refs cross-component sao validas
- [ ] Atualizar screens e journeys se afetados

### Dividir Componente
- [ ] Cada sub-componente deve ser auto-contido
- [ ] Adicionar deps entre sub-componentes se necessario
- [ ] Verificar que nao criou dependencias circulares
- [ ] Atualizar journeys que referenciam screens movidos

### Mesclar Componentes
- [ ] Resolver conflitos de nome (entidades/enums duplicados)
- [ ] Remover deps internos que se tornaram desnecessarios
- [ ] Consolidar APIs (unificar prefixos se necessario)

### Adicionar/Remover Campo de Entidade
- [ ] Verificar screens que mostram essa entidade (campo em `shows`)
- [ ] Verificar forms que editam essa entidade
- [ ] Verificar flows que processam essa entidade
- [ ] Verificar eventos que incluem essa entidade

### Alterar State Machine
- [ ] Verificar que novos estados existem no enum
- [ ] Verificar que transicoes removidas nao sao usadas em flows
- [ ] Verificar que wildcard (*) transitions ainda fazem sentido

## Padroes Comuns de Refatoracao

### Extract Component
**Quando:** Um componente faz coisas demais.
**Como:** Mover entidades, flows e APIs relacionados para novo componente. Adicionar dep entre eles.

### Inline Component
**Quando:** Um componente e muito pequeno e sempre usado junto com outro.
**Como:** Mover tudo para o componente pai. Remover dep.

### Extract Enum
**Quando:** Strings magicas aparecem em flows ou regras.
**Como:** Criar enum com valores. Usar como tipo em entidades. Referenciar em states.

### Split Flow
**Quando:** Um flow tem muitos steps e branches.
**Como:** Extrair sub-flows. Flow principal chama sub-flows como steps.

### Generalize Entity
**Quando:** Duas entidades sao muito parecidas.
**Como:** Criar entidade base com campos comuns. Entidades especializadas adicionam campos extras.

### Extract Event
**Quando:** Um flow faz notificacoes ou side effects inline.
**Como:** Criar evento. Flow emite evento com `@async`. Consumidor trata separadamente.

### Consolidate APIs
**Quando:** Multiplas APIs com prefixos similares e overlapping.
**Como:** Unificar sob um unico bloco API com prefixo comum.

## Procedimento

1. **Analisar** — Ler modelo atual, identificar o que refatorar
2. **Planejar** — Listar todas as mudancas com checklist de impacto
3. **Apresentar** — Explicar ao humano o que sera alterado e por que
4. **Executar** — Aplicar mudancas no modelo (apos aprovacao)
5. **Validar** — Rodar `mfd validate` para garantir consistencia
6. **Comparar** — Usar `mfd diff` entre versao antiga e nova
7. **Documentar** — Atualizar semantic comments explicando a refatoracao
