import type { CanonicalSkill, Provider } from "../types.js";
import { readClaudeSkill, writeClaudeSkill } from "./claude.js";
import { readCursorSkill, writeCursorSkill } from "./cursor.js";
import { readOpenAiSkill, writeOpenAiSkill } from "./openai.js";
import type { AdapterReadResult, AdapterWriteResult } from "./types.js";

export async function readByProvider(provider: Provider, skillDir: string): Promise<AdapterReadResult> {
  switch (provider) {
    case "codex":
      return readOpenAiSkill(skillDir);
    case "claude-code":
      return readClaudeSkill(skillDir);
    case "cursor":
      return readCursorSkill(skillDir);
    default:
      return assertNever(provider);
  }
}

export function writeByProvider(provider: Provider, canonical: CanonicalSkill): AdapterWriteResult {
  switch (provider) {
    case "codex":
      return writeOpenAiSkill(canonical);
    case "claude-code":
      return writeClaudeSkill(canonical);
    case "cursor":
      return writeCursorSkill(canonical);
    default:
      return assertNever(provider);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unsupported provider: ${String(value)}`);
}
