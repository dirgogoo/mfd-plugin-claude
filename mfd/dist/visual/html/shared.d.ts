/**
 * Shared utilities for HTML rendering.
 * Centralizes escapeHtml, formatType, link helpers, chip rendering, etc.
 */
export declare function escapeHtml(str: string): string;
export declare function formatType(typeExpr: any): string;
/**
 * Format a type expression as HTML with links for ReferenceTypes.
 * Links point to the entity detail page in the component that owns it.
 */
export declare function formatTypeLinked(typeExpr: any, entityComponentMap: Map<string, string>, enumNames?: Set<string>): string;
export declare function constructLink(componentName: string, type: string, name: string): string;
export declare function componentLink(name: string): string;
export declare function renderImplChip(decorators: any[] | undefined): string;
export declare function renderStatusChip(decorators: any[] | undefined): string;
export declare function renderTestsChip(decorators: any[] | undefined): string;
export declare function renderVerifiedChip(decorators: any[] | undefined): string;
export declare function renderDecoratorChips(decorators: any[] | undefined): string;
/**
 * Build a map from entity/enum name → component name.
 * Uses the central constructComponentMap from the snapshot for correct mapping
 * (handles both nested and top-level constructs).
 */
export declare function buildEntityComponentMap(model: any, constructComponentMap?: Map<string, string>): Map<string, string>;
/**
 * Get the component that owns a construct, using the central map.
 */
export declare function getConstructComponent(constructComponentMap: Map<string, string>, type: string, name: string): string | null;
/**
 * Get all constructs of a given type assigned to a component.
 */
export declare function getComponentConstructs(constructComponentMap: Map<string, string>, componentName: string, type?: string): {
    type: string;
    name: string;
}[];
export declare function renderSection(title: string, count: number, body: string, color?: string, id?: string): string;
//# sourceMappingURL=shared.d.ts.map