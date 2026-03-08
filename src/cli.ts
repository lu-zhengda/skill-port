#!/usr/bin/env node
import path from "node:path";
import process from "node:process";
import { convertScopedSkill, formatTextReport, StrictModeError } from "./core/convert.js";
import { formatSkillsText, listSkillsByScope } from "./core/list.js";
import { validateSkillName } from "./core/scopes.js";
import type { OutputFormat, Provider, Scope, ScopedConvertOptions } from "./types.js";

const PROVIDERS: Provider[] = ["codex", "claude-code", "cursor"];
const SCOPES: Scope[] = ["user", "project", "local"];

function printUsage(): void {
  const usage = `skill-port v0.1.0

Usage:
  skill-port list [options]
  skill-port convert [<skill-name> | --all] --to <provider> [options]

Providers:
  codex | claude-code | cursor

Scopes:
  user | project | local

list options:
  --scope <scope>           Scope to scan (default: user)
  --provider <provider|all> Filter providers (default: all)
  --show-paths              Include absolute skill paths in output
  --format <text|json>      Output format (default: text)

convert options:
  --from <provider|auto>    Source provider (default: auto)
  --to <provider>           Target provider (required)
  --all                     Convert all skills in scope (cannot be used with <skill-name>)
                           Continues per-skill on errors; exits non-zero if any fail
  --scope <scope>           Source scope (default: user)
  --target-scope <scope>    Target scope (default: same as --scope)
  --out <dir>               Explicit output directory (overrides scope path)
  --report <path>           Report output path (default: <out>/skill-port.report.json)
  --strict                  Fail on lossy conversion or conflicts
  --dry-run                 Run conversion analysis without writing files
  --overwrite               Replace existing output directory
  --format <text|json>      Console output format (default: text)
  -h, --help                Show this help
`;

  process.stdout.write(usage);
}

function parseProvider(value: string, flag: string): Provider {
  if (!PROVIDERS.includes(value as Provider)) {
    throw new Error(`Invalid ${flag} value: ${value}. Expected one of: ${PROVIDERS.join(", ")}`);
  }

  return value as Provider;
}

function parseScope(value: string, flag: string): Scope {
  if (!SCOPES.includes(value as Scope)) {
    throw new Error(`Invalid ${flag} value: ${value}. Expected one of: ${SCOPES.join(", ")}`);
  }

  return value as Scope;
}

function parseFormat(value: string): OutputFormat {
  if (value !== "text" && value !== "json") {
    throw new Error(`Invalid --format value: ${value}. Expected text or json.`);
  }

  return value;
}

function requireValue(args: string[], index: number, flag: string): string {
  const value = args[index];
  if (!value || value.startsWith("-")) {
    throw new Error(`Missing value for ${flag}.`);
  }

  return value;
}

function parseListArgs(args: string[]): {
  scope: Scope;
  provider: Provider | "all";
  format: OutputFormat;
  showPaths: boolean;
} {
  let scope: Scope = "user";
  let provider: Provider | "all" = "all";
  let format: OutputFormat = "text";
  let showPaths = false;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];

    switch (arg) {
      case "--scope":
        scope = parseScope(requireValue(args, ++i, "--scope"), "--scope");
        break;
      case "--provider": {
        const value = requireValue(args, ++i, "--provider");
        provider = value === "all" ? "all" : parseProvider(value, "--provider");
        break;
      }
      case "--format":
        format = parseFormat(requireValue(args, ++i, "--format"));
        break;
      case "--show-paths":
        showPaths = true;
        break;
      case "-h":
      case "--help":
        printUsage();
        process.exit(0);
      default:
        throw new Error(`Unknown option for list: ${arg}`);
    }
  }

  return { scope, provider, format, showPaths };
}

function parseConvertArgs(args: string[]): (ScopedConvertOptions & { format: OutputFormat }) & { all: boolean } {
  let skill: string | undefined;
  let all = false;

  if (args.length > 0 && !args[0].startsWith("-")) {
    skill = validateSkillName(args[0]);
  }

  let to: Provider | undefined;
  let from: Provider | "auto" = "auto";
  let scope: Scope = "user";
  let targetScope: Scope | undefined;
  let out: string | undefined;
  let report: string | undefined;
  let strict = false;
  let dryRun = false;
  let overwrite = false;
  let format: OutputFormat = "text";

  const optionStart = skill ? 1 : 0;

  for (let i = optionStart; i < args.length; i += 1) {
    const arg = args[i];

    switch (arg) {
      case "--to":
        to = parseProvider(requireValue(args, ++i, "--to"), "--to");
        break;
      case "--from": {
        const value = requireValue(args, ++i, "--from");
        from = value === "auto" ? "auto" : parseProvider(value, "--from");
        break;
      }
      case "--scope":
        scope = parseScope(requireValue(args, ++i, "--scope"), "--scope");
        break;
      case "--target-scope":
        targetScope = parseScope(requireValue(args, ++i, "--target-scope"), "--target-scope");
        break;
      case "--out":
        out = path.resolve(requireValue(args, ++i, "--out"));
        break;
      case "--report":
        report = path.resolve(requireValue(args, ++i, "--report"));
        break;
      case "--strict":
        strict = true;
        break;
      case "--all":
        all = true;
        break;
      case "--dry-run":
        dryRun = true;
        break;
      case "--overwrite":
        overwrite = true;
        break;
      case "--format":
        format = parseFormat(requireValue(args, ++i, "--format"));
        break;
      case "-h":
      case "--help":
        printUsage();
        process.exit(0);
      default:
        throw new Error(`Unknown option for convert: ${arg}`);
    }
  }

  if (!to) {
    throw new Error("Missing required option --to <provider>.");
  }

  if (!skill && !all) {
    throw new Error("Missing <skill-name>. Use 'convert <skill-name>' or 'convert --all'.");
  }

  if (skill && all) {
    throw new Error("Use either <skill-name> or --all, not both.");
  }

  if (all && (out || report)) {
    throw new Error("--all cannot be combined with --out or --report.");
  }

  return {
    skill: skill ?? "",
    to,
    from,
    scope,
    targetScope,
    out,
    report,
    strict,
    dryRun,
    overwrite,
    format,
    all
  };
}

async function runList(args: string[]): Promise<void> {
  const parsed = parseListArgs(args);
  const skills = await listSkillsByScope(parsed.scope, parsed.provider);

  if (parsed.format === "json") {
    const payload = parsed.showPaths
      ? skills
      : skills.map(({ provider, scope, name }) => ({ provider, scope, name }));
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    return;
  }

  process.stdout.write(formatSkillsText(skills, parsed.scope, parsed.provider, parsed.showPaths));
}

async function runConvert(args: string[]): Promise<void> {
  const parsed = parseConvertArgs(args);
  const { format, all, ...options } = parsed;

  if (all) {
    const resolvedFrom = options.from ?? "auto";
    const sourceProvider = resolvedFrom === "auto" ? "all" : resolvedFrom;
    const scope = options.scope ?? "user";
    const skills = await listSkillsByScope(scope, sourceProvider);

    if (skills.length === 0) {
      if (format === "json") {
        process.stdout.write(`${JSON.stringify({ converted: [], count: 0 }, null, 2)}\n`);
      } else {
        process.stdout.write(`No skills found for scope='${scope}' provider='${sourceProvider}'.\n`);
      }
      return;
    }

    if (resolvedFrom === "auto") {
      const byName = new Map<string, Set<Provider>>();
      for (const item of skills) {
        const providers = byName.get(item.name) ?? new Set<Provider>();
        providers.add(item.provider);
        byName.set(item.name, providers);
      }

      const ambiguous = Array.from(byName.entries())
        .filter(([, providers]) => providers.size > 1)
        .map(([name, providers]) => `${name} (${Array.from(providers).join(", ")})`);

      if (ambiguous.length > 0) {
        throw new Error(
          `--all with --from auto is ambiguous for duplicated names: ${ambiguous.join(
            "; "
          )}. Use --from to select a provider.`
        );
      }
    }

    const converted: Array<{
      skill: string;
      sourceProvider: Provider;
      targetProvider: Provider;
      outputDir: string;
      report: unknown;
    }> = [];
    const failed: Array<{
      skill: string;
      sourceProvider: Provider;
      targetProvider: Provider;
      error: string;
      report?: unknown;
    }> = [];

    for (const item of skills) {
      try {
        const result = await convertScopedSkill({
          ...options,
          skill: item.name,
          from: item.provider
        });

        converted.push({
          skill: item.name,
          sourceProvider: result.sourceProvider,
          targetProvider: result.targetProvider,
          outputDir: result.outputDir,
          report: result.report
        });
      } catch (error) {
        if (error instanceof StrictModeError) {
          failed.push({
            skill: item.name,
            sourceProvider: item.provider,
            targetProvider: options.to,
            error: "Strict mode blocked conversion due lossy mappings or conflicts.",
            report: error.report
          });
          continue;
        }

        failed.push({
          skill: item.name,
          sourceProvider: item.provider,
          targetProvider: options.to,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    if (format === "json") {
      process.stdout.write(
        `${JSON.stringify(
          {
            converted,
            failed,
            count: converted.length + failed.length,
            convertedCount: converted.length,
            failedCount: failed.length
          },
          null,
          2
        )}\n`
      );
      if (failed.length > 0) {
        process.exitCode = 3;
      }
      return;
    }

    const lines = [`Processed ${converted.length + failed.length} skill(s):`];
    lines.push(`- converted: ${converted.length}`);
    lines.push(`- failed: ${failed.length}`);

    if (converted.length > 0) {
      lines.push("Converted:");
    }
    for (const item of converted) {
      lines.push(`- ${item.skill}: ${item.sourceProvider} -> ${item.targetProvider} (${item.outputDir})`);
    }

    if (failed.length > 0) {
      lines.push("Failed:");
      for (const item of failed) {
        lines.push(`- ${item.skill}: ${item.sourceProvider} -> ${item.targetProvider} (${item.error})`);
      }
      lines.push("Batch completed with errors.");
      process.exitCode = 3;
    }

    process.stdout.write(`${lines.join("\n")}\n`);
    return;
  }

  const result = await convertScopedSkill(options);

  if (format === "json") {
    process.stdout.write(`${JSON.stringify(result.report, null, 2)}\n`);
    return;
  }

  process.stdout.write(formatTextReport(result));
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);

  if (argv.length === 0 || argv[0] === "-h" || argv[0] === "--help") {
    printUsage();
    return;
  }

  const command = argv[0];

  switch (command) {
    case "list":
      await runList(argv.slice(1));
      return;
    case "convert":
      await runConvert(argv.slice(1));
      return;
    default:
      throw new Error(`Unsupported command '${command}'. Use 'list' or 'convert'.`);
  }
}

main().catch((error: unknown) => {
  if (error instanceof StrictModeError) {
    const result = {
      outputDir: "(not written)",
      report: error.report,
      sourceProvider: error.report.sourceProvider,
      targetProvider: error.report.targetProvider,
      wroteFiles: false
    };
    process.stderr.write(formatTextReport(result, true));
    process.exit(2);
  }

  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Error: ${message}\n`);
  process.exit(1);
});
