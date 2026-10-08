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
  // 문항 분리는 크레딧을 쓰지 않는 편의 기능이라 레이트리밋만으로 비용을 통제한다.
  resumeSplit: Object.freeze({
    route: "analyze-split",
    limit: 10,
    windowMs: 15 * 60 * 1000,
  }),
  // 채용공고 불러오기(URL fetch + flash-lite 요약)도 크레딧을 쓰지 않는 편의 기능이다.
  jobPosting: Object.freeze({
    route: "analyze-posting",
    limit: 10,
    windowMs: 15 * 60 * 1000,
  }),
  // 경험 → 초안(무료). 하루 2개. 창이 UTC 자정 정렬이라 KST 09:00 에 초기화된다.
  experienceDraft: Object.freeze({
    route: "experience-draft",
    limit: 2,
    windowMs: 24 * 60 * 60 * 1000,
  }),
  // 경험 자동 채우기(무료). 하루 3번, 초안과 따로 센다. 창이 UTC 자정 정렬이라 KST 09:00 에 초기화된다.
  experienceExtract: Object.freeze({
    route: "experience-extract",
    limit: 3,
    windowMs: 24 * 60 * 60 * 1000,
  }),
});

export const ANALYSIS_THROUGHPUT = Object.freeze({
  free: Object.freeze({
    concurrencyLimit: 1,
    rateLimit: USER_RATE_LIMITS.analysis,
  }),
  premium: Object.freeze({
    concurrencyLimit: 2,
    rateLimit: Object.freeze({
      route: "analysis",
      limit: 10,
      windowMs: 15 * 60 * 1000,
    }),
  }),
});

export function getAnalysisThroughputPolicy(summary) {
  return summary?.premiumEnabled === true && Number(summary.premiumRemaining) > 0
    ? ANALYSIS_THROUGHPUT.premium
    : ANALYSIS_THROUGHPUT.free;
}

// 기업 분석 리포트는 무료 티어가 없고 검색 그라운딩으로 호출이 길다.
// 동시 2건으로 함수 부하를 막고, 15분 5회로 비용을 통제한다.
export const COMPANY_ANALYSIS_THROUGHPUT = Object.freeze({
  concurrencyLimit: 2,
  rateLimit: Object.freeze({
    route: "company-analysis",
    limit: 5,
    windowMs: 15 * 60 * 1000,
  }),
});

export function getCompanyAnalysisThroughputPolicy() {
  return COMPANY_ANALYSIS_THROUGHPUT;
}

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
  const bucket = await db.apiRateLimitBucket.upsert({
    where: {
      subjectKey_route_windowStart: {
        subjectKey,
        route: policy.route,
        windowStart,
      },
    },
    create: {
      subjectKey,
      route: policy.route,
      windowStart,
      requestCount: 1,
    },
    update: {
      requestCount: { increment: 1 },
    },
    select: { requestCount: true },
  });

  const requestCount = Number(bucket?.requestCount);
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

/**
 * consume 한 1회를 되돌린다(모델 실패·경험 부족 응답). consume 때와 같은 now 를 넘겨야 같은 창을 고친다.
 * 이미 0 이거나 버킷이 없으면 아무것도 하지 않는다.
 */
export async function refundUserRateLimit(db, { userId, policy, now = new Date() }) {
  validatePolicy(policy);
  await db.apiRateLimitBucket.updateMany({
    where: {
      subjectKey: `user:${userId}`,
      route: policy.route,
      windowStart: getWindowStart(now, policy.windowMs),
      requestCount: { gt: 0 },
    },
    data: { requestCount: { decrement: 1 } },
  });
}

/**
 * 표시용: 이번 창에서 남은 횟수만 읽는다. 버킷을 만들거나 늘리지 않는다(이용권 화면의 "오늘 무료 AI 도구").
 */
export async function peekUserRateLimit(db, { userId, policy, now = new Date() }) {
  validatePolicy(policy);
  const windowStart = getWindowStart(now, policy.windowMs);
  const bucket = await db.apiRateLimitBucket.findUnique({
    where: {
      subjectKey_route_windowStart: { subjectKey: `user:${userId}`, route: policy.route, windowStart },
    },
    select: { requestCount: true },
  });
  const used = Number(bucket?.requestCount) || 0;
  return {
    limit: policy.limit,
    remaining: Math.max(policy.limit - used, 0),
    resetAt: new Date(windowStart.getTime() + policy.windowMs),
  };
}
