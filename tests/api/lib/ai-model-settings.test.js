import { describe, expect, it } from "vitest";

import { getActiveModel, getModelCallSequence } from "../../../lib/ai-model-settings.js";

describe("getActiveModel", () => {
  it("returns the configured provider and model together", () => {
    const model = getActiveModel({
      defaultModel: {
        providerKey: "openai",
        modelName: "gpt-5.6-luna",
      },
    });

    expect(model).toEqual({
      providerKey: "openai",
      modelName: "gpt-5.6-luna",
    });
  });

  it("returns default then fallback models without duplicates", () => {
    expect(getModelCallSequence({
      defaultModel: {
        providerKey: "gemini",
        modelName: "gemini-2.5-flash",
      },
      fallbackModel: {
        providerKey: "gemini",
        modelName: "gemini-2.5-flash-lite",
      },
    })).toEqual([
      { providerKey: "gemini", modelName: "gemini-2.5-flash" },
      { providerKey: "gemini", modelName: "gemini-2.5-flash-lite" },
    ]);

    expect(getModelCallSequence({
      defaultModel: {
        providerKey: "gemini",
        modelName: "gemini-2.5-flash",
      },
      fallbackModel: {
        providerKey: "google",
        modelName: "gemini-2.5-flash",
      },
    })).toEqual([
      { providerKey: "gemini", modelName: "gemini-2.5-flash" },
    ]);
  });
});
