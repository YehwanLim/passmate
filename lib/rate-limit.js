export const USER_RATE_LIMITS = Object.freeze({
  analysis: Object.freeze({
    route: "analysis",
    limit: 3,
    windowMs: 15 * 60 * 1000,
  }),
  adminModelTest: Object.freeze({
    route: "admin-model-test",
    limit: 3,
    windowMs: 60 * 60 * 1000,
  }),
});

function getWindowStart(now, windowMs) {
  return new Date(Math.floor(now.getTime() / windowMs) * windowMs);
}

function validatePolicy(policy) {
  if (!policy || !Number.isInteger(policy.limit) || policy.limit < 1) {
    throw new TypeError("Rate limit policy must have a positive integer limit");
  }

  if (!Number.isInteger(policy.windowMs) || policy.windowMs < 1) {
    throw new TypeError("Rate limit policy must have a positive integer windowMs");
  }

  if (typeof policy.route !== "string" || policy.route.length === 0) {
    throw new TypeError("Rate limit policy must have a route");
  }
}

export async function consumeUserRateLimit(db, { userId, policy, now = new Date() }) {
  if (typeof userId !== "string" || userId.length === 0) {
    throw new TypeError("Rate limit subject must be a user ID");
  }
  validatePolicy(policy);

  const windowStart = getWindowStart(now, policy.windowMs);
  const subjectKey = `user:${userId}`;
  let rows;
  try {
    rows = await db.$queryRaw`
      INSERT INTO api_rate_limit_buckets (
        subject_key,
        route,
        window_start,
        request_count
      )
      VALUES (
        ${subjectKey},
        ${policy.route},
        ${windowStart},
        1
      )
      ON CONFLICT (subject_key, route, window_start)
      DO UPDATE
      SET
        request_count = api_rate_limit_buckets.request_count + 1,
        updated_at = NOW()
      RETURNING request_count
    `;
  } catch (error) {
    if (error && typeof error === "object") error.safeDiagnosticStage = "rate_limit_bucket";
    throw error;
  }

  const requestCount = Number(rows[0]?.request_count);
  if (!Number.isInteger(requestCount) || requestCount < 1) {
    throw new Error("Rate limit bucket increment did not return a request count");
  }

  const resetAt = new Date(windowStart.getTime() + policy.windowMs);
  const allowed = requestCount <= policy.limit;

  return {
    allowed,
    code: allowed ? null : "RATE_LIMITED",
    limit: policy.limit,
    remaining: Math.max(policy.limit - requestCount, 0),
    requestCount,
    resetAt,
    retryAfterSeconds: Math.max(1, Math.ceil((resetAt.getTime() - now.getTime()) / 1000)),
  };
}
