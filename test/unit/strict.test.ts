import path from "node:path";
import { describe, expect, it } from "vitest";
import { StrictModeError, convertSkill } from "../../src/core/convert.js";

const fixture = path.resolve("test/fixtures/openai-skill");

describe("strict mode", () => {
  it("fails when lossy conversion would drop provider-specific fields", async () => {
    await expect(
      convertSkill({
        input: fixture,
        to: "claude-code",
        strict: true,
        dryRun: true
      })
    ).rejects.toBeInstanceOf(StrictModeError);
  });
});
