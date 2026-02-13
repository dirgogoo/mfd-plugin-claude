import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "../../parser/index.js";
import { resolveFile } from "../../resolver/index.js";
import { MfdParseError } from "../../parser/errors.js";
export function parseCommand(file, options) {
    const filePath = resolve(file);
    let source;
    try {
        source = readFileSync(filePath, "utf-8");
    }
    catch {
        console.error(`error: Cannot read file '${filePath}'`);
        process.exit(1);
    }
    const shouldResolve = options.resolve ?? /^\s*(import|include)\s+"/m.test(source);
    try {
        if (shouldResolve) {
            const result = resolveFile(filePath);
            if (result.errors.length > 0) {
                for (const err of result.errors) {
                    console.error(`error: ${err.message}`);
                }
                process.exit(1);
            }
            printAst(result.document, options.json);
        }
        else {
            const ast = parse(source, { source: filePath });
            printAst(ast, options.json);
        }
    }
    catch (err) {
        if (err instanceof MfdParseError) {
            console.error(err.format(source));
            process.exit(1);
        }
        throw err;
    }
}
function printAst(ast, json) {
    if (json) {
        console.log(JSON.stringify(ast, null, 2));
    }
    else {
        printPretty(ast, 0);
    }
}
function printPretty(node, indent) {
    const pad = "  ".repeat(indent);
    if (!node || typeof node !== "object") {
        console.log(`${pad}${node}`);
        return;
    }
    if (Array.isArray(node)) {
        for (const item of node) {
            printPretty(item, indent);
        }
        return;
    }
    if (node.type) {
        const name = node.name ? ` "${node.name}"` : "";
        const extra = [];
        if (node.decorators?.length > 0) {
            extra.push(node.decorators.map((d) => `@${d.name}`).join(" "));
        }
        const line = `${pad}${node.type}${name}${extra.length ? " " + extra.join(" ") : ""}`;
        console.log(line);
        // Print body/fields/endpoints/transitions etc.
        for (const key of ["body", "fields", "values", "transitions", "endpoints", "params"]) {
            if (node[key] && Array.isArray(node[key]) && node[key].length > 0) {
                for (const child of node[key]) {
                    printPretty(child, indent + 1);
                }
            }
        }
    }
}
//# sourceMappingURL=parse.js.map