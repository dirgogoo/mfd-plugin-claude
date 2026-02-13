import { findNodeAtPosition } from "../utils/position.js";
export function getHover(params, docManager) {
    const entry = docManager.getModel(params.textDocument.uri);
    if (!entry)
        return null;
    const node = findNodeAtPosition(entry.doc, params.position);
    if (!node)
        return null;
    const contents = formatNodeInfo(node);
    if (!contents)
        return null;
    return { contents: { kind: "markdown", value: contents } };
}
function formatNodeInfo(node) {
    switch (node.type) {
        case "EntityDecl":
            return formatEntity(node);
        case "FlowDecl":
            return formatFlow(node);
        case "ApiDecl":
            return formatApi(node);
        case "StateDecl":
            return formatState(node);
        case "EnumDecl":
            return formatEnum(node);
        case "EventDecl":
            return formatEvent(node);
        case "SignalDecl":
            return formatSignal(node);
        case "OperationDecl":
            return formatOperation(node);
        case "RuleDecl":
            return formatRule(node);
        case "ScreenDecl":
            return formatScreen(node);
        case "ComponentDecl":
            return formatComponent(node);
        case "JourneyDecl":
            return formatJourney(node);
        case "SecretDecl":
            return formatSecret(node);
        case "DepDecl":
            return formatDep(node);
        case "ElementDecl":
            return formatElement(node);
        case "ActionDecl":
            return formatAction(node);
        case "FieldDecl":
            return `**field** \`${node.name}\`: \`${typeToString(node.fieldType)}\``;
        case "Decorator":
            return `**decorator** \`@${node.name}\``;
        default:
            return null;
    }
}
function formatEntity(e) {
    const fields = e.fields.map((f) => `  ${f.name}: ${typeToString(f.fieldType)}`).join("\n");
    const decos = formatDecorators(e.decorators);
    const inherit = formatInheritance(e);
    return `**entity** \`${e.name}\`${decos}${inherit}\n\`\`\`mfd\nentity ${e.name} {\n${fields}\n}\n\`\`\``;
}
function formatFlow(f) {
    const params = f.params.map(typeToString).join(", ");
    const ret = f.returnType ? typeToString(f.returnType) : "void";
    const decos = formatDecorators(f.decorators);
    const inherit = formatInheritance(f);
    const steps = f.body.filter((i) => i.type === "FlowStep").length;
    const trigger = f.body.find((i) => i.type === "OnClause");
    const triggerInfo = trigger ? `\n\ntriggered by \`${trigger.event}\`` : "";
    const emitItems = f.body.filter((i) => i.type === "EmitsClause");
    const emitsInfo = emitItems.length > 0 ? `\n\nemits: ${emitItems.map((e) => `\`${e.event}\``).join(", ")}` : "";
    return `**flow** \`${f.name}(${params}) -> ${ret}\`${decos}${inherit}\n\n${steps} step(s)${triggerInfo}${emitsInfo}`;
}
function formatApi(a) {
    const prefix = a.decorators.find((d) => d.name === "prefix");
    const prefixStr = prefix?.params[0] ? ` @prefix(${prefix.params[0].value})` : "";
    const isExternal = a.decorators.some((d) => d.name === "external");
    const externalStr = isExternal ? " @external" : "";
    const eps = a.endpoints.length;
    const streamCount = a.endpoints.filter((e) => e.method === "STREAM").length;
    const streamInfo = streamCount > 0 ? ` (${streamCount} STREAM)` : "";
    return `**api** \`${a.name ?? "(anonymous)"}\` ${a.style}${externalStr}${prefixStr}\n\n${eps} endpoint(s)${streamInfo}`;
}
function formatState(s) {
    const transitions = s.transitions.length;
    return `**state** \`${s.name}\` : \`${s.enumRef}\`\n\n${transitions} transition(s)`;
}
function formatEnum(e) {
    const vals = e.values.map((v) => v.name).join(", ");
    return `**enum** \`${e.name}\`\n\nValues: \`${vals}\``;
}
function formatEvent(e) {
    const fields = e.fields.map((f) => `${f.name}: ${typeToString(f.fieldType)}`).join(", ");
    const inherit = formatInheritance(e);
    return `**event** \`${e.name}\`${inherit}\n\nFields: ${fields || "(none)"}`;
}
function formatSignal(s) {
    const fields = s.fields.map((f) => `${f.name}: ${typeToString(f.fieldType)}`).join(", ");
    const inherit = formatInheritance(s);
    const decos = formatDecorators(s.decorators);
    return `**signal** \`${s.name}\`${decos}${inherit}\n\nFields: ${fields || "(none)"}`;
}
function formatOperation(o) {
    const params = o.params.map(typeToString).join(", ");
    const ret = o.returnType ? typeToString(o.returnType) : "void";
    const decos = formatDecorators(o.decorators);
    const parts = [`**operation** \`${o.name}(${params}) -> ${ret}\`${decos}`];
    const handlesItems = o.body.filter((i) => i.type === "OperationHandlesClause");
    if (handlesItems.length > 0) {
        parts.push(`handles: ${handlesItems.map((h) => `\`${h.method} ${h.path}\``).join(", ")}`);
    }
    const callsItems = o.body.filter((i) => i.type === "OperationCallsClause");
    if (callsItems.length > 0) {
        parts.push(`calls: ${callsItems.map((c) => `\`${c.method} ${c.path}\``).join(", ")}`);
    }
    const trigger = o.body.find((i) => i.type === "OnClause");
    if (trigger) {
        parts.push(`triggered by \`${trigger.event}\``);
    }
    const emitItems = o.body.filter((i) => i.type === "EmitsClause");
    if (emitItems.length > 0) {
        parts.push(`emits: ${emitItems.map((e) => `\`${e.event}\``).join(", ")}`);
    }
    const enforcesItems = o.body.filter((i) => i.type === "EnforcesClause");
    if (enforcesItems.length > 0) {
        parts.push(`enforces: ${enforcesItems.map((e) => `\`${e.rule}\``).join(", ")}`);
    }
    return parts.join("\n\n");
}
function formatRule(r) {
    let when = "";
    let then = "";
    const elseIfs = [];
    let elseAction = "";
    for (const item of r.body) {
        if (item.type === "WhenClause")
            when = item.expression;
        if (item.type === "ThenClause")
            then = item.action;
        if (item.type === "ElseIfClause")
            elseIfs.push(`elseif: \`${item.condition}\` then: \`${item.action}\``);
        if (item.type === "ElseClause")
            elseAction = item.action;
    }
    let result = `**rule** \`${r.name}\`\n\nwhen: \`${when}\`\nthen: \`${then}\``;
    if (elseIfs.length > 0)
        result += "\n" + elseIfs.join("\n");
    if (elseAction)
        result += `\nelse: \`${elseAction}\``;
    return result;
}
function formatElement(e) {
    const props = (e.body || []).filter((i) => i.type === "PropDecl").length;
    const forms = (e.body || []).filter((i) => i.type === "FormDecl").length;
    const decos = formatDecorators(e.decorators);
    const inherit = formatInheritance(e);
    return `**element** \`${e.name}\`${decos}${inherit}\n\n${props} prop(s), ${forms} form(s)`;
}
function formatAction(a) {
    const from = a.body?.find((i) => i.type === "ActionFromClause");
    const calls = a.body?.find((i) => i.type === "ActionCallsClause");
    const onStream = a.body?.find((i) => i.type === "ActionOnStreamClause");
    const onSignal = a.body?.find((i) => i.type === "ActionOnSignalClause");
    const emitsSignals = a.body?.filter((i) => i.type === "ActionEmitsSignalClause") || [];
    const results = a.body?.filter((i) => i.type === "ActionResult") || [];
    const pattern = onStream || onSignal ? "reactive" : "imperative";
    const parts = [`**action** \`${a.name}\` *(${pattern})*`];
    if (from)
        parts.push(`from \`${from.screen}\``);
    if (calls)
        parts.push(`calls \`${calls.method} ${calls.path}\``);
    if (onStream)
        parts.push(`on STREAM \`${onStream.path}\``);
    if (onSignal)
        parts.push(`on Signal \`${onSignal.signal}\``);
    if (emitsSignals.length > 0)
        parts.push(`emits Signal: ${emitsSignals.map((e) => `\`${e.signal}\``).join(", ")}`);
    if (results.length > 0)
        parts.push(`${results.length} result(s)`);
    return parts.join("\n\n");
}
function formatScreen(s) {
    const uses = s.body.filter((i) => i.type === "UsesDecl").length;
    const forms = s.body.filter((i) => i.type === "FormDecl").length;
    const inherit = formatInheritance(s);
    return `**screen** \`${s.name}\`${inherit}\n\n${uses} uses, ${forms} forms`;
}
function formatComponent(c) {
    const entities = c.body.filter((i) => i.type === "EntityDecl").length;
    const flows = c.body.filter((i) => i.type === "FlowDecl").length;
    const apis = c.body.filter((i) => i.type === "ApiDecl").length;
    const decos = formatDecorators(c.decorators);
    const inherit = formatInheritance(c);
    return `**component** \`${c.name}\`${decos}${inherit}\n\n${entities} entities, ${flows} flows, ${apis} APIs`;
}
function formatJourney(j) {
    const steps = j.body.filter((i) => i.type === "JourneyStep").length;
    return `**journey** \`${j.name}\`\n\n${steps} step(s)`;
}
function formatSecret(s) {
    const decos = formatDecorators(s.decorators);
    return `**secret** \`${s.name}\`${decos}`;
}
function formatDep(d) {
    const decos = formatDecorators(d.decorators);
    return `**dep** -> \`${d.target}\`${decos}`;
}
function formatInheritance(node) {
    const parts = [];
    if (node.extends) {
        parts.push(`extends \`${node.extends}\``);
    }
    if (node.implements?.length > 0) {
        parts.push(`implements ${node.implements.map((n) => `\`${n}\``).join(", ")}`);
    }
    return parts.length > 0 ? `\n\n${parts.join(" ")}` : "";
}
function formatDecorators(decorators) {
    if (!decorators || decorators.length === 0)
        return "";
    const strs = decorators.map((d) => {
        if (d.params.length === 0)
            return `@${d.name}`;
        const params = d.params.map((p) => p.value).join(", ");
        return `@${d.name}(${params})`;
    });
    return " " + strs.join(" ");
}
function typeToString(t) {
    if (!t)
        return "void";
    switch (t.type) {
        case "PrimitiveType":
        case "ReferenceType":
            return t.name;
        case "OptionalType":
            return `${typeToString(t.inner)}?`;
        case "ArrayType":
            return `${typeToString(t.inner)}[]`;
        case "UnionType":
            return t.alternatives.map(typeToString).join(" | ");
        case "InlineObjectType":
            return `{ ${t.fields.map((f) => `${f.name}: ${typeToString(f.fieldType)}`).join(", ")} }`;
        default:
            return "unknown";
    }
}
//# sourceMappingURL=hover.js.map