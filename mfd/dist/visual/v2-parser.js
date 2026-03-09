/**
 * Lightweight regex-based parser for MFD v2 files.
 * Extracts enough structure for visualization — NOT a full parser.
 * Will be replaced by the real v2 parser when it's built.
 */
function extractTopLevelBlocks(source) {
    const blocks = [];
    const lines = source.split("\n");
    let i = 0;
    while (i < lines.length) {
        const line = lines[i];
        const stripped = line.replace(/#.*$/, "").trim();
        // Match top-level construct start
        const match = stripped.match(/^(system|concept|enum|capability|invariant|property|objective)\s+/);
        if (!match) {
            i++;
            continue;
        }
        const keyword = match[1];
        const headerStart = i;
        // Find opening brace
        let headerLines = [line];
        let braceIdx = stripped.indexOf("{");
        if (braceIdx === -1) {
            // Opening brace may be on subsequent lines
            let j = i + 1;
            while (j < lines.length) {
                headerLines.push(lines[j]);
                const jStripped = lines[j].replace(/#.*$/, "").trim();
                if (jStripped.includes("{")) {
                    braceIdx = 0; // found it
                    break;
                }
                j++;
            }
            if (braceIdx === -1) {
                i++;
                continue;
            }
            i = j;
        }
        // Match braces to find end of block
        const fullText = headerLines.join("\n");
        let depth = 0;
        let bodyStart = -1;
        let bodyEnd = -1;
        // Start from current line, count braces
        let blockLines = [];
        let j = headerStart;
        let foundEnd = false;
        while (j < lines.length) {
            blockLines.push(lines[j]);
            const content = lines[j].replace(/#.*$/, "");
            for (const ch of content) {
                if (ch === "{") {
                    if (depth === 0)
                        bodyStart = blockLines.length - 1;
                    depth++;
                }
                else if (ch === "}") {
                    depth--;
                    if (depth === 0) {
                        bodyEnd = blockLines.length - 1;
                        foundEnd = true;
                        break;
                    }
                }
            }
            if (foundEnd)
                break;
            j++;
        }
        if (!foundEnd) {
            i++;
            continue;
        }
        const header = blockLines.slice(0, bodyStart + 1).join("\n");
        const bodyLines = blockLines.slice(bodyStart + 1, bodyEnd);
        const body = bodyLines.join("\n");
        blocks.push({ keyword, header, body, startLine: headerStart + 1 });
        i = headerStart + blockLines.length;
    }
    return blocks;
}
// === Decorator Parsing ===
function parseDecorators(text) {
    const decorators = [];
    const re = /@(\w+)(?:\(([^)]*)\))?/g;
    let m;
    while ((m = re.exec(text)) !== null) {
        const name = m[1];
        const paramStr = m[2];
        const params = [];
        if (paramStr) {
            for (const p of paramStr.split(",")) {
                const v = p.trim();
                const num = Number(v);
                params.push({ value: isNaN(num) ? v : num });
            }
        }
        decorators.push({ name, params });
    }
    return decorators;
}
// === Type Parsing ===
function parseFieldType(typeStr) {
    const t = typeStr.trim();
    if (t.endsWith("[]")) {
        return { type: "ArrayType", inner: parseFieldType(t.slice(0, -2)) };
    }
    if (t.endsWith("?")) {
        return { type: "OptionalType", inner: parseFieldType(t.slice(0, -1)) };
    }
    if (t.includes("|")) {
        return {
            type: "UnionType",
            alternatives: t.split("|").map((s) => parseFieldType(s.trim())),
        };
    }
    const primitives = ["string", "number", "boolean", "date", "datetime", "uuid", "void"];
    if (primitives.includes(t)) {
        return { type: "PrimitiveType", name: t };
    }
    return { type: "ReferenceType", name: t };
}
// === Comments Extraction ===
function extractComments(text) {
    const comments = [];
    for (const line of text.split("\n")) {
        const m = line.match(/^\s*#\s*(.+)/);
        if (m)
            comments.push(m[1].trim());
    }
    return comments;
}
// === Concept Parsing ===
function parseConcept(block, source) {
    const headerMatch = block.header.match(/concept\s+(\w+)/);
    const name = headerMatch?.[1] ?? "Unknown";
    const decorators = parseDecorators(block.header);
    const comments = extractComments(block.body);
    const fields = [];
    let lifecycle;
    const invariants = [];
    // Extract sub-blocks (lifecycle, invariant) first
    const bodyLines = block.body.split("\n");
    const processedRanges = [];
    // Find lifecycle block
    for (let i = 0; i < bodyLines.length; i++) {
        const lcMatch = bodyLines[i].match(/^\s*lifecycle\s+(\w+)\s*:\s*(\w+)\s*\{/);
        if (lcMatch) {
            const lcField = lcMatch[1];
            const lcEnum = lcMatch[2];
            const transitions = [];
            let depth = 1;
            let j = i + 1;
            let pendingRequires;
            while (j < bodyLines.length && depth > 0) {
                const lcLine = bodyLines[j].replace(/#.*$/, "").trim();
                for (const ch of lcLine) {
                    if (ch === "{")
                        depth++;
                    if (ch === "}")
                        depth--;
                }
                if (depth > 0) {
                    // Parse transition: from -> to : on capability
                    const tMatch = lcLine.match(/^(\w+)\s*->\s*(\w+)\s*:\s*on\s+(\w+)/);
                    if (tMatch) {
                        if (pendingRequires) {
                            // Attach requires to the last transition
                            const last = transitions[transitions.length - 1];
                            if (last)
                                last.requires = pendingRequires;
                            pendingRequires = undefined;
                        }
                        transitions.push({
                            from: tMatch[1],
                            to: tMatch[2],
                            capability: tMatch[3],
                        });
                    }
                    // Parse requires guard
                    const reqMatch = lcLine.match(/^\s*requires\s+(.+)/);
                    if (reqMatch) {
                        pendingRequires = reqMatch[1].trim();
                        const last = transitions[transitions.length - 1];
                        if (last) {
                            last.requires = pendingRequires;
                            pendingRequires = undefined;
                        }
                    }
                }
                j++;
            }
            lifecycle = { field: lcField, enumRef: lcEnum, transitions };
            processedRanges.push([i, j - 1]);
        }
    }
    // Find invariant blocks inside concept
    for (let i = 0; i < bodyLines.length; i++) {
        if (processedRanges.some(([s, e]) => i >= s && i <= e))
            continue;
        const invMatch = bodyLines[i].match(/^\s*invariant\s+(\w+)\s*\{/);
        if (invMatch) {
            let depth = 1;
            let j = i + 1;
            const exprLines = [];
            while (j < bodyLines.length && depth > 0) {
                const invLine = bodyLines[j].replace(/#.*$/, "");
                for (const ch of invLine) {
                    if (ch === "{")
                        depth++;
                    if (ch === "}")
                        depth--;
                }
                if (depth > 0) {
                    const trimmed = invLine.trim();
                    if (trimmed)
                        exprLines.push(trimmed);
                }
                j++;
            }
            invariants.push({ name: invMatch[1], expression: exprLines.join(" ") });
            processedRanges.push([i, j - 1]);
        }
    }
    // Parse fields (lines that match "name: type" pattern)
    for (let i = 0; i < bodyLines.length; i++) {
        if (processedRanges.some(([s, e]) => i >= s && i <= e))
            continue;
        const line = bodyLines[i].replace(/#.*$/, "").trim();
        const fieldMatch = line.match(/^(\w+)\s*:\s*(\S+(?:\[\]|\?)?)\s*(.*)/);
        if (fieldMatch) {
            const fname = fieldMatch[1];
            if (fname === "lifecycle" || fname === "invariant")
                continue;
            const typeStr = fieldMatch[2];
            const rest = fieldMatch[3];
            fields.push({
                name: fname,
                fieldType: parseFieldType(typeStr),
                decorators: parseDecorators(rest),
            });
        }
    }
    const loc = {
        start: { line: block.startLine, column: 1, source },
    };
    return { name, fields, lifecycle, invariants, decorators, comments, loc };
}
// === Enum Parsing ===
function parseEnum(block, source) {
    const headerMatch = block.header.match(/enum\s+(\w+)/);
    const name = headerMatch?.[1] ?? "Unknown";
    const decorators = parseDecorators(block.header);
    const values = [];
    // For single-line enums, body is empty — values are between { } in the header
    let content = block.body.replace(/#.*$/gm, "");
    if (!content.trim()) {
        const inlineMatch = block.header.match(/\{([^}]*)\}/);
        if (inlineMatch)
            content = inlineMatch[1];
    }
    // Values can be comma-separated on one or multiple lines
    const valStr = content.replace(/\n/g, " ").trim();
    for (const v of valStr.split(",")) {
        const val = v.trim();
        if (val)
            values.push(val);
    }
    const loc = { start: { line: block.startLine, column: 1, source } };
    return { name, values, decorators, loc };
}
// === Capability Parsing ===
function parseCapability(block, source) {
    // Header: capability name(params) -> ReturnType @decorators {
    const headerClean = block.header.replace(/#.*$/gm, "").replace(/\n/g, " ");
    const nameMatch = headerClean.match(/capability\s+(\w+)/);
    const name = nameMatch?.[1] ?? "Unknown";
    // Extract params
    const params = [];
    const paramMatch = headerClean.match(/\(([^)]*)\)/);
    if (paramMatch && paramMatch[1].trim()) {
        for (const p of paramMatch[1].split(",")) {
            const pm = p.trim().match(/^(\w+)\s*:\s*(.+)/);
            if (pm) {
                params.push({ name: pm[1], fieldType: parseFieldType(pm[2].trim()) });
            }
        }
    }
    // Extract return type
    let returnType = null;
    const retMatch = headerClean.match(/->\s*(\S+)/);
    if (retMatch) {
        const retStr = retMatch[1].replace(/@.*$/, "").replace(/\{.*$/, "").trim();
        if (retStr)
            returnType = parseFieldType(retStr);
    }
    // Decorators from header (after params/return, before brace)
    const decorators = parseDecorators(headerClean);
    const comments = extractComments(block.body);
    // Parse clauses from body
    const clauses = [];
    const bodyLines = block.body.split("\n");
    for (let i = 0; i < bodyLines.length; i++) {
        const line = bodyLines[i].replace(/#.*$/, "").trim();
        if (!line)
            continue;
        // given
        if (line.startsWith("given ")) {
            clauses.push({ type: "given", expression: line.slice(6).trim() });
            continue;
        }
        // then
        if (line.startsWith("then ")) {
            clauses.push({ type: "then", expression: line.slice(5).trim() });
            continue;
        }
        // reject "reason" when condition
        const rejectMatch = line.match(/^reject\s+"([^"]+)"\s+when\s*(.*)/);
        if (rejectMatch) {
            let condition = rejectMatch[2].trim();
            // Multi-line condition
            if (!condition) {
                let j = i + 1;
                while (j < bodyLines.length) {
                    const nextLine = bodyLines[j].replace(/#.*$/, "").trim();
                    if (nextLine.startsWith("reject ") ||
                        nextLine.startsWith("given ") ||
                        nextLine.startsWith("then ") ||
                        nextLine.startsWith("affects ") ||
                        nextLine.startsWith("emits ") ||
                        nextLine.startsWith("via "))
                        break;
                    if (nextLine) {
                        condition = nextLine;
                        break;
                    }
                    j++;
                }
            }
            clauses.push({ type: "reject", reason: rejectMatch[1], condition });
            continue;
        }
        // affects Concept where condition { assignments }
        if (line.startsWith("affects ")) {
            const affMatch = line.match(/^affects\s+(\w+)(?:\s+where\s+(.+?))?\s*\{?/);
            if (affMatch) {
                const concept = affMatch[1];
                const where = affMatch[2]?.trim();
                const assignments = [];
                // Find block body
                if (line.includes("{")) {
                    let j = i + 1;
                    let depth = 1;
                    while (j < bodyLines.length && depth > 0) {
                        const aLine = bodyLines[j].replace(/#.*$/, "").trim();
                        for (const ch of aLine) {
                            if (ch === "{")
                                depth++;
                            if (ch === "}")
                                depth--;
                        }
                        if (depth > 0) {
                            const assMatch = aLine.match(/^(\w+)\s*=\s*(.+)/);
                            if (assMatch) {
                                assignments.push({ field: assMatch[1], expression: assMatch[2].trim() });
                            }
                        }
                        j++;
                    }
                }
                clauses.push({ type: "affects", concept, where, assignments });
            }
            continue;
        }
        // emits EventName
        if (line.startsWith("emits ")) {
            clauses.push({ type: "emits", event: line.slice(6).trim() });
            continue;
        }
        // via METHOD /path @decorators
        if (line.startsWith("via ")) {
            const viaMatch = line.match(/^via\s+(GET|POST|PUT|DELETE|PATCH|STREAM)\s+(\S+)/);
            if (viaMatch) {
                const viaDecorators = parseDecorators(line);
                clauses.push({
                    type: "via",
                    method: viaMatch[1],
                    path: viaMatch[2],
                    decorators: viaDecorators,
                });
            }
            continue;
        }
    }
    const loc = { start: { line: block.startLine, column: 1, source } };
    return { name, params, returnType, clauses, decorators, comments, loc };
}
// === Invariant Parsing ===
function parseInvariant(block, source) {
    const headerMatch = block.header.match(/invariant\s+(\w+)/);
    const name = headerMatch?.[1] ?? "Unknown";
    const decorators = parseDecorators(block.header);
    const comments = extractComments(block.body);
    const exprLines = [];
    for (const line of block.body.split("\n")) {
        const clean = line.replace(/#.*$/, "").trim();
        if (clean)
            exprLines.push(clean);
    }
    const expression = exprLines.join(" ");
    const loc = { start: { line: block.startLine, column: 1, source } };
    return { name, expression, comments, scope: "global", decorators, loc };
}
// === Property Parsing ===
function parseProperty(block, source) {
    const headerMatch = block.header.match(/property\s+(\w+)/);
    const name = headerMatch?.[1] ?? "Unknown";
    const decorators = parseDecorators(block.header);
    const comments = extractComments(block.body);
    const clauses = [];
    const bodyLines = block.body.split("\n");
    for (let i = 0; i < bodyLines.length; i++) {
        const line = bodyLines[i].replace(/#.*$/, "").trim();
        if (!line)
            continue;
        if (line.startsWith("never:")) {
            clauses.push({ type: "never", expression: line.slice(6).trim() });
        }
        else if (line.startsWith("eventually:")) {
            let expr = line.slice(11).trim();
            // Check for where clause on next line
            const nextIdx = i + 1;
            if (nextIdx < bodyLines.length) {
                const nextLine = bodyLines[nextIdx].replace(/#.*$/, "").trim();
                if (nextLine.startsWith("where ")) {
                    clauses.push({ type: "eventually", expression: expr, where: nextLine.slice(6).trim() });
                    i = nextIdx;
                    continue;
                }
            }
            clauses.push({ type: "eventually", expression: expr });
        }
        else if (line.startsWith("always:")) {
            clauses.push({ type: "always", expression: line.slice(7).trim() });
        }
    }
    const loc = { start: { line: block.startLine, column: 1, source } };
    return { name, clauses, comments, decorators, loc };
}
// === Objective Parsing ===
function parseObjective(block, source) {
    const headerMatch = block.header.match(/objective\s+(\w+)/);
    const name = headerMatch?.[1] ?? "Unknown";
    const decorators = parseDecorators(block.header);
    const personaDec = decorators.find((d) => d.name === "persona");
    const persona = personaDec ? String(personaDec.params[0]?.value ?? "") : undefined;
    const comments = extractComments(block.body);
    const transitions = [];
    for (const line of block.body.split("\n")) {
        const clean = line.replace(/#.*$/, "").trim();
        // Pattern: from -> to : on trigger
        const tMatch = clean.match(/^(\*|\w+)\s*->\s*(\w+)\s*:\s*on\s+(\w+)/);
        if (tMatch) {
            transitions.push({ from: tMatch[1], to: tMatch[2], trigger: tMatch[3] });
        }
    }
    const loc = { start: { line: block.startLine, column: 1, source } };
    return { name, persona, transitions, comments, decorators, loc };
}
// === System Parsing ===
function parseSystem(block) {
    const nameMatch = block.header.match(/system\s+"([^"]+)"/);
    const name = nameMatch?.[1] ?? "MFD System";
    const decorators = parseDecorators(block.header);
    const versionDec = decorators.find((d) => d.name === "version");
    const version = versionDec ? String(versionDec.params[0]?.value ?? "") : undefined;
    const comments = extractComments(block.body);
    // Extract imports
    const imports = [];
    for (const line of block.body.split("\n")) {
        const impMatch = line.match(/^\s*(?:import|include)\s+"([^"]+)"/);
        if (impMatch)
            imports.push(impMatch[1]);
    }
    return { name, version, comments, decorators, imports };
}
// === Main Entry Point ===
/**
 * Parse a v2 .mfd source string into a CollectedModelV2.
 * This is a lightweight regex-based parser for visualization purposes.
 */
export function parseV2(source, filePath = "model.mfd") {
    const blocks = extractTopLevelBlocks(source);
    const model = {
        systems: [],
        concepts: [],
        enums: [],
        capabilities: [],
        invariants: [],
        properties: [],
        objectives: [],
    };
    for (const block of blocks) {
        switch (block.keyword) {
            case "system":
                model.systems.push(parseSystem(block));
                break;
            case "concept": {
                const concept = parseConcept(block, filePath);
                model.concepts.push(concept);
                // Also add local invariants to the global list
                for (const inv of concept.invariants) {
                    model.invariants.push({
                        name: inv.name,
                        expression: inv.expression,
                        comments: [],
                        scope: "local",
                        conceptName: concept.name,
                        decorators: [],
                    });
                }
                break;
            }
            case "enum":
                model.enums.push(parseEnum(block, filePath));
                break;
            case "capability":
                model.capabilities.push(parseCapability(block, filePath));
                break;
            case "invariant":
                model.invariants.push(parseInvariant(block, filePath));
                break;
            case "property":
                model.properties.push(parseProperty(block, filePath));
                break;
            case "objective":
                model.objectives.push(parseObjective(block, filePath));
                break;
        }
    }
    return model;
}
/**
 * Detect if a source file is v2 by looking for v2-specific keywords.
 */
export function isV2Source(source) {
    // v2 files have 'concept' or 'capability' or 'objective' at top level
    return /^\s*(concept|capability|objective|invariant|property)\s+\w+/m.test(source);
}
//# sourceMappingURL=v2-parser.js.map