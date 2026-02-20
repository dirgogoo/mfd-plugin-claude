#!/usr/bin/env node
import { Command } from "commander";
import { parseCommand } from "./commands/parse.js";
import { validateCommand } from "./commands/validate.js";
import { diffCommand } from "./commands/diff.js";
import { statsCommand } from "./commands/stats.js";
import { initCommand } from "./commands/init.js";
import { splitCommand } from "./commands/split.js";
import { stripVerifiedCommand } from "./commands/strip-verified.js";
const program = new Command();
program
    .name("mfd")
    .description("MFD-DSL parser, validator, and analysis tool")
    .version("0.1.0");
program
    .command("parse <file>")
    .description("Parse an MFD file and output the AST")
    .option("-j, --json", "Output raw JSON", false)
    .option("-r, --resolve", "Force resolve includes")
    .option("--no-resolve", "Force single-file mode (skip auto-detect)")
    .action(parseCommand);
program
    .command("validate <file>")
    .description("Validate an MFD file")
    .option("-r, --resolve", "Force resolve includes")
    .option("--no-resolve", "Force single-file mode (skip auto-detect)")
    .option("-s, --strict", "Strict mode: promote all warnings to errors")
    .action(validateCommand);
program
    .command("diff <file1> <file2>")
    .description("Show semantic differences between two MFD files")
    .action(diffCommand);
program
    .command("stats <file>")
    .description("Show statistics and metrics for an MFD file")
    .option("-r, --resolve", "Force resolve includes")
    .option("--no-resolve", "Force single-file mode (skip auto-detect)")
    .action(statsCommand);
program
    .command("init")
    .description("Initialize a new MFD project from a template")
    .option("-t, --template <name>", "Template to use (auth-basic, crud-api, event-driven)", "crud-api")
    .option("-n, --name <project>", "Project name", "MyProject")
    .option("-c, --components <names>", "Component names (comma-separated) for multi-file structure")
    .action(initCommand);
program
    .command("split <file>")
    .description("Split a monolithic MFD file into multi-file structure")
    .option("-o, --output <dir>", "Output directory", "model")
    .option("--dry-run", "Show plan without writing files")
    .action(splitCommand);
program
    .command("strip-verified <file>")
    .description("Strip @verified decorators from an MFD file (all, or only changed constructs when --baseline is provided)")
    .option("-b, --baseline <file>", "Baseline file for diff-based stripping (only strip constructs that changed)")
    .action((file, opts) => stripVerifiedCommand(file, { baseline: opts.baseline }));
program.parse();
//# sourceMappingURL=index.js.map