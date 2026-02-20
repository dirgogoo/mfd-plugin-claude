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
        return handleMarkDecorator(args.file, args.mark.construct, args.mark.paths, "impl");
    }
    if (args.markTests) {
        return handleMarkDecorator(args.file, args.markTests.construct, args.markTests.paths, "tests");
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
            const verifiedDeco = decorators.find((d) => d.name === "verified");
            const implPaths = [];
            if (implDeco) {
                for (const p of implDeco.params) {
                    const val = p.kind === "string" || p.kind === "identifier" ? String(p.value) : null;
                    if (val)
                        implPaths.push(val);
                }
            }
            const testsPaths = [];
            if (testsDeco) {
                for (const p of testsDeco.params) {
                    const val = p.kind === "string" || p.kind === "identifier" ? String(p.value) : null;
                    if (val)
                        testsPaths.push(val);
                }
            }
            const verifiedCount = verifiedDeco
                ? (verifiedDeco.params[0] ? parseInt(String(verifiedDeco.params[0].value), 10) || 1 : 1)
                : null;
            // Check if files exist (both @impl and @tests paths)
            const fileStatus = {};
            for (const p of implPaths) {
                const fullPath = resolve(projectRoot, p);
                fileStatus[p] = existsSync(fullPath);
            }
            for (const p of testsPaths) {
                // Only check paths that look like file paths (contain /)
                if (p.includes("/")) {
                    const fullPath = resolve(projectRoot, p);
                    fileStatus[p] = existsSync(fullPath);
                }
            }
            entries.push({ type, name, component, impl: implPaths, tests: testsPaths, verified: verifiedCount, fileStatus });
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
        const verifiedDeco = decorators.find((d) => d.name === "verified");
        const implPaths = [];
        if (implDeco) {
            for (const p of implDeco.params) {
                const val = p.kind === "string" || p.kind === "identifier" ? String(p.value) : null;
                if (val)
                    implPaths.push(val);
            }
        }
        const testsPaths = [];
        if (testsDeco) {
            for (const p of testsDeco.params) {
                const val = p.kind === "string" || p.kind === "identifier" ? String(p.value) : null;
                if (val)
                    testsPaths.push(val);
            }
        }
        const verifiedCount = verifiedDeco
            ? (verifiedDeco.params[0] ? parseInt(String(verifiedDeco.params[0].value), 10) || 1 : 1)
            : null;
        const fileStatus = {};
        for (const p of implPaths) {
            const fullPath = resolve(projectRoot, p);
            fileStatus[p] = existsSync(fullPath);
        }
        for (const p of testsPaths) {
            if (p.includes("/")) {
                const fullPath = resolve(projectRoot, p);
                fileStatus[p] = existsSync(fullPath);
            }
        }
        entries.push({ type: "api", name, component, impl: implPaths, tests: testsPaths, verified: verifiedCount, fileStatus });
    }
    const total = entries.length;
    const implemented = entries.filter(e => e.impl.length > 0).length;
    const pending = total - implemented;
    const tested = entries.filter(e => e.tests.length > 0).length;
    const verified = entries.filter(e => e.verified !== null).length;
    const missingFiles = entries.reduce((count, e) => {
        return count + Object.values(e.fileStatus).filter(v => !v).length;
    }, 0);
    const result = {
        summary: {
            total,
            implemented,
            pending,
            tested,
            verified,
            missingFiles,
            implPct: total > 0 ? Math.round((implemented / total) * 100) : 0,
            verifiedPct: implemented > 0 ? Math.round((verified / implemented) * 100) : 0,
        },
        entries,
    };
    return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
}
function handleMarkDecorator(file, constructName, paths, decorator) {
    const absPath = resolve(file);
    const source = readFileSync(absPath, "utf-8");
    const lines = source.split("\n");
    const pathValue = paths.join(", ");
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
                    text: `Could not find construct "${constructName}" in ${file}`,
                }],
            isError: true,
        };
    }
    const line = lines[targetLineIdx];
    // Check if @decorator already exists on this line
    const decoRegex = new RegExp(`@${decorator}\\([^)]*\\)`);
    if (decoRegex.test(line)) {
        // Replace existing decorator
        lines[targetLineIdx] = line.replace(decoRegex, `@${decorator}(${pathValue})`);
    }
    else {
        // Insert decorator before the opening brace or at end of declaration
        const braceIdx = line.indexOf("{");
        if (braceIdx >= 0) {
            lines[targetLineIdx] =
                line.substring(0, braceIdx).trimEnd() + ` @${decorator}(${pathValue}) ` + line.substring(braceIdx);
        }
        else {
            // No brace on this line — append decorator at end
            lines[targetLineIdx] = line.trimEnd() + ` @${decorator}(${pathValue})`;
        }
    }
    writeFileSync(absPath, lines.join("\n"), "utf-8");
    return {
        content: [{
                type: "text",
                text: JSON.stringify({
                    success: true,
                    construct: constructName,
                    [decorator]: paths,
                    file,
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