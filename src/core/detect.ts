import { access } from "node:fs/promises";
import path from "node:path";
import { ISSUE_CODES } from "../constants.js";
import type { Provider, ReportIssue } from "../types.js";

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function detectProvider(skillDir: string): Promise<{ provider: Provider; issues: ReportIssue[] }> {
  const issues: ReportIssue[] = [];

  const openaiConfigPath = path.join(skillDir, "agents", "openai.yaml");
  if (await exists(openaiConfigPath)) {
    return { provider: "codex", issues };
  }

  const normalized = skillDir.split(path.sep).join("/").toLowerCase();

  if (normalized.includes("/.claude/skills/")) {
    return { provider: "claude-code", issues };
  }

  if (normalized.includes("/.cursor/skills/")) {
    return { provider: "cursor", issues };
  }

  if (normalized.includes("/.agents/skills/")) {
    return { provider: "codex", issues };
  }

  issues.push({
    code: ISSUE_CODES.DETECT_FALLBACK,
    message: "No provider-specific marker found; falling back to generic Agent Skills interpretation (claude-code)."
  });

  return { provider: "claude-code", issues };
}
