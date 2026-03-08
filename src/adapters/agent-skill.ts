import { ISSUE_CODES } from "../constants.js";
import { readSkillDocument } from "../core/skill-file.js";
import type { CanonicalSkill, Provider, ReportIssue } from "../types.js";
import { clone, toBoolean } from "../utils/object.js";
import { deriveNameAndDescription } from "./shared.js";
import type { AdapterReadResult, AdapterWriteResult } from "./types.js";

export async function readAgentSkill(skillDir: string, sourceProvider: Provider): Promise<AdapterReadResult> {
  const doc = await readSkillDocument(skillDir);
  const frontmatter = clone(doc.frontmatter);
  const { name, description, issues } = deriveNameAndDescription(skillDir, frontmatter, doc.body);

  const disableModelInvocation = toBoolean(frontmatter["disable-model-invocation"]);
  const userInvocable = toBoolean(frontmatter["user-invocable"]);

  const canonical: CanonicalSkill = {
    name,
    description,
    body: doc.body,
    frontmatter,
    sourceProvider,
    policy: {
      disableModelInvocation,
      userInvocable,
      allowImplicitInvocation:
        disableModelInvocation === undefined ? undefined : !disableModelInvocation
    }
  };

  return {
    canonical,
    mappings: [
      {
        from: "SKILL.md.frontmatter",
        to: "canonical.frontmatter",
        action: "copied"
      }
    ],
    warnings: issues,
    dropped: [],
    conflicts: []
  };
}

export function writeAgentSkill(canonical: CanonicalSkill, targetProvider: Provider): AdapterWriteResult {
  const frontmatter = clone(canonical.frontmatter);
  frontmatter.name = canonical.name;
  frontmatter.description = canonical.description;

  if (canonical.policy.disableModelInvocation !== undefined) {
    frontmatter["disable-model-invocation"] = canonical.policy.disableModelInvocation;
  }

  if (canonical.policy.userInvocable !== undefined) {
    frontmatter["user-invocable"] = canonical.policy.userInvocable;
  }

  const dropped = collectDroppedOpenAiFields(canonical, targetProvider);

  return {
    frontmatter,
    body: canonical.body,
    mappings: [
      {
        from: "canonical.frontmatter",
        to: "SKILL.md.frontmatter",
        action: "preserved"
      }
    ],
    warnings: [],
    dropped,
    conflicts: []
  };
}

function collectDroppedOpenAiFields(
  canonical: CanonicalSkill,
  targetProvider: Provider
): ReportIssue[] {
  if (!canonical.openai) {
    return [];
  }

  const dropped: ReportIssue[] = [];

  for (const key of Object.keys(canonical.openai)) {
    if (canonical.openai[key] !== undefined) {
      dropped.push({
        code: key === "policy" ? ISSUE_CODES.OPENAI_CONFIG_DROPPED : ISSUE_CODES.OPENAI_FIELD_DROPPED,
        field: `openai.${key}`,
        message: `OpenAI-specific field '${key}' is not portable to ${targetProvider} and was omitted.`
      });
    }
  }

  return dropped;
}
