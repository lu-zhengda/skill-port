import { describe, expect, it } from "vitest";
import { resolveSkillsRoot } from "../../src/core/scopes.js";

describe("plugin scope type", () => {
  it("resolveSkillsRoot handles plugin scope without throwing assertNever", () => {
    expect(() => resolveSkillsRoot("claude-code", "plugin" as any)).toThrow(
      "installed_plugins.json"
    );
  });
});
