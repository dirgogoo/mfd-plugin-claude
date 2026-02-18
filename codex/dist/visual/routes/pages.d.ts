/**
 * HTML page routes — server-side rendered pages
 * Routes: / (System Info), /components (Component Graph), /dashboard,
 *         /component/:name, /component/:name/:type/:item
 */
import { Hono } from "hono";
import type { ModelSnapshot } from "../types.js";
export declare function pageRoutes(getSnapshot: () => ModelSnapshot | null): Hono;
//# sourceMappingURL=pages.d.ts.map