/**
 * JSON API routes for model data.
 * Uses the central constructComponentMap for correct construct→component mapping.
 */
import { Hono } from "hono";
import { renderComponentEntityDiagram, renderComponentStateDiagram, renderComponentFlowDiagram, renderComponentScreenDiagram, renderComponentJourneyDiagram, renderComponentDepDiagram, } from "../html/component-diagrams.js";
const DIAGRAM_TYPES = [
    "component", "entity", "state", "flow", "screen", "journey",
];
export function apiRoutes(getSnapshot) {
    const app = new Hono();
    app.get("/api/stats", (c) => {
        const snapshot = getSnapshot();
        if (!snapshot)
            return c.json({ error: "No model loaded" }, 503);
        return c.json(snapshot.stats);
    });
    app.get("/api/model", (c) => {
        const snapshot = getSnapshot();
        if (!snapshot)
            return c.json({ error: "No model loaded" }, 503);
        return c.json({
            systemName: snapshot.systemName,
            systemVersion: snapshot.systemVersion,
            timestamp: snapshot.timestamp,
            filePath: snapshot.filePath,
            validation: snapshot.validation,
        });
    });
    app.get("/api/diagrams/:type", (c) => {
        const snapshot = getSnapshot();
        if (!snapshot)
            return c.json({ error: "No model loaded" }, 503);
        const type = c.req.param("type");
        if (!DIAGRAM_TYPES.includes(type)) {
            return c.json({ error: `Invalid diagram type. Use: ${DIAGRAM_TYPES.join(", ")}` }, 400);
        }
        return c.json({
            type,
            mermaid: snapshot.diagrams[type],
            count: getConstructCount(snapshot, type),
        });
    });
    app.get("/api/component/:name", (c) => {
        const snapshot = getSnapshot();
        if (!snapshot)
            return c.json({ error: "No model loaded" }, 503);
        const name = c.req.param("name");
        const comp = snapshot.model.components.find((comp) => comp.name === name);
        if (!comp) {
            return c.json({ error: `Component not found: ${name}` }, 404);
        }
        const compStats = snapshot.stats.componentCompleteness.find((cs) => cs.name === name);
        const ccMap = snapshot.constructComponentMap;
        // Gather constructs using central map
        const entities = snapshot.model.entities.filter((e) => ccMap.get(`entity:${e.name}`) === name);
        const flows = snapshot.model.flows.filter((f) => ccMap.get(`flow:${f.name}`) === name);
        const apis = comp.body.filter((b) => b.type === "ApiDecl");
        const states = snapshot.model.states.filter((s) => ccMap.get(`state:${s.name}`) === name);
        const events = snapshot.model.events.filter((e) => ccMap.get(`event:${e.name}`) === name);
        const rules = snapshot.model.rules.filter((r) => ccMap.get(`rule:${r.name}`) === name);
        const screens = snapshot.model.screens.filter((s) => ccMap.get(`screen:${s.name}`) === name);
        const journeys = snapshot.model.journeys.filter((j) => ccMap.get(`journey:${j.name}`) === name);
        const enums = snapshot.model.enums.filter((e) => ccMap.get(`enum:${e.name}`) === name);
        const deps = comp.body.filter((b) => b.type === "DepDecl");
        const secrets = comp.body.filter((b) => b.type === "SecretDecl");
        return c.json({
            name: comp.name,
            decorators: comp.decorators,
            completeness: compStats,
            deps,
            secrets,
            entities,
            enums,
            flows,
            apis,
            states,
            events,
            rules,
            screens,
            journeys,
        });
    });
    // Component-scoped diagrams (Phase 8)
    app.get("/api/component/:name/diagrams", (c) => {
        const snapshot = getSnapshot();
        if (!snapshot)
            return c.json({ error: "No model loaded" }, 503);
        const name = c.req.param("name");
        const comp = snapshot.model.components.find((comp) => comp.name === name);
        if (!comp) {
            return c.json({ error: `Component not found: ${name}` }, 404);
        }
        return c.json({
            component: name,
            diagrams: {
                entity: renderComponentEntityDiagram(snapshot, name),
                state: renderComponentStateDiagram(snapshot, name),
                flow: renderComponentFlowDiagram(snapshot, name),
                screen: renderComponentScreenDiagram(snapshot, name),
                journey: renderComponentJourneyDiagram(snapshot, name),
                dep: renderComponentDepDiagram(snapshot, name),
            },
        });
    });
    app.get("/api/components", (c) => {
        const snapshot = getSnapshot();
        if (!snapshot)
            return c.json({ error: "No model loaded" }, 503);
        return c.json(snapshot.model.components.map((comp) => ({
            name: comp.name,
            status: comp.decorators?.find((d) => d.name === "status"),
            completeness: snapshot.stats.componentCompleteness.find((cs) => cs.name === comp.name),
        })));
    });
    // Deep command palette: all constructs indexed
    app.get("/api/constructs", (c) => {
        const snapshot = getSnapshot();
        if (!snapshot)
            return c.json({ error: "No model loaded" }, 503);
        const items = [];
        const ccMap = snapshot.constructComponentMap;
        // Pages
        items.push({ type: "page", name: "System Overview", component: "", href: "/" });
        items.push({ type: "page", name: "Progress Dashboard", component: "", href: "/dashboard" });
        // Components
        for (const comp of snapshot.model.components) {
            items.push({
                type: "component",
                name: comp.name,
                component: "",
                href: `/component/${encodeURIComponent(comp.name)}`,
            });
        }
        // All constructs using central map
        for (const entity of snapshot.model.entities) {
            const comp = ccMap.get(`entity:${entity.name}`) ?? "";
            items.push({
                type: "entity",
                name: entity.name,
                component: comp,
                href: comp ? `/component/${encodeURIComponent(comp)}/entity/${encodeURIComponent(entity.name)}` : "/",
            });
        }
        for (const en of snapshot.model.enums) {
            const comp = ccMap.get(`enum:${en.name}`) ?? "";
            items.push({
                type: "enum",
                name: en.name,
                component: comp,
                href: comp ? `/component/${encodeURIComponent(comp)}/enum/${encodeURIComponent(en.name)}` : "/",
            });
        }
        for (const flow of snapshot.model.flows) {
            const comp = ccMap.get(`flow:${flow.name}`) ?? "";
            items.push({
                type: "flow",
                name: flow.name,
                component: comp,
                href: comp ? `/component/${encodeURIComponent(comp)}/flow/${encodeURIComponent(flow.name)}` : "/",
            });
        }
        for (const state of snapshot.model.states) {
            const comp = ccMap.get(`state:${state.name}`) ?? "";
            items.push({
                type: "state",
                name: state.name,
                component: comp,
                href: comp ? `/component/${encodeURIComponent(comp)}/state/${encodeURIComponent(state.name)}` : "/",
                detail: `on ${state.enumRef}`,
            });
        }
        for (const event of snapshot.model.events) {
            const comp = ccMap.get(`event:${event.name}`) ?? "";
            items.push({
                type: "event",
                name: event.name,
                component: comp,
                href: comp ? `/component/${encodeURIComponent(comp)}/event/${encodeURIComponent(event.name)}` : "/",
            });
        }
        for (const rule of snapshot.model.rules) {
            const comp = ccMap.get(`rule:${rule.name}`) ?? "";
            items.push({
                type: "rule",
                name: rule.name,
                component: comp,
                href: comp ? `/component/${encodeURIComponent(comp)}/rule/${encodeURIComponent(rule.name)}` : "/",
            });
        }
        for (const screen of snapshot.model.screens) {
            const comp = ccMap.get(`screen:${screen.name}`) ?? "";
            items.push({
                type: "screen",
                name: screen.name,
                component: comp,
                href: comp ? `/component/${encodeURIComponent(comp)}/screen/${encodeURIComponent(screen.name)}` : "/",
            });
        }
        for (const journey of snapshot.model.journeys) {
            const comp = ccMap.get(`journey:${journey.name}`) ?? "";
            items.push({
                type: "journey",
                name: journey.name,
                component: comp,
                href: comp ? `/component/${encodeURIComponent(comp)}/journey/${encodeURIComponent(journey.name)}` : "/",
            });
        }
        // API endpoints — find owning component via body reference (ccMap keys collide for same-name APIs like "REST")
        for (const api of snapshot.model.apis) {
            const comp = snapshot.model.components.find(c => c.body.includes(api))?.name ?? "";
            const prefix = api.decorators?.find((d) => d.name === "prefix");
            const prefixVal = prefix ? String(prefix.params[0]?.value ?? "") : "";
            for (const ep of api.endpoints) {
                const method = ep.method;
                const path = ep.path;
                items.push({
                    type: "endpoint",
                    name: `${method} ${path}`,
                    component: comp,
                    href: comp ? `/component/${encodeURIComponent(comp)}` : "/",
                    detail: prefixVal,
                });
            }
        }
        return c.json(items);
    });
    return app;
}
function getConstructCount(snapshot, type) {
    switch (type) {
        case "component": return snapshot.model.components.length;
        case "entity": return snapshot.model.entities.length;
        case "state": return snapshot.model.states.length;
        case "flow": return snapshot.model.flows.length;
        case "screen": return snapshot.model.screens.length;
        case "journey": return snapshot.model.journeys.length;
    }
}
//# sourceMappingURL=api.js.map