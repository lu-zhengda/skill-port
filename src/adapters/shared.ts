import path from "node:path";
import { ISSUE_CODES } from "../constants.js";
import type { ReportIssue } from "../types.js";
import { firstParagraph, readString } from "../utils/object.js";

const SKILL_NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function deriveNameAndDescription(
  skillDir: string,
  frontmatter: Record<string, unknown>,
  body: string
): { name: string; description: string; issues: ReportIssue[] } {
  const issues: ReportIssue[] = [];

  let name = readString(frontmatter.name);
  if (!name) {
    name = path.basename(skillDir);
    issues.push({
      code: ISSUE_CODES.NAME_DERIVED,
      field: "name",
      message: `Missing frontmatter name; derived from directory name: ${name}.`
    });
  }

  if (!SKILL_NAME_PATTERN.test(name)) {
    issues.push({
      code: ISSUE_CODES.NAME_DERIVED,
      field: "name",
      message: `Skill name '${name}' does not match lowercase-kebab format.`
    });
  }

  let description = readString(frontmatter.description);
  if (!description) {
    description = firstParagraph(body) ?? "No description provided.";
    issues.push({
      code: ISSUE_CODES.DESCRIPTION_DERIVED,
      field: "description",
      message: "Missing frontmatter description; derived from first paragraph of body content."
    });
  }

  return { name, description, issues };
}

export function mergeMappings<T>(...groups: T[][]): T[] {
  return groups.flatMap((group) => group);
}
