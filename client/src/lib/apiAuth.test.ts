import { existsSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

const helperPath = new URL("./apiAuth.ts", import.meta.url);

describe("client API authentication", () => {
  it("returns the current Supabase access token as a Bearer Authorization header", async () => {
    if (!existsSync(helperPath)) {
      expect(existsSync(helperPath)).toBe(true);
      return;
    }

    const getSession = vi.fn().mockResolvedValue({
      data: { session: { access_token: "session-token" } },
      error: null,
    });
    vi.resetModules();
    vi.doMock("./supabase", () => ({ supabase: { auth: { getSession } } }));

    const { getAuthorizationHeader } = await import("./apiAuth");

    await expect(getAuthorizationHeader()).resolves.toEqual({
      Authorization: "Bearer session-token",
    });
  });

  it("fails locally with a clear authentication error when there is no session", async () => {
    if (!existsSync(helperPath)) {
      expect(existsSync(helperPath)).toBe(true);
      return;
    }

    vi.resetModules();
    vi.doMock("./supabase", () => ({
      supabase: { auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }) } },
    }));

    const { getAuthorizationHeader, AuthenticationRequiredError } = await import("./apiAuth");

    await expect(getAuthorizationHeader()).rejects.toBeInstanceOf(AuthenticationRequiredError);
    await expect(getAuthorizationHeader()).rejects.toThrow("Authentication is required");
  });
});
