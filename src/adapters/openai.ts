import path from "node:path";
import { ISSUE_CODES } from "../constants.js";
import { readYamlFile } from "../core/files.js";
import { readSkillDocument } from "../core/skill-file.js";
import type { CanonicalSkill, ReportIssue, ReportMapping } from "../types.js";
import { clone, isObject, toBoolean } from "../utils/object.js";
import { deriveNameAndDescription } from "./shared.js";
import type { AdapterReadResult, AdapterWriteResult } from "./types.js";

export async function readOpenAiSkill(skillDir: string): Promise<AdapterReadResult> {
  const doc = await readSkillDocument(skillDir);
  const frontmatter = clone(doc.frontmatter);
  const mappings: ReportMapping[] = [
    {
      from: "SKILL.md.frontmatter",
      to: "canonical.frontmatter",
      action: "copied"
    }
  ];

  const { name, description, issues } = deriveNameAndDescription(skillDir, frontmatter, doc.body);

  const openaiPath = path.join(skillDir, "agents", "openai.yaml");
  const openaiRead = await readYamlFile(openaiPath);
  const openaiConfig = openaiRead.data;
  const warnings = [...issues];

  if (openaiRead.error) {
    warnings.push({
      code: ISSUE_CODES.OPENAI_YAML_INVALID,
      field: "openai.yaml",
      path: "agents/openai.yaml",
      message: openaiRead.error
    });
  }

  if (openaiConfig) {
    mappings.push({
      from: "agents/openai.yaml",
      to: "canonical.openai",
      action: "copied"
    });
  }

  const disableModelInvocation = toBoolean(frontmatter["disable-model-invocation"]);
  const allowImplicitInvocation = toBoolean(openaiConfig?.policy && (openaiConfig.policy as Record<string, unknown>)["allow_implicit_invocation"]);

  const conflicts: ReportIssue[] = [];

  let resolvedDisableModelInvocation = disableModelInvocation;
  if (resolvedDisableModelInvocation === undefined && allowImplicitInvocation !== undefined) {
    resolvedDisableModelInvocation = !allowImplicitInvocation;
    mappings.push({
      from: "agents/openai.yaml.policy.allow_implicit_invocation",
      to: "canonical.policy.disableModelInvocation",
      action: "transformed",
      note: "inverted boolean"
    });
  }

  if (
    disableModelInvocation !== undefined &&
    allowImplicitInvocation !== undefined &&
    disableModelInvocation === allowImplicitInvocation
  ) {
    conflicts.push({
      code: ISSUE_CODES.POLICY_CONFLICT,
      field: "disable-model-invocation",
      path: "agents/openai.yaml",
      message:
        "Conflict between SKILL.md disable-model-invocation and openai.yaml policy.allow_implicit_invocation. Expected inverse relationship."
    });
  }

  const canonical: CanonicalSkill = {
    name,
    description,
    body: doc.body,
    frontmatter,
    sourceProvider: "codex",
    policy: {
      disableModelInvocation: resolvedDisableModelInvocation,
      allowImplicitInvocation
    },
    openai: openaiConfig
  };

  return {
    canonical,
    mappings,
    warnings,
    dropped: [],
    conflicts
  };
}

export function writeOpenAiSkill(canonical: CanonicalSkill): AdapterWriteResult {
  const frontmatter = clone(canonical.frontmatter);
  frontmatter.name = canonical.name;
  frontmatter.description = canonical.description;

  const mappings: ReportMapping[] = [
    {
      from: "canonical.frontmatter",
      to: "SKILL.md.frontmatter",
      action: "preserved"
    }
  ];

  const conflicts: ReportIssue[] = [];

  let allowImplicitInvocation = canonical.policy.allowImplicitInvocation;
  if (canonical.policy.disableModelInvocation !== undefined) {
    const derivedAllowImplicit = !canonical.policy.disableModelInvocation;

    if (allowImplicitInvocation !== undefined && allowImplicitInvocation !== derivedAllowImplicit) {
      conflicts.push({
        code: ISSUE_CODES.POLICY_CONFLICT,
        field: "policy.allow_implicit_invocation",
        message:
          "canonical.policy.disableModelInvocation conflicts with canonical.policy.allowImplicitInvocation during OpenAI serialization."
      });
    }

    allowImplicitInvocation = derivedAllowImplicit;
    mappings.push({
      from: "canonical.policy.disableModelInvocation",
      to: "agents/openai.yaml.policy.allow_implicit_invocation",
      action: "transformed",
      note: "inverted boolean"
    });
  }

  const openaiConfig = clone(canonical.openai ?? {});

  if (allowImplicitInvocation !== undefined) {
    const policy = isObject(openaiConfig.policy) ? openaiConfig.policy : {};
    policy.allow_implicit_invocation = allowImplicitInvocation;
    openaiConfig.policy = policy;
  }

  const hasInterface = isObject(openaiConfig.interface) && Object.keys(openaiConfig.interface).length > 0;
  const hasDependencies = isObject(openaiConfig.dependencies) && Object.keys(openaiConfig.dependencies).length > 0;
  const hasPolicy =
    isObject(openaiConfig.policy) &&
    Object.prototype.hasOwnProperty.call(openaiConfig.policy, "allow_implicit_invocation");

  const openaiYaml = hasInterface || hasDependencies || hasPolicy ? openaiConfig : undefined;

  if (openaiYaml) {
    mappings.push({
      from: "canonical.openai",
      to: "agents/openai.yaml",
      action: "generated"
    });
  }

  return {
    frontmatter,
    body: canonical.body,
    openaiYaml,
    mappings,
    warnings: [],
    dropped: [],
    conflicts
  };
}
