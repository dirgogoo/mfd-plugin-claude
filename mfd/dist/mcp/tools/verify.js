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
    // Collect ALL @impl constructs first (to compute auto threshold)
    const allImpl = [];
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
            allImpl.push({ type, name, component, impl, verifiedCount });
        }
    }
    // Auto threshold: min verifiedCount across all @impl constructs in scope + 1
    // This ensures the current "round" includes constructs not yet verified at this level.
    // If caller explicitly passes threshold, that overrides auto.
    const minVerified = allImpl.length > 0 ? Math.min(...allImpl.map((e) => e.verifiedCount)) : 0;
    const threshold = args.threshold ?? (minVerified + 1);
    const pending = allImpl.filter((e) => e.verifiedCount < threshold);
    // Sort by verifiedCount ascending (lowest first = highest priority), then alphabetically by name
    pending.sort((a, b) => a.verifiedCount - b.verifiedCount || a.name.localeCompare(b.name));
    const withImpl = allImpl.length;
    const totalPending = pending.length;
    // group_by="component": return constructs grouped by component instead of flat list
    if (args.group_by === "component") {
        const groups = {};
        for (const entry of pending) {
            const key = entry.component ?? "(unowned)";
            if (!groups[key])
                groups[key] = [];
            groups[key].push(entry);
        }
        // Sort component names alphabetically; within each group already sorted by verifiedCount/name
        const sortedGroups = Object.fromEntries(Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)));
        return {
            content: [{
                    type: "text",
                    text: JSON.stringify({
                        summary: {
                            total_pending: totalPending,
                            components_with_pending: Object.keys(sortedGroups).length,
                            withImpl,
                            pct_verified: withImpl > 0 ? Math.round(((withImpl - totalPending) / withImpl) * 100) : 100,
                            threshold,
                            threshold_source: args.threshold != null ? "explicit" : "auto",
                            sorted_by: "component asc, verifiedCount asc, name asc",
                        },
                        groups: sortedGroups,
                    }, null, 2),
                }],
        };
    }
    // Flat list with optional batch_size/page
    const batchSize = args.batch_size;
    const page = args.page ?? 0;
    const offset = batchSize != null ? page * batchSize : 0;
    const batch = batchSize != null ? pending.slice(offset, offset + batchSize) : pending;
    const hasMore = batchSize != null ? offset + batchSize < totalPending : false;
    const totalPages = batchSize != null ? Math.ceil(totalPending / batchSize) : 1;
    return {
        content: [{
                type: "text",
                text: JSON.stringify({
                    summary: {
                        returned: batch.length,
                        total_pending: totalPending,
                        has_more: hasMore,
                        ...(batchSize != null && { page, total_pages: totalPages, batch_size: batchSize }),
                        withImpl,
                        pct_verified: withImpl > 0 ? Math.round(((withImpl - totalPending) / withImpl) * 100) : 100,
                        threshold,
                        threshold_source: args.threshold != null ? "explicit" : "auto",
                        sorted_by: "verifiedCount asc, name asc",
                    },
                    pending: batch,
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