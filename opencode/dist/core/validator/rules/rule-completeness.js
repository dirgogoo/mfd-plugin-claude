import { collectModel } from "../collect.js";
/**
 * RULE_INCOMPLETE: Warns when a rule is missing when or then clauses.
 * RULE_CLAUSE_ORDER: Error when else appears before when/then, or multiple else clauses.
 */
export function ruleCompleteness(doc) {
    const model = collectModel(doc);
    const diagnostics = [];
    for (const rule of model.rules) {
        const hasWhen = rule.body.some((i) => i.type === "WhenClause");
        const hasThen = rule.body.some((i) => i.type === "ThenClause");
        if (!hasWhen) {
            diagnostics.push({
                code: "RULE_INCOMPLETE",
                severity: "warning",
                message: `Rule '${rule.name}' is missing a 'when' clause`,
                location: rule.loc,
                help: "A rule should have both 'when' and 'then' clauses",
            });
        }
        if (!hasThen) {
            diagnostics.push({
                code: "RULE_INCOMPLETE",
                severity: "warning",
                message: `Rule '${rule.name}' is missing a 'then' clause`,
                location: rule.loc,
                help: "A rule should have both 'when' and 'then' clauses",
            });
        }
        // Validate clause ordering for elseif/else
        let elseCount = 0;
        let elseSeenAt = -1;
        const nonCommentItems = rule.body.filter((i) => i.type !== "SemanticComment");
        for (let i = 0; i < nonCommentItems.length; i++) {
            const item = nonCommentItems[i];
            if (item.type === "ElseIfClause") {
                // elseif without preceding when/then
                if (!hasWhen || !hasThen) {
                    diagnostics.push({
                        code: "RULE_INCOMPLETE",
                        severity: "warning",
                        message: `Rule '${rule.name}' has 'elseif' without preceding 'when'/'then'`,
                        location: item.loc,
                        help: "Add 'when' and 'then' clauses before 'elseif'",
                    });
                }
                // elseif after else
                if (elseSeenAt >= 0) {
                    diagnostics.push({
                        code: "RULE_CLAUSE_ORDER",
                        severity: "error",
                        message: `Rule '${rule.name}' has 'elseif' after 'else' — 'else' must be the last clause`,
                        location: item.loc,
                        help: `Correct clause order: when -> then -> elseif -> then -> else. Example:

  rule ${rule.name} {
    when condition_a
    then action_a("msg")
    elseif condition_b
    then action_b("msg")
    else fallback("msg")
  }`,
                    });
                }
            }
            if (item.type === "ElseClause") {
                elseCount++;
                elseSeenAt = i;
                if (elseCount > 1) {
                    diagnostics.push({
                        code: "RULE_CLAUSE_ORDER",
                        severity: "error",
                        message: `Rule '${rule.name}' has multiple 'else' clauses — only one is allowed`,
                        location: item.loc,
                        help: "Use 'elseif' for intermediate conditions",
                    });
                }
                // else without preceding when/then
                if (!hasWhen || !hasThen) {
                    diagnostics.push({
                        code: "RULE_INCOMPLETE",
                        severity: "warning",
                        message: `Rule '${rule.name}' has 'else' without preceding 'when'/'then'`,
                        location: item.loc,
                        help: "Add 'when' and 'then' clauses before 'else'",
                    });
                }
            }
        }
        // Check that else is last non-comment item (if present and count == 1)
        if (elseCount === 1 && elseSeenAt >= 0) {
            const afterElse = nonCommentItems.slice(elseSeenAt + 1);
            for (const item of afterElse) {
                if (item.type === "ElseIfClause" || item.type === "WhenClause" || item.type === "ThenClause") {
                    diagnostics.push({
                        code: "RULE_CLAUSE_ORDER",
                        severity: "error",
                        message: `Rule '${rule.name}' has clauses after 'else' — 'else' must be the last clause`,
                        location: item.loc,
                        help: `Correct clause order: when -> then -> [elseif -> then]* -> else. The 'else' clause must always be last.`,
                    });
                }
            }
        }
    }
    return diagnostics;
}
//# sourceMappingURL=rule-completeness.js.map