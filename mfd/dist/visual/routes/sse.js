/**
 * SSE (Server-Sent Events) endpoint for live-reload.
 * Clients connect to GET /api/events and receive model updates.
 */
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
export function createSSEBroadcaster() {
    const clients = new Set();
    return {
        send(event, data) {
            const json = JSON.stringify(data);
            for (const writer of clients) {
                writer(event, json).catch(() => {
                    clients.delete(writer);
                });
            }
        },
        addClient(writer) {
            clients.add(writer);
            return () => {
                clients.delete(writer);
            };
        },
    };
}
export function sseRoutes(broadcaster) {
    const app = new Hono();
    app.get("/api/events", (c) => {
        return streamSSE(c, async (stream) => {
            const writer = async (event, data) => {
                await stream.writeSSE({ event, data });
            };
            const removeClient = broadcaster.addClient(writer);
            // Heartbeat every 30s
            const heartbeat = setInterval(async () => {
                try {
                    await stream.writeSSE({ event: "heartbeat", data: "{}" });
                }
                catch {
                    clearInterval(heartbeat);
                    removeClient();
                }
            }, 30000);
            // Keep the stream alive until client disconnects
            stream.onAbort(() => {
                clearInterval(heartbeat);
                removeClient();
            });
            // Send initial connected event
            await stream.writeSSE({
                event: "connected",
                data: JSON.stringify({ timestamp: Date.now() }),
            });
            // Wait indefinitely (stream stays open)
            await new Promise(() => { });
        });
    });
    return app;
}
//# sourceMappingURL=sse.js.map