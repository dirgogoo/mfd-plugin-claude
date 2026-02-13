/**
 * MCP tools for MFD Scope — visual server management
 * mfd_visual_start, mfd_visual_stop, mfd_visual_navigate
 */
import { spawn } from "node:child_process";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createConnection } from "node:net";
import { rmSync, readdirSync, existsSync } from "node:fs";
const __dirname = dirname(fileURLToPath(import.meta.url));
/**
 * Locate the visual server entry point.
 * In monorepo: packages/mfd-visual/src/server.ts (needs npx tsx)
 * In packaged dist: dist/visual/server.js (use node directly)
 */
function findVisualServer() {
    // In packaged distribution, visual server is always compiled JS
    const jsPath = resolve(join(__dirname, "..", "..", "visual", "server.js"));
    if (existsSync(jsPath))
        return { path: jsPath, compiled: true };
    // Fallback: TypeScript source (development)
    const tsPath = resolve(join(__dirname, "..", "..", "visual", "server.ts"));
    if (existsSync(tsPath))
        return { path: tsPath, compiled: false };
    return { path: jsPath, compiled: true };
}
const visualServerInfo = findVisualServer();
const VISUAL_SERVER_PATH = visualServerInfo.path;
// Singleton state
let serverProcess = null;
let serverPort = null;
let serverFile = null;
let serverResolveIncludes = false;
function isPortAvailable(port) {
    return new Promise((resolve) => {
        const socket = createConnection({ port }, () => {
            socket.destroy();
            resolve(false); // port is in use
        });
        socket.on("error", () => {
            resolve(true); // port is available
        });
    });
}
async function findAvailablePort(start = 4200) {
    for (let port = start; port <= start + 9; port++) {
        if (await isPortAvailable(port))
            return port;
    }
    throw new Error(`No available port in range ${start}-${start + 9}`);
}
function waitForServer(port, timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
        const deadline = Date.now() + timeoutMs;
        const check = () => {
            if (Date.now() > deadline) {
                reject(new Error("Server startup timeout"));
                return;
            }
            const socket = createConnection({ port }, () => {
                socket.destroy();
                resolve();
            });
            socket.on("error", () => {
                setTimeout(check, 300);
            });
        };
        check();
    });
}
/**
 * Stop the visual server cleanly via its /api/shutdown endpoint.
 * This is the most reliable method because it lets the server shut itself
 * down, killing the entire node process tree from within.
 * Falls back to SIGTERM if the HTTP request fails.
 */
async function shutdownServer(port, proc) {
    try {
        // Primary: HTTP shutdown — server calls process.exit(0) internally
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);
        await fetch(`http://localhost:${port}/api/shutdown`, {
            method: "POST",
            signal: controller.signal,
        }).catch(() => { });
        clearTimeout(timeout);
        // Wait for process to actually exit
        await new Promise((resolve) => {
            const checkInterval = setInterval(() => {
                try {
                    // process.kill(pid, 0) throws if process is gone
                    if (proc.pid)
                        process.kill(proc.pid, 0);
                }
                catch {
                    clearInterval(checkInterval);
                    resolve();
                    return;
                }
            }, 100);
            // Don't wait forever
            setTimeout(() => { clearInterval(checkInterval); resolve(); }, 2000);
        });
    }
    catch {
        // Fallback: direct SIGTERM
        try {
            if (proc.pid)
                process.kill(proc.pid, "SIGTERM");
        }
        catch { /* gone */ }
    }
}
export async function handleVisualStart(args) {
    const absFile = resolve(args.file);
    // If already running with same file, return existing URL
    if (serverProcess && serverFile === absFile && serverPort) {
        const url = `http://localhost:${serverPort}`;
        return {
            content: [
                {
                    type: "text",
                    text: `MFD Scope already running at ${url}\nFile: ${absFile}`,
                },
            ],
        };
    }
    // If running with different file, stop first
    if (serverProcess && serverPort) {
        await shutdownServer(serverPort, serverProcess);
        serverProcess = null;
        serverPort = null;
        serverFile = null;
        serverResolveIncludes = false;
    }
    try {
        const port = args.port ?? (await findAvailablePort());
        const serverArgs = [VISUAL_SERVER_PATH, "--file", absFile, "--port", String(port)];
        if (args.resolve_includes)
            serverArgs.push("--resolve");
        let child;
        if (visualServerInfo.compiled) {
            // Packaged distribution: run compiled JS directly with node
            child = spawn("node", serverArgs, {
                stdio: ["ignore", "pipe", "pipe"],
                detached: true,
            });
        }
        else {
            // Monorepo: run TypeScript source with tsx
            child = spawn("npx", ["tsx", ...serverArgs], {
                stdio: ["ignore", "pipe", "pipe"],
                detached: true,
            });
        }
        serverProcess = child;
        serverPort = port;
        serverFile = absFile;
        serverResolveIncludes = !!args.resolve_includes;
        // Capture output for debugging
        let stderr = "";
        child.stderr?.on("data", (chunk) => {
            stderr += chunk.toString();
        });
        child.on("exit", (code) => {
            if (serverProcess === child) {
                serverProcess = null;
                serverPort = null;
                serverFile = null;
                serverResolveIncludes = false;
            }
        });
        // Wait for server to be ready
        await waitForServer(port);
        const url = `http://localhost:${port}`;
        // Open browser if requested
        if (args.open !== false) {
            try {
                spawn("xdg-open", [url], { stdio: "ignore", detached: true }).unref();
            }
            catch {
                // Ignore if xdg-open not available
            }
        }
        return {
            content: [
                {
                    type: "text",
                    text: `MFD Scope started at ${url}\nFile: ${absFile}\nPort: ${port}\nPID: ${child.pid}`,
                },
            ],
        };
    }
    catch (err) {
        return {
            content: [
                {
                    type: "text",
                    text: `Failed to start MFD Scope: ${err instanceof Error ? err.message : String(err)}`,
                },
            ],
            isError: true,
        };
    }
}
export async function handleVisualStop() {
    if (!serverProcess || !serverPort) {
        return {
            content: [
                { type: "text", text: "MFD Scope is not running." },
            ],
        };
    }
    const port = serverPort;
    await shutdownServer(port, serverProcess);
    serverProcess = null;
    serverPort = null;
    serverFile = null;
    serverResolveIncludes = false;
    return {
        content: [
            {
                type: "text",
                text: `MFD Scope stopped (was running on port ${port}).`,
            },
        ],
    };
}
/** Clear tsx compilation cache so code changes are picked up on restart */
function clearTsxCache() {
    try {
        const tmpDir = "/tmp";
        const entries = readdirSync(tmpDir);
        for (const entry of entries) {
            if (entry.startsWith("tsx-")) {
                rmSync(join(tmpDir, entry), { recursive: true, force: true });
            }
        }
    }
    catch {
        // Ignore — cache dir may not exist
    }
}
export async function handleVisualRestart() {
    if (!serverProcess || !serverFile || !serverPort) {
        return {
            content: [
                { type: "text", text: "MFD Scope is not running. Use mfd_visual_start first." },
            ],
            isError: true,
        };
    }
    const file = serverFile;
    const port = serverPort;
    const resolveIncludes = serverResolveIncludes;
    // Shutdown via HTTP
    await shutdownServer(port, serverProcess);
    serverProcess = null;
    serverPort = null;
    serverFile = null;
    serverResolveIncludes = false;
    // Clear tsx cache so code/CSS changes are picked up
    clearTsxCache();
    // Wait for port to free up
    await new Promise((r) => setTimeout(r, 500));
    // Restart with same file, port, and resolve_includes
    return handleVisualStart({ file, port, open: false, resolve_includes: resolveIncludes });
}
export async function handleVisualNavigate(args) {
    if (!serverProcess || !serverPort) {
        return {
            content: [
                {
                    type: "text",
                    text: "MFD Scope is not running. Use mfd_visual_start first.",
                },
            ],
            isError: true,
        };
    }
    let path;
    switch (args.view) {
        case "system":
            path = "/";
            break;
        case "overview":
            path = "/components";
            break;
        case "dashboard":
            path = "/dashboard";
            break;
        case "component":
            if (args.name) {
                path = `/component/${encodeURIComponent(args.name)}`;
            }
            else {
                path = "/components";
            }
            break;
        default:
            path = "/";
    }
    const url = `http://localhost:${serverPort}${path}`;
    try {
        spawn("xdg-open", [url], { stdio: "ignore", detached: true }).unref();
    }
    catch {
        // Ignore if xdg-open not available
    }
    return {
        content: [
            { type: "text", text: `Opened: ${url}` },
        ],
    };
}
//# sourceMappingURL=visual.js.map