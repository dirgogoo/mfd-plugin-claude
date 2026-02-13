import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface PromptTemplate {
  name: string;
  mode: string;
  description: string;
  content: string;
}

function parseFrontmatter(raw: string): { meta: Record<string, string>; content: string } {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { meta: {}, content: raw };

  const meta: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx > 0) {
      const key = line.slice(0, colonIdx).trim();
      const value = line.slice(colonIdx + 1).trim();
      meta[key] = value;
    }
  }

  return { meta, content: match[2].trim() };
}

export function loadPrompt(name: string): PromptTemplate {
  const filePath = join(__dirname, `${name}.md`);
  const raw = readFileSync(filePath, "utf-8");
  const { meta, content } = parseFrontmatter(raw);

  return {
    name: meta.name ?? name,
    mode: meta.mode ?? "unknown",
    description: meta.description ?? "",
    content,
  };
}

export function listPrompts(): PromptTemplate[] {
  const files = readdirSync(__dirname).filter((f) => f.endsWith(".md"));
  return files.map((f) => {
    const name = f.replace(".md", "");
    return loadPrompt(name);
  });
}
