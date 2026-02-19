---
name: mfd-install
description: Instala e prepara o comando mfd no ambiente do OpenCode. Use quando o usuario ainda nao tem a toolchain MFD disponivel.
---

# /mfd-install — Install MFD for OpenCode

## Objetivo
Instalar os comandos `mfd` e `mfd-mcp`, registrar o MCP server no OpenCode, copiar skills, plugins, commands, agents e o OPENCODE.md para o projeto.

## Quando usar
- O comando `mfd` nao existe no terminal do projeto.
- Dependencias foram removidas/limpas e comandos falham.
- Nova maquina ou container sem instalacao de MFD.

## Argumentos
`$ARGUMENTS` — opcionalmente:
- `--bin-dir <path>`: diretorio onde os links serao criados (padrao `~/.local/bin`).
- `--force`: reaplicar os links e sobrescrever sempre.
- `--no-deps`: ignorar instalacao de dependencias (so cria links).
- `--no-mcp`: pular registro do MCP server no opencode.json.
- `--no-skills`: pular copia das skills para .opencode/skills/.
- `--no-plugins`: pular copia do plugin TypeScript para .opencode/plugins/.
- `--no-commands`: pular copia dos custom commands para .opencode/commands/.
- `--no-agents`: pular copia dos custom agents para .opencode/agents/.

## Procedimento

1. Rodar o script de instalacao:
   ```bash
   bash plugin/opencode/scripts/install-mfd-opencode.sh $ARGUMENTS
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
bash plugin/opencode/scripts/update-mfd-opencode.sh
```

O script de update faz `git pull`, reinstala dependencias e re-synca skills/plugins/commands/agents automaticamente.

## Saidas esperadas
- Links dos binarios criados/atualizados em `$LOCAL_BIN`.
- Dependencias instaladas (quando nao existentes).
- MCP server `mfd-tools` registrado em `opencode.json`.
- Skills copiadas para `.opencode/skills/`.
- Plugin TypeScript copiado para `.opencode/plugins/`.
- Custom commands copiados para `.opencode/commands/`.
- Custom agents copiados para `.opencode/agents/`.
- OPENCODE.md copiado para a raiz do projeto.
- Comandos MFD responsivos em novas sessoes de terminal.

## Regras
- **Nao** alterar o codigo do projeto durante a instalacao, apenas preparar ambiente.
- Se o diretorio `dist/` nao existir, interromper e solicitar build:
  ```bash
  npx tsx scripts/build-plugin.ts
  ```
