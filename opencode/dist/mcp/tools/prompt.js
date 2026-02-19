import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
function findPromptsDir() {
    // Primary: relative to source (monorepo layout)
    const primary = join(__dirname, "..", "..", "prompts");
    if (existsSync(primary))
        return primary;
    // Fallback: packaged distribution — prompts/ at package root
    let dir = __dirname;
    for (let i = 0; i < 10; i++) {
        const candidate = join(dir, "prompts");
        if (existsSync(candidate) && readdirSync(candidate).some((f) => f.endsWith(".md"))) {
            return candidate;
        }
        const parent = dirname(dir);
        if (parent === dir)
            break;
        dir = parent;
    }
    return primary;
}
const promptsDir = findPromptsDir();
export function handlePrompt(args) {
    if (args.action === "list") {
        return listPrompts();
    }
    if (args.action === "get" && args.name) {
        return getPrompt(args.name);
    }
    return {
        content: [
            {
                type: "text",
                text: "Invalid action. Use 'list' or 'get' with a name.",
            },
        ],
        isError: true,
    };
}
function listPrompts() {
    const files = readdirSync(promptsDir).filter((f) => f.endsWith(".md"));
    const prompts = files.map((f) => {
        const raw = readFileSync(join(promptsDir, f), "utf-8");
        const match = raw.match(/^---\n([\s\S]*?)\n---/);
        const meta = {};
        if (match) {
            for (const line of match[1].split("\n")) {
                const colonIdx = line.indexOf(":");
                if (colonIdx > 0) {
                    meta[line.slice(0, colonIdx).trim()] = line.slice(colonIdx + 1).trim();
                }
            }
        }
        return {
            name: meta.name ?? f.replace(".md", ""),
            mode: meta.mode ?? "unknown",
            description: meta.description ?? "",
        };
    });
    const lines = prompts.map((p) => `- **${p.name}** (mode: ${p.mode}) — ${p.description}`);
    return {
        content: [
            {
                type: "text",
                text: `Available prompts:\n\n${lines.join("\n")}`,
            },
        ],
    };
}
function getPrompt(name) {
    try {
        const filePath = join(promptsDir, `${name}.md`);
        const raw = readFileSync(filePath, "utf-8");
        // Strip frontmatter for cleaner output
        const content = raw.replace(/^---\n[\s\S]*?\n---\n/, "").trim();
        return {
            content: [{ type: "text", text: content }],
        };
    }
    catch {
        return {
            content: [
                { type: "text", text: `Prompt not found: ${name}` },
            ],
            isError: true,
        };
    }
}
//# sourceMappingURL=prompt.js.map