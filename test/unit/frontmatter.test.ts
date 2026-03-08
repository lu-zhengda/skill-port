import { describe, expect, it } from "vitest";
import { parseSkillMarkdown, serializeSkillMarkdown } from "../../src/core/frontmatter.js";

describe("frontmatter parser", () => {
  it("parses and serializes while preserving unknown fields", () => {
    const input = `---\nname: sample-skill\ndescription: Sample description\nunknown-field: keep-me\nmetadata:\n  owner: team\n---\n\n# Title\n\nBody\n`;

    const parsed = parseSkillMarkdown(input);
    expect(parsed.frontmatter.name).toBe("sample-skill");
    expect(parsed.frontmatter["unknown-field"]).toBe("keep-me");

    const serialized = serializeSkillMarkdown(parsed);
    const reparsed = parseSkillMarkdown(serialized);

    expect(reparsed.frontmatter["unknown-field"]).toBe("keep-me");
    expect(reparsed.body).toContain("# Title");
  });
});
