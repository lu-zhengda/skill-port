import type { CanonicalSkill } from "../types.js";
import { readAgentSkill, writeAgentSkill } from "./agent-skill.js";
import type { AdapterReadResult, AdapterWriteResult } from "./types.js";

export async function readCursorSkill(skillDir: string): Promise<AdapterReadResult> {
  return readAgentSkill(skillDir, "cursor");
}

export function writeCursorSkill(canonical: CanonicalSkill): AdapterWriteResult {
  return writeAgentSkill(canonical, "cursor");
}
