import { describe, expect, it } from "vitest";

import { filterRecommendedModels } from "./ai-models.js";

describe("filterRecommendedModels", () => {
  it("keeps only the intended Gemini and OpenAI candidates", () => {
    const models = filterRecommendedModels([
      { providerKey: "gemini", modelName: "gemini-2.5-flash-lite" },
      { providerKey: "gemini", modelName: "gemini-2.5-flash" },
      { providerKey: "gemini", modelName: "gemini-1.5-pro" },
      { providerKey: "openai", modelName: "gpt-5.4-nano" },
      { providerKey: "openai", modelName: "gpt-4o-mini" },
    ]);

    expect(models).toEqual([
      { providerKey: "gemini", modelName: "gemini-2.5-flash-lite" },
      { providerKey: "gemini", modelName: "gemini-2.5-flash" },
      { providerKey: "openai", modelName: "gpt-5.4-nano" },
    ]);
  });
});
