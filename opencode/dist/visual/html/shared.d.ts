/**
 * Shared utilities for HTML rendering.
 * Centralizes escapeHtml, formatType, link helpers, chip rendering, etc.
 *
 * Updated for v2: supports /domain/ routes, concept-domain mapping, v2 type colors.
 */
export declare function escapeHtml(str: string): string;
export declare const V2_TYPE_COLORS: Record<string, string>;
export declare function formatType(typeExpr: any): string;
/**
 * Format a type expression as HTML with links for ReferenceTypes.
 * Links point to the construct detail page in the domain that owns it.
 * For v2, uses "concept" kind instead of "entity" for non-enum references.
 */
export declare function formatTypeLinked(typeExpr: any, conceptDomainMap: Map<string, string>, enumNames?: Set<string>): string;
/**
 * Build a link to a construct detail page within a domain.
 * Uses /domain/ routes for v2.
 */
export declare function constructLink(domainName: string, type: string, name: string): string;
/**
 * Build a link to a domain detail page.
 */
export declare function domainLink(name: string): string;
/**
 * Legacy alias for domainLink. Points to /domain/ for backwards compat.
 */
export declare function componentLink(name: string): string;
export declare function renderImplChip(decorators: any[] | undefined): string;
export declare function renderStatusChip(decorators: any[] | undefined): string;
export declare function renderTestsChip(decorators: any[] | undefined): string;
export declare function renderVerifiedChip(decorators: any[] | undefined): string;
export declare function renderNodeChip(decorators: any[] | undefined): string;
export declare function renderDecoratorChips(decorators: any[] | undefined): string;
/**
 * Build a map from concept/enum name to domain name.
 * Used for type reference linking in v2.
 */
export declare function buildConceptDomainMap(constructDomainMap: Map<string, string>): Map<string, string>;
/**
 * Build a map from entity/enum name to component name.
 * Uses the central constructComponentMap from the snapshot for correct mapping
 * (handles both nested and top-level constructs).
 */
export declare function buildEntityComponentMap(model: any, constructComponentMap?: Map<string, string>): Map<string, string>;
/**
 * Get the domain/component that owns a construct, using the central map.
 */
export declare function getConstructComponent(constructDomainMap: Map<string, string>, type: string, name: string): string | null;
/**
 * Get all constructs of a given type assigned to a domain/component.
 */
export declare function getComponentConstructs(constructDomainMap: Map<string, string>, domainName: string, type?: string): {
    type: string;
    name: string;
}[];
export declare function renderSection(title: string, count: number, body: string, color?: string, id?: string): string;
//# sourceMappingURL=shared.d.ts.map