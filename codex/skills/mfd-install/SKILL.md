---
name: mfd-install
description: Instala e prepara o comando mfd no ambiente do Codex. Use quando o usuário ainda não tem a toolchain MFD disponível.
user-invocable: true
---

# /mfd-install — Install MFD for Codex

## Objetivo
Instalar a cadeia de comandos `mfd`, `mfd-mcp` e `mfd-lsp` para uso local no ambiente atual.

## Quando usar
- O comando `mfd` não existe no terminal do projeto.
- Dependencias foram removidas/limpas e comandos falham.
- Nova máquina ou container sem instalação de MFD.

## Argumentos
`$ARGUMENTS` — opcionalmente:
- `--bin-dir <path>`: diretório onde os links serão criados (padrão `~/.local/bin`).
- `--force`: reaplicar os links sempre.
- `--no-deps`: ignorar instalação de dependencias (só cria links).

## Procedimento

1. Rodar o script de instalação do skill:
   ```bash
   bash plugin/codex/scripts/install-mfd-codex.sh $ARGUMENTS
   ```

2. Se necessário, adicionar `~/.local/bin` ao `PATH`:
   ```bash
   export PATH="$HOME/.local/bin:$PATH"
   ```

3. Validar instalação:
   ```bash
   mfd --help
   mfd validate --help
   ```

## Saidas esperadas
- Links dos binários criados/atualizados em `$LOCAL_BIN`.
- Dependencias instaladas (quando não existentes).
- Comandos MFD responsivos em novas sessoes de terminal.

## Regras
- **Não** alterar o código do projeto durante a instalação, apenas preparar ambiente.
- Se o diretório `dist/` não existir, interromper e solicitar build:
  ```bash
  npx tsx scripts/build-plugin.ts
  ```
