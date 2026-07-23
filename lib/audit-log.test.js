import { describe, expect, it, vi } from "vitest";

import { AUDIT_RETENTION_DAYS, purgeExpiredAuditEvents, recordAuditEvent } from "./audit-log.js";

describe("security audit log", () => {
  it("stores only the identifier-only event contract", async () => {
    const create = vi.fn(async () => ({}));

    await recordAuditEvent({
      actorId: "11111111-1111-4111-8111-111111111111",
      db: { auditEvent: { create } },
      outcome: "FAILED",
      requestId: "request-1",
      targetId: "analysis-1",
      targetType: "analysis",
    });

    expect(create).toHaveBeenCalledWith({
      data: {
        actorId: "11111111-1111-4111-8111-111111111111",
        outcome: "FAILED",
        requestId: "request-1",
        targetId: "analysis-1",
        targetType: "analysis",
      },
    });
  });

  it("removes audit events after the ninety-day retention window", async () => {
    const deleteMany = vi.fn(async () => ({ count: 2 }));
    const now = new Date("2026-07-23T00:00:00.000Z");

    await expect(purgeExpiredAuditEvents({ db: { auditEvent: { deleteMany } }, now })).resolves.toBe(2);
    expect(deleteMany).toHaveBeenCalledWith({
      where: { createdAt: { lt: new Date(now.getTime() - AUDIT_RETENTION_DAYS * 24 * 60 * 60 * 1000) } },
    });
  });
});
