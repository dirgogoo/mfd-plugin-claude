import { collectModel } from "../collect.js";
import { normalizePath, baseTypeName, extractPathParams, getEntityFields } from "./shared-helpers.js";
/**
 * OPERATION_EVENT_UNRESOLVED: Checks that operation emits/on clauses
 * reference declared events.
 *
 * OPERATION_RULE_UNRESOLVED: Checks that operation enforces clauses
 * reference declared rules.
 *
 * OPERATION_HANDLES_UNRESOLVED: handles endpoint not found in any API.
 * OPERATION_CALLS_UNRESOLVED: calls endpoint not found in any API (including @external).
 *
 * FLOW_HANDLES_UNRESOLVED: flow handles endpoint not found in any API.
 * FLOW_CALLS_FORBIDDEN: flows cannot use 'calls' — only operations can consume endpoints.
 *   Flows can receive endpoints with 'handles', but cannot consume them with 'calls'.
 *
 * API_ENDPOINT_ORPHAN: API endpoint has no flow or operation handling it.
 *   Every non-@external API endpoint should have a flow or operation with
 *   'handles METHOD /path' connecting it. APIs don't connect to entities directly —
 *   the chain is: API → Flow/Operation (handles) → Entity (params/return).
 *
 * RULE_ORPHAN: Warning when a rule has no operation enforcing it
 * (only when model has >= 1 operation — opt-in).
 */
export function operationCompleteness(doc) {
    const model = collectModel(doc);
    const diagnostics = [];
    const eventNames = new Set(model.events.map((e) => e.name));
    const ruleNames = new Set(model.rules.map((r) => r.name));
    const enforcedRules = new Set();
    // Resolve all API endpoints: "METHOD fullPath" -> { inputType, returnType }
    const apiEndpoints = new Map();
    for (const api of model.apis) {
        const prefixDeco = api.decorators.find((d) => d.name === "prefix");
        const prefixVal = prefixDeco?.params[0]
            ? String(prefixDeco.params[0].value)
            : "";
        for (const ep of api.endpoints) {
            const fullPath = normalizePath(prefixVal + ep.path);
            const key = `${ep.method} ${fullPath}`;
            const inputType = ep.type === "ApiEndpointSimple" ? ep.inputType : ep.body;
            const returnType = ep.type === "ApiEndpointSimple" ? ep.returnType : ep.response;
            // API_DUPLICATE_ENDPOINT: same METHOD+path in multiple API blocks
            if (apiEndpoints.has(key)) {
                diagnostics.push({
                    code: "API_DUPLICATE_ENDPOINT",
                    severity: "error",
                    message: `Duplicate API endpoint '${key}' declared in multiple API blocks`,
                    location: ep.loc || api.loc,
                    help: `Remove the duplicate or use a different path`,
                });
            }
            apiEndpoints.set(key, { inputType: inputType ?? null, returnType: returnType ?? null });
        }
    }
    for (const op of model.operations) {
        for (const item of op.body) {
            if (item.type === "EmitsClause") {
                if (!eventNames.has(item.event)) {
                    diagnostics.push({
                        code: "OPERATION_EVENT_UNRESOLVED",
                        severity: "error",
                        message: `Operation '${op.name}' emits '${item.event}' which is not declared`,
                        location: item.loc,
                        help: "Declare the event or check the name",
                    });
                }
            }
            if (item.type === "OnClause") {
                if (!eventNames.has(item.event)) {
                    diagnostics.push({
                        code: "OPERATION_EVENT_UNRESOLVED",
                        severity: "error",
                        message: `Operation '${op.name}' trigger '${item.event}' is not a declared event`,
                        location: item.loc,
                        help: "Declare the event or check the name",
                    });
                }
            }
            if (item.type === "OperationHandlesClause") {
                const key = `${item.method} ${normalizePath(item.path)}`;
                const epInfo = apiEndpoints.get(key);
                if (!epInfo) {
                    diagnostics.push({
                        code: "OPERATION_HANDLES_UNRESOLVED",
                        severity: "warning",
                        message: `Operation '${op.name}' handles '${item.method} ${item.path}' which is not declared in any API`,
                        location: item.loc,
                        help: "Declare the endpoint in an 'api' block or check the method/path",
                    });
                }
                else {
                    // Check input type mismatch
                    const handlerInputName = baseTypeName(op.params[0]);
                    const epInputName = baseTypeName(epInfo.inputType);
                    if (handlerInputName && epInputName && handlerInputName !== epInputName) {
                        diagnostics.push({
                            code: "HANDLES_INPUT_MISMATCH",
                            severity: "warning",
                            message: `Operation '${op.name}' expects input '${handlerInputName}' but endpoint '${item.method} ${item.path}' expects '${epInputName}'`,
                            location: item.loc,
                            help: "Align the operation parameter type with the API endpoint input type, or update the endpoint",
                        });
                    }
                    // Check return type mismatch
                    const handlerReturnName = baseTypeName(op.returnType);
                    const epReturnName = baseTypeName(epInfo.returnType);
                    if (handlerReturnName && epReturnName && handlerReturnName !== epReturnName) {
                        diagnostics.push({
                            code: "HANDLES_RETURN_MISMATCH",
                            severity: "warning",
                            message: `Operation '${op.name}' returns '${handlerReturnName}' but endpoint '${item.method} ${item.path}' returns '${epReturnName}'`,
                            location: item.loc,
                            help: "Align the operation return type with the API endpoint return type, or update the endpoint",
                        });
                    }
                    // HANDLES_PARAM_MISMATCH: path has :id but input type has no matching field
                    const pathParams = extractPathParams(item.path);
                    if (pathParams.length > 0 && op.params[0]) {
                        const inputTypeName = baseTypeName(op.params[0]);
                        if (inputTypeName) {
                            const fields = getEntityFields(inputTypeName, model.entities);
                            if (fields) {
                                const missing = pathParams.filter((p) => !fields.has(p));
                                if (missing.length > 0) {
                                    diagnostics.push({
                                        code: "HANDLES_PARAM_MISMATCH",
                                        severity: "warning",
                                        message: `Operation '${op.name}' handles path with param(s) ':${missing.join("', ':")}' but input type '${inputTypeName}' has no matching field(s)`,
                                        location: item.loc,
                                        help: `Add field(s) '${missing.join("', '")}' to '${inputTypeName}' or use a type that includes them`,
                                    });
                                }
                            }
                        }
                    }
                }
            }
            if (item.type === "OperationCallsClause") {
                const key = `${item.method} ${normalizePath(item.path)}`;
                if (!apiEndpoints.has(key)) {
                    diagnostics.push({
                        code: "OPERATION_CALLS_UNRESOLVED",
                        severity: "warning",
                        message: `Operation '${op.name}' calls '${item.method} ${item.path}' which is not declared in any API (including @external)`,
                        location: item.loc,
                        help: "Declare the endpoint in an 'api' block (use @external for third-party APIs) or check the method/path",
                    });
                }
            }
            if (item.type === "EnforcesClause") {
                if (!ruleNames.has(item.rule)) {
                    diagnostics.push({
                        code: "OPERATION_RULE_UNRESOLVED",
                        severity: "error",
                        message: `Operation '${op.name}' enforces '${item.rule}' which is not a declared rule`,
                        location: item.loc,
                        help: "Declare the rule or check the name",
                    });
                }
                else {
                    enforcedRules.add(item.rule);
                }
            }
        }
    }
    // FLOW_HANDLES_UNRESOLVED: flow handles endpoint not found in any API
    // FLOW_CALLS_FORBIDDEN: flows cannot use 'calls' — only operations can consume endpoints
    for (const flow of model.flows) {
        for (const item of flow.body) {
            if (item.type === "OperationHandlesClause") {
                const key = `${item.method} ${normalizePath(item.path)}`;
                const epInfo = apiEndpoints.get(key);
                if (!epInfo) {
                    diagnostics.push({
                        code: "FLOW_HANDLES_UNRESOLVED",
                        severity: "warning",
                        message: `Flow '${flow.name}' handles '${item.method} ${item.path}' which is not declared in any API`,
                        location: item.loc,
                        help: "Declare the endpoint in an 'api' block or check the method/path",
                    });
                }
                else {
                    // Check input type mismatch
                    const handlerInputName = baseTypeName(flow.params[0]);
                    const epInputName = baseTypeName(epInfo.inputType);
                    if (handlerInputName && epInputName && handlerInputName !== epInputName) {
                        diagnostics.push({
                            code: "HANDLES_INPUT_MISMATCH",
                            severity: "warning",
                            message: `Flow '${flow.name}' expects input '${handlerInputName}' but endpoint '${item.method} ${item.path}' expects '${epInputName}'`,
                            location: item.loc,
                            help: "Align the flow parameter type with the API endpoint input type, or update the endpoint",
                        });
                    }
                    // Check return type mismatch
                    const handlerReturnName = baseTypeName(flow.returnType);
                    const epReturnName = baseTypeName(epInfo.returnType);
                    if (handlerReturnName && epReturnName && handlerReturnName !== epReturnName) {
                        diagnostics.push({
                            code: "HANDLES_RETURN_MISMATCH",
                            severity: "warning",
                            message: `Flow '${flow.name}' returns '${handlerReturnName}' but endpoint '${item.method} ${item.path}' returns '${epReturnName}'`,
                            location: item.loc,
                            help: "Align the flow return type with the API endpoint return type, or update the endpoint",
                        });
                    }
                    // HANDLES_PARAM_MISMATCH: path has :id but input type has no matching field
                    const pathParams = extractPathParams(item.path);
                    if (pathParams.length > 0 && flow.params[0]) {
                        const inputTypeName = baseTypeName(flow.params[0]);
                        if (inputTypeName) {
                            const fields = getEntityFields(inputTypeName, model.entities);
                            if (fields) {
                                const missing = pathParams.filter((p) => !fields.has(p));
                                if (missing.length > 0) {
                                    diagnostics.push({
                                        code: "HANDLES_PARAM_MISMATCH",
                                        severity: "warning",
                                        message: `Flow '${flow.name}' handles path with param(s) ':${missing.join("', ':")}' but input type '${inputTypeName}' has no matching field(s)`,
                                        location: item.loc,
                                        help: `Add field(s) '${missing.join("', '")}' to '${inputTypeName}' or use a type that includes them`,
                                    });
                                }
                            }
                        }
                    }
                }
            }
            // Detect 'calls' misused in flow (parsed as FlowStep since grammar doesn't allow it)
            if (item.type === "FlowStep" && /^calls\s/i.test(item.action)) {
                diagnostics.push({
                    code: "FLOW_CALLS_FORBIDDEN",
                    severity: "error",
                    message: `Flow '${flow.name}' uses 'calls' which is not allowed in flows. Only operations can consume API endpoints with 'calls'. Flows can receive endpoints with 'handles'`,
                    location: item.loc,
                    help: "Move 'calls' to an operation, or use 'handles' if this flow serves the endpoint",
                });
            }
        }
    }
    // API_ENDPOINT_ORPHAN: API endpoint has no flow or operation handling it.
    // Only checked for non-@external APIs, and only when model has flows or operations.
    if (model.flows.length > 0 || model.operations.length > 0) {
        // Collect all handled endpoints from flows and operations
        const handledEndpoints = new Set();
        for (const op of model.operations) {
            for (const item of op.body) {
                if (item.type === "OperationHandlesClause") {
                    handledEndpoints.add(`${item.method} ${normalizePath(item.path)}`);
                }
            }
        }
        for (const flow of model.flows) {
            for (const item of flow.body) {
                if (item.type === "OperationHandlesClause") {
                    handledEndpoints.add(`${item.method} ${normalizePath(item.path)}`);
                }
            }
        }
        for (const api of model.apis) {
            // Skip @external APIs — they are consumed, not served
            if (api.decorators.some((d) => d.name === "external"))
                continue;
            const prefixDeco = api.decorators.find((d) => d.name === "prefix");
            const prefixVal = prefixDeco?.params[0]
                ? String(prefixDeco.params[0].value)
                : "";
            for (const ep of api.endpoints) {
                const fullPath = normalizePath(prefixVal + ep.path);
                const key = `${ep.method} ${fullPath}`;
                if (!handledEndpoints.has(key)) {
                    diagnostics.push({
                        code: "API_ENDPOINT_ORPHAN",
                        severity: "warning",
                        message: `API endpoint '${ep.method} ${fullPath}' has no flow or operation handling it. Add 'handles ${ep.method} ${fullPath}' to the responsible flow or operation`,
                        location: ep.loc || api.loc,
                        help: `Add 'handles ${ep.method} ${fullPath}' inside the flow or operation that serves this endpoint`,
                    });
                }
            }
        }
    }
    // RULE_ORPHAN: only when model has operations (opt-in)
    if (model.operations.length > 0) {
        for (const rule of model.rules) {
            if (!enforcedRules.has(rule.name)) {
                diagnostics.push({
                    code: "RULE_ORPHAN",
                    severity: "warning",
                    message: `Rule '${rule.name}' is not enforced by any operation`,
                    location: rule.loc,
                    help: `Add 'enforces ${rule.name}' to the relevant operation`,
                });
            }
        }
    }
    return diagnostics;
}
//# sourceMappingURL=operation-completeness.js.map