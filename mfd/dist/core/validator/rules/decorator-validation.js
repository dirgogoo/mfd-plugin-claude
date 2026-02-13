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
    tests: { params: "string" },
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
        if (!spec)
            return; // Unknown decorators are allowed (extensibility)
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
                message: `Decorator '@${deco.name}' expects a parameter`,
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