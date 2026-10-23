import { describe, expect, it, vi } from "vitest";

import { InstagramDmError } from "./errors.js";
import {
  DELIVERY_RETENTION_MS,
  REFRESH_AFTER_MS,
  purgeExpiredInstagramDeliveries,
  refreshInstagramTokenIfDue,
  runInstagramMaintenance,
  saveInstagramCredential,
} from "./credential.js";

const NOW = new Date("2026-10-23T03:00:00.000Z");

function dbWith(row) {
  return {
    instagramCredential: {
      findUnique: vi.fn(async () => row),
      update: vi.fn(async () => row),
      upsert: vi.fn(async () => row),
    },
    instagramDmDelivery: { deleteMany: vi.fn(async () => ({ count: 3 })) },
  };
}

describe("saveInstagramCredential", () => {
  it("upserts the single row with an absolute expiry", async () => {
    const db = dbWith(null);
    await saveInstagramCredential({ db, accountId: "acc", accessToken: "tok", expiresIn: 60, now: NOW });
    const expected = { accountId: "acc", accessToken: "tok", expiresAt: new Date(NOW.getTime() + 60_000), refreshedAt: NOW };
    expect(db.instagramCredential.upsert).toHaveBeenCalledWith({
      where: { id: "singleton" },
      create: { id: "singleton", ...expected },
      update: expected,
    });
  });
});

describe("refreshInstagramTokenIfDue", () => {
  it("does nothing without a connected account or before 30 days", async () => {
    const graph = { refreshToken: vi.fn() };
    expect(await refreshInstagramTokenIfDue({ db: dbWith(null), graph, now: NOW })).toBe("missing");
    const fresh = dbWith({ accessToken: "old", refreshedAt: new Date(NOW.getTime() - REFRESH_AFTER_MS + 1) });
    expect(await refreshInstagramTokenIfDue({ db: fresh, graph, now: NOW })).toBe("skipped");
    expect(graph.refreshToken).not.toHaveBeenCalled();
  });

  it("refreshes and stores the new token after 30 days", async () => {
    const db = dbWith({ accessToken: "old", refreshedAt: new Date(NOW.getTime() - REFRESH_AFTER_MS) });
    const graph = { refreshToken: vi.fn(async () => ({ accessToken: "new", expiresIn: 5184000 })) };

    expect(await refreshInstagramTokenIfDue({ db, graph, now: NOW })).toBe("refreshed");
    expect(graph.refreshToken).toHaveBeenCalledWith({ token: "old" });
    expect(db.instagramCredential.update).toHaveBeenCalledWith({
      where: { id: "singleton" },
      data: { accessToken: "new", expiresAt: new Date(NOW.getTime() + 5184000 * 1000), refreshedAt: NOW },
    });
  });

  it("refuses an unusable refresh response and leaves the stored row untouched", async () => {
    for (const bad of [
      { accessToken: undefined, expiresIn: 5184000 },
      { accessToken: "", expiresIn: 5184000 },
      { accessToken: "new", expiresIn: undefined },
      { accessToken: "new", expiresIn: 0 },
    ]) {
      const db = dbWith({ accessToken: "old", refreshedAt: new Date(0) });
      const graph = { refreshToken: vi.fn(async () => bad) };

      await expect(refreshInstagramTokenIfDue({ db, graph, now: NOW })).rejects.toMatchObject({
        code: "INSTAGRAM_REFRESH_INVALID",
      });
      expect(db.instagramCredential.update).not.toHaveBeenCalled();
    }
  });
});

describe("purgeExpiredInstagramDeliveries", () => {
  it("deletes rows older than a year", async () => {
    const db = dbWith(null);
    expect(await purgeExpiredInstagramDeliveries({ db, now: NOW })).toBe(3);
    expect(db.instagramDmDelivery.deleteMany).toHaveBeenCalledWith({
      where: { createdAt: { lt: new Date(NOW.getTime() - DELIVERY_RETENTION_MS) } },
    });
  });
});

describe("runInstagramMaintenance", () => {
  it("never throws and logs only codes", async () => {
    const db = dbWith({ accessToken: "secret-token", refreshedAt: new Date(0) });
    db.instagramDmDelivery.deleteMany.mockRejectedValue(new Error("db down"));
    const graph = { refreshToken: vi.fn(async () => { throw new InstagramDmError("GRAPH_190"); }) };
    const logger = { warn: vi.fn() };

    await expect(runInstagramMaintenance({ db, graph, now: NOW, logger })).resolves.toEqual({ token: "failed", purgedDeliveries: null });
    expect(JSON.stringify(logger.warn.mock.calls)).not.toContain("secret-token");
    expect(logger.warn).toHaveBeenCalledWith("[instagram-dm] token refresh failed", { code: "GRAPH_190" });
  });

  it("survives a db without the instagram tables (older test doubles)", async () => {
    await expect(runInstagramMaintenance({ db: {}, graph: {}, now: NOW, logger: { warn: vi.fn() } })).resolves.toEqual({
      token: "failed",
      purgedDeliveries: null,
    });
  });
});
