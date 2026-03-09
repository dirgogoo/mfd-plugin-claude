/**
 * Shared utilities for HTML rendering.
 * Centralizes escapeHtml, formatType, link helpers, chip rendering, etc.
 *
 * Updated for v2: supports /domain/ routes, concept-domain mapping, v2 type colors.
 */
// ===== Escaping =====
export function escapeHtml(str) {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}
// ===== V2 Type Colors =====
export const V2_TYPE_COLORS = {
    concept: "#00E5FF", // Cyan
    capability: "#FF6B6B", // Coral
    lifecycle: "#FBBF24", // Amber
    invariant: "#A78BFA", // Violet
    property: "#34D399", // Emerald
    objective: "#F472B6", // Pink
    enum: "#60A5FA", // Blue
};
// ===== Type Formatting =====
export function formatType(typeExpr) {
    if (!typeExpr)
        return "unknown";
    switch (typeExpr.type) {
        case "PrimitiveType":
            return typeExpr.name;
        case "ReferenceType":
            return typeExpr.name;
        case "OptionalType":
            return formatType(typeExpr.inner) + "?";
        case "ArrayType":
            return formatType(typeExpr.inner) + "[]";
        case "UnionType":
            return typeExpr.alternatives.map(formatType).join(" | ");
        case "InlineObjectType":
            return "{...}";
        default:
            return "unknown";
    }
}
/**
 * Format a type expression as HTML with links for ReferenceTypes.
 * Links point to the construct detail page in the domain that owns it.
 * For v2, uses "concept" kind instead of "entity" for non-enum references.
 */
export function formatTypeLinked(typeExpr, conceptDomainMap, enumNames) {
    if (!typeExpr)
        return "unknown";
    switch (typeExpr.type) {
        case "PrimitiveType":
            return escapeHtml(typeExpr.name);
        case "ReferenceType": {
            const domain = conceptDomainMap.get(typeExpr.name);
            if (domain) {
                const kind = enumNames?.has(typeExpr.name) ? "enum" : "concept";
                return `<a href="${constructLink(domain, kind, typeExpr.name)}" class="scope-construct-link">${escapeHtml(typeExpr.name)}</a>`;
            }
            return escapeHtml(typeExpr.name);
        }
        case "OptionalType":
            return formatTypeLinked(typeExpr.inner, conceptDomainMap, enumNames) + "?";
        case "ArrayType":
            return formatTypeLinked(typeExpr.inner, conceptDomainMap, enumNames) + "[]";
        case "UnionType":
            return typeExpr.alternatives.map((a) => formatTypeLinked(a, conceptDomainMap, enumNames)).join(" | ");
        case "InlineObjectType":
            return "{...}";
        default:
            return "unknown";
    }
}
// ===== Link Helpers =====
/**
 * Build a link to a construct detail page within a domain.
 * Uses /domain/ routes for v2.
 */
export function constructLink(domainName, type, name) {
    return `/domain/${encodeURIComponent(domainName)}/${encodeURIComponent(type)}/${encodeURIComponent(name)}`;
}
/**
 * Build a link to a domain detail page.
 */
export function domainLink(name) {
    return `/domain/${encodeURIComponent(name)}`;
}
/**
 * Legacy alias for domainLink. Points to /domain/ for backwards compat.
 */
export function componentLink(name) {
    return `/domain/${encodeURIComponent(name)}`;
}
// ===== Chip Rendering =====
export function renderImplChip(decorators) {
    const implDec = decorators?.find((d) => d.name === "impl");
    if (!implDec || implDec.params.length === 0)
        return "";
    const paths = implDec.params.map((p) => String(p.value));
    const display = paths.length === 1 ? paths[0] : `${paths.length} files`;
    const tooltip = paths.join(", ");
    return `<span class="scope-chip done" title="${escapeHtml(tooltip)}">${escapeHtml(display)}</span>`;
}
export function renderStatusChip(decorators) {
    const statusDec = decorators?.find((d) => d.name === "status");
    if (!statusDec)
        return "";
    const val = String(statusDec.params[0]?.value ?? "?");
    const cls = val === "active" || val === "done" ? "done" : val === "draft" ? "wip" : "pending";
    return `<span class="scope-chip ${cls}">${escapeHtml(val)}</span>`;
}
export function renderTestsChip(decorators) {
    const testsDec = decorators?.find((d) => d.name === "tests");
    if (!testsDec)
        return "";
    const val = String(testsDec.params[0]?.value ?? "");
    return `<span class="scope-chip ${val === 'unit' || val === 'integration' || val === 'e2e' ? 'done' : 'wip'}">${escapeHtml(val)}</span>`;
}
export function renderVerifiedChip(decorators) {
    const verifiedDec = decorators?.find((d) => d.name === "verified");
    if (!verifiedDec)
        return "";
    const count = verifiedDec.params[0] ? String(verifiedDec.params[0].value) : "1";
    return `<span class="scope-chip verified" title="Verified ${count} time(s) by council">verified(${escapeHtml(count)})</span>`;
}
export function renderNodeChip(decorators) {
    const nodeDec = decorators?.find((d) => d.name === "node");
    if (!nodeDec || !nodeDec.params[0])
        return "";
    const nodeName = String(nodeDec.params[0].value);
    return `<span class="scope-chip" style="background:var(--c-info,#3b82f6);color:#fff" title="Runs on node: ${escapeHtml(nodeName)}">${escapeHtml(nodeName)}</span>`;
}
export function renderDecoratorChips(decorators) {
    if (!decorators?.length)
        return "";
    return decorators
        .map((d) => {
        const params = d.params?.length
            ? `(${d.params.map((p) => p.value).join(", ")})`
            : "";
        return `<span class="scope-chip pending">@${escapeHtml(d.name)}${params}</span>`;
    })
        .join(" ");
}
// ===== Concept-Domain Map (v2) =====
/**
 * Build a map from concept/enum name to domain name.
 * Used for type reference linking in v2.
 */
export function buildConceptDomainMap(constructDomainMap) {
    const map = new Map();
    for (const [key, domain] of constructDomainMap) {
        const [type, ...rest] = key.split(":");
        const name = rest.join(":");
        if (type === "concept" || type === "enum") {
            map.set(name, domain);
        }
    }
    return map;
}
// ===== Entity-Component Map (legacy v1) =====
/**
 * Build a map from entity/enum name to component name.
 * Uses the central constructComponentMap from the snapshot for correct mapping
 * (handles both nested and top-level constructs).
 */
export function buildEntityComponentMap(model, constructComponentMap) {
    const map = new Map();
    if (constructComponentMap) {
        // Use the central map
        for (const [key, comp] of constructComponentMap) {
            const [type, ...rest] = key.split(":");
            const name = rest.join(":");
            if (type === "entity" || type === "enum") {
                map.set(name, comp);
            }
        }
    }
    else {
        // Fallback: scan comp.body (works for nested models)
        for (const comp of model.components) {
            for (const item of comp.body) {
                if (item.type === "EntityDecl" || item.type === "EnumDecl") {
                    map.set(item.name, comp.name);
                }
            }
        }
    }
    return map;
}
/**
 * Get the domain/component that owns a construct, using the central map.
 */
export function getConstructComponent(constructDomainMap, type, name) {
    return constructDomainMap.get(`${type}:${name}`) ?? null;
}
/**
 * Get all constructs of a given type assigned to a domain/component.
 */
export function getComponentConstructs(constructDomainMap, domainName, type) {
    const results = [];
    for (const [key, domain] of constructDomainMap) {
        if (domain !== domainName)
            continue;
        const [t, ...rest] = key.split(":");
        const name = rest.join(":");
        if (!type || t === type) {
            results.push({ type: t, name });
        }
    }
    return results;
}
// ===== Section Rendering =====
export function renderSection(title, count, body, color, id) {
    const borderStyle = color ? `border-left: 3px solid ${color};` : "";
    const idAttr = id ? ` id="${id}"` : "";
    return `
  <div class="scope-detail-section" style="${borderStyle}"${idAttr}>
    <div class="scope-detail-section-header" onclick="this.parentElement.classList.toggle('collapsed')">
      <span class="scope-detail-section-title">${title}</span>
      <span class="scope-detail-section-badge">${count}</span>
    </div>
    <div class="scope-detail-section-body">${body}</div>
  </div>`;
}
//# sourceMappingURL=shared.js.map