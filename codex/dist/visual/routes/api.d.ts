/**
 * JSON API routes for model data.
 * Uses the central constructDomainMap for correct construct->domain mapping.
 */
import { Hono } from "hono";
import type { ModelSnapshot } from "../types.js";
export declare function apiRoutes(getSnapshot: () => ModelSnapshot | null): Hono;
//# sourceMappingURL=api.d.ts.map