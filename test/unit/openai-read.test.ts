import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { readOpenAiSkill } from "../../src/adapters/openai.js";

describe("openai adapter read", () => {
  it("reports warning when agents/openai.yaml is invalid", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "skill-port-openai-yaml-"));
    await mkdir(path.join(root, "agents"), { recursive: true });
    await writeFile(
      path.join(root, "SKILL.md"),
      "---\nname: demo\ndescription: demo\n---\n\nbody\n",
      "utf8"
    );
    await writeFile(path.join(root, "agents", "openai.yaml"), "policy: [", "utf8");

    const result = await readOpenAiSkill(root);

    expect(result.warnings.some((warning) => warning.code === "SP102")).toBe(true);
  });
});
