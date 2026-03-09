/**
 * Domain detail page (Level 2 — Domain)
 * Tabbed interface with diagrams + cards per v2 construct type.
 * All construct names are navigable links to Level 3 detail pages.
 *
 * Uses the central constructDomainMap to find constructs belonging to this domain.
 */
import type { ModelSnapshot } from "../types.js";
export interface DomainDetailResult {
    html: string;
    tabs: {
        id: string;
        label: string;
        count: number;
    }[];
    defaultTab: string;
}
export declare function renderDomainDetail(snapshot: ModelSnapshot, domainName: string): DomainDetailResult;
//# sourceMappingURL=domain-detail.d.ts.map