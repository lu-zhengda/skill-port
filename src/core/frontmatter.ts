import yaml from "js-yaml";
import { FRONTMATTER_KEY_ORDER } from "../constants.js";
import type { SkillDocument } from "../types.js";
import { isObject } from "../utils/object.js";

const FRONTMATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

export function parseSkillMarkdown(content: string): SkillDocument {
  const match = content.match(FRONTMATTER_REGEX);
  if (!match) {
    throw new Error("SKILL.md must start with YAML frontmatter delimited by --- markers.");
  }

  const [, yamlBlock, markdownBody] = match;
  const parsed = yaml.load(yamlBlock);

  if (!isObject(parsed)) {
    throw new Error("Frontmatter must parse to a YAML object.");
  }

  return {
    frontmatter: parsed,
    body: markdownBody.replace(/^\s+/, "")
  };
}

export function serializeSkillMarkdown(document: SkillDocument): string {
  const ordered = orderFrontmatter(document.frontmatter);
  const yamlText = yaml.dump(ordered, {
    lineWidth: -1,
    noRefs: true,
    sortKeys: false
  });

  const body = document.body.trimEnd();

  return `---\n${yamlText}---\n\n${body}\n`;
}

export function orderFrontmatter(frontmatter: Record<string, unknown>): Record<string, unknown> {
  const ordered: Record<string, unknown> = {};

  for (const key of FRONTMATTER_KEY_ORDER) {
    if (key in frontmatter) {
      ordered[key] = frontmatter[key];
    }
  }

  const unknownKeys = Object.keys(frontmatter)
    .filter((key) => !FRONTMATTER_KEY_ORDER.includes(key as (typeof FRONTMATTER_KEY_ORDER)[number]))
    .sort();

  for (const key of unknownKeys) {
    ordered[key] = frontmatter[key];
  }

  return ordered;
}
