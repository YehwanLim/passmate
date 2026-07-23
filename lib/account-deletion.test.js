import { describe, expect, it } from "vitest";

import {
  cancelAccountDeletion,
  purgeDueAccounts,
  requestAccountDeletion,
} from "./account-deletion.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const NOW = new Date("2026-07-23T00:00:00.000Z");

function createDatabase(user = {}) {
  const state = {
    deleted: [],
    updated: [],
    user: { id: USER_ID, deletionRequestedAt: null, purgeAt: null, purgeClaimedAt: null, ...user },
  };
  return {
    state,
    user: {
      findUnique: async () => state.user,
      update: async ({ data }) => {
        state.updated.push(data);
        state.user = { ...state.user, ...data };
        return state.user;
      },
      updateMany: async ({ data, where }) => {
        state.updated.push(data);
        const matches = state.user
          && (!where.id || where.id === state.user.id)
          && (!where.deletionRequestedAt || state.user.deletionRequestedAt)
          && (!Object.hasOwn(where, "purgeClaimedAt") || where.purgeClaimedAt === state.user.purgeClaimedAt);
        if (!matches) return { count: 0 };
        state.user = { ...state.user, ...data };
        return { count: 1 };
      },
      findMany: async () => [{ id: USER_ID }],
      deleteMany: async ({ where }) => {
        state.deleted.push(where);
        return { count: 1 };
      },
    },
  };
}

describe("account deletion lifecycle", () => {
  it("locks an account immediately and schedules its purge thirty days later", async () => {
    const db = createDatabase();

    const result = await requestAccountDeletion({ prisma: db, userId: USER_ID, now: NOW });

    expect(result.purgeAt).toEqual(new Date("2026-08-22T00:00:00.000Z"));
    expect(db.state.updated[0]).toEqual({ deletionRequestedAt: NOW, purgeAt: result.purgeAt });
  });

  it("cancels a scheduled deletion before the purge", async () => {
    const db = createDatabase({ id: USER_ID, deletionRequestedAt: NOW, purgeAt: new Date("2026-08-22T00:00:00.000Z") });

    await expect(cancelAccountDeletion({ prisma: db, userId: USER_ID })).resolves.toMatchObject({ deletionRequestedAt: null, purgeAt: null });
    expect(db.state.updated[0]).toEqual({ deletionRequestedAt: null, purgeAt: null });
  });

  it("claims a due account before deleting its auth identity", async () => {
    const db = createDatabase();
    const calls = [];

    await purgeDueAccounts({
      prisma: db,
      deleteAuthUser: async (id) => {
        expect(db.state.user.purgeClaimedAt).toBeInstanceOf(Date);
        calls.push(`auth:${id}`);
      },
      now: NOW,
    });

    expect(calls).toEqual([`auth:${USER_ID}`]);
    expect(db.state.deleted).toEqual([{ id: USER_ID, purgeClaimedAt: expect.any(Date) }]);
  });

  it("does not cancel a deletion after the cron has claimed it", async () => {
    const db = createDatabase({ id: USER_ID, deletionRequestedAt: NOW, purgeAt: NOW, purgeClaimedAt: NOW });

    await expect(cancelAccountDeletion({ prisma: db, userId: USER_ID })).rejects.toMatchObject({
      code: "ACCOUNT_DELETION_NOT_PENDING",
      statusCode: 409,
    });
  });
});
