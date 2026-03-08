import type { CanonicalSkill } from "../types.js";
import { readAgentSkill, writeAgentSkill } from "./agent-skill.js";
import type { AdapterReadResult, AdapterWriteResult } from "./types.js";

export async function readClaudeSkill(skillDir: string): Promise<AdapterReadResult> {
  return readAgentSkill(skillDir, "claude-code");
}

export function writeClaudeSkill(canonical: CanonicalSkill): AdapterWriteResult {
  return writeAgentSkill(canonical, "claude-code");
}
