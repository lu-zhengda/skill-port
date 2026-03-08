import type { ListedSkill, Provider, Scope } from "../types.js";
import { listSkills } from "./scopes.js";

export async function listSkillsByScope(
  scope: Scope,
  provider: Provider | "all",
  cwd = process.cwd()
): Promise<ListedSkill[]> {
  return listSkills(scope, provider, cwd);
}

export function formatSkillsText(
  skills: ListedSkill[],
  scope: Scope,
  provider: Provider | "all",
  showPaths = false
): string {
  const lines: string[] = [];

  lines.push(`Skills (scope=${scope}, provider=${provider})`);

  if (skills.length === 0) {
    lines.push("- none found");
    return `${lines.join("\n")}\n`;
  }

  for (const skill of skills) {
    lines.push(
      showPaths
        ? `- ${skill.provider}: ${skill.name} (${skill.path})`
        : `- ${skill.provider}: ${skill.name}`
    );
  }

  return `${lines.join("\n")}\n`;
}
