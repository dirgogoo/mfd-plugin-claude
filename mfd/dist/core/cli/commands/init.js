import { readFileSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "../../parser/index.js";
import { validate } from "../../validator/index.js";
const AVAILABLE_TEMPLATES = ["auth-basic", "crud-api", "event-driven"];
function toKebabCase(name) {
    return name
        .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
        .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
        .toLowerCase();
}
function findTemplatesDir() {
    // Walk up from this file to find the project root with templates/
    let dir = dirname(fileURLToPath(import.meta.url));
    for (let i = 0; i < 10; i++) {
        const candidate = join(dir, "templates");
        if (existsSync(candidate)) {
            return candidate;
        }
        dir = dirname(dir);
    }
    // Fallback: relative to cwd
    const cwdCandidate = resolve("templates");
    if (existsSync(cwdCandidate)) {
        return cwdCandidate;
    }
    throw new Error("Cannot find templates directory");
}
/**
 * Extract the inner body text of the first component found in a template file.
 * Returns the text between the opening `{` and closing `}` of that component.
 */
function extractTemplateBody(templateContent, projectName) {
    const content = templateContent.replace(/\{\{PROJECT_NAME\}\}/g, projectName);
    try {
        const doc = parse(content, {});
        // Look for the first ComponentDecl -- it may be nested inside a SystemDecl
        // or at the top level of the document (templates use both patterns).
        let comp;
        const system = doc.body.find((item) => item.type === "SystemDecl");
        if (system) {
            comp = system.body.find((item) => item.type === "ComponentDecl");
        }
        if (!comp) {
            comp = doc.body.find((item) => item.type === "ComponentDecl");
        }
        if (comp) {
            const start = comp.loc.start.offset;
            const end = comp.loc.end.offset;
            const compSource = content.slice(start, end);
            const bodyStart = compSource.indexOf("{") + 1;
            const bodyEnd = compSource.lastIndexOf("}");
            if (bodyStart > 0 && bodyEnd > bodyStart) {
                return compSource.slice(bodyStart, bodyEnd);
            }
        }
    }
    catch {
        // Fall through to default
    }
    return "  # TODO: Define component\n";
}
/**
 * Generate a multi-file project structure when --components is provided.
 *
 * Layout:
 *   <project>/
 *     model/
 *       main.mfd          # system wrapper with imports
 *       <component>.mfd   # one file per component
 */
function initMultiFile(name, componentNames, template, templatesDir) {
    const projectDir = resolve(name);
    if (existsSync(projectDir)) {
        console.error(`error: Directory '${name}' already exists`);
        process.exit(1);
    }
    const modelDir = join(projectDir, "model");
    mkdirSync(modelDir, { recursive: true });
    // Generate main.mfd with import statements
    const imports = componentNames.map((c) => `  import "${toKebabCase(c)}"`).join("\n");
    const mainContent = `system "${name}" @version(1.0) {\n${imports}\n}\n`;
    writeFileSync(join(modelDir, "main.mfd"), mainContent, "utf-8");
    console.log(`\u2713 Created ${name}/model/main.mfd`);
    // Generate one file per component
    for (let i = 0; i < componentNames.length; i++) {
        const compName = componentNames[i];
        const filename = toKebabCase(compName) + ".mfd";
        let content;
        // If a template is provided and this is the first component, seed it from the template
        if (i === 0 && template) {
            try {
                const templateFile = join(templatesDir, `${template}.mfd`);
                if (existsSync(templateFile)) {
                    const templateContent = readFileSync(templateFile, "utf-8");
                    const body = extractTemplateBody(templateContent, name);
                    content = `component ${compName} @status(active) {\n${body}}\n`;
                }
                else {
                    content = `component ${compName} @status(pending) {\n  # TODO: Define ${compName} component\n}\n`;
                }
            }
            catch {
                content = `component ${compName} @status(pending) {\n  # TODO: Define ${compName} component\n}\n`;
            }
        }
        else {
            content = `component ${compName} @status(pending) {\n  # TODO: Define ${compName} component\n}\n`;
        }
        writeFileSync(join(modelDir, filename), content, "utf-8");
        console.log(`\u2713 Created ${name}/model/${filename}`);
    }
    // Attempt lightweight validation of the generated main file
    try {
        const mainSource = readFileSync(join(modelDir, "main.mfd"), "utf-8");
        parse(mainSource, { source: join(modelDir, "main.mfd") });
        console.log(`\u2713 Validated model structure`);
    }
    catch {
        console.log("\u26a0 Could not validate \u2014 run 'mfd validate' manually");
    }
    console.log();
    console.log(`\u2192 Next steps:`);
    console.log(`  cd ${name}`);
    console.log(`  mfd validate model/main.mfd --resolve`);
    console.log(`  mfd stats model/main.mfd --resolve`);
}
export function initCommand(options) {
    const template = options.template || "crud-api";
    const name = options.name || "MyProject";
    // Validate template name
    if (!AVAILABLE_TEMPLATES.includes(template)) {
        console.error(`error: Unknown template '${template}'. Available: ${AVAILABLE_TEMPLATES.join(", ")}`);
        process.exit(1);
    }
    // Find template directory
    let templatesDir;
    try {
        templatesDir = findTemplatesDir();
    }
    catch {
        console.error("error: Cannot find templates directory");
        process.exit(1);
    }
    // Multi-file mode when --components is provided
    if (options.components) {
        const componentNames = options.components
            .split(",")
            .map((c) => c.trim())
            .filter((c) => c.length > 0);
        if (componentNames.length === 0) {
            console.error("error: --components requires at least one component name");
            process.exit(1);
        }
        initMultiFile(name, componentNames, template, templatesDir);
        return;
    }
    // --- Single-file mode (existing behavior) ---
    const templateFile = join(templatesDir, `${template}.mfd`);
    if (!existsSync(templateFile)) {
        console.error(`error: Template file not found: ${templateFile}`);
        process.exit(1);
    }
    // Read template
    let templateContent;
    try {
        templateContent = readFileSync(templateFile, "utf-8");
    }
    catch {
        console.error(`error: Cannot read template '${templateFile}'`);
        process.exit(1);
    }
    // Replace placeholders
    const modelContent = templateContent.replace(/\{\{PROJECT_NAME\}\}/g, name);
    // Create project directory
    const projectDir = resolve(name);
    if (existsSync(projectDir)) {
        console.error(`error: Directory '${name}' already exists`);
        process.exit(1);
    }
    mkdirSync(projectDir, { recursive: true });
    // Write model file
    const modelPath = join(projectDir, "model.mfd");
    writeFileSync(modelPath, modelContent, "utf-8");
    console.log(`\u2713 Created ${name}/model.mfd`);
    // Validate the generated model
    try {
        const doc = parse(modelContent, { source: modelPath });
        const result = validate(doc);
        if (result.errors.length === 0) {
            console.log(`\u2713 Validated model (0 errors${result.warnings.length > 0 ? `, ${result.warnings.length} warning(s)` : ""})`);
        }
        else {
            console.log(`\u26a0 Model has ${result.errors.length} error(s) \u2014 run 'mfd validate ${name}/model.mfd' for details`);
        }
    }
    catch {
        console.log("\u26a0 Could not validate model \u2014 run 'mfd validate' manually");
    }
    console.log();
    console.log(`\u2192 Next steps:`);
    console.log(`  cd ${name}`);
    console.log(`  mfd stats model.mfd`);
    console.log(`  mfd validate model.mfd`);
}
//# sourceMappingURL=init.js.map