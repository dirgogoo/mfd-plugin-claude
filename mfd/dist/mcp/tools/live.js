import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { collectModel } from "../../core/validator/collect.js";
import { loadDocument } from "./common.js";
import { stripAllVerified } from "../../core/cli/commands/strip-verified.js";
export function handleLive(args) {
    switch (args.action) {
        case "mark":
            return handleMarkLive(args);
        case "strip":
            return handleStripLive(args);
        case "strip-all":
            return handleStripAll(args);
        case "list-pending":
            return handleListPending(args);
        default:
            return {
                content: [{ type: "text", text: `Unknown action: ${args.action}` }],
                isError: true,
            };
    }
}
// ===== mark =====
// Increments @live(N) by 1, or adds @live(1) if absent.
function handleMarkLive(args) {
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
    // Extract current @live(N) or @live
    const existingLive = /@live\s*\((\d+)\)/.exec(line);
    const existingLiveNoParam = /@live\b(?!\s*\()/.exec(line);
    let newLine;
    let newCount;
    if (existingLive) {
        const current = parseInt(existingLive[1], 10);
        newCount = current + 1;
        newLine = line.replace(/@live\s*\(\d+\)/, `@live(${newCount})`);
    }
    else if (existingLiveNoParam) {
        // @live without parens — treat as @live(1), increment to @live(2)
        newCount = 2;
        newLine = line.replace(/@live\b(?!\s*\()/, `@live(${newCount})`);
    }
    else {
        // No @live — insert @live(1) before opening brace or at end
        newCount = 1;
        const braceIdx = line.indexOf("{");
        if (braceIdx >= 0) {
            newLine = line.substring(0, braceIdx).trimEnd() + ` @live(1) ` + line.substring(braceIdx);
        }
        else {
            newLine = line.trimEnd() + ` @live(1)`;
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
                    live: newCount,
                    file: args.file,
                    line: targetLineIdx + 1,
                }, null, 2),
            }],
    };
}
// ===== strip =====
// Removes @live from a specific construct.
function handleStripLive(args) {
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
    const hadLive = /@live\b/.test(line);
    if (!hadLive) {
        return {
            content: [{
                    type: "text",
                    text: JSON.stringify({
                        success: true,
                        construct: args.construct,
                        stripped: false,
                        message: "Construct had no @live decorator",
                        file: args.file,
                    }, null, 2),
                }],
        };
    }
    lines[targetLineIdx] = line
        .replace(/[ \t]*@live\s*\([^)]*\)/g, "")
        .replace(/[ \t]*@live\b(?!\s*\()/g, "")
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
// Removes ALL @live decorators from the file (via stripAllVerified which now strips both @verified and @live).
function handleStripAll(args) {
    const absPath = resolve(args.file);
    const source = readFileSync(absPath, "utf-8");
    // stripAllVerified also strips @live after the extension in strip-verified.ts
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
                        ? `Stripped ${count} @verified/@live decorator(s)`
                        : "No @verified or @live decorators found",
                }, null, 2),
            }],
    };
}
// ===== list-pending =====
// Lists constructs with @impl but @live absent or @live(N) < threshold.
// Primary focus: journey, screen, action, api (but supports all trackable constructs).
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
        { type: "journey", items: model.journeys },
        { type: "screen", items: model.screens },
        { type: "action", items: model.actions },
        { type: "api", items: model.apis },
        { type: "entity", items: model.entities },
        { type: "enum", items: model.enums },
        { type: "flow", items: model.flows },
        { type: "state", items: model.states },
        { type: "event", items: model.events },
        { type: "signal", items: model.signals },
        { type: "operation", items: model.operations },
        { type: "element", items: model.elements },
        { type: "rule", items: model.rules },
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
            const liveDec = decorators.find((d) => d.name === "live");
            const liveCount = liveDec
                ? (liveDec.params[0] ? parseInt(String(liveDec.params[0].value), 10) || 1 : 1)
                : 0;
            allImpl.push({ type, name, component, impl, liveCount });
        }
    }
    // Auto threshold: min liveCount across all @impl constructs in scope + 1
    const minLive = allImpl.length > 0 ? Math.min(...allImpl.map((e) => e.liveCount)) : 0;
    const threshold = args.threshold ?? (minLive + 1);
    const pending = allImpl.filter((e) => e.liveCount < threshold);
    // Sort: journey/screen/action/api first (primary focus), then by liveCount ascending, then name
    const primaryTypes = new Set(["journey", "screen", "action", "api"]);
    pending.sort((a, b) => {
        const aIsPrimary = primaryTypes.has(a.type) ? 0 : 1;
        const bIsPrimary = primaryTypes.has(b.type) ? 0 : 1;
        if (aIsPrimary !== bIsPrimary)
            return aIsPrimary - bIsPrimary;
        return a.liveCount - b.liveCount || a.name.localeCompare(b.name);
    });
    const withImpl = allImpl.length;
    const totalPending = pending.length;
    const PAGE_SIZE = 20;
    const pctLive = withImpl > 0 ? Math.round(((withImpl - totalPending) / withImpl) * 100) : 100;
    const thresholdSource = args.threshold != null ? "explicit" : "auto";
    // With component filter: return paginated flat list
    if (args.component) {
        const page = args.page ?? 0;
        const paged = pending.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
        const hasMore = (page + 1) * PAGE_SIZE < totalPending;
        const totalPages = Math.ceil(totalPending / PAGE_SIZE);
        return {
            content: [{
                    type: "text",
                    text: JSON.stringify({
                        summary: {
                            component: args.component,
                            total: totalPending,
                            returned: paged.length,
                            has_more: hasMore,
                            page,
                            total_pages: totalPages,
                            withImpl,
                            pct_live: pctLive,
                            threshold,
                            threshold_source: thresholdSource,
                        },
                        pending: paged,
                    }, null, 2),
                }],
        };
    }
    // No component filter: return all pending grouped by component
    const byComponent = new Map();
    for (const entry of pending) {
        const key = entry.component ?? "(unowned)";
        if (!byComponent.has(key))
            byComponent.set(key, []);
        byComponent.get(key).push(entry);
    }
    const sortedComponents = [...byComponent.entries()].sort(([a], [b]) => a.localeCompare(b));
    const batches = [];
    for (const [component, constructs] of sortedComponents) {
        const totalBatches = Math.ceil(constructs.length / PAGE_SIZE);
        for (let i = 0; i < totalBatches; i++) {
            batches.push({
                component,
                batch: i + 1,
                total_batches: totalBatches,
                constructs: constructs.slice(i * PAGE_SIZE, (i + 1) * PAGE_SIZE),
            });
        }
    }
    return {
        content: [{
                type: "text",
                text: JSON.stringify({
                    summary: {
                        total_pending: totalPending,
                        total_batches: batches.length,
                        components_with_pending: sortedComponents.length,
                        withImpl,
                        pct_live: pctLive,
                        threshold,
                        threshold_source: thresholdSource,
                    },
                    batches,
                }, null, 2),
            }],
    };
}
// ===== helpers =====
function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
//# sourceMappingURL=live.js.map