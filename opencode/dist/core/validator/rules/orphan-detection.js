import { collectModel } from "../collect.js";
import { collectAllTypeReferences } from "./shared-helpers.js";
/**
 * Orphan detection rules:
 *
 * ORPHAN_EVENT: event that is never emitted nor listened to
 *   (checks emits, on, state triggers, journey triggers)
 *
 * ORPHAN_FLOW: flow without `handles` clause
 *   (only when model has APIs; skip @abstract flows)
 *
 * ORPHAN_OPERATION: operation without `handles` clause and not referenced by any flow step
 *   (only when model has APIs; skip operations that have `on` or `calls` clauses)
 *
 * ORPHAN_SIGNAL: signal that is never emitted nor listened to by any action
 *   (skip @abstract signals)
 */
export function orphanDetection(doc) {
    const model = collectModel(doc);
    const diagnostics = [];
    // ---- ORPHAN_EVENT ----
    if (model.events.length > 0) {
        const usedEvents = new Set();
        // Collect events used in: emits, on, state triggers, journey triggers, action on
        for (const op of model.operations) {
            for (const item of op.body) {
                if (item.type === "EmitsClause")
                    usedEvents.add(item.event);
                if (item.type === "OnClause")
                    usedEvents.add(item.event);
            }
        }
        for (const flow of model.flows) {
            for (const item of flow.body) {
                if (item.type === "EmitsClause")
                    usedEvents.add(item.event);
                if (item.type === "OnClause")
                    usedEvents.add(item.event);
                // Flow steps with emit(EventName) pattern
                if (item.type === "FlowStep" && /^emit\b/i.test(item.action)) {
                    const match = item.action.match(/^emit\((\w+)\)/i);
                    if (match)
                        usedEvents.add(match[1]);
                }
            }
        }
        for (const state of model.states) {
            for (const tr of state.transitions) {
                if (tr.event) {
                    usedEvents.add(tr.event);
                }
            }
        }
        for (const journey of model.journeys) {
            for (const item of journey.body) {
                if (item.type === "JourneyStep" && item.trigger) {
                    usedEvents.add(item.trigger);
                }
            }
        }
        // Also check STREAM return types (they reference events)
        for (const api of model.apis) {
            for (const ep of api.endpoints) {
                if (ep.method === "STREAM") {
                    const returnType = ep.type === "ApiEndpointSimple" ? ep.returnType : ep.response;
                    if (returnType && returnType.type === "ReferenceType") {
                        usedEvents.add(returnType.name);
                    }
                }
            }
        }
        for (const event of model.events) {
            // Skip @abstract events (they are base types, not meant to be emitted directly)
            if (event.decorators.some((d) => d.name === "abstract"))
                continue;
            if (!usedEvents.has(event.name)) {
                diagnostics.push({
                    code: "ORPHAN_EVENT",
                    severity: "warning",
                    message: `Event '${event.name}' is never emitted nor listened to`,
                    location: event.loc,
                    help: `Add 'emits ${event.name}' to an operation, 'on ${event.name}' to a flow/state trigger, or remove if unused`,
                });
            }
        }
    }
    // ---- ORPHAN_FLOW / ORPHAN_OPERATION ----
    // Only check when model has APIs (opt-in like other endpoint-related checks)
    if (model.apis.length > 0) {
        // ORPHAN_FLOW: flow without handles (skip @abstract)
        for (const flow of model.flows) {
            if (flow.decorators.some((d) => d.name === "abstract"))
                continue;
            const hasHandles = flow.body.some((item) => item.type === "OperationHandlesClause");
            const hasOn = flow.body.some((item) => item.type === "OnClause");
            // Flows with `on` clause are event-driven, not endpoint-driven — skip
            if (!hasHandles && !hasOn) {
                diagnostics.push({
                    code: "ORPHAN_FLOW",
                    severity: "warning",
                    message: `Flow '${flow.name}' has no 'handles' clause connecting it to an API endpoint`,
                    location: flow.loc,
                    help: `Add 'handles METHOD /path' to connect it to an API endpoint, or 'on EventName' for event-driven flows`,
                });
            }
        }
        // ORPHAN_OPERATION: operation without handles and not referenced by flow steps
        // Collect operation names referenced by flow steps and overrides
        const referencedOps = new Set();
        for (const flow of model.flows) {
            for (const item of flow.body) {
                if (item.type === "FlowStep") {
                    // Extract function name from step action (e.g. "validate(input)" -> "validate")
                    const match = item.action.match(/^(\w+)/);
                    if (match)
                        referencedOps.add(match[1]);
                    // Also check branches
                    for (const branch of item.branches) {
                        const bMatch = branch.action.match(/^(\w+)/);
                        if (bMatch)
                            referencedOps.add(bMatch[1]);
                    }
                }
                if (item.type === "FlowOverrideStep") {
                    // override target -> replacement: both reference operations
                    referencedOps.add(item.target);
                    const match = item.action.match(/^(\w+)/);
                    if (match)
                        referencedOps.add(match[1]);
                }
            }
        }
        // Also check rule then/elseif/else clauses
        for (const rule of model.rules) {
            for (const item of rule.body) {
                if (item.type === "ThenClause" || item.type === "ElseClause") {
                    const match = item.action.match(/^(\w+)/);
                    if (match)
                        referencedOps.add(match[1]);
                }
                if (item.type === "ElseIfClause") {
                    const match = item.action.match(/^(\w+)/);
                    if (match)
                        referencedOps.add(match[1]);
                }
            }
        }
        for (const op of model.operations) {
            const hasHandles = op.body.some((item) => item.type === "OperationHandlesClause");
            const hasCalls = op.body.some((item) => item.type === "OperationCallsClause");
            const hasOn = op.body.some((item) => item.type === "OnClause");
            const isReferenced = referencedOps.has(op.name);
            // Operations with handles, calls, on, or referenced by flows are connected
            if (!hasHandles && !hasCalls && !hasOn && !isReferenced) {
                diagnostics.push({
                    code: "ORPHAN_OPERATION",
                    severity: "warning",
                    message: `Operation '${op.name}' has no 'handles' clause and is not referenced by any flow or rule`,
                    location: op.loc,
                    help: `Add 'handles METHOD /path' or reference it from a flow step`,
                });
            }
        }
    }
    // ---- ORPHAN_SIGNAL ----
    if (model.signals.length > 0) {
        const usedSignals = new Set();
        for (const action of model.actions) {
            for (const item of action.body) {
                if (item.type === "ActionOnSignalClause")
                    usedSignals.add(item.signal);
                if (item.type === "ActionEmitsSignalClause")
                    usedSignals.add(item.signal);
            }
        }
        // Also count signals used as extends targets by other signals
        for (const signal of model.signals) {
            if (signal.extends)
                usedSignals.add(signal.extends);
        }
        for (const signal of model.signals) {
            if (signal.decorators.some((d) => d.name === "abstract"))
                continue;
            if (!usedSignals.has(signal.name)) {
                diagnostics.push({
                    code: "ORPHAN_SIGNAL",
                    severity: "warning",
                    message: `Signal '${signal.name}' is never emitted nor listened to by any action`,
                    location: signal.loc,
                    help: `Add 'on ${signal.name}' to an action to listen, or 'emits ${signal.name}' to emit it, or remove if unused`,
                });
            }
        }
    }
    // ---- ORPHAN_ENTITY + ORPHAN_ENUM ----
    const needTypeRefs = model.entities.length >= 2 || model.enums.length >= 2;
    if (needTypeRefs) {
        const usedTypes = collectAllTypeReferences(model);
        // ORPHAN_ENTITY (opt-in: >= 2 entities)
        if (model.entities.length >= 2) {
            const inheritanceTargets = new Set();
            for (const e of model.entities) {
                if (e.extends)
                    inheritanceTargets.add(e.extends);
                for (const i of e.implements)
                    inheritanceTargets.add(i);
            }
            for (const e of model.elements) {
                if (e.extends)
                    inheritanceTargets.add(e.extends);
                for (const i of e.implements)
                    inheritanceTargets.add(i);
            }
            for (const f of model.flows) {
                if (f.extends)
                    inheritanceTargets.add(f.extends);
            }
            for (const s of model.screens) {
                if (s.extends)
                    inheritanceTargets.add(s.extends);
                for (const i of s.implements)
                    inheritanceTargets.add(i);
            }
            for (const entity of model.entities) {
                if (entity.decorators.some((d) => d.name === "abstract"))
                    continue;
                if (entity.decorators.some((d) => d.name === "interface"))
                    continue;
                if (usedTypes.has(entity.name))
                    continue;
                if (inheritanceTargets.has(entity.name))
                    continue;
                diagnostics.push({
                    code: "ORPHAN_ENTITY",
                    severity: "warning",
                    message: `Entity '${entity.name}' is not referenced by any field type, parameter, or inheritance`,
                    location: entity.loc,
                    help: `Use '${entity.name}' as a field type, flow parameter/return, or API type — or remove if unused`,
                });
            }
        }
        // ORPHAN_ENUM (opt-in: >= 2 enums)
        if (model.enums.length >= 2) {
            const stateEnumRefs = new Set();
            for (const state of model.states)
                stateEnumRefs.add(state.enumRef);
            for (const enumDecl of model.enums) {
                if (usedTypes.has(enumDecl.name))
                    continue;
                if (stateEnumRefs.has(enumDecl.name))
                    continue;
                diagnostics.push({
                    code: "ORPHAN_ENUM",
                    severity: "warning",
                    message: `Enum '${enumDecl.name}' is not referenced by any field type, parameter, or state machine`,
                    location: enumDecl.loc,
                    help: `Use '${enumDecl.name}' as a field type, state machine enumRef, or remove if unused`,
                });
            }
        }
    }
    return diagnostics;
}
//# sourceMappingURL=orphan-detection.js.map