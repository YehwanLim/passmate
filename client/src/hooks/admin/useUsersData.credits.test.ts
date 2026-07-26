import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ supabase: {} }));

import { mergeUserCreditSummaries, type AdminUserRow } from "./useUsersData";

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
