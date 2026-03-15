import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { readByProvider, writeByProvider } from "../adapters/index.js";
import { ISSUE_CODES } from "../constants.js";
import type {
  ConversionReport,
  ConvertOptions,
  ConvertResult,
  Provider,
  ScopedConvertOptions,
  Scope
} from "../types.js";
import { copySkillDirectory, ensureOutputDirectory, removeFileIfExists, writeYamlFile } from "./files.js";
import { detectProvider } from "./detect.js";
import { ReportBuilder } from "./report.js";
import { resolveDefaultOutputPath, resolveSkillForConvert } from "./scopes.js";
import { writeSkillDocument } from "./skill-file.js";

export class StrictModeError extends Error {
  public constructor(
    message: string,
    public readonly report: ConversionReport
  ) {
    super(message);
    this.name = "StrictModeError";
  }
}

export async function convertSkill(options: ConvertOptions): Promise<ConvertResult> {
  const inputDir = path.resolve(options.input);
  const targetProvider = options.to;
  const outputDir = path.resolve(
    options.out ?? path.join(path.dirname(inputDir), `${path.basename(inputDir)}-${targetProvider}`)
  );

  await assertSkillDirectory(inputDir);

  const sourceProvider = await resolveSourceProvider(inputDir, options.from);
  const reportBuilder = new ReportBuilder(sourceProvider, targetProvider);

  if (!options.from || options.from === "auto") {
    const detection = await detectProvider(inputDir);
    for (const issue of detection.issues) {
      reportBuilder.warn(issue);
    }
  }

  const readResult = await readByProvider(sourceProvider, inputDir);
  reportBuilder.addMappings(readResult.mappings);
  for (const warning of readResult.warnings) {
    reportBuilder.warn(warning);
  }
  for (const dropped of readResult.dropped) {
    reportBuilder.drop(dropped);
  }
  for (const conflict of readResult.conflicts) {
    reportBuilder.conflict(conflict);
  }

  const writeResult = writeByProvider(targetProvider, readResult.canonical);
  reportBuilder.addMappings(writeResult.mappings);
  for (const warning of writeResult.warnings) {
    reportBuilder.warn(warning);
  }
  for (const dropped of writeResult.dropped) {
    reportBuilder.drop(dropped);
  }
  for (const conflict of writeResult.conflicts) {
    reportBuilder.conflict(conflict);
  }

  const strictFailed = Boolean(options.strict) &&
    (reportBuilder.getDroppedCount() > 0 || reportBuilder.getConflictCount() > 0);

  const report = reportBuilder.build(strictFailed);

  if (strictFailed) {
    throw new StrictModeError(
      "Strict mode blocked conversion because lossy mappings or conflicts were detected.",
      report
    );
  }

  let wroteFiles = false;

  if (!options.dryRun) {
    if (path.resolve(outputDir) === path.resolve(inputDir)) {
      if (sourceProvider === targetProvider) {
        throw new Error(
          `Detected source provider '${sourceProvider}' and target provider '${targetProvider}' for the same skill path (${outputDir}). ` +
            "This is a no-op conversion to the same provider. Choose a different --to provider, or set --target-scope/--out to write elsewhere."
        );
      }

      throw new Error(
        `Output directory resolves to the input directory (${outputDir}). Set --out (or --target-scope in scoped mode) to a different path.`
      );
    }

    await ensureOutputDirectory(outputDir, Boolean(options.overwrite));
    await copySkillDirectory(inputDir, outputDir);

    await writeSkillDocument(outputDir, {
      frontmatter: writeResult.frontmatter,
      body: writeResult.body
    });

    const outputOpenAiPath = path.join(outputDir, "agents", "openai.yaml");

    if (targetProvider === "codex" && writeResult.openaiYaml) {
      await writeYamlFile(outputOpenAiPath, writeResult.openaiYaml);
    } else {
      const removed = await removeFileIfExists(outputOpenAiPath);
      if (removed) {
        report.mappings.push({
          from: "agents/openai.yaml",
          to: "",
          action: "removed",
          note: "Removed provider-specific OpenAI metadata from non-OpenAI target output."
        });
      }
    }

    const reportPath = path.resolve(options.report ?? path.join(outputDir, "skill-port.report.json"));
    await mkdir(path.dirname(reportPath), { recursive: true });
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    wroteFiles = true;
  }

  return {
    outputDir,
    report,
    sourceProvider,
    targetProvider,
    wroteFiles
  };
}

export async function convertScopedSkill(options: ScopedConvertOptions): Promise<ConvertResult> {
  const scope: Scope = options.scope ?? "user";
  const targetScope: Scope = options.targetScope ?? scope;

  if (targetScope === "plugin") {
    throw new Error(
      `[${ISSUE_CODES.PLUGIN_WRITE_BLOCKED}] Cannot write to plugin scope. ` +
        "Plugin skills are managed by the plugin system. " +
        "Use --target-scope user|project|local instead."
    );
  }

  const source = await resolveSkillForConvert(options.skill, scope, options.from ?? "auto");
  const output = options.out
    ? path.resolve(options.out)
    : resolveDefaultOutputPath(options.to, targetScope, options.skill);

  return convertSkill({
    input: source.path,
    to: options.to,
    from: source.provider,
    out: output,
    report: options.report,
    strict: options.strict,
    dryRun: options.dryRun,
    overwrite: options.overwrite
  });
}

async function resolveSourceProvider(
  inputDir: string,
  from: ConvertOptions["from"]
): Promise<Provider> {
  if (from && from !== "auto") {
    return from;
  }

  const detection = await detectProvider(inputDir);
  return detection.provider;
}

async function assertSkillDirectory(inputDir: string): Promise<void> {
  const skillFile = path.join(inputDir, "SKILL.md");

  try {
    await access(skillFile);
  } catch {
    throw new Error(`Input path is not a skill directory. Missing SKILL.md: ${skillFile}`);
  }
}

export function formatTextReport(
  result: ConvertResult,
  strictError = false
): string {
  const lines: string[] = [];

  lines.push(
    `Converted ${result.sourceProvider} -> ${result.targetProvider}${result.wroteFiles ? "" : " (dry-run)"}`
  );
  lines.push(`Output: ${result.outputDir}`);
  lines.push(
    `Summary: ${result.report.summary.warningCount} warning(s), ${result.report.summary.droppedCount} dropped field(s), ${result.report.summary.conflictCount} conflict(s)`
  );

  for (const warning of result.report.warnings) {
    lines.push(`[WARN ${warning.code}] ${warning.message}`);
  }

  for (const dropped of result.report.dropped) {
    lines.push(`[DROP ${dropped.code}] ${dropped.message}`);
  }

  for (const conflict of result.report.conflicts) {
    lines.push(`[CONFLICT ${conflict.code}] ${conflict.message}`);
  }

  if (strictError) {
    lines.push(`[ERROR ${ISSUE_CODES.STRICT_BLOCKED}] Strict mode blocked this conversion.`);
  }

  return `${lines.join("\n")}\n`;
}
