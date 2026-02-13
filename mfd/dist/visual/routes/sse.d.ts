/**
 * SSE (Server-Sent Events) endpoint for live-reload.
 * Clients connect to GET /api/events and receive model updates.
 */
import { Hono } from "hono";
export interface SSEBroadcaster {
    send(event: string, data: unknown): void;
    addClient(writer: (event: string, data: string) => Promise<void>): () => void;
}
export declare function createSSEBroadcaster(): SSEBroadcaster;
export declare function sseRoutes(broadcaster: SSEBroadcaster): Hono;
//# sourceMappingURL=sse.d.ts.map