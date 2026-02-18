---
name: mfd-install
description: Instala e prepara o comando mfd no ambiente do Codex. Use quando o usuario ainda nao tem a toolchain MFD disponivel.
user-invocable: true
---

# /mfd-install — Install MFD for Codex

## Objetivo
Instalar os comandos `mfd` e `mfd-mcp`, registrar o MCP server no Codex, e copiar o AGENTS.md para o projeto.

## Quando usar
- O comando `mfd` nao existe no terminal do projeto.
- Dependencias foram removidas/limpas e comandos falham.
- Nova maquina ou container sem instalacao de MFD.

## Argumentos
`$ARGUMENTS` — opcionalmente:
- `--bin-dir <path>`: diretorio onde os links serao criados (padrao `~/.local/bin`).
- `--force`: reaplicar os links sempre.
- `--no-deps`: ignorar instalacao de dependencias (so cria links).
- `--no-mcp`: pular registro do MCP server no Codex.
- `--no-agents`: pular copia do AGENTS.md para o projeto.

## Procedimento

1. Rodar o script de instalacao:
   ```bash
   bash plugin/codex/scripts/install-mfd-codex.sh $ARGUMENTS
   ```

2. Se necessario, adicionar `~/.local/bin` ao `PATH`:
   ```bash
   export PATH="$HOME/.local/bin:$PATH"
   ```

3. Validar instalacao:
   ```bash
   mfd --help
   mfd-mcp --help
   ```

## Atualizacoes futuras

Para atualizar a toolchain MFD apos a instalacao inicial:
```bash
bash plugin/codex/scripts/update-mfd-codex.sh
```

O script de update faz `git pull`, reinstala dependencias e recria symlinks automaticamente.

## Saidas esperadas
- Links dos binarios criados/atualizados em `$LOCAL_BIN`.
- Dependencias instaladas (quando nao existentes).
- MCP server `mfd-tools` registrado no Codex (quando `codex` disponivel).
- AGENTS.md copiado para `.codex/AGENTS.md` (quando nao existente).
- Comandos MFD responsivos em novas sessoes de terminal.

## Regras
- **Nao** alterar o codigo do projeto durante a instalacao, apenas preparar ambiente.
- Se o diretorio `dist/` nao existir, interromper e solicitar build:
  ```bash
  npx tsx scripts/build-plugin.ts
  ```
