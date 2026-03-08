import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { convertSkill } from "../src/core/convert.js";

function run(cmd: string, args: string[], cwd?: string): void {
  execFileSync(cmd, args, {
    cwd,
    stdio: "inherit"
  });
}

async function main(): Promise<void> {
  if (process.env.SKILL_PORT_LIVE_E2E !== "1") {
    console.log("Skipping live E2E. Set SKILL_PORT_LIVE_E2E=1 to enable network-backed smoke tests.");
    return;
  }

  const tmpRoot = mkdtempSync(path.join(os.tmpdir(), "skill-port-live-"));
  const openaiRepo = path.join(tmpRoot, "openai-skills");
  const anthropicRepo = path.join(tmpRoot, "anthropic-skills");

  run("git", ["clone", "--depth", "1", "https://github.com/openai/skills", openaiRepo]);
  run("git", ["clone", "--depth", "1", "https://github.com/anthropics/skills", anthropicRepo]);

  const openaiSkill = path.join(openaiRepo, "skills", ".system", "skill-installer");
  const claudeSkill = path.join(anthropicRepo, "skills", "claude-api");

  await convertSkill({
    input: openaiSkill,
    to: "claude-code",
    out: path.join(tmpRoot, "openai-to-claude"),
    overwrite: true
  });

  await convertSkill({
    input: claudeSkill,
    to: "codex",
    out: path.join(tmpRoot, "claude-to-openai"),
    overwrite: true
  });

  console.log(`Live E2E smoke tests passed in ${tmpRoot}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
