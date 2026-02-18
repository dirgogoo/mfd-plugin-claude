import { collectModel, getKnownTypes } from "../collect.js";
/**
 * Simple Levenshtein distance for fuzzy matching suggestions.
 */
function levenshtein(a, b) {
    const la = a.length;
    const lb = b.length;
    const dp = Array.from({ length: la + 1 }, () => Array(lb + 1).fill(0));
    for (let i = 0; i <= la; i++)
        dp[i][0] = i;
    for (let j = 0; j <= lb; j++)
        dp[0][j] = j;
    for (let i = 1; i <= la; i++) {
        for (let j = 1; j <= lb; j++) {
            dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        }
    }
    return dp[la][lb];
}
/**
 * Find the closest matching type name for "Did you mean?" suggestions.
 */
function findSuggestion(name, candidates) {
    const lower = name.toLowerCase();
    let best;
    let bestDist = Infinity;
    const maxDist = Math.max(2, Math.floor(name.length / 3));
    for (const c of candidates) {
        const dist = levenshtein(lower, c.toLowerCase());
        if (dist < bestDist && dist <= maxDist) {
            bestDist = dist;
            best = c;
        }
    }
    return best;
}
/**
 * REF_UNRESOLVED: Checks that all type references in fields resolve to
 * declared entities, enums, or primitive types.
 *
 * Entity/event field types: error
 * Flow param/return and API types: warning (DTOs may be implicit)
 */
export function referentialIntegrity(doc) {
    const model = collectModel(doc);
    const knownTypes = getKnownTypes(model);
    const diagnostics = [];
    function checkType(typeExpr, context, severity) {
        switch (typeExpr.type) {
            case "ReferenceType":
                if (!knownTypes.has(typeExpr.name)) {
                    const available = [...knownTypes].filter(t => !["string", "number", "boolean", "date", "datetime", "uuid", "void"].includes(t)).sort();
                    const suggestion = findSuggestion(typeExpr.name, available);
                    let help;
                    if (suggestion) {
                        help = `Did you mean '${suggestion}'?`;
                    }
                    else if (available.length > 0) {
                        help = `Available types: ${available.join(", ")}`;
                    }
                    diagnostics.push({
                        code: "REF_UNRESOLVED",
                        severity,
                        message: `Type '${typeExpr.name}' is not defined`,
                        location: typeExpr.loc,
                        help,
                    });
                }
                break;
            case "OptionalType":
                checkType(typeExpr.inner, context, severity);
                break;
            case "ArrayType":
                checkType(typeExpr.inner, context, severity);
                break;
            case "UnionType":
                for (const alt of typeExpr.alternatives) {
                    checkType(alt, context, severity);
                }
                break;
            case "InlineObjectType":
                for (const field of typeExpr.fields) {
                    checkType(field.fieldType, `${context}.${field.name}`, severity);
                }
                break;
        }
    }
    // Check entity fields — strict (error)
    for (const entity of model.entities) {
        for (const field of entity.fields) {
            checkType(field.fieldType, `${entity.name}.${field.name}`, "error");
        }
    }
    // Check event fields — strict (error)
    for (const event of model.events) {
        for (const field of event.fields) {
            checkType(field.fieldType, `${event.name}.${field.name}`, "error");
        }
    }
    // Check signal fields — strict (error)
    for (const signal of model.signals) {
        for (const field of signal.fields) {
            checkType(field.fieldType, `${signal.name}.${field.name}`, "error");
        }
    }
    // Check flow params and return types — lenient (warning)
    // Flow params often reference implicit DTO types (e.g. Credentials, RegisterInput)
    for (const flow of model.flows) {
        for (const param of flow.params) {
            checkType(param, `flow ${flow.name} params`, "warning");
        }
        if (flow.returnType) {
            checkType(flow.returnType, `flow ${flow.name} return`, "warning");
        }
    }
    // Check operation params and return types — lenient (warning)
    for (const op of model.operations) {
        for (const param of op.params) {
            checkType(param, `operation ${op.name} params`, "warning");
        }
        if (op.returnType) {
            checkType(op.returnType, `operation ${op.name} return`, "warning");
        }
    }
    // Check screen form field types — lenient (warning)
    for (const screen of model.screens) {
        for (const item of screen.body) {
            if (item.type === "FormDecl") {
                for (const field of item.fields) {
                    checkType(field.fieldType, `screen ${screen.name} form`, "warning");
                }
            }
        }
    }
    // Check action params — lenient (warning)
    for (const action of model.actions) {
        for (const param of action.params) {
            checkType(param, `action ${action.name} params`, "warning");
        }
    }
    // Check API endpoint types — lenient (warning)
    for (const api of model.apis) {
        for (const ep of api.endpoints) {
            if (ep.type === "ApiEndpointSimple") {
                if (ep.inputType)
                    checkType(ep.inputType, `api ${api.name ?? api.style} input`, "warning");
                if (ep.returnType)
                    checkType(ep.returnType, `api ${api.name ?? api.style} return`, "warning");
            }
            else {
                if (ep.body)
                    checkType(ep.body, `api ${api.name ?? api.style} body`, "warning");
                if (ep.response)
                    checkType(ep.response, `api ${api.name ?? api.style} response`, "warning");
                if (ep.query)
                    checkType(ep.query, `api ${api.name ?? api.style} query`, "warning");
            }
        }
    }
    return diagnostics;
}
//# sourceMappingURL=referential-integrity.js.map