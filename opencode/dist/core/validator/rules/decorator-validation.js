import { collectModel } from "../collect.js";
/** Known decorators and their expected parameter patterns */
const KNOWN_DECORATORS = {
    // Validation
    min: { params: "number" },
    max: { params: "number" },
    format: { params: "identifier|string" },
    unique: { params: "none" },
    optional: { params: "none" },
    // Status
    status: { params: "identifier" },
    version: { params: "number" },
    domain: { params: "identifier" },
    // Implementation
    impl: { params: "path_list" },
    tests: { params: "path_list" },
    // API
    rate_limit: { params: "rate" },
    cache: { params: "duration" },
    auth: { params: "none" },
    paginated: { params: "none" },
    deprecated: { params: "none" },
    prefix: { params: "string" },
    scope: { params: "identifier" },
    external: { params: "none" },
    // Behavior
    async: { params: "none" },
    retry: { params: "number" },
    timeout: { params: "duration" },
    requires: { params: "identifier" },
    // Dep
    type: { params: "identifier" },
    // Secret
    required: { params: "none" },
    rotation: { params: "duration" },
    provider: { params: "identifier" },
    // Relationships
    relation: { params: "identifier" },
    // Inheritance
    abstract: { params: "none" },
    interface: { params: "none" },
};
const VALID_STATUS = new Set(["modeling", "implementing", "production", "deprecated",
    "implemented", "in_progress", "pending", "verified"]);
/** Deprecated @impl label values — replaced by file paths */
const DEPRECATED_IMPL_VALUES = new Set(["done", "backend", "frontend", "partial"]);
/** Deprecated @tests label values — replaced by file paths */
const DEPRECATED_TESTS_VALUES = new Set(["unit", "integration", "e2e", "contract", "done", "pending"]);
/** All known decorator names for "did you mean?" suggestions */
const ALL_DECORATOR_NAMES = Object.keys(KNOWN_DECORATORS);
/** Human-readable descriptions for decorator parameter types */
const PARAM_DESCRIPTIONS = {
    number: "a number, e.g. @min(1)",
    identifier: "an identifier, e.g. @requires(admin)",
    "identifier|string": "a format, e.g. @format(email)",
    string: "a string value, e.g. @prefix(/api)",
    rate: "a rate, e.g. @rate_limit(100/min)",
    duration: "a duration, e.g. @cache(5m)",
};
/**
 * Simple Levenshtein distance for "did you mean?" suggestions.
 */
function levenshtein(a, b) {
    const m = a.length, n = b.length;
    const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++)
        dp[i][0] = i;
    for (let j = 0; j <= n; j++)
        dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            dp[i][j] = a[i - 1] === b[j - 1]
                ? dp[i - 1][j - 1]
                : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
        }
    }
    return dp[m][n];
}
function suggestDecorator(name) {
    let best = null;
    let bestDist = Infinity;
    for (const known of ALL_DECORATOR_NAMES) {
        const d = levenshtein(name, known);
        if (d < bestDist && d <= 2) {
            bestDist = d;
            best = known;
        }
    }
    return best;
}
/** Constructs that support @abstract */
const ABSTRACT_VALID_CONSTRUCTS = new Set([
    "ElementDecl", "EntityDecl", "FlowDecl", "EventDecl", "SignalDecl", "ScreenDecl", "ComponentDecl",
]);
/** Constructs that support @interface */
const INTERFACE_VALID_CONSTRUCTS = new Set([
    "ElementDecl", "EntityDecl", "FlowDecl", "ScreenDecl", "ComponentDecl",
]);
/**
 * DECORATOR_INVALID: Warns when known decorator parameters don't match expected types.
 */
export function decoratorValidation(doc) {
    const model = collectModel(doc);
    const diagnostics = [];
    function checkDecorator(deco, constructType) {
        const spec = KNOWN_DECORATORS[deco.name];
        if (!spec) {
            // DECORATOR_UNKNOWN: warn on unrecognized decorators with "did you mean?" suggestion
            const suggestion = suggestDecorator(deco.name);
            diagnostics.push({
                code: "DECORATOR_UNKNOWN",
                severity: "warning",
                message: `Unknown decorator '@${deco.name}'`,
                location: deco.loc,
                help: suggestion
                    ? `Did you mean '@${suggestion}'?`
                    : `Known decorators: ${ALL_DECORATOR_NAMES.join(", ")}`,
            });
            return;
        }
        if (spec.params === "none" && deco.params.length > 0) {
            diagnostics.push({
                code: "DECORATOR_INVALID",
                severity: "warning",
                message: `Decorator '@${deco.name}' takes no parameters, but ${deco.params.length} given`,
                location: deco.loc,
            });
        }
        if (spec.params !== "none" && spec.params !== "path_list" && deco.params.length === 0) {
            diagnostics.push({
                code: "DECORATOR_INVALID",
                severity: "warning",
                message: `Decorator '@${deco.name}' expects ${PARAM_DESCRIPTIONS[spec.params] || "a parameter"}`,
                location: deco.loc,
            });
        }
        // Validate @status values
        if (deco.name === "status" && deco.params.length > 0) {
            const val = deco.params[0];
            if (val.kind === "identifier" && !VALID_STATUS.has(val.value)) {
                diagnostics.push({
                    code: "DECORATOR_INVALID",
                    severity: "warning",
                    message: `Invalid status '${val.value}'`,
                    location: deco.loc,
                    help: `Valid values: ${[...VALID_STATUS].join(", ")}`,
                });
            }
        }
        // Validate @impl values — file paths expected, deprecated labels warned
        if (deco.name === "impl" && deco.params.length > 0) {
            for (const param of deco.params) {
                const val = param.kind === "string" ? param.value : param.kind === "identifier" ? param.value : null;
                if (val && DEPRECATED_IMPL_VALUES.has(val)) {
                    diagnostics.push({
                        code: "IMPL_DEPRECATED_VALUE",
                        severity: "warning",
                        message: `@impl('${val}') is deprecated. Use file paths instead: @impl(src/path/to/file.ts)`,
                        location: deco.loc,
                        help: `Replace with the path to the implementation file, e.g. @impl(src/models/file.ts)`,
                    });
                }
                // Identifiers that aren't deprecated values and don't look like paths = likely error
                if (val && param.kind === "identifier" && !DEPRECATED_IMPL_VALUES.has(val) && !val.includes("/")) {
                    diagnostics.push({
                        code: "IMPL_INVALID_VALUE",
                        severity: "warning",
                        message: `@impl('${val}') should be a file path`,
                        location: deco.loc,
                        help: `Use a relative path like @impl(src/path/to/file.ts)`,
                    });
                }
            }
        }
        // Validate @tests values — file paths expected, deprecated labels warned
        if (deco.name === "tests" && deco.params.length > 0) {
            for (const param of deco.params) {
                const val = param.kind === "string" ? param.value : param.kind === "identifier" ? param.value : null;
                if (val && DEPRECATED_TESTS_VALUES.has(val)) {
                    diagnostics.push({
                        code: "TESTS_DEPRECATED_VALUE",
                        severity: "warning",
                        message: `@tests('${val}') is deprecated. Use file paths instead: @tests(tests/path/to/file.test.ts)`,
                        location: deco.loc,
                        help: `Replace with the path to the test file, e.g. @tests(tests/services/file.test.ts)`,
                    });
                }
                // Identifiers that aren't deprecated values and don't look like paths = likely error
                if (val && param.kind === "identifier" && !DEPRECATED_TESTS_VALUES.has(val) && !val.includes("/")) {
                    diagnostics.push({
                        code: "TESTS_INVALID_VALUE",
                        severity: "warning",
                        message: `@tests('${val}') should be a file path`,
                        location: deco.loc,
                        help: `Use a relative path like @tests(tests/path/to/file.test.ts)`,
                    });
                }
            }
        }
        // PREFIX_NO_LEADING_SLASH: @prefix(users) without leading /
        if (deco.name === "prefix" && deco.params.length > 0) {
            const val = deco.params[0].value;
            if (typeof val === "string" && val.length > 0 && !val.startsWith("/")) {
                diagnostics.push({
                    code: "PREFIX_NO_LEADING_SLASH",
                    severity: "warning",
                    message: `@prefix('${val}') should start with '/'`,
                    location: deco.loc,
                    help: `Use @prefix(/${val}) instead`,
                });
            }
        }
        // DECORATOR_INVALID_VALUE: @rate_limit / @timeout with value <= 0
        if ((deco.name === "rate_limit" || deco.name === "timeout" || deco.name === "retry") && deco.params.length > 0) {
            const param = deco.params[0];
            const numVal = param.kind === "number" ? Number(param.value) : null;
            if (numVal !== null && numVal <= 0) {
                diagnostics.push({
                    code: "DECORATOR_INVALID_VALUE",
                    severity: "warning",
                    message: `@${deco.name}(${param.value}) must have a positive value`,
                    location: deco.loc,
                    help: `Use a value greater than 0`,
                });
            }
        }
    }
    function checkDecorators(decos, constructType) {
        for (const d of decos)
            checkDecorator(d, constructType);
        // DECORATOR_CONFLICT: @abstract + @interface on same construct
        const hasAbstract = decos.some((d) => d.name === "abstract");
        const hasInterface = decos.some((d) => d.name === "interface");
        if (hasAbstract && hasInterface) {
            const loc = decos.find((d) => d.name === "interface").loc;
            diagnostics.push({
                code: "DECORATOR_CONFLICT",
                severity: "error",
                message: "A construct cannot be both @abstract and @interface",
                location: loc,
                help: "Use @abstract for base constructs with partial implementation, @interface for pure contracts",
            });
        }
        // DECORATOR_INVALID_TARGET: @abstract/@interface on unsupported constructs
        if (hasAbstract && constructType && !ABSTRACT_VALID_CONSTRUCTS.has(constructType)) {
            const kind = constructType.replace("Decl", "").toLowerCase();
            diagnostics.push({
                code: "DECORATOR_INVALID_TARGET",
                severity: "error",
                message: `@abstract is not valid on '${kind}' constructs`,
                location: decos.find((d) => d.name === "abstract").loc,
                help: "@abstract is valid on: element, entity, flow, event, screen, component",
            });
        }
        if (hasInterface && constructType && !INTERFACE_VALID_CONSTRUCTS.has(constructType)) {
            const kind = constructType.replace("Decl", "").toLowerCase();
            diagnostics.push({
                code: "DECORATOR_INVALID_TARGET",
                severity: "error",
                message: `@interface is not valid on '${kind}' constructs`,
                location: decos.find((d) => d.name === "interface").loc,
                help: "@interface is valid on: element, entity, flow, screen, component",
            });
        }
    }
    for (const el of model.elements) {
        checkDecorators(el.decorators, "ElementDecl");
        for (const item of el.body) {
            if (item.type === "PropDecl")
                checkDecorators(item.decorators);
        }
    }
    for (const e of model.entities) {
        checkDecorators(e.decorators, "EntityDecl");
        for (const f of e.fields)
            checkDecorators(f.decorators);
    }
    for (const e of model.enums)
        checkDecorators(e.decorators, "EnumDecl");
    for (const f of model.flows)
        checkDecorators(f.decorators, "FlowDecl");
    for (const s of model.states)
        checkDecorators(s.decorators, "StateDecl");
    for (const e of model.events)
        checkDecorators(e.decorators, "EventDecl");
    for (const s of model.signals)
        checkDecorators(s.decorators, "SignalDecl");
    for (const a of model.apis) {
        checkDecorators(a.decorators, "ApiDecl");
        for (const ep of a.endpoints)
            checkDecorators(ep.decorators);
    }
    for (const r of model.rules)
        checkDecorators(r.decorators, "RuleDecl");
    for (const d of model.deps)
        checkDecorators(d.decorators, "DepDecl");
    for (const s of model.secrets)
        checkDecorators(s.decorators, "SecretDecl");
    for (const c of model.components)
        checkDecorators(c.decorators);
    for (const s of model.systems)
        checkDecorators(s.decorators);
    for (const sc of model.screens)
        checkDecorators(sc.decorators, "ScreenDecl");
    for (const j of model.journeys)
        checkDecorators(j.decorators, "JourneyDecl");
    for (const o of model.operations)
        checkDecorators(o.decorators, "OperationDecl");
    return diagnostics;
}
//# sourceMappingURL=decorator-validation.js.map