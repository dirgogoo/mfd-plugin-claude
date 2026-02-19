/**
 * HTML page routes — server-side rendered pages
 * Routes: / (System Info), /components (Component Graph), /dashboard,
 *         /component/:name, /component/:name/:type/:item
 */
import { Hono } from "hono";
import { renderLayout } from "../html/layout.js";
import { renderOverview, renderSystemInfo } from "../html/overview.js";
import { renderDashboard } from "../html/dashboard.js";
import { renderTimeline } from "../html/timeline.js";
import { renderComponentDetail } from "../html/component-detail.js";
import { renderConstructDetail } from "../html/construct-detail.js";
const CONSTRUCT_TYPES = [
    "entity", "enum", "flow", "api", "state", "event", "signal", "rule", "screen", "journey", "operation", "element", "action",
];
function layoutOpts(snapshot, overrides) {
    return {
        systemName: snapshot.systemName,
        systemVersion: snapshot.systemVersion,
        activePage: "system",
        components: snapshot.components,
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
    // Level 1: Components (component graph — was previously "/")
    app.get("/components", (c) => {
        const snapshot = getSnapshot();
        if (!snapshot) {
            return c.html(renderLayout("<p>Loading model...</p>", {
                systemName: "MFD Scope",
                systemVersion: null,
                activePage: "components",
            }));
        }
        const content = renderOverview(snapshot);
        return c.html(renderLayout(content, layoutOpts(snapshot, {
            activePage: "components",
            title: "Components",
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
    // Level 2: Component detail
    app.get("/component/:name", (c) => {
        const snapshot = getSnapshot();
        if (!snapshot) {
            return c.html(renderLayout("<p>Loading model...</p>", {
                systemName: "MFD Scope",
                systemVersion: null,
                activePage: "system",
            }));
        }
        const name = decodeURIComponent(c.req.param("name"));
        const result = renderComponentDetail(snapshot, name);
        const requestedTab = c.req.query("tab") || result.defaultTab;
        return c.html(renderLayout(result.html, layoutOpts(snapshot, {
            activePage: "component",
            activeComponent: name,
            componentTabs: result.tabs,
            activeTab: requestedTab,
            breadcrumbs: [
                { label: "System", href: "/" },
                { label: name },
            ],
            title: name,
        })));
    });
    // Level 3: Construct detail
    app.get("/component/:name/:type/:item", (c) => {
        const snapshot = getSnapshot();
        if (!snapshot) {
            return c.html(renderLayout("<p>Loading model...</p>", {
                systemName: "MFD Scope",
                systemVersion: null,
                activePage: "system",
            }));
        }
        const compName = decodeURIComponent(c.req.param("name"));
        const type = decodeURIComponent(c.req.param("type"));
        const itemName = decodeURIComponent(c.req.param("item"));
        if (!CONSTRUCT_TYPES.includes(type)) {
            return c.html(renderLayout(`<p>Unknown construct type: ${type}</p>`, layoutOpts(snapshot, {
                activePage: "component",
                activeComponent: compName,
            })), 404);
        }
        const typeLabels = {
            entity: "Entity",
            enum: "Enum",
            flow: "Flow",
            api: "API",
            state: "State",
            event: "Event",
            rule: "Rule",
            screen: "Screen",
            journey: "Journey",
            operation: "Operation",
            element: "Element",
            action: "Action",
            signal: "Signal",
        };
        const content = renderConstructDetail(snapshot, compName, type, itemName);
        return c.html(renderLayout(content, layoutOpts(snapshot, {
            activePage: "component",
            activeComponent: compName,
            constructContext: { type: typeLabels[type], name: itemName, component: compName },
            breadcrumbs: [
                { label: "System", href: "/" },
                { label: compName, href: `/component/${encodeURIComponent(compName)}` },
                { label: `${typeLabels[type]}: ${itemName}` },
            ],
            title: `${typeLabels[type]}: ${itemName}`,
        })));
    });
    return app;
}
//# sourceMappingURL=pages.js.map