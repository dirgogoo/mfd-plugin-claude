#!/usr/bin/env node
/**
 * MFD-DSL MCP Server
 *
 * Exposes MFD tools (parse, validate, stats, render, contract, prompt) via the
 * Model Context Protocol, allowing Claude to use them directly during conversations.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, ListResourcesRequestSchema, ReadResourceRequestSchema, } from "@modelcontextprotocol/sdk/types.js";
import { handleParse, handleValidate, handleStats, handleRender, handleContract, handleQuery, handlePrompt, handleVisualStart, handleVisualStop, handleVisualRestart, handleVisualNavigate, } from "./tools/index.js";
import { handleListResources, handleReadResource, } from "./resources/index.js";
const server = new Server({
    name: "mfd-tools",
    version: "0.1.0",
}, {
    capabilities: {
        tools: {},
        resources: {},
    },
});
// --- Tool Definitions ---
server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
        {
            name: "mfd_parse",
            description: "Parse an MFD-DSL file and return its Abstract Syntax Tree (AST) as JSON. Use this to inspect the structure of an MFD model.",
            inputSchema: {
                type: "object",
                properties: {
                    file: {
                        type: "string",
                        description: "Path to the .mfd file to parse",
                    },
                    resolve_includes: {
                        type: "boolean",
                        description: "Whether to resolve include directives (default: false)",
                        default: false,
                    },
                },
                required: ["file"],
            },
        },
        {
            name: "mfd_validate",
            description: "Validate an MFD-DSL file for syntax and semantic correctness. Returns errors and warnings with precise source locations and fix suggestions.",
            inputSchema: {
                type: "object",
                properties: {
                    file: {
                        type: "string",
                        description: "Path to the .mfd file to validate",
                    },
                    resolve_includes: {
                        type: "boolean",
                        description: "Whether to resolve include directives (default: false)",
                        default: false,
                    },
                },
                required: ["file"],
            },
        },
        {
            name: "mfd_stats",
            description: "Get statistics and metrics for an MFD model: construct counts, token estimate, field counts, dependency graph analysis, and implementation completeness.",
            inputSchema: {
                type: "object",
                properties: {
                    file: {
                        type: "string",
                        description: "Path to the .mfd file to analyze",
                    },
                    resolve_includes: {
                        type: "boolean",
                        description: "Whether to resolve include directives (default: false)",
                        default: false,
                    },
                },
                required: ["file"],
            },
        },
        {
            name: "mfd_render",
            description: "Render an MFD model as a Mermaid diagram. Supports: component (dependency graph), entity (ER diagram), state (state machine diagram), flow (sequence diagram), screen (screen dependency graph), journey (user journey graph).",
            inputSchema: {
                type: "object",
                properties: {
                    file: {
                        type: "string",
                        description: "Path to the .mfd file to render",
                    },
                    diagram_type: {
                        type: "string",
                        enum: [
                            "component",
                            "entity",
                            "state",
                            "flow",
                            "screen",
                            "journey",
                        ],
                        description: "Type of diagram to generate",
                    },
                    resolve_includes: {
                        type: "boolean",
                        description: "Whether to resolve include directives (default: false)",
                        default: false,
                    },
                },
                required: ["file", "diagram_type"],
            },
        },
        {
            name: "mfd_contract",
            description: "Generate an implementation contract from an MFD model. The contract is a JSON representation optimized for LLMs to implement code that follows the model as a specification.",
            inputSchema: {
                type: "object",
                properties: {
                    file: {
                        type: "string",
                        description: "Path to the .mfd file to generate a contract from",
                    },
                    resolve_includes: {
                        type: "boolean",
                        description: "Whether to resolve include directives (default: false)",
                        default: false,
                    },
                },
                required: ["file"],
            },
        },
        {
            name: "mfd_query",
            description: "Query specific constructs from an MFD model filtered by component, type, or name. Returns a filtered contract (JSON) with only matching constructs. More efficient than mfd_contract when you need a subset of the model.",
            inputSchema: {
                type: "object",
                properties: {
                    file: {
                        type: "string",
                        description: "Path to the .mfd file to query",
                    },
                    component: {
                        type: "string",
                        description: "Filter by component name (e.g., 'Auth', 'Catalogo')",
                    },
                    type: {
                        type: "string",
                        enum: [
                            "entity",
                            "enum",
                            "flow",
                            "state",
                            "event",
                            "signal",
                            "api",
                            "rule",
                            "screen",
                            "journey",
                            "operation",
                            "action",
                            "dep",
                            "secret",
                        ],
                        description: "Filter by construct type (e.g., 'entity', 'flow', 'api')",
                    },
                    name: {
                        type: "string",
                        description: "Filter by construct name (substring match, case-insensitive)",
                    },
                    resolve_includes: {
                        type: "boolean",
                        description: "Whether to resolve include directives (default: false)",
                        default: false,
                    },
                },
                required: ["file"],
            },
        },
        {
            name: "mfd_prompt",
            description: "Access the MFD prompt library. Use 'list' to see available prompts, or provide a prompt name to get its content. Available prompts: modelagem, implementacao, verificacao, refatoracao, exploracao.",
            inputSchema: {
                type: "object",
                properties: {
                    action: {
                        type: "string",
                        enum: ["list", "get"],
                        description: "Action: 'list' to list prompts, 'get' to retrieve a specific prompt",
                    },
                    name: {
                        type: "string",
                        description: "Name of the prompt to retrieve (required for 'get' action)",
                    },
                },
                required: ["action"],
            },
        },
        {
            name: "mfd_visual_start",
            description: "Start the MFD Scope visual server. Opens an interactive diagram viewer and dashboard in the browser. Watches the .mfd file for changes and live-reloads.",
            inputSchema: {
                type: "object",
                properties: {
                    file: {
                        type: "string",
                        description: "Path to the .mfd file to visualize",
                    },
                    port: {
                        type: "number",
                        description: "Port to run the server on (default: 4200, auto-detects available port)",
                        default: 4200,
                    },
                    open: {
                        type: "boolean",
                        description: "Whether to automatically open the browser (default: true)",
                        default: true,
                    },
                    resolve_includes: {
                        type: "boolean",
                        description: "Whether to resolve include directives (default: false)",
                        default: false,
                    },
                },
                required: ["file"],
            },
        },
        {
            name: "mfd_visual_stop",
            description: "Stop the running MFD Scope visual server.",
            inputSchema: {
                type: "object",
                properties: {},
            },
        },
        {
            name: "mfd_visual_restart",
            description: "Restart the running MFD Scope visual server. Stops and re-starts with the same file and port, picking up code and model changes.",
            inputSchema: {
                type: "object",
                properties: {},
            },
        },
        {
            name: "mfd_visual_navigate",
            description: "Navigate the MFD Scope visual server to a specific view. Opens the URL in the browser.",
            inputSchema: {
                type: "object",
                properties: {
                    view: {
                        type: "string",
                        enum: [
                            "system",
                            "overview",
                            "component",
                            "dashboard",
                        ],
                        description: "The view to navigate to",
                    },
                    name: {
                        type: "string",
                        description: "Component name (only used when view is 'component' to navigate to a specific component detail page)",
                    },
                },
                required: ["view"],
            },
        },
    ],
}));
// --- Resource Handlers ---
server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return handleListResources();
});
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    return handleReadResource(request.params.uri);
});
// --- Tool Dispatch ---
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
        switch (name) {
            case "mfd_parse":
                return handleParse(args);
            case "mfd_validate":
                return handleValidate(args);
            case "mfd_stats":
                return handleStats(args);
            case "mfd_render":
                return handleRender(args);
            case "mfd_contract":
                return handleContract(args);
            case "mfd_query":
                return handleQuery(args);
            case "mfd_prompt":
                return handlePrompt(args);
            case "mfd_visual_start":
                return await handleVisualStart(args);
            case "mfd_visual_stop":
                return await handleVisualStop();
            case "mfd_visual_restart":
                return await handleVisualRestart();
            case "mfd_visual_navigate":
                return await handleVisualNavigate(args);
            default:
                return {
                    content: [{ type: "text", text: `Unknown tool: ${name}` }],
                    isError: true,
                };
        }
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
            content: [{ type: "text", text: `Error: ${message}` }],
            isError: true,
        };
    }
});
// --- Start Server ---
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((err) => {
    console.error("MFD MCP Server error:", err);
    process.exit(1);
});
//# sourceMappingURL=server.js.map
