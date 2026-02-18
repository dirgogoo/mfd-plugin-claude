# MFD Codex Integration

This package contains the MFD tooling bundle and one Codex skill:

- `plugin/codex/skills/mfd-install` -> `/mfd-install`

`/mfd-install` checks dependencies and creates CLI links for:
- `mfd`
- `mfd-mcp`
- `mfd-lsp`

## Instalacao rapida no Codex

1) No root do repositorio, rode o build da integracao:

```bash
npx tsx scripts/build-plugin.ts
```

2) Execute o script de instalacao:

```bash
bash plugin/codex/scripts/install-mfd-codex.sh
```

3) Opcional, garanta que o bin dir esta no PATH:

```bash
export PATH="$HOME/.local/bin:$PATH"
```

4) Valide:

```bash
mfd --help
mfd validate --help
```

## Opcoes do instalador

- `--bin-dir <path>`: altera o diretorio onde serao criados os links.
- `--force`: reaplica os links mesmo se ja existirem.
- `--no-deps`: pula instalacao de dependencias npm (so cria links).
- `--help`: exibe a ajuda do script.

## Atualizacao futura

Depois de atualizar o projeto:

1) `npx tsx scripts/build-plugin.ts`
2) execute novamente:
   `bash plugin/codex/scripts/install-mfd-codex.sh`

## Observacoes

- Se o comando falhar dizendo que `dist/` nao existe, rode o build novamente.
- O script assume `~/.local/bin` como destino padrao dos binarios.
- No Codex, rode o skill `/mfd-install` para repetir o processo por demanda.
