import { describe, expect, it, vi } from "vitest";

import { callGeminiGenerate } from "../../../lib/model-client.js";

describe("callGeminiGenerate", () => {
  it("sends the API key in a header, never in the URL", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ candidates: [] }), { status: 200 }));

    await callGeminiGenerate({ apiKey: "secret-key", modelName: "gemini-x", body: {}, fetcher, timeoutMs: 1000 });

    const [url, init] = fetcher.mock.calls[0];
    expect(String(url)).not.toContain("secret-key");
    expect(String(url)).not.toContain("key=");
    expect(String(url)).toMatch(/\/gemini-x:generateContent$/);
    expect(init.headers["x-goog-api-key"]).toBe("secret-key");
  });

  it("encodes the model name so it cannot change the request path", async () => {
    const fetcher = vi.fn(async () => new Response("{}", { status: 200 }));

    await callGeminiGenerate({ apiKey: "k", modelName: "a/../b?x", body: {}, fetcher, timeoutMs: 1000 });

    expect(String(fetcher.mock.calls[0][0])).toContain("/a%2F..%2Fb%3Fx:generateContent");
  });
});
