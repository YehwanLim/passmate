import { describe, expect, it, vi } from "vitest";

vi.mock("../lib/prisma.js", () => ({ prisma: {}, default: {} }));

const { SCOPES, buildAuthorizeUrl, extractCode } = await import("./instagram-dm.mjs");

describe("instagram-dm script helpers", () => {
  it("builds the Instagram business login URL with the three scopes", () => {
    const url = new URL(buildAuthorizeUrl({ appId: "123", redirectUri: "https://pre-view.me/" }));
    expect(url.origin + url.pathname).toBe("https://www.instagram.com/oauth/authorize");
    expect(url.searchParams.get("client_id")).toBe("123");
    expect(url.searchParams.get("redirect_uri")).toBe("https://pre-view.me/");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("scope")).toBe(SCOPES.join(","));
    expect(SCOPES).toEqual([
      "instagram_business_basic",
      "instagram_business_manage_comments",
      "instagram_business_manage_messages",
    ]);
  });

  it("extracts the code from a pasted redirect URL or a bare code, dropping #_", () => {
    expect(extractCode("https://pre-view.me/?code=AQBx123#_")).toBe("AQBx123");
    expect(extractCode("AQBx123#_")).toBe("AQBx123");
    expect(extractCode("  AQBx123  ")).toBe("AQBx123");
    expect(extractCode("")).toBe("");
  });
});
