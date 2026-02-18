/**
 * JSON API routes for model data.
 * Uses the central constructComponentMap for correct construct→component mapping.
 */
import { Hono } from "hono";
import type { ModelSnapshot } from "../types.js";
export declare function apiRoutes(getSnapshot: () => ModelSnapshot | null): Hono;
//# sourceMappingURL=api.d.ts.map