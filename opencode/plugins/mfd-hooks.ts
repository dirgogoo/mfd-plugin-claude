/**
 * MFD Hooks Plugin for OpenCode
 *
 * Rewrites the 6 Claude Code shell hooks as a TypeScript OpenCode plugin:
 * - session.created  → mfd-auto-setup.sh   (auto-install deps, create symlinks)
 * - tool.execute.before (edit/write .mfd)   → mfd-cycle-pre-edit.sh (Etapa 3 instructions)
 * - tool.execute.before (edit/write code)   → mfd-cycle-pre-edit.sh (Etapa 7 instructions)
 * - tool.execute.before (mfd-tools MCP)     → mfd-pre-mcp-validate.sh (validate before render)
 * - tool.execute.after  (edit/write .mfd)   → mfd-cycle-post-edit.sh (remind validate+render)
 * - tool.execute.after  (edit/write code)   → mfd-cycle-post-edit.sh (remind @impl)
 * - tool.execute.after  (bash mfd commands) → mfd-cycle-post-bash.sh (interpret results)
 * - session.idle / stop                     → mfd-cycle-notification.sh (drift detection)
 */

import { existsSync, readdirSync } from "node:fs";
import { execSync } from "node:child_process";
import { join, resolve } from "node:path";

// --- Helpers ---

const CODE_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".py", ".go", ".rs", ".java", ".kt", ".rb", ".php", ".cs",
]);

function isCodeFile(filePath: string): boolean {
  return CODE_EXTENSIONS.has(filePath.slice(filePath.lastIndexOf(".")));
}

function isMfdFile(filePath: string): boolean {
  return filePath.endsWith(".mfd");
}

function findMfdFiles(projectDir: string): string[] {
  const results: string[] = [];
  const excludeDirs = new Set(["node_modules", "dist", "build", "plugin", ".git"]);

  function walk(dir: string, depth: number) {
    if (depth > 4) return;
    try {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
          if (excludeDirs.has(entry.name) || entry.name.startsWith("test")) continue;
          walk(join(dir, entry.name), depth + 1);
        } else if (entry.name.endsWith(".mfd")) {
          results.push(join(dir, entry.name));
        }
      }
    } catch {
      // Permission denied or similar — skip
    }
  }

  walk(projectDir, 0);
  return results;
}

function projectHasMfd(projectDir: string): boolean {
  return findMfdFiles(projectDir).length > 0;
}

// --- Hook: session.created (auto-setup) ---

function handleSessionCreated(pluginDir: string): string | undefined {
  const sdkPkg = join(pluginDir, "node_modules/@modelcontextprotocol/sdk/package.json");
  const sdkServerJs = join(pluginDir, "node_modules/@modelcontextprotocol/sdk/dist/esm/server/index.js");

  let needsInstall = false;
  if (!existsSync(join(pluginDir, "node_modules"))) {
    needsInstall = true;
  } else if (!existsSync(sdkPkg) || !existsSync(sdkServerJs)) {
    needsInstall = true;
  }

  if (needsInstall) {
    try {
      execSync("npm install --omit=dev --silent", { cwd: pluginDir, stdio: "ignore" });
      return "[MFD] Dependencies installed successfully.";
    } catch {
      return "[MFD] Warning: Failed to install dependencies. MCP tools may not work.\n[MFD] Run manually: cd " + pluginDir + " && rm -rf node_modules && npm install --omit=dev";
    }
  }

  // Create symlink if missing
  const localBin = join(process.env.HOME || "~", ".local", "bin");
  const mfdBin = join(pluginDir, "bin", "mfd");
  const mfdLink = join(localBin, "mfd");
  if (existsSync(mfdBin) && !existsSync(mfdLink)) {
    try {
      execSync(`mkdir -p "${localBin}" && ln -sf "${mfdBin}" "${mfdLink}"`, { stdio: "ignore" });
    } catch {
      // Non-critical — skip
    }
  }

  return undefined;
}

// --- Hook: tool.execute.before (pre-edit) ---

function handlePreEdit(filePath: string, projectDir: string): string | undefined {
  if (!filePath) return undefined;

  // Editing .mfd file → Etapa 3 (Traducao DSL)
  if (isMfdFile(filePath)) {
    return `[MFD Ciclo — Etapa 3: Traducao DSL]

Voce esta editando um arquivo .mfd. Siga o protocolo:

1. NUNCA mostre DSL crua ao humano. Explique em linguagem natural o que vai alterar e por que.
2. Apos salvar, OBRIGATORIAMENTE valide: execute \`mfd validate\` no arquivo.
3. Se houver erros de validacao, corrija automaticamente antes de mostrar ao humano.
4. Se houver warnings, informe ao humano mas nao bloqueie.
5. Apos validacao, gere diagrama com \`mfd_render\` (Etapa 4) e peca aprovacao visual ao humano (Etapa 5).
6. Se o humano pedir mudancas, volte a Etapa 2 (conversa) — nao pule direto para editar.

Lembre: um modelo ambiguo e PIOR que um modelo incompleto. Se algo nao esta claro, PERGUNTE antes de editar.`;
  }

  // Editing code file in project with .mfd → Etapa 7 (Implementacao)
  if (isCodeFile(filePath) && projectHasMfd(projectDir)) {
    return `[MFD Ciclo — Etapa 7: Implementacao]

Voce esta escrevendo codigo em um projeto com modelo MFD. O modelo e o CONTRATO:

- Liberdade total sobre o COMO (algoritmos, estruturas, organizacao de codigo)
- ZERO liberdade sobre o QUE (entidades, campos, APIs, regras devem corresponder ao modelo)
- Se o modelo define \`entity User { email: string }\`, o codigo DEVE ter esse campo
- Se encontrar ambiguidade no modelo, PERGUNTE ao humano — nao assuma

REGRAS DE @impl — Rastreabilidade por caminho de arquivo:

  @impl aponta para os ARQUIVOS onde o codigo vive.
  Exemplo: entity User @impl(src/models/user.ts) { ... }
  Multiplos arquivos: flow criar @impl(src/services/user.ts, src/validators/user.ts) { ... }
  Sem @impl = construto pendente de implementacao.

  Valores DEPRECATED (nao usar): done, backend, frontend, partial
  Use caminhos relativos: @impl(src/models/user.ts)

  Atualize @impl IMEDIATAMENTE apos cada construto — nao acumule para marcar em lote.
  Ao escrever testes, atualize: @tests(unit) ou @tests(integration)`;
  }

  return undefined;
}

// --- Hook: tool.execute.before (pre-mcp-validate) ---

function handlePreMcpValidate(toolName: string, toolInput: Record<string, unknown>, pluginDir: string): string | undefined {
  // Only intercept MFD render/visual/contract/query/stats tools
  const validationRequired = ["mfd_render", "mfd_visual_start", "mfd_contract", "mfd_query", "mfd_stats", "mfd_context"];
  if (!validationRequired.includes(toolName)) return undefined;

  const filePath = toolInput.file as string | undefined;
  if (!filePath || !existsSync(filePath)) return undefined;

  // Find CLI
  let mfdCli = join(pluginDir, "bin", "mfd");
  if (!existsSync(mfdCli)) {
    try {
      mfdCli = execSync("which mfd", { encoding: "utf-8" }).trim();
    } catch {
      return undefined; // Can't validate without CLI
    }
  }

  try {
    execSync(`"${mfdCli}" validate "${filePath}"`, { encoding: "utf-8", stdio: "pipe" });
    return undefined; // Valid — proceed
  } catch (e: unknown) {
    const error = e as { status?: number; stdout?: string; stderr?: string };
    if (error.status === 1) {
      const output = error.stdout || error.stderr || "";
      return `[MFD — Validacao Obrigatoria ANTES de renderizar/visualizar]

O arquivo ${filePath} tem ERROS de validacao. Voce DEVE corrigir antes de continuar.

NAO tente forcar a renderizacao/visualizacao. O parser vai falhar com os mesmos erros.

Erros encontrados:
${output}

ACAO OBRIGATORIA:
1. Corrija os erros no arquivo .mfd
2. Execute mfd_validate para confirmar que esta limpo
3. SO ENTAO tente renderizar/visualizar novamente`;
    } else if (error.status === 2) {
      const output = error.stdout || error.stderr || "";
      return `[MFD] Warnings encontrados (nao bloqueiam visualizacao):\n${output}`;
    }
    return undefined;
  }
}

// --- Hook: tool.execute.after (post-edit) ---

function handlePostEdit(filePath: string, projectDir: string): string | undefined {
  if (!filePath) return undefined;

  // Just edited .mfd → remind to validate and render
  if (isMfdFile(filePath)) {
    return `[MFD Ciclo — Pos-Edicao de Modelo]

Voce acabou de editar um arquivo .mfd. Proximos passos OBRIGATORIOS:

1. VALIDAR: Execute \`mfd validate\` neste arquivo. Se erros, corrija agora.
2. RENDERIZAR: Gere diagrama com \`mfd_render\` para o humano ver visualmente.
3. EXPLICAR: Resuma em linguagem natural o que mudou e por que.
4. PEDIR APROVACAO: Pergunte ao humano se o modelo esta correto (Etapa 5).
   - Se aceitar → sugira commit (Etapa 6)
   - Se pedir mudancas → volte a conversar (Etapa 2), nao edite direto
   - Se perguntar → responda usando o modelo como fonte da verdade`;
  }

  // Just edited code → remind about @impl
  if (isCodeFile(filePath) && projectHasMfd(projectDir)) {
    return `[MFD Ciclo — Pos-Edicao de Codigo]

Voce acabou de editar codigo. Checklist de @impl:

1. Qual construto MFD voce acabou de implementar? (entity, flow, api, rule, screen, etc.)
2. Atualize o .mfd agora com @impl apontando para o arquivo:
   - @impl(src/models/user.ts) — caminho relativo do arquivo implementado
   - Multiplos arquivos: @impl(src/schema.ts, src/routes.ts)
   - Sem @impl = construto pendente
3. Valores DEPRECATED (nao usar): done, backend, frontend, partial
4. Ao escrever testes, atualize: @tests(unit) ou @tests(integration)`;
  }

  return undefined;
}

// --- Hook: tool.execute.after (post-bash) ---

function handlePostBash(command: string, exitCode: number): string | undefined {
  if (!command) return undefined;

  // After mfd validate
  if (command.includes("validate")) {
    if (exitCode === 0) {
      return `[MFD Ciclo — Validacao OK]

O modelo esta valido! Proximos passos:
- Se ainda em modelagem (Etapa 3-5): gere diagrama e peca aprovacao visual ao humano
- Se humano ja aprovou: sugira commit do modelo (Etapa 6)
- Mostre stats (\`mfd stats\`) para dar visao de completude ao humano`;
    } else if (exitCode === 1) {
      return `[MFD Ciclo — Erros de Validacao]

O modelo tem ERROS. Voce DEVE corrigi-los antes de prosseguir:
- Analise cada erro e corrija no .mfd
- Valide novamente apos correcoes
- NAO mostre o modelo ao humano ate estar livre de erros
- Warnings sao aceitaveis, erros nao`;
    } else if (exitCode === 2) {
      return `[MFD Ciclo — Warnings de Validacao]

O modelo e valido mas tem warnings. Informe ao humano:
- Explique cada warning em linguagem natural
- Sugira correcoes se forem faceis
- Warnings nao bloqueiam — o humano decide se quer corrigir agora ou depois`;
    }
  }

  // After mfd stats
  if (command.includes("stats")) {
    return `[MFD Ciclo — Etapa 9: Dashboard]

Apresente as metricas ao humano de forma clara:
- Destaque a completude (@status, @impl, @tests)
- Se @impl esta baixo, sugira quais componentes implementar primeiro
- Se @tests esta baixo, sugira escrever testes para construtos implementados
- Se ha ciclos no grafo de dependencias, alerte
- Sugira o proximo passo baseado no estado atual`;
  }

  // After mfd diff
  if (command.includes("diff")) {
    return `[MFD Ciclo — Diff Semantico]

Apresente as diferencas ao humano agrupadas por tipo:
- Adicionados: novos construtos no modelo
- Removidos: construtos que nao existem mais
- Modificados: construtos que mudaram (detalhe o que mudou)
Pergunte se as mudancas estao corretas antes de prosseguir.`;
  }

  return undefined;
}

// --- Hook: session.idle / stop (drift detection) ---

function handleStop(projectDir: string): string | undefined {
  const mfdFiles = findMfdFiles(projectDir);
  if (mfdFiles.length === 0) return undefined;

  // Extract @impl paths from all .mfd files
  const implPaths: string[] = [];
  const deprecatedValues = new Set(["done", "backend", "frontend", "partial"]);
  const deprecatedFound: Array<{ value: string; file: string }> = [];
  const driftLines: string[] = [];

  for (const mfdFile of mfdFiles) {
    try {
      const content = require("node:fs").readFileSync(mfdFile, "utf-8") as string;
      const implMatches = content.matchAll(/@impl\(([^)]+)\)/g);
      for (const m of implMatches) {
        const values = m[1].split(",").map((v: string) => v.trim());
        for (const v of values) {
          if (deprecatedValues.has(v)) {
            deprecatedFound.push({ value: v, file: mfdFile });
          } else {
            implPaths.push(v);
            // Check if file exists
            const fullPath = join(projectDir, v);
            if (!existsSync(fullPath)) {
              driftLines.push(`  - ${v}`);
            }
          }
        }
      }
    } catch {
      // Skip unreadable files
    }
  }

  // Check git status for code files without @impl
  let missingImplLines: string[] = [];
  try {
    const gitStatus = execSync("git status --porcelain", { cwd: projectDir, encoding: "utf-8" });
    const codeFiles = gitStatus.split("\n")
      .filter((line) => /\.(ts|tsx|js|jsx|py|go|rs|rb|java|kt|cs)$/.test(line))
      .filter((line) => !/\.(test\.|spec\.|__test|\.config\.|\.d\.ts)/.test(line))
      .filter((line) => !/(dist\/|build\/|node_modules\/)/.test(line))
      .filter((line) => !/(packages\/mfd-|plugin\/)/.test(line))
      .map((line) => line.trim().split(/\s+/).pop() || "")
      .filter(Boolean);

    for (const codeFile of codeFiles) {
      if (!implPaths.some((p) => codeFile.includes(p) || p.includes(codeFile))) {
        missingImplLines.push(`  - ${codeFile}`);
      }
    }
  } catch {
    // Not a git repo or git not available
  }

  const hasProblems = deprecatedFound.length > 0 || driftLines.length > 0 || missingImplLines.length > 0;

  let output = "\n[MFD Ciclo — Verificacao Pos-Implementacao]\n\n";

  if (deprecatedFound.length > 0) {
    output += "DEPRECATED — @impl com valores obsoletos (substituir por caminhos de arquivo):\n";
    for (const d of deprecatedFound) {
      output += `  - @impl(${d.value}) em ${d.file}\n`;
    }
  }

  if (driftLines.length > 0) {
    output += "DRIFT — @impl aponta para arquivos que NAO existem:\n";
    output += driftLines.join("\n") + "\n";
  }

  if (missingImplLines.length > 0) {
    output += "IMPL FALTANDO — Codigo modificado sem @impl no modelo:\n";
    output += missingImplLines.join("\n") + "\n";
  }

  if (!hasProblems) {
    output += "@impl OK — sem drift estrutural detectado.\n";
  }

  output += "\nOBRIGATORIO:\n";
  let step = 1;

  if (deprecatedFound.length > 0) {
    output += `${step}. DEPRECATED: substituir valores obsoletos por caminhos reais de arquivo.\n`;
    step++;
  }

  if (driftLines.length > 0) {
    output += `${step}. DRIFT: corrigir os caminhos @impl no modelo.\n`;
    step++;
  }

  if (missingImplLines.length > 0) {
    output += `${step}. IMPL FALTANDO: identificar o construto correspondente e adicionar @impl.\n`;
    step++;
  }

  output += `${step}. VERIFICACAO SEMANTICA: Para cada construto com @impl cujo arquivo foi modificado:
   a. Rodar: mfd_trace file="<mfd_file>" para obter construtos com @impl
   b. Rodar: mfd_query file="<mfd_file>" name="<construto>" para obter o contrato
   c. Ler o arquivo @impl referenciado
   d. Comparar: entity (campos), flow (passos), api (endpoints), enum (valores)
   e. Se divergencia: reportar "DRIFT SEMANTICO em [tipo] [nome]: [descricao]"
   f. Se OK: confirmar "Verificacao semantica OK"\n`;

  step++;
  output += `${step}. COMMIT: Apos resolver todos os problemas acima, commitar todas as alteracoes.\n`;

  return output;
}

// --- Plugin export ---

interface ToolEvent {
  tool?: string;
  tool_input?: Record<string, unknown>;
  file_path?: string;
  filePath?: string;
  command?: string;
  exit_code?: number;
}

interface PluginContext {
  project: { path: string };
  directory: string;
}

export const MFDPlugin = async ({ project, directory }: PluginContext) => {
  const projectDir = project?.path || directory || process.cwd();

  // Resolve plugin dir relative to this file
  const pluginDir = resolve(join(__dirname, ".."));

  return {
    "session.created": async () => {
      return handleSessionCreated(pluginDir);
    },

    "tool.execute.before": async (input: ToolEvent) => {
      const toolName = input.tool || "";
      const toolInput = input.tool_input || {};

      // Pre-MCP-validate for MFD tools
      if (toolName.startsWith("mfd_")) {
        const msg = handlePreMcpValidate(toolName, toolInput, pluginDir);
        if (msg) return msg;
      }

      // Pre-edit for Edit/Write tools
      if (toolName === "edit" || toolName === "write") {
        const filePath = (toolInput.file_path || toolInput.filePath || input.file_path || input.filePath || "") as string;
        return handlePreEdit(filePath, projectDir);
      }

      return undefined;
    },

    "tool.execute.after": async (input: ToolEvent) => {
      const toolName = input.tool || "";
      const toolInput = input.tool_input || {};

      // Post-edit for Edit/Write tools
      if (toolName === "edit" || toolName === "write") {
        const filePath = (toolInput.file_path || toolInput.filePath || input.file_path || input.filePath || "") as string;
        return handlePostEdit(filePath, projectDir);
      }

      // Post-bash for mfd CLI commands
      if (toolName === "bash" || toolName === "shell") {
        const command = (toolInput.command || input.command || "") as string;
        const exitCode = (input.exit_code ?? 0) as number;
        if (command.includes("mfd")) {
          return handlePostBash(command, exitCode);
        }
      }

      return undefined;
    },

    "session.idle": async () => {
      return handleStop(projectDir);
    },
  };
};

export default MFDPlugin;
