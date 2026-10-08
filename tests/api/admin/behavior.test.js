import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    siteVisit: { findMany: vi.fn() },
    clientEvent: { findMany: vi.fn() },
    user: { findMany: vi.fn() },
    analysis: { findMany: vi.fn() },
    paymentEntitlement: { findMany: vi.fn() },
    experience: { findMany: vi.fn() },
    apiRateLimitBucket: { findMany: vi.fn() },
  },
  requireAdministrator: vi.fn(),
}));

vi.mock("../../../lib/auth.js", () => ({ requireAdministrator: mocks.requireAdministrator }));
vi.mock("../../../lib/prisma.js", () => ({ default: mocks.prisma }));

const { default: behaviorHandler, deviceOf } = await import("../../../lib/admin-handlers/behavior.js");
import { createResponse } from "../../helpers/http.js";

const NOW = new Date("2026-09-10T06:00:00.000Z");
const at = (iso) => new Date(iso);
let signups = [];
let admins = [];

async function run(query = {}) {
  const res = createResponse();
  await behaviorHandler({ method: "GET", query, headers: {} }, res);
  return res;
}

describe("admin behavior — 사용 행동", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    vi.clearAllMocks();
    signups = [];
    admins = [];
    mocks.requireAdministrator.mockResolvedValue({});
    mocks.prisma.siteVisit.findMany.mockResolvedValue([]);
    mocks.prisma.clientEvent.findMany.mockResolvedValue([]);
    mocks.prisma.user.findMany.mockImplementation(async ({ where }) => (where?.role === "admin" ? admins : signups));
    mocks.prisma.analysis.findMany.mockResolvedValue([]);
    mocks.prisma.paymentEntitlement.findMany.mockResolvedValue([]);
    mocks.prisma.experience.findMany.mockResolvedValue([]);
    mocks.prisma.apiRateLimitBucket.findMany.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("관리자가 아니면 401/403 을 그대로 돌려주고 DB 를 읽지 않는다", async () => {
    for (const statusCode of [401, 403]) {
      mocks.requireAdministrator.mockRejectedValueOnce(Object.assign(new Error("nope"), { statusCode }));
      const res = await run();
      expect(res.statusCode).toBe(statusCode);
    }
    expect(mocks.prisma.siteVisit.findMany).not.toHaveBeenCalled();
  });

  it("기기 코드는 m·d 와 m:위치 꼴만 읽는다", () => {
    expect(deviceOf("m")).toBe("m");
    expect(deviceOf("d:hero")).toBe("d");
    expect(deviceOf("missing token")).toBeNull();
    expect(deviceOf(null)).toBeNull();
  });

  it("단계별 고유 수를 세고 이벤트 단계는 폰/PC 로 나눈다", async () => {
    signups = [{ id: "u1" }, { id: "u2" }];
    mocks.prisma.siteVisit.findMany.mockResolvedValue([
      { visitorId: "a", path: "/", createdAt: NOW },
      { visitorId: "a", path: "/analyze", createdAt: NOW },
      { visitorId: "b", path: "/analyze", createdAt: NOW },
      { visitorId: "c", path: "/guide", createdAt: NOW },
    ]);
    mocks.prisma.clientEvent.findMany.mockResolvedValue([
      { visitorId: "a", name: "analyze_form_start", detail: "m" },
      { visitorId: "a", name: "analyze_form_start", detail: "m" },
      { visitorId: "b", name: "analyze_form_start", detail: "d:hero" },
      { visitorId: "a", name: "analyze_submit_click", detail: "m" },
    ]);
    mocks.prisma.analysis.findMany.mockResolvedValue([
      { userId: "u1", kind: "RESUME", status: "SUCCESS" },
      { userId: "u1", kind: "RESUME", status: "SUCCESS" },
      { userId: "u2", kind: "RESUME", status: "FAILED" },
    ]);
    mocks.prisma.paymentEntitlement.findMany.mockResolvedValue([{ userId: "u1" }]);

    const res = await run();

    expect(res.statusCode).toBe(200);
    expect(res.body.period).toBe("7d");
    expect(Object.fromEntries(res.body.funnel.map((step) => [step.key, step.count]))).toEqual({
      visit: 3, analyzeView: 2, formStart: 2, submit: 1, signup: 2, analysis: 1, payment: 1,
    });
    expect(res.body.funnel.find((step) => step.key === "formStart")).toEqual(
      expect.objectContaining({ mobile: 1, desktop: 1 }),
    );
    expect(res.body.funnel.find((step) => step.key === "visit")).toEqual(
      expect.objectContaining({ mobile: null, desktop: null }),
    );
  });

  it("유입원별로 작성 시작과 가입까지 이어진 방문자를 센다", async () => {
    signups = [{ id: "u1" }];
    mocks.prisma.siteVisit.findMany.mockResolvedValue([
      { visitorId: "a", createdAt: NOW, utmSource: "threads", referrer: null },
      { visitorId: "a", createdAt: NOW, utmSource: null, referrer: null, userId: "u1" },
      { visitorId: "b", createdAt: NOW, utmSource: "threads", referrer: null },
      { visitorId: "c", createdAt: NOW, utmSource: null, referrer: "https://blog.naver.com/x" },
      { visitorId: "d", createdAt: NOW, utmSource: null, referrer: null },
      // 로그인하고 돌아온 referrer 는 유입원이 아니다
      { visitorId: "d", createdAt: NOW, utmSource: null, referrer: "https://accounts.google.com/signin" },
      { visitorId: "c", createdAt: NOW, utmSource: null, referrer: "https://kauth.kakao.com/oauth" },
      // 기간 전 가입자(u-old)로 이어진 방문은 가입으로 치지 않는다
      { visitorId: "e", createdAt: NOW, utmSource: "threads", referrer: null, userId: "u-old" },
    ]);
    mocks.prisma.clientEvent.findMany.mockResolvedValue([
      { visitorId: "b", name: "analyze_form_start", detail: "m" },
    ]);

    const res = await run();

    expect(res.body.sources).toEqual([
      { source: "threads", visitors: 3, formStarts: 1, signups: 1 },
      { source: "blog.naver.com", visitors: 1, formStarts: 0, signups: 0 },
      { source: "직접 유입·알 수 없음", visitors: 1, formStarts: 0, signups: 0 },
    ]);
  });

  it("이틀 이상 온 방문자와 가입자를 센다", async () => {
    signups = [{ id: "u1" }, { id: "u2" }];
    mocks.prisma.siteVisit.findMany.mockResolvedValue([
      { visitorId: "a", createdAt: at("2026-09-08T03:00:00.000Z") },
      { visitorId: "a", createdAt: at("2026-09-08T05:00:00.000Z") },
      { visitorId: "b", createdAt: at("2026-09-08T03:00:00.000Z") },
      // 같은 사람(u1)이 다른 브라우저로 다른 날 들어옴
      { visitorId: "c", createdAt: at("2026-09-08T03:00:00.000Z"), userId: "u1" },
      { visitorId: "d", createdAt: at("2026-09-10T03:00:00.000Z"), userId: "u1" },
      { visitorId: "b", createdAt: at("2026-09-09T03:00:00.000Z") },
    ]);

    const res = await run();

    expect(res.body.retention).toEqual({ visitors: 4, returningVisitors: 1, signups: 2, returningSignups: 1 });
  });

  it("앱 안 브라우저 종류와 로그인 이벤트 건수를 센다", async () => {
    mocks.prisma.siteVisit.findMany.mockResolvedValue([
      { visitorId: "a", createdAt: NOW, inAppBrowser: "kakaotalk" },
      { visitorId: "b", createdAt: NOW, inAppBrowser: "kakaotalk" },
      { visitorId: "c", createdAt: NOW, inAppBrowser: "instagram" },
      { visitorId: "d", createdAt: NOW, inAppBrowser: null },
    ]);
    mocks.prisma.clientEvent.findMany.mockResolvedValue([
      { visitorId: "a", name: "login_prompt_in_app", detail: "kakaotalk" },
      { visitorId: "b", name: "login_prompt_in_app", detail: "kakaotalk" },
      { visitorId: "d", name: "google_signin_failed", detail: "popup closed" },
      { visitorId: "d", name: "analyze_form_start", detail: "d" },
    ]);

    const res = await run();

    expect(res.body.login).toEqual({
      visitors: 4,
      inAppVisitors: 3,
      inAppKinds: [{ kind: "kakaotalk", visitors: 2 }, { kind: "instagram", visitors: 1 }],
      events: { login_prompt_in_app: 2, google_button_unavailable: 0, google_signin_failed: 1, kakao_start_failed: 0 },
    });
  });

  it("기능별 사용 횟수·사용자를 세고, 무료 기능은 버킷 요청 수를 쓴다", async () => {
    mocks.prisma.analysis.findMany.mockResolvedValue([
      { userId: "u1", kind: "RESUME", status: "SUCCESS" },
      { userId: "u1", kind: "COMPANY", status: "SUCCESS" },
      { userId: "u2", kind: "COMPANY", status: "SUCCESS" },
      { userId: "u2", kind: "COMPANY", status: "FAILED" },
    ]);
    mocks.prisma.experience.findMany.mockResolvedValue([{ userId: "u1" }, { userId: "u1" }]);
    mocks.prisma.apiRateLimitBucket.findMany.mockResolvedValue([
      { subjectKey: "user:u1", route: "experience-draft", requestCount: 2 },
      { subjectKey: "user:u1", route: "experience-draft", requestCount: 1 },
      { subjectKey: "user:u2", route: "experience-extract", requestCount: 3 },
      // 전부 환불된 창은 사용자로 세지 않는다
      { subjectKey: "user:u3", route: "experience-extract", requestCount: 0 },
    ]);

    const res = await run({ period: "30d" });

    expect(Object.fromEntries(res.body.features.map((row) => [row.key, [row.uses, row.users]]))).toEqual({
      resume: [1, 1], company: [2, 2], experience: [2, 1],
      experienceExtract: [3, 1], experienceDraft: [3, 1], jobPosting: [0, 0],
    });
    const bucketWhere = mocks.prisma.apiRateLimitBucket.findMany.mock.calls[0][0].where;
    expect(bucketWhere.route.in).toEqual(["experience-extract", "experience-draft", "analyze-posting"]);
    expect(bucketWhere.windowStart.gte).toBeInstanceOf(Date);
  });

  it("운영자 계정의 방문·이벤트·사용은 전부 뺀다", async () => {
    admins = [{ id: "admin-1" }];
    signups = [{ id: "admin-1" }, { id: "u1" }];
    mocks.prisma.siteVisit.findMany.mockResolvedValue([
      { visitorId: "me", createdAt: NOW, path: "/analyze" },
      { visitorId: "me", createdAt: NOW, userId: "admin-1" },
      { visitorId: "guest", createdAt: NOW },
    ]);
    mocks.prisma.clientEvent.findMany.mockResolvedValue([{ visitorId: "me", name: "analyze_form_start", detail: "d" }]);
    mocks.prisma.analysis.findMany.mockResolvedValue([{ userId: "admin-1", kind: "RESUME", status: "SUCCESS" }]);
    mocks.prisma.apiRateLimitBucket.findMany.mockResolvedValue([
      { subjectKey: "user:admin-1", route: "experience-draft", requestCount: 2 },
    ]);

    const res = await run();
    const counts = Object.fromEntries(res.body.funnel.map((step) => [step.key, step.count]));

    expect(counts).toEqual(expect.objectContaining({ visit: 1, analyzeView: 0, formStart: 0, signup: 1, analysis: 0 }));
    expect(res.body.features.find((row) => row.key === "experienceDraft").uses).toBe(0);
  });

  it("지난주는 끝 경계까지 조회 조건에 넣고, 허용 밖 period 는 7일로 돌린다", async () => {
    await run({ period: "lastWeek" });
    const where = mocks.prisma.siteVisit.findMany.mock.calls[0][0].where.createdAt;
    expect(where.gte.toISOString()).toBe("2026-08-30T15:00:00.000Z");
    expect(where.lt.toISOString()).toBe("2026-09-06T15:00:00.000Z");

    const res = await run({ period: "all" });
    expect(res.body.period).toBe("7d");
  });

  it("응답에 이메일이 실리지 않는다", async () => {
    mocks.prisma.siteVisit.findMany.mockResolvedValue([{ visitorId: "a", createdAt: NOW, utmSource: "threads" }]);
    const res = await run();
    expect(JSON.stringify(res.body)).not.toMatch(/@/);
  });
});
