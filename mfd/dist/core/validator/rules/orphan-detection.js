import { collectModel } from "../collect.js";
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
        // Collect operation names referenced by flow steps
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
    return diagnostics;
}
//# sourceMappingURL=orphan-detection.js.map