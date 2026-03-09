/**
 * JSON API routes for model data.
 * Uses the central constructDomainMap for correct construct->domain mapping.
 */
import { Hono } from "hono";
import { getOrLoadTimeline } from "../git-timeline.js";
import { renderDomainConceptDiagram, renderDomainCapabilityDiagram, renderDomainLifecycleDiagram, renderDomainObjectiveDiagram, renderDomainInvariantDiagram, renderDomainPropertyDiagram, } from "../html/domain-diagrams.js";
const DIAGRAM_TYPES = [
    "domain", "concept", "lifecycle", "capability", "objective", "invariant", "property",
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
    app.get("/api/domain/:name", (c) => {
        const snapshot = getSnapshot();
        if (!snapshot)
            return c.json({ error: "No model loaded" }, 503);
        const name = c.req.param("name");
        const domain = snapshot.domains.find((d) => d.name === name);
        if (!domain) {
            return c.json({ error: `Domain not found: ${name}` }, 404);
        }
        const domainStats = snapshot.stats.domainCompleteness.find((ds) => ds.name === name);
        const cdMap = snapshot.constructDomainMap;
        // Gather constructs using central map
        const concepts = snapshot.model.concepts.filter((c) => cdMap.get(`concept:${c.name}`) === name);
        const capabilities = snapshot.model.capabilities.filter((c) => cdMap.get(`capability:${c.name}`) === name);
        const invariants = snapshot.model.invariants.filter((i) => cdMap.get(`invariant:${i.name}`) === name);
        const properties = snapshot.model.properties.filter((p) => cdMap.get(`property:${p.name}`) === name);
        const objectives = snapshot.model.objectives.filter((o) => cdMap.get(`objective:${o.name}`) === name);
        const enums = snapshot.model.enums.filter((e) => cdMap.get(`enum:${e.name}`) === name);
        return c.json({
            name: domain.name,
            completeness: domainStats,
            concepts,
            enums,
            capabilities,
            invariants,
            properties,
            objectives,
        });
    });
    // Domain-scoped diagrams
    app.get("/api/domain/:name/diagrams", (c) => {
        const snapshot = getSnapshot();
        if (!snapshot)
            return c.json({ error: "No model loaded" }, 503);
        const name = c.req.param("name");
        const domain = snapshot.domains.find((d) => d.name === name);
        if (!domain) {
            return c.json({ error: `Domain not found: ${name}` }, 404);
        }
        return c.json({
            domain: name,
            diagrams: {
                concept: renderDomainConceptDiagram(snapshot, name),
                capability: renderDomainCapabilityDiagram(snapshot, name),
                lifecycle: renderDomainLifecycleDiagram(snapshot, name),
                objective: renderDomainObjectiveDiagram(snapshot, name),
                invariant: renderDomainInvariantDiagram(snapshot, name),
                property: renderDomainPropertyDiagram(snapshot, name),
            },
        });
    });
    app.get("/api/domains", (c) => {
        const snapshot = getSnapshot();
        if (!snapshot)
            return c.json({ error: "No model loaded" }, 503);
        return c.json(snapshot.domains.map((domain) => ({
            name: domain.name,
            constructCounts: domain.constructCounts,
            completeness: snapshot.stats.domainCompleteness.find((ds) => ds.name === domain.name),
        })));
    });
    // Deep command palette: all constructs indexed
    app.get("/api/constructs", async (c) => {
        const snapshot = getSnapshot();
        if (!snapshot)
            return c.json({ error: "No model loaded" }, 503);
        const items = [];
        const cdMap = snapshot.constructDomainMap;
        // Pages
        items.push({ type: "page", name: "System Overview", domain: "", href: "/" });
        items.push({ type: "page", name: "Progress Dashboard", domain: "", href: "/dashboard" });
        items.push({ type: "page", name: "System Timeline", domain: "", href: "/timeline" });
        // Domains
        for (const domain of snapshot.domains) {
            items.push({
                type: "domain",
                name: domain.name,
                domain: "",
                href: `/domain/${encodeURIComponent(domain.name)}`,
            });
        }
        // All constructs using central map
        for (const concept of snapshot.model.concepts) {
            const domain = cdMap.get(`concept:${concept.name}`) ?? "";
            items.push({
                type: "concept",
                name: concept.name,
                domain,
                href: domain ? `/domain/${encodeURIComponent(domain)}/concept/${encodeURIComponent(concept.name)}` : "/",
            });
        }
        for (const en of snapshot.model.enums) {
            const domain = cdMap.get(`enum:${en.name}`) ?? "";
            items.push({
                type: "enum",
                name: en.name,
                domain,
                href: domain ? `/domain/${encodeURIComponent(domain)}/enum/${encodeURIComponent(en.name)}` : "/",
            });
        }
        for (const cap of snapshot.model.capabilities) {
            const domain = cdMap.get(`capability:${cap.name}`) ?? "";
            items.push({
                type: "capability",
                name: cap.name,
                domain,
                href: domain ? `/domain/${encodeURIComponent(domain)}/capability/${encodeURIComponent(cap.name)}` : "/",
            });
        }
        for (const inv of snapshot.model.invariants) {
            const domain = cdMap.get(`invariant:${inv.name}`) ?? "";
            items.push({
                type: "invariant",
                name: inv.name,
                domain,
                href: domain ? `/domain/${encodeURIComponent(domain)}/invariant/${encodeURIComponent(inv.name)}` : "/",
            });
        }
        for (const prop of snapshot.model.properties) {
            const domain = cdMap.get(`property:${prop.name}`) ?? "";
            items.push({
                type: "property",
                name: prop.name,
                domain,
                href: domain ? `/domain/${encodeURIComponent(domain)}/property/${encodeURIComponent(prop.name)}` : "/",
            });
        }
        for (const obj of snapshot.model.objectives) {
            const domain = cdMap.get(`objective:${obj.name}`) ?? "";
            items.push({
                type: "objective",
                name: obj.name,
                domain,
                href: domain ? `/domain/${encodeURIComponent(domain)}/objective/${encodeURIComponent(obj.name)}` : "/",
            });
        }
        // Timeline commits — indexed for search
        try {
            const timeline = await getOrLoadTimeline(snapshot.filePath, 50);
            for (const commit of timeline.commits) {
                items.push({
                    type: "commit",
                    name: `${commit.shortHash} — ${commit.message}`,
                    domain: "",
                    href: `/timeline?highlight=${commit.shortHash}`,
                });
                for (const ev of commit.subEvents) {
                    if (ev.type === 'impl_added' || ev.type === 'impl_changed') {
                        items.push({
                            type: "impl",
                            name: `${ev.detail ?? '@impl'} on ${ev.constructType}:${ev.constructName}`,
                            domain: "",
                            href: `/timeline?highlight=${commit.shortHash}`,
                            detail: commit.shortHash,
                        });
                    }
                }
            }
        }
        catch {
            // Timeline unavailable — skip
        }
        return c.json(items);
    });
    // Timeline API
    app.get("/api/timeline", async (c) => {
        const snapshot = getSnapshot();
        if (!snapshot)
            return c.json({ error: "No model loaded" }, 503);
        const limit = parseInt(c.req.query("limit") ?? "100", 10);
        const timeline = await getOrLoadTimeline(snapshot.filePath, limit);
        return c.json(timeline);
    });
    return app;
}
function getConstructCount(snapshot, type) {
    switch (type) {
        case "domain": return snapshot.domains.length;
        case "concept": return snapshot.model.concepts.length;
        case "capability": return snapshot.model.capabilities.length;
        case "lifecycle": return snapshot.model.concepts.filter(c => c.lifecycle).length;
        case "objective": return snapshot.model.objectives.length;
        case "invariant": return snapshot.model.invariants.length;
        case "property": return snapshot.model.properties.length;
    }
}
//# sourceMappingURL=api.js.map