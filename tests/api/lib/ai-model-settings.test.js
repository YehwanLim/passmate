import { describe, expect, it } from "vitest";

import { getActiveModel } from "../../../api/lib/ai-model-settings.js";

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
});
