import { accessSync } from "node:fs";
import { access, readdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ISSUE_CODES } from "../constants.js";
import { listPluginSkills } from "./plugins.js";
import type { ListedSkill, Provider, Scope } from "../types.js";

const PROVIDER_ORDER: Provider[] = ["codex", "claude-code", "cursor"];

interface ScopeRoots {
  userRoot: string;
  projectRoot: string;
  localRoot: string;
}

function getScopeRoots(cwd: string): ScopeRoots {
  const localRoot = cwd;
  const projectRoot = findProjectRoot(cwd);
  const userRoot = process.env.SKILL_PORT_HOME ?? os.homedir();

  return {
    userRoot,
    projectRoot,
    localRoot
  };
}

function providerSubpath(provider: Provider): string {
  switch (provider) {
    case "codex":
      return path.join(".agents", "skills");
    case "claude-code":
      return path.join(".claude", "skills");
    case "cursor":
      return path.join(".cursor", "skills");
    default:
      return assertNever(provider);
  }
}

export function resolveSkillsRoot(provider: Provider, scope: Scope, cwd = process.cwd()): string {
  const roots = getScopeRoots(cwd);

  switch (scope) {
    case "user":
      return path.join(roots.userRoot, providerSubpath(provider));
    case "project":
      return path.join(roots.projectRoot, providerSubpath(provider));
    case "local":
      return path.join(roots.localRoot, providerSubpath(provider));
    case "plugin":
      throw new Error("Plugin skills are resolved via installed_plugins.json, not a fixed root path.");
    default:
      return assertNever(scope);
  }
}

export function resolveSkillPath(
  provider: Provider,
  scope: Scope,
  skillName: string,
  cwd = process.cwd()
): string {
  const normalizedSkillName = validateSkillName(skillName);
  const root = path.resolve(resolveSkillsRoot(provider, scope, cwd));
  const resolved = path.resolve(root, normalizedSkillName);

  if (!isWithinRoot(root, resolved)) {
    throw new Error(
      `[${ISSUE_CODES.INVALID_SKILL_NAME}] Invalid skill name '${skillName}'. Skill names must resolve under the provider root.`
    );
  }

  return resolved;
}

export async function listSkills(
  scope: Scope,
  provider: Provider | "all",
  cwd = process.cwd()
): Promise<ListedSkill[]> {
  if (scope === "plugin") {
    return listPluginSkills(provider);
  }

  const providers = provider === "all" ? PROVIDER_ORDER : [provider];

  const output: ListedSkill[] = [];

  for (const candidateProvider of providers) {
    const root = resolveSkillsRoot(candidateProvider, scope, cwd);

    const entries = await readDirSafe(root);
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      const skillDir = path.join(root, entry.name);
      if (!(await pathExists(path.join(skillDir, "SKILL.md")))) {
        continue;
      }

      output.push({
        provider: candidateProvider,
        scope,
        name: entry.name,
        path: skillDir
      });
    }
  }

  return output.sort((a, b) => {
    if (a.provider !== b.provider) {
      return a.provider.localeCompare(b.provider);
    }

    return a.name.localeCompare(b.name);
  });
}

export async function resolveSkillForConvert(
  skillName: string,
  scope: Scope,
  from: Provider | "auto",
  cwd = process.cwd()
): Promise<{ provider: Provider; path: string }> {
  if (scope === "plugin") {
    return resolvePluginSkill(skillName, from);
  }

  if (from !== "auto") {
    const explicitPath = resolveSkillPath(from, scope, skillName, cwd);
    if (!(await pathExists(path.join(explicitPath, "SKILL.md")))) {
      throw new Error(
        `Skill '${skillName}' was not found for provider '${from}' in scope '${scope}' (${explicitPath}).`
      );
    }

    return { provider: from, path: explicitPath };
  }

  const matches: Array<{ provider: Provider; path: string }> = [];

  for (const provider of PROVIDER_ORDER) {
    const candidatePath = resolveSkillPath(provider, scope, skillName, cwd);
    if (await pathExists(path.join(candidatePath, "SKILL.md"))) {
      matches.push({ provider, path: candidatePath });
    }
  }

  if (matches.length === 0) {
    throw new Error(`Skill '${skillName}' was not found in scope '${scope}'.`);
  }

  if (matches.length > 1) {
    const providers = matches.map((match) => match.provider).join(", ");
    throw new Error(
      `Skill '${skillName}' exists for multiple providers in scope '${scope}' (${providers}). Specify --from.`
    );
  }

  return matches[0];
}

export function resolveDefaultOutputPath(
  to: Provider,
  targetScope: Scope,
  skillName: string,
  cwd = process.cwd()
): string {
  return resolveSkillPath(to, targetScope, skillName, cwd);
}

export function validateSkillName(skillName: string): string {
  const normalized = skillName.trim();
  const separators = [path.sep, path.posix.sep, path.win32.sep];

  if (!normalized) {
    throw new Error(
      `[${ISSUE_CODES.INVALID_SKILL_NAME}] Invalid skill name '${skillName}'. Skill name cannot be empty.`
    );
  }

  if (normalized === "." || normalized === "..") {
    throw new Error(
      `[${ISSUE_CODES.INVALID_SKILL_NAME}] Invalid skill name '${skillName}'. Dot path segments are not allowed.`
    );
  }

  if (path.isAbsolute(normalized) || separators.some((sep) => sep && normalized.includes(sep))) {
    throw new Error(
      `[${ISSUE_CODES.INVALID_SKILL_NAME}] Invalid skill name '${skillName}'. Path separators are not allowed.`
    );
  }

  return normalized;
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

function findProjectRoot(start: string): string {
  const override = process.env.SKILL_PORT_PROJECT_ROOT;
  if (override) {
    return path.resolve(override);
  }

  let current = path.resolve(start);

  while (true) {
    const gitMarker = path.join(current, ".git");
    try {
      accessSync(gitMarker);
      return current;
    } catch {
      // no-op
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return path.resolve(start);
    }

    current = parent;
  }
}

async function resolvePluginSkill(
  skillName: string,
  from: Provider | "auto"
): Promise<{ provider: Provider; path: string }> {
  const normalizedName = validateSkillName(skillName);
  const provider = from === "auto" ? "all" : from;
  const skills = await listPluginSkills(provider);

  const matches = skills.filter((s) => s.name === normalizedName);

  if (matches.length === 0) {
    throw new Error(`Skill '${skillName}' was not found in scope 'plugin'.`);
  }

  if (from === "auto" && matches.length > 1) {
    const uniqueProviders = new Set(matches.map((m) => m.provider));
    if (uniqueProviders.size > 1) {
      const providers = Array.from(uniqueProviders).join(", ");
      throw new Error(
        `Skill '${skillName}' exists for multiple providers in scope 'plugin' (${providers}). Specify --from.`
      );
    }
  }

  const match = matches[0];
  return { provider: match.provider, path: match.path };
}

function assertNever(value: never): never {
  throw new Error(`Unsupported value: ${String(value)}`);
}

function isWithinRoot(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}
