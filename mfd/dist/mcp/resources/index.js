import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// ---------------------------------------------------------------------------
// Directory discovery (same pattern as prompt.ts)
// ---------------------------------------------------------------------------
function findDir(relPath) {
    // Primary: relative to source (monorepo layout)
    const primary = join(__dirname, "..", "..", relPath);
    if (existsSync(primary))
        return primary;
    // Fallback: walk up looking for directory
    let dir = __dirname;
    for (let i = 0; i < 10; i++) {
        const candidate = join(dir, relPath);
        if (existsSync(candidate))
            return candidate;
        const parent = dirname(dir);
        if (parent === dir)
            break;
        dir = parent;
    }
    return primary;
}
const resourcesDir = findDir("resources");
const templatesDir = findDir("../../templates");
const fixturesDir = findDir("../../packages/mfd-core/tests/fixtures/valid");
const RESOURCE_REGISTRY = [
    // Guidelines
    {
        uri: "mfd://guidelines/syntax-reference",
        name: "MFD-DSL Syntax Reference",
        description: "Complete cheatsheet of all 19 MFD-DSL constructs with correct syntax, common mistakes, and decision trees",
        mimeType: "text/markdown",
    },
    {
        uri: "mfd://guidelines/common-mistakes",
        name: "MFD-DSL Common Mistakes",
        description: "Top 10 errors when writing .mfd files with wrong vs correct examples and pre-validation checklist",
        mimeType: "text/markdown",
    },
    // Templates
    {
        uri: "mfd://templates/auth-basic",
        name: "Template: Basic Auth",
        description: "Authentication component template with User entity, login/register flows, JWT",
        mimeType: "text/plain",
    },
    {
        uri: "mfd://templates/crud-api",
        name: "Template: CRUD API",
        description: "CRUD component template with entity, API endpoints, state machine",
        mimeType: "text/plain",
    },
    {
        uri: "mfd://templates/event-driven",
        name: "Template: Event-Driven",
        description: "Event-driven component template with events, flows, operations",
        mimeType: "text/plain",
    },
    // Examples (from test fixtures)
    {
        uri: "mfd://examples/ecommerce",
        name: "Example: E-Commerce",
        description: "Complete e-commerce system with products, orders, payments, and state machines",
        mimeType: "text/plain",
    },
    {
        uri: "mfd://examples/taskmanager-auth",
        name: "Example: Task Manager with Auth",
        description: "Task management system with authentication, projects, and permissions",
        mimeType: "text/plain",
    },
    {
        uri: "mfd://examples/notification-hub",
        name: "Example: Notification Hub",
        description: "Notification system with channels, templates, and delivery tracking",
        mimeType: "text/plain",
    },
    {
        uri: "mfd://examples/library-frontend",
        name: "Example: Library Frontend",
        description: "Frontend-focused example with screens, elements, actions, signals, and journeys",
        mimeType: "text/plain",
    },
];
// ---------------------------------------------------------------------------
// File resolution
// ---------------------------------------------------------------------------
function resolveResourceFile(uri) {
    // Guidelines: resources/*.md
    if (uri === "mfd://guidelines/syntax-reference") {
        const p = join(resourcesDir, "syntax-reference.md");
        return existsSync(p) ? p : null;
    }
    if (uri === "mfd://guidelines/common-mistakes") {
        const p = join(resourcesDir, "common-mistakes.md");
        return existsSync(p) ? p : null;
    }
    // Templates: templates/*.mfd
    if (uri.startsWith("mfd://templates/")) {
        const name = uri.replace("mfd://templates/", "");
        const p = join(templatesDir, `${name}.mfd`);
        return existsSync(p) ? p : null;
    }
    // Examples: test fixtures
    const exampleMap = {
        "mfd://examples/ecommerce": "ecommerce.mfd",
        "mfd://examples/taskmanager-auth": "taskmanager-auth.mfd",
        "mfd://examples/notification-hub": "notification-hub.mfd",
        "mfd://examples/library-frontend": "library-frontend.mfd",
    };
    if (exampleMap[uri]) {
        const p = join(fixturesDir, exampleMap[uri]);
        return existsSync(p) ? p : null;
    }
    return null;
}
// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------
export function handleListResources() {
    return {
        resources: RESOURCE_REGISTRY.map((r) => ({
            uri: r.uri,
            name: r.name,
            description: r.description,
            mimeType: r.mimeType,
        })),
    };
}
export function handleReadResource(uri) {
    const filePath = resolveResourceFile(uri);
    if (!filePath) {
        throw new Error(`Resource not found: ${uri}`);
    }
    try {
        const content = readFileSync(filePath, "utf-8");
        return {
            contents: [
                {
                    uri,
                    mimeType: RESOURCE_REGISTRY.find((r) => r.uri === uri)?.mimeType ?? "text/plain",
                    text: content,
                },
            ],
        };
    }
    catch (err) {
        throw new Error(`Failed to read resource ${uri}: ${err instanceof Error ? err.message : String(err)}`);
    }
}
//# sourceMappingURL=index.js.map