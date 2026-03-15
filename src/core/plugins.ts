import { access, readdir, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { InstalledPluginsFile, ListedSkill, PluginInstall, Provider } from "../types.js";

// Plugins commonly use a bare `skills/` directory (e.g., macos-toolkit, planlog).
// This is mapped to claude-code since these plugins are Claude Code plugins.
// Provider-specific subdirs (`.agents/skills/`, `.cursor/skills/`) are also
// scanned for plugins like everything-claude-code that ship multi-provider skills.
const PROVIDER_SKILL_DIRS: ReadonlyArray<{ subpath: string; provider: Provider }> = [
  { subpath: "skills", provider: "claude-code" },
  { subpath: path.join(".claude", "skills"), provider: "claude-code" },
  { subpath: path.join(".agents", "skills"), provider: "codex" },
  { subpath: path.join(".cursor", "skills"), provider: "cursor" },
];

export async function readInstalledPlugins(
  homeDir?: string
): Promise<readonly PluginInstall[]> {
  const home = homeDir ?? (process.env.SKILL_PORT_HOME ?? os.homedir());
  const filePath = path.join(home, ".claude", "plugins", "installed_plugins.json");

  let raw: string;
  try {
    raw = await readFile(filePath, "utf8");
  } catch {
    return [];
  }

  let parsed: InstalledPluginsFile;
  try {
    parsed = JSON.parse(raw) as InstalledPluginsFile;
  } catch {
    return [];
  }

  if (!parsed.plugins || typeof parsed.plugins !== "object") {
    return [];
  }

  const entries: PluginInstall[] = [];
  for (const installs of Object.values(parsed.plugins)) {
    if (!Array.isArray(installs)) {
      continue;
    }
    for (const install of installs) {
      if (install && typeof install.installPath === "string") {
        entries.push({
          scope: String(install.scope ?? "user"),
          installPath: install.installPath,
          version: String(install.version ?? "unknown"),
        });
      }
    }
  }

  return entries;
}

export async function listPluginSkills(
  provider: Provider | "all",
  homeDir?: string
): Promise<ListedSkill[]> {
  const installs = await readInstalledPlugins(homeDir);
  const output: ListedSkill[] = [];

  for (const install of installs) {
    for (const { subpath, provider: dirProvider } of PROVIDER_SKILL_DIRS) {
      if (provider !== "all" && provider !== dirProvider) {
        continue;
      }

      const skillsRoot = path.join(install.installPath, subpath);
      const entries = await readDirSafe(skillsRoot);

      for (const entry of entries) {
        if (!entry.isDirectory()) {
          continue;
        }

        const skillDir = path.join(skillsRoot, entry.name);
        if (!(await pathExists(path.join(skillDir, "SKILL.md")))) {
          continue;
        }

        output.push({
          provider: dirProvider,
          scope: "plugin",
          name: entry.name,
          path: skillDir,
        });
      }
    }
  }

  return output.sort((a, b) => {
    if (a.provider !== b.provider) {
      return a.provider.localeCompare(b.provider);
    }
    return a.name.localeCompare(b.name);
  });
}

async function readDirSafe(dirPath: string) {
  try {
    return await readdir(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}
