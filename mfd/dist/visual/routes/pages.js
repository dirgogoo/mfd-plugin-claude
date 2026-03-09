/**
 * HTML page routes — server-side rendered pages
 * Routes: / (System Info), /domains (Domain Overview), /dashboard,
 *         /domain/:name, /domain/:name/:type/:item
 */
import { Hono } from "hono";
import { renderLayout } from "../html/layout.js";
import { renderOverview, renderSystemInfo } from "../html/overview.js";
import { renderDashboard } from "../html/dashboard.js";
import { renderTimeline } from "../html/timeline.js";
import { renderDomainDetail } from "../html/domain-detail.js";
import { renderConstructDetail } from "../html/construct-detail.js";
import { renderDiagramPage } from "../html/diagram.js";
const CONSTRUCT_TYPES = [
    "concept", "enum", "capability", "invariant", "property", "objective",
];
function layoutOpts(snapshot, overrides) {
    return {
        systemName: snapshot.systemName,
        systemVersion: snapshot.systemVersion,
        activePage: "system",
        domains: snapshot.domains,
        ...overrides,
    };
}
export function pageRoutes(getSnapshot) {
    const app = new Hono();
    // Level 1: System info (new system tab)
    app.get("/", (c) => {
        const snapshot = getSnapshot();
        if (!snapshot) {
            return c.html(renderLayout("<p>Loading model...</p>", {
                systemName: "MFD Scope",
                systemVersion: null,
                activePage: "system",
            }));
        }
        const content = renderSystemInfo(snapshot);
        return c.html(renderLayout(content, layoutOpts(snapshot, {
            activePage: "system",
            title: "System Info",
        })));
    });
    // Level 1: Domains (domain graph — was previously "/components")
    app.get("/domains", (c) => {
        const snapshot = getSnapshot();
        if (!snapshot) {
            return c.html(renderLayout("<p>Loading model...</p>", {
                systemName: "MFD Scope",
                systemVersion: null,
                activePage: "domains",
            }));
        }
        const content = renderOverview(snapshot);
        return c.html(renderLayout(content, layoutOpts(snapshot, {
            activePage: "domains",
            title: "Domains",
        })));
    });
    // Dashboard
    app.get("/dashboard", (c) => {
        const snapshot = getSnapshot();
        if (!snapshot) {
            return c.html(renderLayout("<p>Loading model...</p>", {
                systemName: "MFD Scope",
                systemVersion: null,
                activePage: "dashboard",
            }));
        }
        const content = renderDashboard(snapshot);
        return c.html(renderLayout(content, layoutOpts(snapshot, {
            activePage: "dashboard",
            breadcrumbs: [
                { label: "System", href: "/" },
                { label: "Progress" },
            ],
            title: "Progress Dashboard",
        })));
    });
    // Timeline
    app.get("/timeline", (c) => {
        const snapshot = getSnapshot();
        if (!snapshot) {
            return c.html(renderLayout("<p>Loading model...</p>", {
                systemName: "MFD Scope",
                systemVersion: null,
                activePage: "timeline",
            }));
        }
        const content = renderTimeline(snapshot);
        return c.html(renderLayout(content, layoutOpts(snapshot, {
            activePage: "timeline",
            breadcrumbs: [
                { label: "System", href: "/" },
                { label: "Timeline" },
            ],
            title: "Timeline",
        })));
    });
    // Level 2: Domain detail
    app.get("/domain/:name", (c) => {
        const snapshot = getSnapshot();
        if (!snapshot) {
            return c.html(renderLayout("<p>Loading model...</p>", {
                systemName: "MFD Scope",
                systemVersion: null,
                activePage: "system",
            }));
        }
        const name = decodeURIComponent(c.req.param("name"));
        const result = renderDomainDetail(snapshot, name);
        const requestedTab = c.req.query("tab") || result.defaultTab;
        return c.html(renderLayout(result.html, layoutOpts(snapshot, {
            activePage: "domain",
            activeDomain: name,
            domainTabs: result.tabs,
            activeTab: requestedTab,
            breadcrumbs: [
                { label: "System", href: "/" },
                { label: name },
            ],
            title: name,
        })));
    });
    // Level 3: Construct detail
    app.get("/domain/:name/:type/:item", (c) => {
        const snapshot = getSnapshot();
        if (!snapshot) {
            return c.html(renderLayout("<p>Loading model...</p>", {
                systemName: "MFD Scope",
                systemVersion: null,
                activePage: "system",
            }));
        }
        const domainName = decodeURIComponent(c.req.param("name"));
        const type = decodeURIComponent(c.req.param("type"));
        const itemName = decodeURIComponent(c.req.param("item"));
        if (!CONSTRUCT_TYPES.includes(type)) {
            return c.html(renderLayout(`<p>Unknown construct type: ${type}</p>`, layoutOpts(snapshot, {
                activePage: "domain",
                activeDomain: domainName,
            })), 404);
        }
        const typeLabels = {
            concept: "Concept",
            enum: "Enum",
            capability: "Capability",
            invariant: "Invariant",
            property: "Property",
            objective: "Objective",
        };
        const content = renderConstructDetail(snapshot, domainName, type, itemName);
        return c.html(renderLayout(content, layoutOpts(snapshot, {
            activePage: "domain",
            activeDomain: domainName,
            constructContext: { type: typeLabels[type], name: itemName, domain: domainName },
            breadcrumbs: [
                { label: "System", href: "/" },
                { label: domainName, href: `/domain/${encodeURIComponent(domainName)}` },
                { label: `${typeLabels[type]}: ${itemName}` },
            ],
            title: `${typeLabels[type]}: ${itemName}`,
        })));
    });
    // Full-page diagram view
    const DIAGRAM_TYPES = [
        "domain", "concept", "lifecycle", "capability", "objective", "invariant", "property",
    ];
    app.get("/diagram/:type", (c) => {
        const snapshot = getSnapshot();
        if (!snapshot) {
            return c.html(renderLayout("<p>Loading model...</p>", {
                systemName: "MFD Scope",
                systemVersion: null,
                activePage: "system",
            }));
        }
        const type = c.req.param("type");
        if (!DIAGRAM_TYPES.includes(type)) {
            return c.html(renderLayout(`<p>Unknown diagram type: ${type}</p>`, layoutOpts(snapshot, {})), 404);
        }
        const content = renderDiagramPage(snapshot, type);
        return c.html(renderLayout(content, layoutOpts(snapshot, {
            activePage: "domains",
            title: `${type.charAt(0).toUpperCase() + type.slice(1)} Diagram`,
        })));
    });
    return app;
}
//# sourceMappingURL=pages.js.map