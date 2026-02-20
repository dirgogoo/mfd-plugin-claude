import { readFileSync, writeFileSync } from "node:fs";
import { resolve, basename } from "node:path";
import { collectModel } from "../../core/validator/collect.js";
import { loadDocument } from "./common.js";
import { stripAllVerified } from "../../core/cli/commands/strip-verified.js";
export function handleVerify(args) {
    switch (args.action) {
        case "mark":
            return handleMarkVerified(args);
        case "strip":
            return handleStripVerified(args);
        case "strip-all":
            return handleStripAll(args);
        case "list-pending":
            return handleListPending(args);
        case "mark-from-file":
            return handleMarkFromFile(args);
        default:
            return {
                content: [{ type: "text", text: `Unknown action: ${args.action}` }],
                isError: true,
            };
    }
}
// ===== mark =====
// Increments @verified(N) by 1, or adds @verified(1) if absent.
function handleMarkVerified(args) {
    if (!args.construct) {
        return {
            content: [{ type: "text", text: "action 'mark' requires 'construct' parameter" }],
            isError: true,
        };
    }
    const absPath = resolve(args.file);
    const source = readFileSync(absPath, "utf-8");
    const lines = source.split("\n");
    const declRegex = new RegExp(`^(\\s*)(entity|flow|screen|enum|state|event|signal|operation|action|element|rule|journey|api|component)\\s+${escapeRegex(args.construct)}\\b`);
    let targetLineIdx = -1;
    for (let i = 0; i < lines.length; i++) {
        if (declRegex.test(lines[i])) {
            targetLineIdx = i;
            break;
        }
    }
    if (targetLineIdx < 0) {
        return {
            content: [{
                    type: "text",
                    text: `Could not find construct "${args.construct}" in ${args.file}`,
                }],
            isError: true,
        };
    }
    const line = lines[targetLineIdx];
    // Extract current @verified(N) or @verified
    const existingVerified = /@verified\s*\((\d+)\)/.exec(line);
    const existingVerifiedNoParam = /@verified\b(?!\s*\()/.exec(line);
    let newLine;
    let newCount;
    if (existingVerified) {
        const current = parseInt(existingVerified[1], 10);
        newCount = current + 1;
        newLine = line.replace(/@verified\s*\(\d+\)/, `@verified(${newCount})`);
    }
    else if (existingVerifiedNoParam) {
        // @verified without parens — treat as @verified(1), increment to @verified(2)
        newCount = 2;
        newLine = line.replace(/@verified\b(?!\s*\()/, `@verified(${newCount})`);
    }
    else {
        // No @verified — insert @verified(1) before opening brace or at end
        newCount = 1;
        const braceIdx = line.indexOf("{");
        if (braceIdx >= 0) {
            newLine = line.substring(0, braceIdx).trimEnd() + ` @verified(1) ` + line.substring(braceIdx);
        }
        else {
            newLine = line.trimEnd() + ` @verified(1)`;
        }
    }
    lines[targetLineIdx] = newLine;
    writeFileSync(absPath, lines.join("\n"), "utf-8");
    return {
        content: [{
                type: "text",
                text: JSON.stringify({
                    success: true,
                    construct: args.construct,
                    verified: newCount,
                    file: args.file,
                    line: targetLineIdx + 1,
                }, null, 2),
            }],
    };
}
// ===== strip =====
// Removes @verified from a specific construct.
function handleStripVerified(args) {
    if (!args.construct) {
        return {
            content: [{ type: "text", text: "action 'strip' requires 'construct' parameter" }],
            isError: true,
        };
    }
    const absPath = resolve(args.file);
    const source = readFileSync(absPath, "utf-8");
    const lines = source.split("\n");
    const declRegex = new RegExp(`^(\\s*)(entity|flow|screen|enum|state|event|signal|operation|action|element|rule|journey|api|component)\\s+${escapeRegex(args.construct)}\\b`);
    let targetLineIdx = -1;
    for (let i = 0; i < lines.length; i++) {
        if (declRegex.test(lines[i])) {
            targetLineIdx = i;
            break;
        }
    }
    if (targetLineIdx < 0) {
        return {
            content: [{
                    type: "text",
                    text: `Could not find construct "${args.construct}" in ${args.file}`,
                }],
            isError: true,
        };
    }
    const line = lines[targetLineIdx];
    const hadVerified = /@verified\b/.test(line);
    if (!hadVerified) {
        return {
            content: [{
                    type: "text",
                    text: JSON.stringify({
                        success: true,
                        construct: args.construct,
                        stripped: false,
                        message: "Construct had no @verified decorator",
                        file: args.file,
                    }, null, 2),
                }],
        };
    }
    lines[targetLineIdx] = line
        .replace(/[ \t]*@verified\s*\([^)]*\)/g, "")
        .replace(/[ \t]*@verified\b(?!\s*\()/g, "")
        .replace(/\s+$/, "");
    writeFileSync(absPath, lines.join("\n"), "utf-8");
    return {
        content: [{
                type: "text",
                text: JSON.stringify({
                    success: true,
                    construct: args.construct,
                    stripped: true,
                    file: args.file,
                    line: targetLineIdx + 1,
                }, null, 2),
            }],
    };
}
// ===== strip-all =====
// Removes ALL @verified decorators from the file.
function handleStripAll(args) {
    const absPath = resolve(args.file);
    const source = readFileSync(absPath, "utf-8");
    const { source: stripped, count } = stripAllVerified(source);
    if (count > 0) {
        writeFileSync(absPath, stripped, "utf-8");
    }
    return {
        content: [{
                type: "text",
                text: JSON.stringify({
                    success: true,
                    stripped: count,
                    file: args.file,
                    message: count > 0
                        ? `Stripped ${count} @verified decorator(s)`
                        : "No @verified decorators found",
                }, null, 2),
            }],
    };
}
// ===== list-pending =====
// Lists constructs with @impl but @verified absent or @verified(N) < threshold.
function handleListPending(args) {
    const threshold = args.threshold ?? 1;
    const { doc } = loadDocument(args.file, args.resolve_includes);
    const model = collectModel(doc);
    const componentFilter = args.component?.toLowerCase() ?? null;
    // Build component ownership map
    const ownership = new Map();
    for (const comp of model.components) {
        for (const item of comp.body) {
            const name = item.name;
            if (name)
                ownership.set(name, comp.name);
        }
    }
    const pending = [];
    const allTrackable = [
        { type: "entity", items: model.entities },
        { type: "enum", items: model.enums },
        { type: "flow", items: model.flows },
        { type: "state", items: model.states },
        { type: "event", items: model.events },
        { type: "signal", items: model.signals },
        { type: "screen", items: model.screens },
        { type: "journey", items: model.journeys },
        { type: "operation", items: model.operations },
        { type: "action", items: model.actions },
        { type: "element", items: model.elements },
        { type: "rule", items: model.rules },
        { type: "api", items: model.apis },
    ];
    for (const { type, items } of allTrackable) {
        for (const item of items) {
            const name = item.name ?? (type === "api" ? (item.style ?? "api") : null);
            if (!name)
                continue;
            const component = ownership.get(name) ?? null;
            if (componentFilter && (!component || component.toLowerCase() !== componentFilter))
                continue;
            const decorators = item.decorators ?? [];
            const implDec = decorators.find((d) => d.name === "impl");
            if (!implDec || implDec.params.length === 0)
                continue; // no @impl → skip
            const impl = implDec.params
                .map((p) => (p.kind === "string" || p.kind === "identifier" ? String(p.value) : null))
                .filter(Boolean);
            const verifiedDec = decorators.find((d) => d.name === "verified");
            const verifiedCount = verifiedDec
                ? (verifiedDec.params[0] ? parseInt(String(verifiedDec.params[0].value), 10) || 1 : 1)
                : 0;
            if (verifiedCount < threshold) {
                pending.push({ type, name, component, impl, verifiedCount });
            }
        }
    }
    const withImpl = allTrackable.reduce((sum, { items }) => sum + items.filter((i) => i.decorators?.some((d) => d.name === "impl")).length, 0);
    return {
        content: [{
                type: "text",
                text: JSON.stringify({
                    summary: {
                        pending: pending.length,
                        withImpl,
                        pct: withImpl > 0 ? Math.round(((withImpl - pending.length) / withImpl) * 100) : 0,
                        threshold,
                    },
                    pending,
                }, null, 2),
            }],
    };
}
// ===== mark-from-file =====
// Finds constructs without @impl and suggests which ones a given code file likely implements.
function handleMarkFromFile(args) {
    if (!args.codePath) {
        return {
            content: [{ type: "text", text: "action 'mark-from-file' requires 'codePath' parameter" }],
            isError: true,
        };
    }
    const { doc } = loadDocument(args.file, args.resolve_includes);
    const model = collectModel(doc);
    const componentFilter = args.component?.toLowerCase() ?? null;
    // Tokenize the code file path for heuristic matching
    const fileTokens = basename(args.codePath)
        .replace(/\.[^.]+$/, "") // remove extension
        .replace(/[-_.]/g, " ")
        .split(/[\s.]+/)
        .map((t) => t.toLowerCase())
        .filter((t) => t.length > 2 && !["service", "controller", "handler", "route", "model", "schema"].includes(t));
    // Build component ownership
    const ownership = new Map();
    for (const comp of model.components) {
        for (const item of comp.body) {
            const name = item.name;
            if (name)
                ownership.set(name, comp.name);
        }
    }
    const candidates = [];
    const allItems = [
        { type: "entity", items: model.entities },
        { type: "flow", items: model.flows },
        { type: "operation", items: model.operations },
        { type: "rule", items: model.rules },
        { type: "api", items: model.apis },
        { type: "screen", items: model.screens },
        { type: "action", items: model.actions },
        { type: "element", items: model.elements },
    ];
    for (const { type, items } of allItems) {
        for (const item of items) {
            const name = item.name ?? (type === "api" ? (item.style ?? "api") : null);
            if (!name)
                continue;
            const component = ownership.get(name) ?? null;
            if (componentFilter && (!component || component.toLowerCase() !== componentFilter))
                continue;
            const decorators = item.decorators ?? [];
            const hasImpl = decorators.some((d) => d.name === "impl");
            if (hasImpl)
                continue; // already has @impl
            // Heuristic: score by how many tokens from the file path appear in the construct name
            const nameLower = name.toLowerCase().replace(/[_-]/g, " ");
            let score = 0;
            for (const token of fileTokens) {
                if (nameLower.includes(token))
                    score++;
            }
            candidates.push({ type, name, component, matchScore: score });
        }
    }
    // Sort by match score descending, then name
    candidates.sort((a, b) => b.matchScore - a.matchScore || a.name.localeCompare(b.name));
    const suggestions = candidates.filter((c) => c.matchScore > 0);
    const noMatch = candidates.filter((c) => c.matchScore === 0);
    return {
        content: [{
                type: "text",
                text: JSON.stringify({
                    codePath: args.codePath,
                    fileTokens,
                    suggestions: suggestions.slice(0, 10),
                    otherWithoutImpl: noMatch.length,
                    message: suggestions.length > 0
                        ? `${suggestions.length} candidate(s) matched. Use mfd_verify mark to mark them.`
                        : "No name-based matches found. Check 'otherWithoutImpl' for all unimplemented constructs.",
                }, null, 2),
            }],
    };
}
// ===== helpers =====
function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
//# sourceMappingURL=verify.js.map