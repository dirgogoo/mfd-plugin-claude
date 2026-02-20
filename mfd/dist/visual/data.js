/**
 * Data layer: loads an MFD file and produces a complete ModelSnapshot
 * with parsed model, all 6 diagrams, stats, relationships, and validation results.
 *
 * Handles both nested models (constructs inside component blocks) and
 * flat models (constructs at top level, outside component blocks).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "../core/parser/index.js";
import { resolveFile } from "../core/resolver/index.js";
import { collectModel } from "../core/validator/collect.js";
import { validate } from "../core/validator/index.js";
import { computeStats } from "../core/utils/stats.js";
import { renderComponentDiagram, renderEntityDiagram, renderStateDiagram, renderFlowDiagram, renderScreenDiagram, renderJourneyDiagram, } from "../mcp/tools/render.js";
import { computeRelationships } from "./relationships.js";
import { buildConstructComponentMap, apiMapKey, declTypeToType, } from "../core/relationships/index.js";
export function loadModelSnapshot(filePath, resolveIncludes = false) {
    const t0 = performance.now();
    const absPath = resolve(filePath);
    const source = readFileSync(absPath, "utf-8");
    // Auto-detect imports — same heuristic as CLI
    const shouldResolve = resolveIncludes || /^\s*(import|include)\s+"/m.test(source);
    let doc;
    const t1 = performance.now();
    if (shouldResolve) {
        const result = resolveFile(absPath);
        if (result.errors.length > 0) {
            throw new Error(`Resolution errors:\n${result.errors.map((e) => e.message).join("\n")}`);
        }
        doc = result.document;
    }
    else {
        doc = parse(source, { source: absPath });
    }
    const tParse = performance.now();
    const model = collectModel(doc);
    const tCollect = performance.now();
    const stats = computeStats(model, source);
    const tStats = performance.now();
    // Lazy diagram generation: only render each diagram type on first access.
    // Saves ~50-200ms per unused diagram type.
    const diagramRenderers = {
        component: () => renderComponentDiagram(model),
        entity: () => renderEntityDiagram(model),
        state: () => renderStateDiagram(model),
        flow: () => renderFlowDiagram(model),
        screen: () => renderScreenDiagram(model),
        journey: () => renderJourneyDiagram(model),
    };
    const diagramCache = {};
    const diagrams = new Proxy(diagramCache, {
        get(target, prop) {
            if (!(prop in diagramCache) && prop in diagramRenderers) {
                diagramCache[prop] = diagramRenderers[prop]();
            }
            return target[prop];
        },
    });
    // Validation
    const valResult = validate(doc);
    const tValidate = performance.now();
    const validation = {
        errors: valResult.errors.map((e) => ({
            message: e.message,
            line: e.location?.start?.line,
            column: e.location?.start?.column,
        })),
        warnings: valResult.warnings.map((w) => ({
            message: w.message,
            line: w.location?.start?.line,
            column: w.location?.start?.column,
        })),
    };
    // Build central construct→component mapping (handles top-level constructs)
    const constructComponentMap = buildConstructComponentMap(model);
    const tMapping = performance.now();
    // Compute relationships using the map
    const relationships = computeRelationships(model, constructComponentMap);
    const tRelationships = performance.now();
    // Build component info using the map
    const components = buildComponentInfos(model, stats, constructComponentMap);
    // Extract system name and version
    let systemName = "MFD Model";
    let systemVersion = null;
    if (model.systems.length > 0) {
        systemName = model.systems[0].name;
        const versionDec = model.systems[0].decorators?.find((d) => d.name === "version");
        if (versionDec && versionDec.params[0]) {
            systemVersion = String(versionDec.params[0].value);
        }
    }
    const tEnd = performance.now();
    console.log(`[MFD Scope] Snapshot built in ${(tEnd - t0).toFixed(0)}ms` +
        ` (parse:${(tParse - t1).toFixed(0)} collect:${(tCollect - tParse).toFixed(0)}` +
        ` stats:${(tStats - tCollect).toFixed(0)} validate:${(tValidate - tStats).toFixed(0)}` +
        ` mapping:${(tMapping - tValidate).toFixed(0)} rels:${(tRelationships - tMapping).toFixed(0)}` +
        ` diagrams:lazy)`);
    return {
        systemName,
        systemVersion,
        model,
        diagrams,
        stats,
        validation,
        relationships,
        components,
        constructComponentMap,
        timestamp: Date.now(),
        filePath: absPath,
    };
}
// ===== Construct → Component Mapping =====
// buildConstructComponentMap, declTypeToType, apiMapKey, collectAllConstructNames,
// extractTypeRefs are imported from mfd-core/src/relationships/index.js
// ===== Component Info Builder =====
function buildComponentInfos(model, stats, constructComponentMap) {
    return model.components.map((comp) => {
        const statusDec = comp.decorators?.find((d) => d.name === "status");
        const status = statusDec ? String(statusDec.params[0]?.value ?? null) : null;
        const counts = {};
        // Count constructs assigned to this component via the map
        const countedKeys = new Set();
        for (const [key, compName] of constructComponentMap) {
            if (compName !== comp.name)
                continue;
            countedKeys.add(key);
            const [type] = key.split(":");
            switch (type) {
                case "element":
                    counts.elements = (counts.elements ?? 0) + 1;
                    break;
                case "entity":
                    counts.entities = (counts.entities ?? 0) + 1;
                    break;
                case "enum":
                    counts.enums = (counts.enums ?? 0) + 1;
                    break;
                case "flow":
                    counts.flows = (counts.flows ?? 0) + 1;
                    break;
                case "state":
                    counts.states = (counts.states ?? 0) + 1;
                    break;
                case "event":
                    counts.events = (counts.events ?? 0) + 1;
                    break;
                case "signal":
                    counts.signals = (counts.signals ?? 0) + 1;
                    break;
                case "rule":
                    counts.rules = (counts.rules ?? 0) + 1;
                    break;
                case "screen":
                    counts.screens = (counts.screens ?? 0) + 1;
                    break;
                case "journey":
                    counts.journeys = (counts.journeys ?? 0) + 1;
                    break;
                case "api":
                    counts.apis = (counts.apis ?? 0) + 1;
                    break;
                case "operation":
                    counts.operations = (counts.operations ?? 0) + 1;
                    break;
                case "action":
                    counts.actions = (counts.actions ?? 0) + 1;
                    break;
            }
        }
        // Also count constructs in comp.body that the ccMap assigned to a different
        // component (happens with @interface + implements pattern where names collide)
        for (const item of comp.body) {
            const type = declTypeToType(item.type);
            if (!type)
                continue;
            const name = item.name;
            if (!name)
                continue;
            const key = type === "api" ? apiMapKey(item) : `${type}:${name}`;
            if (countedKeys.has(key))
                continue; // already counted via ccMap
            switch (type) {
                case "element":
                    counts.elements = (counts.elements ?? 0) + 1;
                    break;
                case "entity":
                    counts.entities = (counts.entities ?? 0) + 1;
                    break;
                case "enum":
                    counts.enums = (counts.enums ?? 0) + 1;
                    break;
                case "flow":
                    counts.flows = (counts.flows ?? 0) + 1;
                    break;
                case "state":
                    counts.states = (counts.states ?? 0) + 1;
                    break;
                case "event":
                    counts.events = (counts.events ?? 0) + 1;
                    break;
                case "signal":
                    counts.signals = (counts.signals ?? 0) + 1;
                    break;
                case "rule":
                    counts.rules = (counts.rules ?? 0) + 1;
                    break;
                case "screen":
                    counts.screens = (counts.screens ?? 0) + 1;
                    break;
                case "journey":
                    counts.journeys = (counts.journeys ?? 0) + 1;
                    break;
                case "api":
                    counts.apis = (counts.apis ?? 0) + 1;
                    break;
                case "operation":
                    counts.operations = (counts.operations ?? 0) + 1;
                    break;
                case "action":
                    counts.actions = (counts.actions ?? 0) + 1;
                    break;
            }
        }
        // Count API endpoints
        if (counts.apis) {
            let endpoints = 0;
            for (const api of model.apis) {
                if (constructComponentMap.get(apiMapKey(api)) === comp.name) {
                    endpoints += api.endpoints.length;
                }
            }
            counts.endpoints = endpoints;
        }
        const compStats = stats.componentCompleteness.find((cs) => cs.name === comp.name);
        const implDone = compStats?.implDone ?? 0;
        const implTotal = compStats?.implTotal ?? 0;
        const verifiedDone = compStats?.verifiedDone ?? 0;
        const verifiedTotal = compStats?.verifiedTotal ?? 0;
        // If stats reports 0 but we have constructs, use construct count as total
        const effectiveTotal = implTotal > 0 ? implTotal : Object.values(counts).reduce((sum, n) => sum + n, 0);
        return { name: comp.name, status, constructCounts: counts, implDone, implTotal: effectiveTotal, verifiedDone, verifiedTotal };
    });
}
//# sourceMappingURL=data.js.map