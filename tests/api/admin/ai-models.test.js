import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import { filterRecommendedModels } from "../../../api/admin/ai-models.js";

const source = readFileSync(new URL("../../../api/admin/ai-models.js", import.meta.url), "utf8");

describe("filterRecommendedModels", () => {
  it("keeps only the intended Gemini and OpenAI candidates", () => {
    const models = filterRecommendedModels([
      { providerKey: "gemini", modelName: "gemini-2.5-flash-lite" },
      { providerKey: "gemini", modelName: "gemini-2.5-flash" },
      { providerKey: "gemini", modelName: "gemini-1.5-pro" },
      { providerKey: "openai", modelName: "gpt-5.4-nano" },
      { providerKey: "openai", modelName: "gpt-5.4-mini" },
      { providerKey: "openai", modelName: "gpt-5.6-luna" },
      { providerKey: "openai", modelName: "gpt-4o-mini" },
    ]);

    expect(models).toEqual([
      { providerKey: "gemini", modelName: "gemini-2.5-flash-lite" },
      { providerKey: "gemini", modelName: "gemini-2.5-flash" },
      { providerKey: "openai", modelName: "gpt-5.4-nano" },
      { providerKey: "openai", modelName: "gpt-5.4-mini" },
      { providerKey: "openai", modelName: "gpt-5.6-luna" },
    ]);
  });

  it("adds live provider test status to the admin model payload", () => {
    expect(source).toContain("async function getLiveModelStatuses");
    expect(source).toContain("liveStatuses: await getLiveModelStatuses");
    expect(source).toContain("testModelConnection");
    expect(source).toContain("uniqueModels(filterRecommendedModels(models))");
  });
});
