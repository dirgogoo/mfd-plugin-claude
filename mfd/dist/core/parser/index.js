import peggy from "peggy";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { MfdParseError } from "./errors.js";
export * from "./ast.js";
export { MfdParseError } from "./errors.js";
let _parser = null;
function findGrammarPath() {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    // Primary: relative to source (monorepo layout)
    const primary = join(__dirname, "..", "grammar", "mfd.peggy");
    if (existsSync(primary))
        return primary;
    // Fallback: packaged distribution — grammar/ at package root
    let dir = __dirname;
    for (let i = 0; i < 10; i++) {
        const candidate = join(dir, "grammar", "mfd.peggy");
        if (existsSync(candidate))
            return candidate;
        const parent = dirname(dir);
        if (parent === dir)
            break;
        dir = parent;
    }
    // Last resort: return primary and let readFileSync throw
    return primary;
}
function getParser() {
    if (_parser)
        return _parser;
    const grammarPath = findGrammarPath();
    const grammarSource = readFileSync(grammarPath, "utf-8");
    _parser = peggy.generate(grammarSource, {
        allowedStartRules: ["Document"],
    });
    return _parser;
}
/**
 * Parse MFD-DSL source code into an AST.
 */
export function parse(input, options = {}) {
    const parser = getParser();
    try {
        const ast = parser.parse(input, {
            startRule: options.startRule ?? "Document",
        });
        return ast;
    }
    catch (err) {
        if (err && typeof err === "object" && "location" in err) {
            const pegErr = err;
            throw new MfdParseError({
                message: pegErr.message,
                location: {
                    start: pegErr.location.start,
                    end: pegErr.location.end,
                },
                source: options.source,
                expected: pegErr.expected?.map((e) => e.description),
                found: pegErr.found ?? undefined,
            });
        }
        throw err;
    }
}
/**
 * Collect all ErrorNode instances from a parsed AST.
 */
export function collectErrorNodes(doc) {
    const diagnostics = [];
    function visitItems(items) {
        for (const item of items) {
            if (item.type === "ErrorNode") {
                const err = item;
                diagnostics.push({
                    message: `Unexpected syntax: ${err.raw}`,
                    location: err.loc,
                    context: err.context,
                    raw: err.raw,
                });
            }
            else if (item.type === "SystemDecl") {
                visitItems(item.body);
            }
            else if (item.type === "ComponentDecl") {
                visitItems(item.body);
            }
        }
    }
    visitItems(doc.body);
    return diagnostics;
}
/**
 * Return a copy of the document with all ErrorNodes removed.
 */
export function stripErrorNodes(doc) {
    function filterItems(items) {
        return items
            .filter((item) => item.type !== "ErrorNode")
            .map((item) => {
            if (item.type === "SystemDecl") {
                const sys = item;
                return { ...sys, body: filterItems(sys.body) };
            }
            if (item.type === "ComponentDecl") {
                const comp = item;
                return { ...comp, body: filterItems(comp.body) };
            }
            return item;
        });
    }
    return {
        ...doc,
        body: filterItems(doc.body),
    };
}
/**
 * Parse with error recovery: reports multiple syntax errors instead of
 * stopping at the first one. The original parse() function is unchanged.
 *
 * Layer 1 (grammar-level): ErrorNode productions in the grammar capture
 * unrecognized lines and continue parsing.
 *
 * Layer 2 (wrapper-level): If the grammar itself fails (e.g. unclosed brace),
 * this function attempts skip-reparse by advancing past the problematic
 * top-level construct and retrying.
 */
export function parseWithRecovery(input, options = {}) {
    // Layer 1: try parsing — grammar error productions will capture inline errors
    try {
        const doc = parse(input, options);
        const errors = collectErrorNodes(doc);
        return { document: doc, errors, hasErrors: errors.length > 0 };
    }
    catch (firstError) {
        // Layer 2: grammar-level parse failed entirely (e.g. unclosed brace)
        // Attempt skip-reparse: collect the fatal error, then try to salvage
        // remaining content by skipping the problematic region.
        const fatalDiagnostics = [];
        if (firstError instanceof MfdParseError) {
            fatalDiagnostics.push({
                message: firstError.message,
                location: firstError.location,
                context: "top-level",
                raw: "",
            });
        }
        // Try to skip past the error location and parse the rest
        const remaining = skipToNextTopLevel(input, firstError);
        if (remaining !== null) {
            try {
                const doc = parse(remaining.text, options);
                const inlineErrors = collectErrorNodes(doc);
                return {
                    document: doc,
                    errors: [...fatalDiagnostics, ...inlineErrors],
                    hasErrors: true,
                };
            }
            catch {
                // Second parse also failed — return what we have
            }
        }
        // Last resort: return an empty document with the fatal error
        const emptyDoc = {
            type: "MfdDocument",
            loc: { start: { line: 1, column: 1, offset: 0 }, end: { line: 1, column: 1, offset: 0 } },
            body: [],
        };
        return {
            document: emptyDoc,
            errors: fatalDiagnostics,
            hasErrors: true,
        };
    }
}
/**
 * Attempt to find the next top-level construct after a parse failure.
 * Returns the remaining text starting from the next recognized keyword,
 * or null if no suitable continuation point is found.
 */
function skipToNextTopLevel(input, error) {
    let startOffset = 0;
    if (error instanceof MfdParseError) {
        startOffset = error.location.start.offset;
    }
    const keywords = [
        "system", "component", "entity", "enum", "flow", "state",
        "event", "api", "rule", "dep", "secret", "screen", "journey", "operation", "import", "include",
    ];
    // Search from after the error for the next top-level keyword at line start
    for (let i = startOffset + 1; i < input.length; i++) {
        // Only check at start of line or start of input
        if (i > 0 && input[i - 1] !== "\n")
            continue;
        for (const kw of keywords) {
            if (input.startsWith(kw, i)) {
                const afterKw = input[i + kw.length];
                // Ensure it's a word boundary
                if (afterKw && /[a-zA-Z0-9_]/.test(afterKw))
                    continue;
                return { text: input.slice(i) };
            }
        }
    }
    return null;
}
//# sourceMappingURL=index.js.map