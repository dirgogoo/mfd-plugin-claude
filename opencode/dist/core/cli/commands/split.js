import { readFileSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { parse } from "../../parser/index.js";
import { MfdParseError } from "../../parser/errors.js";
import { resolveFile } from "../../resolver/index.js";
import { validate } from "../../validator/index.js";
function toKebabCase(name) {
    return name
        .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
        .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
        .toLowerCase();
}
function formatDecoratorValue(v) {
    switch (v.kind) {
        case "string":
            return `"${v.value}"`;
        case "number":
            return String(v.value);
        case "identifier":
            return v.value;
        case "duration":
            return `${v.value}${v.unit}`;
        case "rate":
            return `${v.value}/${v.unit}`;
        default:
            return String(v.value);
    }
}
function formatDecorators(decorators) {
    if (decorators.length === 0)
        return "";
    return (" " +
        decorators
            .map((d) => {
            if (d.params.length === 0)
                return `@${d.name}`;
            const params = d.params.map(formatDecoratorValue).join(", ");
            return `@${d.name}(${params})`;
        })
            .join(" "));
}
export function splitCommand(file, options) {
    const filePath = resolve(file);
    let source;
    try {
        source = readFileSync(filePath, "utf-8");
    }
    catch {
        console.error(`error: Cannot read file '${filePath}'`);
        process.exit(1);
    }
    // Parse the monolithic file
    let doc;
    try {
        doc = parse(source, { source: filePath });
    }
    catch (err) {
        if (err instanceof MfdParseError) {
            console.error(err.format(source));
        }
        else {
            const msg = err instanceof Error ? err.message : String(err);
            console.error(`error: Parse error: ${msg}`);
        }
        process.exit(1);
    }
    // Find the SystemDecl (if any)
    const systemDecl = doc.body.find((item) => item.type === "SystemDecl");
    // Check if system body contains actual ComponentDecl nodes (not just comments)
    const systemComponents = systemDecl
        ? systemDecl.body.filter((item) => item.type === "ComponentDecl")
        : [];
    if (systemDecl && systemComponents.length > 0) {
        // System has inline components — split from system body
        const components = systemComponents;
        const systemComments = systemDecl.body.filter((item) => item.type === "SemanticComment");
        // Shared items = everything outside the system declaration
        const sharedItems = doc.body.filter((item) => item.type !== "SystemDecl" && item.type !== "SemanticComment");
        const plan = buildPlanFromSystem(systemDecl, components, systemComments, sharedItems, source);
        executePlan(plan, filePath, options);
        return;
    }
    // No system with inline components — look for top-level components
    const topComponents = doc.body.filter((item) => item.type === "ComponentDecl");
    if (topComponents.length === 0) {
        console.error("error: No components found (neither in system body nor at top level). Nothing to split.");
        process.exit(1);
    }
    // Shared items = everything that is not a component or semantic comment
    const sharedItems = doc.body.filter((item) => item.type !== "ComponentDecl" &&
        item.type !== "SemanticComment");
    const plan = buildPlanFromTopLevel(systemDecl, topComponents, sharedItems, source);
    executePlan(plan, filePath, options);
}
// ---------------------------------------------------------------------------
// Plan builders
// ---------------------------------------------------------------------------
function buildPlanFromSystem(sys, components, systemComments, sharedItems, source) {
    const plan = [];
    const hasShared = sharedItems.length > 0;
    // 1. Component files
    for (const comp of components) {
        const filename = toKebabCase(comp.name) + ".mfd";
        const content = extractSourceSlice(comp, source);
        plan.push({ filename, content, lines: content.split("\n").length });
    }
    // 2. Shared file (entities, enums, events, etc. outside the system)
    if (hasShared) {
        const content = extractMultipleSourceSlices(sharedItems, source);
        plan.push({
            filename: "shared.mfd",
            content,
            lines: content.split("\n").length,
        });
    }
    // 3. Main file with system wrapper and imports
    const mainContent = generateSystemMainFile(sys, components, systemComments, hasShared);
    plan.push({
        filename: "main.mfd",
        content: mainContent,
        lines: mainContent.split("\n").length,
    });
    return plan;
}
function buildPlanFromTopLevel(systemDecl, components, sharedItems, source) {
    const plan = [];
    // Filter shared items: exclude the system declaration itself (it goes in main.mfd)
    const nonSystemShared = sharedItems.filter((item) => item.type !== "SystemDecl");
    const hasShared = nonSystemShared.length > 0;
    // 1. Component files
    for (const comp of components) {
        const filename = toKebabCase(comp.name) + ".mfd";
        const content = extractSourceSlice(comp, source);
        plan.push({ filename, content, lines: content.split("\n").length });
    }
    // 2. Shared file
    if (hasShared) {
        const content = extractMultipleSourceSlices(nonSystemShared, source);
        plan.push({
            filename: "shared.mfd",
            content,
            lines: content.split("\n").length,
        });
    }
    // 3. Main file
    const mainContent = generateTopLevelMainFile(systemDecl, components, hasShared);
    plan.push({
        filename: "main.mfd",
        content: mainContent,
        lines: mainContent.split("\n").length,
    });
    return plan;
}
// ---------------------------------------------------------------------------
// Source extraction
// ---------------------------------------------------------------------------
/**
 * Extract the original source text for an AST node using its location offsets.
 * This preserves formatting, comments, and whitespace exactly as authored.
 */
function extractSourceSlice(node, source) {
    const start = node.loc.start.offset;
    const end = node.loc.end.offset;
    let content = source.slice(start, end).trim();
    if (!content.endsWith("\n")) {
        content += "\n";
    }
    return content;
}
/**
 * Extract and concatenate source slices for multiple nodes, preserving
 * any leading semantic comments that appear between nodes.
 */
function extractMultipleSourceSlices(items, source) {
    const parts = [];
    for (const item of items) {
        parts.push(extractSourceSlice(item, source).trim());
    }
    return parts.join("\n\n") + "\n";
}
// ---------------------------------------------------------------------------
// Main file generation
// ---------------------------------------------------------------------------
function generateSystemMainFile(sys, components, comments, hasShared) {
    const lines = [];
    const decos = formatDecorators(sys.decorators);
    lines.push(`system "${sys.name}"${decos} {`);
    // Preserve system-level semantic comments
    for (const c of comments) {
        lines.push(`  # ${c.text}`);
    }
    if (comments.length > 0) {
        lines.push("");
    }
    // Imports
    if (hasShared) {
        lines.push(`  import "shared"`);
    }
    for (const comp of components) {
        lines.push(`  import "${toKebabCase(comp.name)}"`);
    }
    lines.push("}");
    lines.push("");
    return lines.join("\n");
}
function generateTopLevelMainFile(systemDecl, components, hasShared) {
    const lines = [];
    // Reproduce the system declaration if there was one (with empty body, or comments only)
    if (systemDecl) {
        const decos = formatDecorators(systemDecl.decorators);
        const comments = systemDecl.body.filter((item) => item.type === "SemanticComment");
        lines.push(`system "${systemDecl.name}"${decos} {`);
        for (const c of comments) {
            lines.push(`  # ${c.text}`);
        }
        lines.push("}");
        lines.push("");
    }
    // Imports
    if (hasShared) {
        lines.push(`import "shared"`);
    }
    for (const comp of components) {
        lines.push(`import "${toKebabCase(comp.name)}"`);
    }
    lines.push("");
    return lines.join("\n");
}
// ---------------------------------------------------------------------------
// Execution
// ---------------------------------------------------------------------------
function executePlan(plan, sourceFilePath, options) {
    // Dry-run: show plan and exit
    if (options.dryRun) {
        console.log("=== Split Plan (dry-run) ===\n");
        console.log(`Source: ${sourceFilePath}`);
        console.log(`Output: ${resolve(options.output)}/\n`);
        for (const f of plan) {
            console.log(`  ${f.filename} (${f.lines} lines)`);
        }
        console.log(`\nTotal: ${plan.length} files`);
        return;
    }
    // Create output directory
    const outputDir = resolve(options.output);
    mkdirSync(outputDir, { recursive: true });
    // Check for existing files that would be overwritten
    const existing = plan.filter((f) => existsSync(join(outputDir, f.filename)));
    if (existing.length > 0) {
        console.error(`error: Output directory already contains: ${existing.map((f) => f.filename).join(", ")}`);
        console.error("Use a different --output directory or remove existing files.");
        process.exit(1);
    }
    // Write all files
    for (const f of plan) {
        const outPath = join(outputDir, f.filename);
        writeFileSync(outPath, f.content, "utf-8");
        console.log(`\u2713 ${f.filename} (${f.lines} lines)`);
    }
    // Validate the split result
    const mainPath = join(outputDir, "main.mfd");
    try {
        const result = resolveFile(mainPath);
        if (result.errors.length > 0) {
            console.log(`\n\u26a0 Resolution warnings:`);
            for (const err of result.errors) {
                console.log(`  ${err.message}`);
            }
        }
        else {
            const valResult = validate(result.document);
            if (valResult.errors.length === 0) {
                console.log(`\n\u2713 Validated: model resolves correctly`);
            }
            else {
                console.log(`\n\u26a0 ${valResult.errors.length} validation error(s) -- check with: mfd validate ${mainPath}`);
            }
        }
    }
    catch {
        console.log(`\n\u26a0 Could not validate split result -- check manually`);
    }
    console.log(`\n${plan.length} files created in ${outputDir}`);
}
//# sourceMappingURL=split.js.map