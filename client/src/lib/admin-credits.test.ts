import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock("./supabase", () => ({ supabase: { auth: { getSession: mocks.getSession } } }));

import { fetchUserCredits, grantUserCredits } from "./admin-credits";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
const SUMMARY = { premiumEnabled: true, freeRemaining: 0, bonusRemaining: 1, premiumRemaining: 2, remaining: 3 };

describe("admin credits client", () => {
  beforeEach(() => {
    mocks.getSession.mockResolvedValue({ data: { session: { access_token: "session-token" } } });
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => vi.unstubAllGlobals());

  it("sends the grant kind and reads the company balance", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse({ summary: { ...SUMMARY, companyRemaining: 4 } }));

    const summary = await grantUserCredits({ userId: "u1", credits: 2, kind: "COMPANY" });

    expect(summary.companyRemaining).toBe(4);
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/credits", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ userId: "u1", credits: 2, note: undefined, kind: "COMPANY" }),
    }));
  });

  it("defaults the company balance to 0 for older server responses", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ summary: SUMMARY, grants: [] }));
    const result = await fetchUserCredits("u1");
    expect(result.summary.companyRemaining).toBe(0);
  });
});
