import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import { filterRecommendedModels } from "../../../lib/admin-handlers/ai-models.js";

const source = readFileSync(new URL("../../../lib/admin-handlers/ai-models.js", import.meta.url), "utf8");

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

  it("keeps provider calls out of GET and protects model testing with the admin limiter", () => {
    expect(source).toContain('import { requireAdministrator }');
    expect(source).toContain("consumeUserRateLimit");
    expect(source).toContain('if (req.method === "GET")');
    expect(source).not.toContain("liveStatuses: await getLiveModelStatuses");
    expect(source).toContain('req.body?.action !== "test-model"');
    expect(source).toContain("isAllowedModel(providerKey, modelName)");
  });
});
