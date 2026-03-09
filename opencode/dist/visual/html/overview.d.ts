/**
 * Overview page (Level 1 — System):
 * Domain graph visualization for v2 models.
 * Each node is a domain (file) with construct counts and impl progress.
 * Edges show cross-domain references.
 *
 * Also exports renderSystemInfo() for the system info tab.
 */
import type { ModelSnapshot } from "../types.js";
export declare function renderOverview(snapshot: ModelSnapshot): string;
export declare function renderSystemInfo(snapshot: ModelSnapshot): string;
//# sourceMappingURL=overview.d.ts.map