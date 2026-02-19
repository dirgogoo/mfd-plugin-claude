import { collectModel } from "../collect.js";
import { normalizePath, baseTypeName, extractPathParams, getEntityFields, resolveApiEndpoints } from "./shared-helpers.js";
/**
 * ACTION_FROM_UNRESOLVED: from screen not declared.
 * ACTION_CALLS_UNRESOLVED: calls endpoint not found in any API.
 * ACTION_CALLS_INPUT_MISMATCH: action input type differs from endpoint input type.
 * ACTION_CALLS_PARAM_MISMATCH: endpoint path has :param but action input type lacks matching field.
 * ACTION_RESULT_SCREEN_UNRESOLVED: result screen not declared.
 * ACTION_ON_STREAM_UNRESOLVED: on STREAM path not found as STREAM endpoint.
 * ACTION_ON_SIGNAL_UNRESOLVED: on Signal references signal not declared.
 * ACTION_EMITS_SIGNAL_UNRESOLVED: emits Signal references signal not declared.
 * ACTION_MIXED_PATTERNS: action cannot have both 'calls' and 'on STREAM'/'on Signal'.
 */
export function actionCompleteness(doc) {
    const model = collectModel(doc);
    const diagnostics = [];
    const screenNames = new Set(model.screens.map((s) => s.name));
    const signalNames = new Set(model.signals.map((s) => s.name));
    // Resolve all API endpoints: "METHOD fullPath" -> { inputType, returnType }
    const apiEndpoints = resolveApiEndpoints(model);
    // Collect STREAM endpoint full paths separately
    const streamEndpoints = new Set();
    for (const api of model.apis) {
        const prefixDeco = api.decorators.find((d) => d.name === "prefix");
        const prefixVal = prefixDeco?.params[0]
            ? String(prefixDeco.params[0].value)
            : "";
        for (const ep of api.endpoints) {
            if (ep.method === "STREAM") {
                streamEndpoints.add(normalizePath(prefixVal + ep.path));
            }
        }
    }
    for (const action of model.actions) {
        // Detect mixed patterns: calls + reactive (on STREAM or on Signal)
        const hasCalls = action.body.some((i) => i.type === "ActionCallsClause");
        const hasOnStream = action.body.some((i) => i.type === "ActionOnStreamClause");
        const hasOnSignal = action.body.some((i) => i.type === "ActionOnSignalClause");
        if (hasCalls && (hasOnStream || hasOnSignal)) {
            diagnostics.push({
                code: "ACTION_MIXED_PATTERNS",
                severity: "error",
                message: `Action '${action.name}' cannot have both 'calls' (imperative) and reactive trigger ('on STREAM' / 'on Signal') — choose one pattern`,
                location: action.loc,
                help: `Actions have 4 mutually exclusive patterns — pick ONE per action:

  # 1. Imperative (calls endpoint)
  action criar_item(Input) {
    from MinhaScreen
    calls POST /api/items
    | sucesso -> OutraScreen
  }

  # 2. Reactive STREAM (server-sent events)
  action refresh_lista {
    from MinhaScreen
    on STREAM /api/items/events
    | atualizado -> MinhaScreen
  }

  # 3. Reactive Signal (client-side)
  action on_theme {
    from MinhaScreen
    on ThemeChanged
    | dark -> MinhaScreen
  }

  # 4. Pure (no calls, no reactive)
  action ir_config {
    from MinhaScreen
    | ok -> ConfigScreen
  }`,
            });
        }
        if (hasOnStream && hasOnSignal) {
            diagnostics.push({
                code: "ACTION_MIXED_PATTERNS",
                severity: "error",
                message: `Action '${action.name}' cannot have both 'on STREAM' and 'on Signal' — choose one reactive source`,
                location: action.loc,
                help: `'on STREAM' and 'on Signal' are different reactive sources — use one per action:

  # STREAM = server-sent events (requires STREAM endpoint in api block)
  action listen_orders {
    from OrderList
    on STREAM /api/orders/events    # server pushes events
    | update -> OrderList
  }

  # Signal = client-side event (requires signal declaration)
  action on_theme {
    from Dashboard
    on ThemeChanged                 # client-side signal
    | dark -> Dashboard
  }`,
            });
        }
        for (const item of action.body) {
            // ACTION_FROM_UNRESOLVED
            if (item.type === "ActionFromClause") {
                if (!screenNames.has(item.screen)) {
                    diagnostics.push({
                        code: "ACTION_FROM_UNRESOLVED",
                        severity: "error",
                        message: `Action '${action.name}' references screen '${item.screen}' in 'from' which is not declared`,
                        location: item.loc,
                        help: `Declare 'screen ${item.screen} { ... }' or check the name`,
                    });
                }
            }
            // ACTION_CALLS_UNRESOLVED + type checks
            if (item.type === "ActionCallsClause") {
                const key = `${item.method} ${normalizePath(item.path)}`;
                const epInfo = apiEndpoints.get(key);
                if (!epInfo) {
                    diagnostics.push({
                        code: "ACTION_CALLS_UNRESOLVED",
                        severity: "warning",
                        message: `Action '${action.name}' calls '${item.method} ${item.path}' which is not declared in any API`,
                        location: item.loc,
                        help: "Declare the endpoint in an 'api' block or check the method/path",
                    });
                }
                else {
                    // ACTION_CALLS_INPUT_MISMATCH
                    const actionInputName = baseTypeName(action.params[0]);
                    const epInputName = baseTypeName(epInfo.inputType);
                    if (actionInputName && epInputName && actionInputName !== epInputName) {
                        diagnostics.push({
                            code: "ACTION_CALLS_INPUT_MISMATCH",
                            severity: "warning",
                            message: `Action '${action.name}' has input '${actionInputName}' but endpoint '${item.method} ${item.path}' expects '${epInputName}'`,
                            location: item.loc,
                            help: "Align the action parameter type with the API endpoint input type, or update the endpoint",
                        });
                    }
                    // ACTION_CALLS_PARAM_MISMATCH
                    const pathParams = extractPathParams(item.path);
                    if (pathParams.length > 0 && action.params[0]) {
                        const inputTypeName = baseTypeName(action.params[0]);
                        if (inputTypeName) {
                            const fields = getEntityFields(inputTypeName, model.entities);
                            if (fields) {
                                const missing = pathParams.filter((p) => !fields.has(p));
                                if (missing.length > 0) {
                                    diagnostics.push({
                                        code: "ACTION_CALLS_PARAM_MISMATCH",
                                        severity: "warning",
                                        message: `Action '${action.name}' calls path with param(s) ':${missing.join("', ':")}' but input type '${inputTypeName}' has no matching field(s)`,
                                        location: item.loc,
                                        help: `Add field(s) '${missing.join("', '")}' to '${inputTypeName}' or use a type that includes them`,
                                    });
                                }
                            }
                        }
                    }
                }
            }
            // ACTION_ON_STREAM_UNRESOLVED
            if (item.type === "ActionOnStreamClause") {
                const normalizedPath = normalizePath(item.path);
                if (!streamEndpoints.has(normalizedPath)) {
                    diagnostics.push({
                        code: "ACTION_ON_STREAM_UNRESOLVED",
                        severity: "error",
                        message: `Action '${action.name}' subscribes to 'STREAM ${item.path}' which is not declared as a STREAM endpoint`,
                        location: item.loc,
                        help: "Declare 'STREAM " + item.path + " -> EventType' in an API block",
                    });
                }
            }
            // ACTION_ON_SIGNAL_UNRESOLVED
            if (item.type === "ActionOnSignalClause") {
                if (!signalNames.has(item.signal)) {
                    diagnostics.push({
                        code: "ACTION_ON_SIGNAL_UNRESOLVED",
                        severity: "error",
                        message: `Action '${action.name}' reacts to signal '${item.signal}' which is not declared`,
                        location: item.loc,
                        help: `Declare 'signal ${item.signal} { ... }' or check the name`,
                    });
                }
            }
            // ACTION_EMITS_SIGNAL_UNRESOLVED
            if (item.type === "ActionEmitsSignalClause") {
                if (!signalNames.has(item.signal)) {
                    diagnostics.push({
                        code: "ACTION_EMITS_SIGNAL_UNRESOLVED",
                        severity: "error",
                        message: `Action '${action.name}' emits signal '${item.signal}' which is not declared`,
                        location: item.loc,
                        help: `Declare 'signal ${item.signal} { ... }' or check the name`,
                    });
                }
            }
            // ACTION_RESULT_SCREEN_UNRESOLVED
            if (item.type === "ActionResult") {
                if (item.screen !== "end" && !screenNames.has(item.screen)) {
                    diagnostics.push({
                        code: "ACTION_RESULT_SCREEN_UNRESOLVED",
                        severity: "warning",
                        message: `Action '${action.name}' result references screen '${item.screen}' which is not declared`,
                        location: item.loc,
                        help: "Declare the target screen or use 'end'",
                    });
                }
            }
        }
    }
    return diagnostics;
}
//# sourceMappingURL=action-completeness.js.map