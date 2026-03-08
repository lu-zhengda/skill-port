import { describe, expect, it } from "vitest";
import { writeOpenAiSkill } from "../../src/adapters/openai.js";
import type { CanonicalSkill } from "../../src/types.js";

describe("policy mapping", () => {
  it("reports policy conflict when canonical policy booleans disagree", () => {
    const canonical: CanonicalSkill = {
      name: "sample",
      description: "sample",
      body: "# Sample",
      sourceProvider: "claude-code",
      frontmatter: {
        name: "sample",
        description: "sample"
      },
      policy: {
        disableModelInvocation: true,
        allowImplicitInvocation: true
      },
      openai: {}
    };

    const result = writeOpenAiSkill(canonical);
    expect(result.conflicts).toHaveLength(1);
  });
});
