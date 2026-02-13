/**
 * Layout shell: Scope Bar + Dynamic Nav Rail + Canvas + external deps
 * Nav rail shows components from the model, not fixed diagram types.
 */
import type { ComponentInfo } from "../types.js";
export interface ComponentTab {
    id: string;
    label: string;
    count: number;
}
export interface ConstructContext {
    type: string;
    name: string;
    component: string;
}
export interface LayoutOptions {
    systemName: string;
    systemVersion: string | null;
    activePage: string;
    activeComponent?: string;
    breadcrumbs?: {
        label: string;
        href?: string;
    }[];
    title?: string;
    components?: ComponentInfo[];
    componentTabs?: ComponentTab[];
    activeTab?: string;
    constructContext?: ConstructContext;
}
export declare function renderLayout(content: string, options: LayoutOptions): string;
//# sourceMappingURL=layout.d.ts.map