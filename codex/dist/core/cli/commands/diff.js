import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "../../parser/index.js";
import { MfdParseError } from "../../parser/errors.js";
import { collectModel } from "../../validator/collect.js";
export function diffCommand(file1, file2) {
    const path1 = resolve(file1);
    const path2 = resolve(file2);
    const doc1 = parseFileOrExit(path1);
    const doc2 = parseFileOrExit(path2);
    const diffs = semanticDiff(doc1, doc2);
    if (diffs.length === 0) {
        console.log("No semantic differences found.");
        process.exit(0);
    }
    // Group by type
    const added = diffs.filter((d) => d.type === "added");
    const removed = diffs.filter((d) => d.type === "removed");
    const modified = diffs.filter((d) => d.type === "modified");
    if (added.length > 0) {
        console.log(`\n+ Added (${added.length}):`);
        for (const d of added) {
            console.log(`  + ${d.kind} ${d.name}`);
        }
    }
    if (removed.length > 0) {
        console.log(`\n- Removed (${removed.length}):`);
        for (const d of removed) {
            console.log(`  - ${d.kind} ${d.name}`);
        }
    }
    if (modified.length > 0) {
        console.log(`\n~ Modified (${modified.length}):`);
        for (const d of modified) {
            console.log(`  ~ ${d.kind} ${d.name}${d.details ? `: ${d.details}` : ""}`);
        }
    }
    console.log(`\nSummary: ${added.length} added, ${removed.length} removed, ${modified.length} modified`);
    process.exit(diffs.length > 0 ? 1 : 0);
}
export function semanticDiff(doc1, doc2) {
    const model1 = collectModel(doc1);
    const model2 = collectModel(doc2);
    const diffs = [];
    // Compare each construct type
    compareByName(model1.entities, model2.entities, "entity", diffs, (a, b) => {
        const changes = [];
        const fieldNames1 = new Set(a.fields.map((f) => f.name));
        const fieldNames2 = new Set(b.fields.map((f) => f.name));
        const addedFields = [...fieldNames2].filter((n) => !fieldNames1.has(n));
        const removedFields = [...fieldNames1].filter((n) => !fieldNames2.has(n));
        if (addedFields.length)
            changes.push(`+fields: ${addedFields.join(", ")}`);
        if (removedFields.length)
            changes.push(`-fields: ${removedFields.join(", ")}`);
        changes.push(...diffInheritance(a, b));
        return changes.join("; ");
    });
    compareByName(model1.enums, model2.enums, "enum", diffs, (a, b) => {
        const vals1 = new Set(a.values.map((v) => v.name));
        const vals2 = new Set(b.values.map((v) => v.name));
        const added = [...vals2].filter((n) => !vals1.has(n));
        const removed = [...vals1].filter((n) => !vals2.has(n));
        const changes = [];
        if (added.length)
            changes.push(`+values: ${added.join(", ")}`);
        if (removed.length)
            changes.push(`-values: ${removed.join(", ")}`);
        return changes.join("; ");
    });
    compareByName(model1.flows, model2.flows, "flow", diffs, (a, b) => {
        const changes = [];
        const steps1 = a.body.filter((i) => i.type === "FlowStep").length;
        const steps2 = b.body.filter((i) => i.type === "FlowStep").length;
        if (steps1 !== steps2)
            changes.push(`steps: ${steps1} -> ${steps2}`);
        changes.push(...diffInheritance(a, b));
        return changes.join("; ");
    });
    compareByName(model1.states, model2.states, "state", diffs, (a, b) => {
        if (a.transitions.length !== b.transitions.length) {
            return `transitions: ${a.transitions.length} -> ${b.transitions.length}`;
        }
        return "";
    });
    compareByName(model1.events, model2.events, "event", diffs, (a, b) => {
        const changes = [];
        const f1 = a.fields.map((f) => f.name).sort().join(",");
        const f2 = b.fields.map((f) => f.name).sort().join(",");
        if (f1 !== f2)
            changes.push("fields changed");
        if ((a.extends ?? null) !== (b.extends ?? null)) {
            changes.push(`extends: ${a.extends ?? "none"} -> ${b.extends ?? "none"}`);
        }
        return changes.join("; ");
    });
    compareByName(model1.rules, model2.rules, "rule", diffs);
    compareByName(model1.components, model2.components, "component", diffs, (a, b) => {
        const changes = [];
        const deps1 = a.body.filter((i) => i.type === "DepDecl").map((d) => d.target).sort().join(",");
        const deps2 = b.body.filter((i) => i.type === "DepDecl").map((d) => d.target).sort().join(",");
        if (deps1 !== deps2)
            changes.push("dependencies changed");
        const secrets1 = a.body.filter((i) => i.type === "SecretDecl").map((d) => d.name).sort().join(",");
        const secrets2 = b.body.filter((i) => i.type === "SecretDecl").map((d) => d.name).sort().join(",");
        if (secrets1 !== secrets2)
            changes.push("secrets changed");
        changes.push(...diffInheritance(a, b));
        return changes.join("; ");
    });
    compareByName(model1.screens, model2.screens, "screen", diffs, (a, b) => {
        const changes = [];
        const actions1 = a.body.filter((i) => i.type === "ActionDecl").length;
        const actions2 = b.body.filter((i) => i.type === "ActionDecl").length;
        if (actions1 !== actions2)
            changes.push(`actions: ${actions1} -> ${actions2}`);
        changes.push(...diffInheritance(a, b));
        return changes.join("; ");
    });
    compareByName(model1.journeys, model2.journeys, "journey", diffs, (a, b) => {
        const steps1 = a.body.filter((i) => i.type === "JourneyStep").length;
        const steps2 = b.body.filter((i) => i.type === "JourneyStep").length;
        if (steps1 !== steps2)
            return `steps: ${steps1} -> ${steps2}`;
        return "";
    });
    compareByName(model1.operations, model2.operations, "operation", diffs, (a, b) => {
        const changes = [];
        const emits1 = a.body.filter((i) => i.type === "EmitsClause").map((i) => i.event).sort().join(",");
        const emits2 = b.body.filter((i) => i.type === "EmitsClause").map((i) => i.event).sort().join(",");
        if (emits1 !== emits2)
            changes.push("emits changed");
        const on1 = a.body.filter((i) => i.type === "OnClause").map((i) => i.event).sort().join(",");
        const on2 = b.body.filter((i) => i.type === "OnClause").map((i) => i.event).sort().join(",");
        if (on1 !== on2)
            changes.push("triggers changed");
        return changes.join("; ");
    });
    return diffs;
}
function diffInheritance(a, b) {
    const changes = [];
    if ((a.extends ?? null) !== (b.extends ?? null)) {
        changes.push(`extends: ${a.extends ?? "none"} -> ${b.extends ?? "none"}`);
    }
    if (a.implements && b.implements) {
        const impl1 = [...a.implements].sort().join(",");
        const impl2 = [...b.implements].sort().join(",");
        if (impl1 !== impl2) {
            const added = b.implements.filter((i) => !a.implements.includes(i));
            const removed = a.implements.filter((i) => !b.implements.includes(i));
            if (added.length)
                changes.push(`+implements: ${added.join(", ")}`);
            if (removed.length)
                changes.push(`-implements: ${removed.join(", ")}`);
        }
    }
    return changes;
}
function compareByName(items1, items2, kind, diffs, diffFn) {
    const map1 = new Map(items1.map((i) => [i.name, i]));
    const map2 = new Map(items2.map((i) => [i.name, i]));
    // Added
    for (const [name] of map2) {
        if (!map1.has(name)) {
            diffs.push({ type: "added", kind, name });
        }
    }
    // Removed
    for (const [name] of map1) {
        if (!map2.has(name)) {
            diffs.push({ type: "removed", kind, name });
        }
    }
    // Modified
    if (diffFn) {
        for (const [name, item1] of map1) {
            const item2 = map2.get(name);
            if (item2) {
                const details = diffFn(item1, item2);
                if (details) {
                    diffs.push({ type: "modified", kind, name, details });
                }
            }
        }
    }
}
function parseFileOrExit(filePath) {
    let source;
    try {
        source = readFileSync(filePath, "utf-8");
    }
    catch {
        console.error(`error: Cannot read file '${filePath}'`);
        process.exit(1);
    }
    try {
        return parse(source, { source: filePath });
    }
    catch (err) {
        if (err instanceof MfdParseError) {
            console.error(err.format(source));
            process.exit(1);
        }
        throw err;
    }
}
//# sourceMappingURL=diff.js.map