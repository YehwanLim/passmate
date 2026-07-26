import { describe, expect, it, vi } from "vitest";

import { AuthorizationError } from "../../../lib/auth.js";
import { createAccountDeletionHandler } from "../../../api/account/deletion.js";
import { createAccountDeletionCancelHandler } from "../../../api/account/deletion/cancel.js";
import { createPurgeDeletedAccountsHandler } from "../../../api/cron/purge-deleted-users.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";

function request(overrides = {}) {
  return {
    headers: { authorization: "Bearer test-token" },
    method: "POST",
    ...overrides,
  };
}

function response() {
  return {
    body: undefined,
    headers: {},
    statusCode: null,
    json(body) {
      this.body = body;
      return this;
    },
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
  };
}

describe("account deletion API", () => {
  it("requires an active application user before scheduling deletion", async () => {
    const schedule = vi.fn();
    const handler = createAccountDeletionHandler({
      requestDeletion: schedule,
      requireUser: async () => {
        throw new AuthorizationError("AUTHENTICATION_REQUIRED", 401, "private auth detail");
      },
    });
    const res = response();

    await handler(request(), res);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: "AUTHENTICATION_REQUIRED", requestId: expect.any(String) });
    expect(schedule).not.toHaveBeenCalled();
    expect(JSON.stringify(res.body)).not.toContain("private auth detail");
  });

  it("schedules deletion and returns only the grace-period deadline", async () => {
    const purgeAt = new Date("2026-08-22T00:00:00.000Z");
    const schedule = vi.fn(async () => ({ purgeAt }));
    const handler = createAccountDeletionHandler({
      db: { user: {} },
      requestDeletion: schedule,
      requireUser: async () => ({ applicationUser: { id: USER_ID } }),
    });
    const res = response();

    await handler(request(), res);

    expect(res.statusCode).toBe(202);
    expect(res.body).toEqual({ deletionPending: true, purgeAt: purgeAt.toISOString() });
    expect(schedule).toHaveBeenCalledWith(expect.objectContaining({ userId: USER_ID }));
  });

  it("allows a verified pending user to cancel deletion before the purge", async () => {
    const cancel = vi.fn(async () => ({ deletionRequestedAt: null, purgeAt: null }));
    const handler = createAccountDeletionCancelHandler({
      authenticate: async () => ({ id: USER_ID }),
      cancelDeletion: cancel,
      db: { user: {} },
    });
    const res = response();

    await handler(request(), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ deletionPending: false });
    expect(cancel).toHaveBeenCalledWith(expect.objectContaining({ userId: USER_ID }));
  });
});

describe("deleted account purge cron", () => {
  it("does not purge accounts without the protected cron credential", async () => {
    const purgeAccounts = vi.fn();
    const handler = createPurgeDeletedAccountsHandler({ cronSecret: "cron-secret", purgeAccounts });
    const res = response();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    try {
      await handler(request({ headers: {}, method: "GET" }), res);

      expect(res.statusCode).toBe(401);
      expect(res.body).toEqual({ error: "CRON_AUTH_REQUIRED", requestId: expect.any(String) });
      expect(purgeAccounts).not.toHaveBeenCalled();
      expect(warn).toHaveBeenCalledWith(
        "[api/cron/purge] authorization rejected",
        {
          authorizationHeaderLength: 0,
          authorizationHeaderPresent: false,
          cronSecretConfigured: true,
          expectedAuthorizationHeaderLength: "Bearer cron-secret".length,
        },
      );
      expect(JSON.stringify(warn.mock.calls)).not.toContain("cron-secret");
    } finally {
      warn.mockRestore();
    }
  });

  it("uses the service role only after cron authentication and reports an aggregate", async () => {
    const deleteUser = vi.fn(async () => ({ error: null }));
    const purgeAccounts = vi.fn(async ({ deleteAuthUser }) => {
      await deleteAuthUser(USER_ID);
      return { purged: 1 };
    });
    const handler = createPurgeDeletedAccountsHandler({
      cronSecret: "cron-secret",
      getAdminClient: () => ({ auth: { admin: { deleteUser } } }),
      purgeAccounts,
    });
    const res = response();

    await handler(request({ headers: { authorization: "Bearer cron-secret" }, method: "GET" }), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ purged: 1 });
    expect(deleteUser).toHaveBeenCalledWith(USER_ID);
  });
});
