/**
 * Layout shell: Scope Bar + Dynamic Nav Rail + Canvas + external deps
 * Nav rail shows domains from the model, not fixed diagram types.
 */
import type { DomainInfo } from "../types.js";
export interface DomainTab {
    id: string;
    label: string;
    count: number;
}
export interface ConstructContext {
    type: string;
    name: string;
    domain: string;
}
export interface LayoutOptions {
    systemName: string;
    systemVersion: string | null;
    activePage: string;
    activeDomain?: string;
    breadcrumbs?: {
        label: string;
        href?: string;
    }[];
    title?: string;
    domains?: DomainInfo[];
    domainTabs?: DomainTab[];
    activeTab?: string;
    constructContext?: ConstructContext;
}
export declare function renderLayout(content: string, options: LayoutOptions): string;
//# sourceMappingURL=layout.d.ts.map