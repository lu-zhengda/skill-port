import { cpSync, existsSync, mkdtempSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import yaml from "js-yaml";
import { describe, expect, it } from "vitest";
import type { Provider } from "../../src/types.js";

const root = path.resolve(".");
const cliEntry = path.join(root, "src", "cli.ts");
const tsxBin = path.join(
  root,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "tsx.cmd" : "tsx"
);

const fixtures: Record<Provider, string> = {
  codex: path.resolve("test/fixtures/openai-skill"),
  "claude-code": path.resolve("test/fixtures/claude-skill"),
  cursor: path.resolve("test/fixtures/cursor-skill")
};

const extraFileBySource: Record<Provider, string> = {
  codex: "scripts/deploy.sh",
  "claude-code": "references/examples.md",
  cursor: "scripts/review.sh"
};

function providerRoot(home: string, provider: Provider): string {
  switch (provider) {
    case "codex":
      return path.join(home, ".agents", "skills");
    case "claude-code":
      return path.join(home, ".claude", "skills");
    case "cursor":
      return path.join(home, ".cursor", "skills");
    default:
      throw new Error(`unsupported provider ${String(provider)}`);
  }
}

function installFixture(home: string, provider: Provider, skillName: string): string {
  const target = path.join(providerRoot(home, provider), skillName);
  cpSync(fixtures[provider], target, { recursive: true });
  return target;
}

function runCli(home: string, args: string[]) {
  return spawnSync(tsxBin, [cliEntry, ...args], {
    cwd: root,
    encoding: "utf8",
    env: {
      ...process.env,
      HOME: home,
      SKILL_PORT_HOME: home
    }
  });
}

function parseFrontmatter(skillPath: string): Record<string, unknown> {
  const raw = readFileSync(skillPath, "utf8");
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!match) {
    throw new Error("missing frontmatter");
  }

  const parsed = yaml.load(match[1]);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("invalid frontmatter");
  }

  return parsed as Record<string, unknown>;
}

describe("cli e2e conversion", () => {
  const pairs: Array<{ from: Provider; to: Provider }> = [
    { from: "codex", to: "claude-code" },
    { from: "codex", to: "cursor" },
    { from: "claude-code", to: "codex" },
    { from: "claude-code", to: "cursor" },
    { from: "cursor", to: "codex" },
    { from: "cursor", to: "claude-code" }
  ];

  for (const pair of pairs) {
    it(`converts ${pair.from} -> ${pair.to} using scoped lookup`, () => {
      const home = mkdtempSync(path.join(os.tmpdir(), "skill-port-e2e-home-"));
      const skillName = "sample-skill";
      installFixture(home, pair.from, skillName);

      const result = runCli(home, ["convert", skillName, "--to", pair.to]);
      expect(result.status, result.stderr).toBe(0);

      const outputDir = path.join(providerRoot(home, pair.to), skillName);
      expect(existsSync(path.join(outputDir, "SKILL.md"))).toBe(true);
      expect(existsSync(path.join(outputDir, "skill-port.report.json"))).toBe(true);
      expect(existsSync(path.join(outputDir, extraFileBySource[pair.from]))).toBe(true);

      const openaiConfigPath = path.join(outputDir, "agents", "openai.yaml");
      if (pair.to === "codex") {
        expect(existsSync(openaiConfigPath)).toBe(true);
      } else {
        expect(existsSync(openaiConfigPath)).toBe(false);
      }
    });
  }

  it("lists skills in user scope", () => {
    const home = mkdtempSync(path.join(os.tmpdir(), "skill-port-list-home-"));
    installFixture(home, "codex", "deploy-one");
    installFixture(home, "claude-code", "explain-one");

    const result = runCli(home, ["list"]);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("codex: deploy-one");
    expect(result.stdout).toContain("claude-code: explain-one");
    expect(result.stdout).not.toContain(home);
  });

  it("includes paths when list is called with --show-paths", () => {
    const home = mkdtempSync(path.join(os.tmpdir(), "skill-port-list-path-home-"));
    installFixture(home, "codex", "deploy-one");

    const result = runCli(home, ["list", "--show-paths"]);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain(home);
  });

  it("converts all skills with --all", () => {
    const home = mkdtempSync(path.join(os.tmpdir(), "skill-port-all-home-"));
    installFixture(home, "codex", "demo-a");
    installFixture(home, "codex", "demo-b");

    const result = runCli(home, ["convert", "--all", "--from", "codex", "--to", "cursor"]);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("Processed 2 skill(s):");
    expect(result.stdout).toContain("- converted: 2");
    expect(result.stdout).toContain("- failed: 0");

    const outA = path.join(providerRoot(home, "cursor"), "demo-a");
    const outB = path.join(providerRoot(home, "cursor"), "demo-b");

    expect(existsSync(path.join(outA, "SKILL.md"))).toBe(true);
    expect(existsSync(path.join(outB, "SKILL.md"))).toBe(true);
  });

  it("continues with --all when some skills fail and returns non-zero", () => {
    const home = mkdtempSync(path.join(os.tmpdir(), "skill-port-all-strict-home-"));
    installFixture(home, "codex", "demo-a");
    installFixture(home, "codex", "demo-b");

    const result = runCli(home, [
      "convert",
      "--all",
      "--from",
      "codex",
      "--to",
      "claude-code",
      "--strict"
    ]);

    expect(result.status, result.stderr).toBe(3);
    expect(result.stdout).toContain("Processed 2 skill(s):");
    expect(result.stdout).toContain("- failed: 2");
    expect(result.stdout).toContain("demo-a");
    expect(result.stdout).toContain("demo-b");
  });

  it("rejects traversal in skill-name", () => {
    const home = mkdtempSync(path.join(os.tmpdir(), "skill-port-traversal-home-"));
    const result = runCli(home, ["convert", "../escape", "--to", "codex"]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("SP002");
  });

  it("preserves canonical fields across codex -> claude -> codex", () => {
    const home = mkdtempSync(path.join(os.tmpdir(), "skill-port-roundtrip-home-"));
    const skillName = "deploy-app";
    installFixture(home, "codex", skillName);

    const first = runCli(home, ["convert", skillName, "--to", "claude-code", "--from", "codex"]);
    expect(first.status, first.stderr).toBe(0);

    const out2 = path.join(home, "roundtrip-openai");
    const second = runCli(home, [
      "convert",
      skillName,
      "--to",
      "codex",
      "--from",
      "claude-code",
      "--out",
      out2
    ]);
    expect(second.status, second.stderr).toBe(0);

    const frontmatter = parseFrontmatter(path.join(out2, "SKILL.md"));
    expect(frontmatter.name).toBe("deploy-app");
    expect(frontmatter.description).toBeTypeOf("string");
    expect(frontmatter["custom-field"]).toBe("preserve-me");

    const openaiConfig = yaml.load(readFileSync(path.join(out2, "agents", "openai.yaml"), "utf8")) as {
      policy?: { allow_implicit_invocation?: boolean };
    };

    expect(openaiConfig.policy?.allow_implicit_invocation).toBe(false);
  });
});
