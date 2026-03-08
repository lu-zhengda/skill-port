import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ISSUE_CODES } from "../../src/constants.js";
import { detectProvider } from "../../src/core/detect.js";

async function makeTempSkill(dirName: string): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), `skill-port-${dirName}-`));
  await writeFile(path.join(root, "SKILL.md"), "---\nname: x\ndescription: y\n---\n\nbody\n", "utf8");
  return root;
}

describe("provider detection", () => {
  it("prioritizes openai marker", async () => {
    const skillDir = await makeTempSkill("openai");
    await mkdir(path.join(skillDir, "agents"), { recursive: true });
    await writeFile(path.join(skillDir, "agents", "openai.yaml"), "policy:\n  allow_implicit_invocation: true\n", "utf8");

    const result = await detectProvider(skillDir);
    expect(result.provider).toBe("codex");
  });

  it("falls back with warning when no hints exist", async () => {
    const skillDir = await makeTempSkill("fallback");
    const result = await detectProvider(skillDir);

    expect(result.provider).toBe("claude-code");
    expect(result.issues[0]?.code).toBe(ISSUE_CODES.DETECT_FALLBACK);
  });

  it("uses codex when path indicates .agents scope", async () => {
    const skillDir = await makeTempSkill("agents");
    const nested = path.join(skillDir, "repo", ".agents", "skills", "demo");
    await mkdir(nested, { recursive: true });
    await writeFile(path.join(nested, "SKILL.md"), "---\nname: demo\ndescription: y\n---\n\nbody\n", "utf8");

    const result = await detectProvider(nested);
    expect(result.provider).toBe("codex");
  });
});
