import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
}));

vi.mock("./supabase", () => ({
  supabase: { auth: { getSession: mocks.getSession } },
}));

import {
  fetchPremiumSalesSettings,
  updatePremiumSalesEnabled,
} from "./admin-entitlements";

const mockedFetch = () => vi.mocked(global.fetch);

function jsonResponse(payload: unknown, { ok = true, status = 200 } = {}) {
  return new Response(JSON.stringify(payload), {
    headers: { "Content-Type": "application/json" },
    status: ok ? status : status || 400,
  });
}

describe("admin premium sales API client", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal("fetch", vi.fn());
    mocks.getSession.mockResolvedValue({
      data: { session: { access_token: "session-token" } },
    });
  });

  it("reads persisted sales state with the active Supabase bearer token", async () => {
    mockedFetch().mockResolvedValue(jsonResponse({ premiumEnabled: true }));

    await expect(fetchPremiumSalesSettings()).resolves.toEqual({ premiumEnabled: true });
    expect(mockedFetch()).toHaveBeenCalledWith("/api/admin/entitlements", {
      headers: {
        Authorization: "Bearer session-token",
        "Content-Type": "application/json",
      },
    });
  });

  it("patches only the requested persisted sales state", async () => {
    mockedFetch().mockResolvedValue(jsonResponse({ premiumEnabled: false }));

    await expect(updatePremiumSalesEnabled(false)).resolves.toEqual({ premiumEnabled: false });
    expect(mockedFetch()).toHaveBeenCalledWith("/api/admin/entitlements", expect.objectContaining({
      method: "PATCH",
      body: JSON.stringify({ premiumEnabled: false }),
      headers: expect.objectContaining({ Authorization: "Bearer session-token" }),
    }));
  });

  it("rejects before requesting when the administrator session is missing", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null } });

    await expect(fetchPremiumSalesSettings()).rejects.toThrow(
      "관리자 세션이 만료되었습니다. 다시 로그인해 주세요.",
    );
    expect(mockedFetch()).not.toHaveBeenCalled();
  });

  it("rejects a malformed response instead of silently treating it as disabled", async () => {
    mockedFetch().mockResolvedValue(jsonResponse({ premiumEnabled: "false" }));

    await expect(fetchPremiumSalesSettings()).rejects.toThrow(
      "결제 판매 상태를 불러오지 못했습니다.",
    );
  });

  it("surfaces JSON API errors", async () => {
    mockedFetch().mockResolvedValue(
      jsonResponse({ error: "저장 실패" }, { ok: false, status: 500 }),
    );

    await expect(updatePremiumSalesEnabled(true)).rejects.toThrow("저장 실패");
  });
});
