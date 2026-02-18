/**
 * Component detail page (Level 2 — Component)
 * Tabbed interface with diagrams + cards per construct type.
 * All construct names are navigable links to Level 3 detail pages.
 *
 * Uses the central constructComponentMap to find constructs belonging to this component.
 */
import type { ModelSnapshot } from "../types.js";
export interface ComponentDetailResult {
    html: string;
    tabs: {
        id: string;
        label: string;
        count: number;
    }[];
    defaultTab: string;
}
export declare function renderComponentDetail(snapshot: ModelSnapshot, componentName: string): ComponentDetailResult;
//# sourceMappingURL=component-detail.d.ts.map