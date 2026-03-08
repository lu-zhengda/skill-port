import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { listSkills, resolveSkillForConvert, resolveSkillPath, validateSkillName } from "../../src/core/scopes.js";

describe("scope resolver", () => {
  it("lists user scoped skills", async () => {
    const home = await mkdtemp(path.join(os.tmpdir(), "skill-port-scopes-"));
    const codexSkill = path.join(home, ".agents", "skills", "alpha");
    await mkdir(codexSkill, { recursive: true });
    await writeFile(path.join(codexSkill, "SKILL.md"), "---\nname: alpha\ndescription: x\n---\n\nbody\n", "utf8");

    const previous = process.env.SKILL_PORT_HOME;
    process.env.SKILL_PORT_HOME = home;

    const skills = await listSkills("user", "all");
    expect(skills.some((s) => s.provider === "codex" && s.name === "alpha")).toBe(true);

    process.env.SKILL_PORT_HOME = previous;
  });

  it("errors on auto-resolve ambiguity", async () => {
    const home = await mkdtemp(path.join(os.tmpdir(), "skill-port-ambiguous-"));
    const codexSkill = path.join(home, ".agents", "skills", "same");
    const claudeSkill = path.join(home, ".claude", "skills", "same");
    await mkdir(codexSkill, { recursive: true });
    await mkdir(claudeSkill, { recursive: true });
    await writeFile(path.join(codexSkill, "SKILL.md"), "---\nname: same\ndescription: x\n---\n\nbody\n", "utf8");
    await writeFile(path.join(claudeSkill, "SKILL.md"), "---\nname: same\ndescription: x\n---\n\nbody\n", "utf8");

    const previous = process.env.SKILL_PORT_HOME;
    process.env.SKILL_PORT_HOME = home;

    await expect(resolveSkillForConvert("same", "user", "auto")).rejects.toThrow("Specify --from");

    process.env.SKILL_PORT_HOME = previous;
  });

  it("rejects invalid skill names with path separators", () => {
    expect(() => validateSkillName("../escape")).toThrow("SP002");
    expect(() => validateSkillName("nested/name")).toThrow("SP002");
  });

  it("rejects skill paths that escape provider root", () => {
    expect(() => resolveSkillPath("codex", "user", "..")).toThrow("SP002");
  });
});
