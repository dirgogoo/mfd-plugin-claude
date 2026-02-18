import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { collectModel } from "../../core/validator/collect.js";
import { loadDocument } from "./common.js";
/**
 * Traceability tool: reads @impl/@tests decorators and verifies file existence.
 * Also supports writing @impl back to the .mfd file.
 */
export function handleTrace(args) {
    if (args.mark) {
        return handleMark(args);
    }
    return handleRead(args);
}
function handleRead(args) {
    const { doc } = loadDocument(args.file, args.resolve_includes);
    const model = collectModel(doc);
    const projectRoot = findProjectRoot(args.file);
    const componentFilter = args.component?.toLowerCase() ?? null;
    const nameFilter = args.name?.toLowerCase() ?? null;
    // Walk all component bodies to get component ownership
    const ownership = new Map();
    for (const comp of model.components) {
        for (const item of comp.body) {
            const name = item.name;
            if (name)
                ownership.set(name, comp.name);
        }
    }
    const entries = [];
    const collections = [
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
    ];
    for (const { type, items } of collections) {
        for (const item of items) {
            const name = item.name;
            if (!name)
                continue;
            const component = ownership.get(name) ?? null;
            if (componentFilter && (!component || component.toLowerCase() !== componentFilter))
                continue;
            if (nameFilter && !name.toLowerCase().includes(nameFilter))
                continue;
            const decorators = item.decorators ?? [];
            const implDeco = decorators.find((d) => d.name === "impl");
            const testsDeco = decorators.find((d) => d.name === "tests");
            const implPaths = [];
            if (implDeco) {
                for (const p of implDeco.params) {
                    const val = p.kind === "string" || p.kind === "identifier" ? String(p.value) : null;
                    if (val)
                        implPaths.push(val);
                }
            }
            const testsValue = testsDeco?.params?.[0]
                ? String(testsDeco.params[0].value)
                : null;
            // Check if files exist
            const fileStatus = {};
            for (const p of implPaths) {
                const fullPath = resolve(projectRoot, p);
                fileStatus[p] = existsSync(fullPath);
            }
            entries.push({ type, name, component, impl: implPaths, tests: testsValue, fileStatus });
        }
    }
    // Also check APIs
    for (const api of model.apis) {
        const name = api.name ?? api.style ?? "api";
        const component = ownership.get(name) ?? null;
        if (componentFilter && (!component || component.toLowerCase() !== componentFilter))
            continue;
        if (nameFilter && !name.toLowerCase().includes(nameFilter))
            continue;
        const decorators = api.decorators ?? [];
        const implDeco = decorators.find((d) => d.name === "impl");
        const testsDeco = decorators.find((d) => d.name === "tests");
        const implPaths = [];
        if (implDeco) {
            for (const p of implDeco.params) {
                const val = p.kind === "string" || p.kind === "identifier" ? String(p.value) : null;
                if (val)
                    implPaths.push(val);
            }
        }
        const testsValue = testsDeco?.params?.[0]
            ? String(testsDeco.params[0].value)
            : null;
        const fileStatus = {};
        for (const p of implPaths) {
            const fullPath = resolve(projectRoot, p);
            fileStatus[p] = existsSync(fullPath);
        }
        entries.push({ type: "api", name, component, impl: implPaths, tests: testsValue, fileStatus });
    }
    const total = entries.length;
    const implemented = entries.filter(e => e.impl.length > 0).length;
    const pending = total - implemented;
    const tested = entries.filter(e => e.tests !== null).length;
    const missingFiles = entries.reduce((count, e) => {
        return count + Object.values(e.fileStatus).filter(v => !v).length;
    }, 0);
    const result = {
        summary: {
            total,
            implemented,
            pending,
            tested,
            missingFiles,
            implPct: total > 0 ? Math.round((implemented / total) * 100) : 0,
        },
        entries,
    };
    return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
}
function handleMark(args) {
    const mark = args.mark;
    const absPath = resolve(args.file);
    const source = readFileSync(absPath, "utf-8");
    const lines = source.split("\n");
    const constructName = mark.construct;
    const paths = mark.paths;
    const implValue = paths.join(", ");
    // Find the line that declares this construct
    // Pattern: "entity Name", "flow name", etc. — with possible decorators
    const declRegex = new RegExp(`^(\\s*)(entity|flow|screen|enum|state|event|signal|operation|action|element|rule|journey|api)\\s+${escapeRegex(constructName)}\\b`);
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
                    text: `Could not find construct "${constructName}" in ${args.file}`,
                }],
            isError: true,
        };
    }
    const line = lines[targetLineIdx];
    // Check if @impl already exists on this line
    const implRegex = /@impl\([^)]*\)/;
    if (implRegex.test(line)) {
        // Replace existing @impl
        lines[targetLineIdx] = line.replace(implRegex, `@impl(${implValue})`);
    }
    else {
        // Insert @impl before the opening brace or at end of declaration
        const braceIdx = line.indexOf("{");
        if (braceIdx >= 0) {
            lines[targetLineIdx] =
                line.substring(0, braceIdx).trimEnd() + ` @impl(${implValue}) ` + line.substring(braceIdx);
        }
        else {
            // No brace on this line — append @impl at end
            lines[targetLineIdx] = line.trimEnd() + ` @impl(${implValue})`;
        }
    }
    writeFileSync(absPath, lines.join("\n"), "utf-8");
    return {
        content: [{
                type: "text",
                text: JSON.stringify({
                    success: true,
                    construct: constructName,
                    impl: paths,
                    file: args.file,
                    line: targetLineIdx + 1,
                }, null, 2),
            }],
    };
}
function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function findProjectRoot(filePath) {
    let dir = dirname(resolve(filePath));
    for (let i = 0; i < 10; i++) {
        if (existsSync(resolve(dir, "package.json")) || existsSync(resolve(dir, ".git"))) {
            return dir;
        }
        const parent = dirname(dir);
        if (parent === dir)
            break;
        dir = parent;
    }
    return dirname(resolve(filePath));
}
//# sourceMappingURL=trace.js.map