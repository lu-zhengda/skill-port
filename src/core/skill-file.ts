import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { SkillDocument } from "../types.js";
import { parseSkillMarkdown, serializeSkillMarkdown } from "./frontmatter.js";

export async function readSkillDocument(skillDir: string): Promise<SkillDocument> {
  const skillPath = path.join(skillDir, "SKILL.md");
  const raw = await readFile(skillPath, "utf8");
  return parseSkillMarkdown(raw);
}

export async function writeSkillDocument(skillDir: string, skill: SkillDocument): Promise<void> {
  const skillPath = path.join(skillDir, "SKILL.md");
  const serialized = serializeSkillMarkdown(skill);
  await writeFile(skillPath, serialized, "utf8");
}
