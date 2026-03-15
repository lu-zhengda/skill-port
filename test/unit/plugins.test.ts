import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { convertScopedSkill } from "../../src/core/convert.js";
import { formatSkillsText } from "../../src/core/list.js";
import { listPluginSkills, readInstalledPlugins } from "../../src/core/plugins.js";
import { resolveSkillsRoot } from "../../src/core/scopes.js";
import type { ListedSkill } from "../../src/types.js";

describe("plugin scope type", () => {
  it("resolveSkillsRoot handles plugin scope without throwing assertNever", () => {
    expect(() => resolveSkillsRoot("claude-code", "plugin" as any)).toThrow(
      "installed_plugins.json"
    );
  });
});

describe("readInstalledPlugins", () => {
  it("reads installed_plugins.json and returns plugin entries", async () => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), "sp-plugins-"));
    const pluginsDir = path.join(tmpDir, ".claude", "plugins");
    await mkdir(pluginsDir, { recursive: true });

    const pluginsFile = {
      version: 2,
      plugins: {
        "my-plugin@marketplace": [
          {
            scope: "user",
            installPath: "/fake/path",
            version: "1.0.0"
          }
        ]
      }
    };
    await writeFile(
      path.join(pluginsDir, "installed_plugins.json"),
      JSON.stringify(pluginsFile),
      "utf8"
    );

    const result = await readInstalledPlugins(tmpDir);
    expect(result).toHaveLength(1);
    expect(result[0].installPath).toBe("/fake/path");
  });

  it("returns empty array when file is missing", async () => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), "sp-plugins-none-"));
    const result = await readInstalledPlugins(tmpDir);
    expect(result).toEqual([]);
  });

  it("returns empty array for malformed JSON", async () => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), "sp-plugins-bad-"));
    const pluginsDir = path.join(tmpDir, ".claude", "plugins");
    await mkdir(pluginsDir, { recursive: true });
    await writeFile(path.join(pluginsDir, "installed_plugins.json"), "not json", "utf8");

    const result = await readInstalledPlugins(tmpDir);
    expect(result).toEqual([]);
  });

  it("returns empty array when plugins field is not an object", async () => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), "sp-plugins-nobj-"));
    const pluginsDir = path.join(tmpDir, ".claude", "plugins");
    await mkdir(pluginsDir, { recursive: true });
    await writeFile(
      path.join(pluginsDir, "installed_plugins.json"),
      JSON.stringify({ version: 2, plugins: "invalid" }),
      "utf8"
    );

    const result = await readInstalledPlugins(tmpDir);
    expect(result).toEqual([]);
  });
});

describe("listPluginSkills", () => {
  it("discovers skills in plugin skills/ directory", async () => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), "sp-plugin-skills-"));
    const pluginsDir = path.join(tmpDir, ".claude", "plugins");
    const installDir = path.join(tmpDir, "cache", "my-plugin", "1.0.0");
    const skillDir = path.join(installDir, "skills", "my-skill");

    await mkdir(skillDir, { recursive: true });
    await writeFile(
      path.join(skillDir, "SKILL.md"),
      "---\nname: my-skill\ndescription: test\n---\n\nbody\n",
      "utf8"
    );
    await mkdir(pluginsDir, { recursive: true });

    const pluginsFile = {
      version: 2,
      plugins: {
        "my-plugin@marketplace": [
          {
            scope: "user",
            installPath: installDir,
            version: "1.0.0"
          }
        ]
      }
    };
    await writeFile(
      path.join(pluginsDir, "installed_plugins.json"),
      JSON.stringify(pluginsFile),
      "utf8"
    );

    const skills = await listPluginSkills("all", tmpDir);
    expect(skills).toHaveLength(1);
    expect(skills[0].name).toBe("my-skill");
    expect(skills[0].scope).toBe("plugin");
  });

  it("discovers skills in provider-specific subdirs", async () => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), "sp-plugin-multi-"));
    const pluginsDir = path.join(tmpDir, ".claude", "plugins");
    const installDir = path.join(tmpDir, "cache", "ecc", "1.0.0");

    const codexSkill = path.join(installDir, ".agents", "skills", "coding");
    const cursorSkill = path.join(installDir, ".cursor", "skills", "coding");
    await mkdir(codexSkill, { recursive: true });
    await mkdir(cursorSkill, { recursive: true });
    await writeFile(path.join(codexSkill, "SKILL.md"), "---\nname: coding\ndescription: x\n---\n\nbody\n", "utf8");
    await writeFile(path.join(cursorSkill, "SKILL.md"), "---\nname: coding\ndescription: x\n---\n\nbody\n", "utf8");
    await mkdir(pluginsDir, { recursive: true });

    const pluginsFile = {
      version: 2,
      plugins: {
        "ecc@ecc": [{ scope: "user", installPath: installDir, version: "1.0.0" }]
      }
    };
    await writeFile(
      path.join(pluginsDir, "installed_plugins.json"),
      JSON.stringify(pluginsFile),
      "utf8"
    );

    const allSkills = await listPluginSkills("all", tmpDir);
    expect(allSkills.length).toBeGreaterThanOrEqual(2);

    const codexOnly = await listPluginSkills("codex", tmpDir);
    expect(codexOnly.every((s) => s.provider === "codex")).toBe(true);
  });

  it("filters by provider", async () => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), "sp-plugin-filter-"));
    const pluginsDir = path.join(tmpDir, ".claude", "plugins");
    const installDir = path.join(tmpDir, "cache", "toolkit", "1.0.0");
    const skillDir = path.join(installDir, "skills", "macctl");

    await mkdir(skillDir, { recursive: true });
    await writeFile(path.join(skillDir, "SKILL.md"), "---\nname: macctl\ndescription: x\n---\n\nbody\n", "utf8");
    await mkdir(pluginsDir, { recursive: true });

    const pluginsFile = {
      version: 2,
      plugins: {
        "toolkit@mk": [{ scope: "user", installPath: installDir, version: "1.0.0" }]
      }
    };
    await writeFile(
      path.join(pluginsDir, "installed_plugins.json"),
      JSON.stringify(pluginsFile),
      "utf8"
    );

    // skills/ dir maps to claude-code by default (no provider marker)
    const cursorOnly = await listPluginSkills("cursor", tmpDir);
    expect(cursorOnly).toHaveLength(0);
  });
});

describe("formatSkillsText for plugins", () => {
  it("formats plugin skills with scope=plugin header", () => {
    const skills: ListedSkill[] = [
      { provider: "claude-code", scope: "plugin", name: "macctl", path: "/fake" },
    ];
    const output = formatSkillsText(skills, "plugin", "all");
    expect(output).toContain("scope=plugin");
    expect(output).toContain("macctl");
  });
});

describe("plugin scope write guard", () => {
  it("rejects plugin as target scope", async () => {
    await expect(
      convertScopedSkill({
        skill: "anything",
        to: "cursor",
        scope: "plugin",
        targetScope: "plugin",
      })
    ).rejects.toThrow("SP403");
  });
});
