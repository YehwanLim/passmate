export const AUDIT_RETENTION_DAYS = 90;

function safeValue(value, maxLength) {
  return typeof value === "string" && value.length > 0
    ? value.slice(0, maxLength)
    : null;
}

/**
 * Audit logging must not make a user-facing security control fail open or
 * leak request content. Only opaque identifiers and a short outcome are kept.
 */
export async function recordAuditEvent({ actorId = null, db, outcome, requestId, targetId = null, targetType }) {
  if (!db?.auditEvent?.create) return false;

  try {
    await db.auditEvent.create({
      data: {
        actorId: safeValue(actorId, 36),
        outcome: safeValue(outcome, 64) ?? "UNKNOWN",
        requestId: safeValue(requestId, 128) ?? "unknown",
        targetId: safeValue(targetId, 255),
        targetType: safeValue(targetType, 64) ?? "unknown",
      },
    });
    return true;
  } catch {
    // Do not log the original error or input: it may contain sensitive data.
    console.error("[audit] event write failed", { requestId: safeValue(requestId, 128) ?? "unknown" });
    return false;
  }
}

export async function purgeExpiredAuditEvents({ db, now = new Date() }) {
  if (!db?.auditEvent?.deleteMany) return 0;
  try {
    const cutoff = new Date(now.getTime() - AUDIT_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const result = await db.auditEvent.deleteMany({ where: { createdAt: { lt: cutoff } } });
    return result.count;
  } catch {
    console.error("[audit] retention purge failed");
    return 0;
  }
}
