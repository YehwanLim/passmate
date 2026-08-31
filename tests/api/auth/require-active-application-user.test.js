import { describe, expect, it, vi } from "vitest";

import { requireActiveApplicationUser } from "../../../lib/auth.js";

const AUTH_USER = { id: "11111111-1111-4111-8111-111111111111" };

function fakeDb(record) {
  return {
    user: { findUnique: vi.fn().mockResolvedValue(record) },
  };
}

describe("requireActiveApplicationUser", () => {
  it("selects the email so downstream audit records can rely on it", async () => {
    const db = fakeDb({
      deletionRequestedAt: null,
      email: "admin@preview.dev",
      id: AUTH_USER.id,
      role: "admin",
    });

    const result = await requireActiveApplicationUser({ headers: {} }, db, {
      authenticate: async () => AUTH_USER,
    });

    const select = db.user.findUnique.mock.calls[0][0].select;
    expect(select.email).toBe(true);
    expect(result.applicationUser.email).toBe("admin@preview.dev");
  });

  it("rejects accounts pending deletion", async () => {
    const db = fakeDb({
      deletionRequestedAt: new Date(),
      email: "user@preview.dev",
      id: AUTH_USER.id,
      role: "user",
    });

    await expect(
      requireActiveApplicationUser({ headers: {} }, db, {
        authenticate: async () => AUTH_USER,
      }),
    ).rejects.toMatchObject({ code: "ACCOUNT_DELETION_PENDING" });
  });
});
