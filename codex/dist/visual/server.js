/**
 * MFD Scope — Visual server entry point
 * Hono HTTP server with SSE live-reload and file watching
 */
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadModelSnapshot } from "./data.js";
import { createWatcher } from "./watcher.js";
import { invalidateTimelineCache } from "./git-timeline.js";
import { apiRoutes } from "./routes/api.js";
import { sseRoutes, createSSEBroadcaster } from "./routes/sse.js";
import { pageRoutes } from "./routes/pages.js";
const __dirname = dirname(fileURLToPath(import.meta.url));
// ===== Parse CLI args =====
function parseArgs() {
    const args = process.argv.slice(2);
    let file = "";
    let port = 4200;
    let resolveIncludes = false;
    for (let i = 0; i < args.length; i++) {
        if (args[i] === "--file" || args[i] === "-f") {
            file = args[++i];
        }
        else if (args[i] === "--port" || args[i] === "-p") {
            port = parseInt(args[++i], 10);
        }
        else if (args[i] === "--resolve") {
            resolveIncludes = true;
        }
        else if (!args[i].startsWith("-") && !file) {
            file = args[i];
        }
    }
    // Also support env vars
    if (!file)
        file = process.env.MFD_FILE ?? "";
    if (process.env.MFD_PORT)
        port = parseInt(process.env.MFD_PORT, 10);
    if (process.env.MFD_RESOLVE === "true")
        resolveIncludes = true;
    if (!file) {
        console.error("Usage: npx tsx src/server.ts --file <path.mfd> [--port 4200] [--resolve]");
        process.exit(1);
    }
    return { file: resolve(file), port, resolveIncludes };
}
// ===== Main =====
const config = parseArgs();
let snapshot = null;
let lastValidSnapshot = null;
const broadcaster = createSSEBroadcaster();
// Initial load
try {
    snapshot = loadModelSnapshot(config.file, config.resolveIncludes);
    lastValidSnapshot = snapshot;
    console.log(`[MFD Scope] Loaded: ${snapshot.systemName} (${snapshot.stats.counts.total} constructs)`);
}
catch (err) {
    console.error(`[MFD Scope] Error loading model: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
}
// File watcher
const watcher = createWatcher(config.file, () => {
    try {
        const newSnapshot = loadModelSnapshot(config.file, config.resolveIncludes);
        const changes = describeChanges(snapshot, newSnapshot);
        snapshot = newSnapshot;
        lastValidSnapshot = newSnapshot;
        invalidateTimelineCache();
        broadcaster.send("model-updated", {
            timestamp: Date.now(),
            stats: newSnapshot.stats,
            changes,
        });
        if (newSnapshot.validation.errors.length > 0 || newSnapshot.validation.warnings.length > 0) {
            broadcaster.send("validation-error", {
                errors: newSnapshot.validation.errors,
                warnings: newSnapshot.validation.warnings,
            });
        }
        console.log(`[MFD Scope] Model updated: ${changes}`);
    }
    catch (err) {
        console.warn(`[MFD Scope] Parse error (keeping last valid state): ${err instanceof Error ? err.message : err}`);
        broadcaster.send("validation-error", {
            errors: [{ message: err instanceof Error ? err.message : String(err) }],
            warnings: [],
        });
    }
});
// ===== Hono App =====
const app = new Hono();
// Static files — find the correct root containing static/
// In dist: __dirname = dist/visual/ → 2 levels up to plugin root
// In source (monorepo): __dirname = packages/mfd-visual/src/ → 1 level up
const packageRoot = existsSync(resolve(__dirname, "..", "static"))
    ? resolve(__dirname, "..")
    : resolve(__dirname, "..", "..");
app.use("/static/*", serveStatic({ root: packageRoot }));
// API routes
app.route("/", apiRoutes(() => snapshot));
// SSE routes
app.route("/", sseRoutes(broadcaster));
// Page routes
app.route("/", pageRoutes(() => snapshot));
// Shutdown endpoint — allows the MCP tool to stop the server cleanly via HTTP
app.post("/api/shutdown", (c) => {
    setTimeout(() => {
        console.log("[MFD Scope] Shutting down via /api/shutdown...");
        watcher.close();
        process.exit(0);
    }, 100);
    return c.json({ status: "shutting_down" });
});
// ===== Start Server =====
const server = serve({
    fetch: app.fetch,
    port: config.port,
});
console.log(`[MFD Scope] Server running at http://localhost:${config.port}`);
console.log(`[MFD Scope] Watching: ${config.file}`);
// Graceful shutdown
process.on("SIGTERM", () => {
    console.log("[MFD Scope] Shutting down...");
    watcher.close();
    process.exit(0);
});
process.on("SIGINT", () => {
    console.log("[MFD Scope] Shutting down...");
    watcher.close();
    process.exit(0);
});
// ===== Helpers =====
function describeChanges(old, next) {
    if (!old)
        return "Initial load";
    const parts = [];
    const oldCounts = old.stats.counts;
    const newCounts = next.stats.counts;
    const types = ["entities", "flows", "apis", "rules", "states", "events", "screens", "journeys"];
    for (const type of types) {
        const diff = newCounts[type] - oldCounts[type];
        if (diff > 0)
            parts.push(`+${diff} ${type}`);
        else if (diff < 0)
            parts.push(`${diff} ${type}`);
    }
    if (parts.length === 0)
        parts.push("Model modified");
    return parts.join(", ");
}
//# sourceMappingURL=server.js.map