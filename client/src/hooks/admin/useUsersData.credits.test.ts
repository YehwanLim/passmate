// @vitest-environment jsdom

import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchUserCreditSummaries: vi.fn(),
  from: vi.fn(),
}));

vi.mock("@/lib/admin-credits", () => ({
  fetchUserCreditSummaries: mocks.fetchUserCreditSummaries,
}));
vi.mock("@/lib/supabase", () => ({
  supabase: { from: mocks.from },
}));

import { mergeUserCreditSummaries, type AdminUserRow, useUsersData } from "./useUsersData";

const USER_ID = "22222222-2222-4222-8222-222222222222";
const SECOND_USER_ID = "33333333-3333-4333-8333-333333333333";

function baseUser(id: string): AdminUserRow {
  return {
    id,
    email: `${id}@example.com`,
    name: null,
    profile_image: null,
    provider: null,
    role: "user",
    created_at: "2026-07-26T00:00:00.000Z",
    updated_at: "2026-07-26T00:00:00.000Z",
    analysis_count: 0,
    project_count: 0,
  };
}

describe("mergeUserCreditSummaries", () => {
  it("adds server totals by user ID and leaves unavailable summaries null", () => {
    expect(mergeUserCreditSummaries([baseUser(USER_ID), baseUser(SECOND_USER_ID)], [
      { userId: USER_ID, freeRemaining: 1, bonusRemaining: 2, premiumRemaining: 0, remaining: 3, premiumEnabled: false },
    ])).toEqual([
      expect.objectContaining({ id: USER_ID, remaining_credits: 3 }),
      expect.objectContaining({ id: SECOND_USER_ID, remaining_credits: null }),
    ]);
  });
});

describe("useUsersData credit summaries", () => {
  it("keeps an empty page as a normal empty state without requesting summaries", async () => {
    const query = {
      select: vi.fn(),
      order: vi.fn(),
      range: vi.fn(),
    };
    query.select.mockReturnValue(query);
    query.order.mockReturnValue(query);
    query.range.mockResolvedValue({ data: [], count: 0, error: null });
    mocks.from.mockReturnValue(query);
    mocks.fetchUserCreditSummaries.mockRejectedValue(
      new Error("empty summary requests are invalid"),
    );

    const { result } = renderHook(() => useUsersData({
      search: "",
      sortField: "created_at",
      sortDir: "desc",
      page: 1,
      pageSize: 20,
    }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.users).toEqual([]);
    expect(result.current.error).toBeNull();
    expect(mocks.fetchUserCreditSummaries).not.toHaveBeenCalled();
  });
});
