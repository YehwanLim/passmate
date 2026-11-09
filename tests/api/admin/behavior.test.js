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
    interviewSession: { findMany: vi.fn() },
    interviewTurn: { groupBy: vi.fn() },
    siteNotice: { findMany: vi.fn() },
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
    mocks.prisma.interviewSession.findMany.mockResolvedValue([]);
    mocks.prisma.interviewTurn.groupBy.mockResolvedValue([]);
    mocks.prisma.siteNotice.findMany.mockResolvedValue([]);
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

  it("단계별 고유 수를 세고 방문~제출 단계는 폰/PC 로 나눈다", async () => {
    signups = [{ id: "u1" }, { id: "u2" }];
    mocks.prisma.siteVisit.findMany.mockResolvedValue([
      // a: 방문 핑에 기기 없음(옛 탭) → 이벤트(m)로 채움, b: 방문 핑 d, c: 기기 모름
      { visitorId: "a", path: "/", createdAt: NOW, device: null },
      { visitorId: "a", path: "/analyze", createdAt: NOW, device: null },
      { visitorId: "b", path: "/analyze", createdAt: NOW, device: "d" },
      { visitorId: "c", path: "/guide", createdAt: NOW, device: null },
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
      expect.objectContaining({ count: 3, mobile: 1, desktop: 1 }),
    );
    expect(res.body.funnel.find((step) => step.key === "analyzeView")).toEqual(
      expect.objectContaining({ count: 2, mobile: 1, desktop: 1 }),
    );
    expect(res.body.funnel.find((step) => step.key === "signup")).toEqual(
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

  it("체류 시간은 방문자별 최댓값으로 중앙값·평균·구간을 내고, 시간을 못 잰 방문은 전체 수에만 남는다", async () => {
    mocks.prisma.siteVisit.findMany.mockResolvedValue(
      ["a", "b", "c", "d", "bot"].map((visitorId) => ({ visitorId, createdAt: NOW })),
    );
    mocks.prisma.clientEvent.findMany.mockResolvedValue([
      // a 는 누적값이 두 번 왔다 — 더하지 않고 큰 값만 쓴다
      { visitorId: "a", name: "engaged_time", detail: "m:5" },
      { visitorId: "a", name: "engaged_time", detail: "m:20" },
      { visitorId: "b", name: "engaged_time", detail: "d:40" },
      { visitorId: "c", name: "engaged_time", detail: "m:100" },
      // 자리를 비운 탭은 1시간에서 자른다
      { visitorId: "d", name: "engaged_time", detail: "d:90000" },
      // 다른 이벤트의 detail 이나 꼴이 틀린 값은 시간으로 읽지 않는다
      { visitorId: "bot", name: "analyze_form_start", detail: "m:999" },
      { visitorId: "bot", name: "engaged_time", detail: "m:abc" },
    ]);

    const res = await run();

    expect(res.body.engagedTime).toEqual({
      visitors: 5,
      measured: 4,
      medianSeconds: 70,
      averageSeconds: 940,
      buckets: [
        { label: "10초 미만", count: 0 },
        { label: "10~30초", count: 1 },
        { label: "30초~1분", count: 1 },
        { label: "1~3분", count: 1 },
        { label: "3~10분", count: 0 },
        { label: "10분 이상", count: 1 },
      ],
    });
  });

  it("체류 시간을 잰 방문이 없으면 초 값은 null 이고, 운영자 탭의 시간은 뺀다", async () => {
    admins = [{ id: "admin-1" }];
    mocks.prisma.siteVisit.findMany.mockResolvedValue([
      { visitorId: "me", createdAt: NOW, userId: "admin-1" },
      { visitorId: "guest", createdAt: NOW },
    ]);
    mocks.prisma.clientEvent.findMany.mockResolvedValue([{ visitorId: "me", name: "engaged_time", detail: "d:500" }]);

    const res = await run();

    expect(res.body.engagedTime).toEqual(
      expect.objectContaining({ visitors: 1, measured: 0, medianSeconds: null, averageSeconds: null }),
    );
  });

  it("응답에 이메일이 실리지 않는다", async () => {
    mocks.prisma.siteVisit.findMany.mockResolvedValue([{ visitorId: "a", createdAt: NOW, utmSource: "threads" }]);
    const res = await run();
    expect(JSON.stringify(res.body)).not.toMatch(/@/);
  });

  it("직접 지정 기간은 끝 날짜 다음 날 0시(KST)까지 조회하고 범위를 돌려준다", async () => {
    const res = await run({ period: "custom", from: "2026-09-08", to: "2026-09-08" });
    const where = mocks.prisma.siteVisit.findMany.mock.calls[0][0].where.createdAt;
    expect(where.gte.toISOString()).toBe("2026-09-07T15:00:00.000Z");
    expect(where.lt.toISOString()).toBe("2026-09-08T15:00:00.000Z");
    expect(res.body.period).toBe("custom");
    expect(res.body.range).toEqual({ from: "2026-09-08", to: "2026-09-08" });
  });

  it("AI 모의 면접은 단계마다 세션·사람 수를 세고 운영자 면접은 뺀다", async () => {
    admins = [{ id: "admin-1" }];
    const t = (iso) => new Date(iso);
    mocks.prisma.interviewSession.findMany.mockResolvedValue([
      // 시작만 누르고 연결 안 됨 → 환불
      { id: "s1", userId: "u1", status: "CANCELLED", mode: "FULL", firstTokenAt: null, endedAt: null, feedbackStatus: "NONE" },
      // 연결됐지만 답 없이 끝 → 환불
      { id: "s2", userId: "u1", status: "CANCELLED", mode: "FULL", firstTokenAt: t("2026-09-09T01:00:00Z"), endedAt: t("2026-09-09T01:01:00Z"), feedbackStatus: "NONE" },
      // 끝까지 보고 피드백 받음(10분)
      { id: "s3", userId: "u1", status: "ENDED", mode: "FULL", firstTokenAt: t("2026-09-09T02:00:00Z"), endedAt: t("2026-09-09T02:10:00Z"), feedbackStatus: "SUCCEEDED" },
      // 다른 사람, 중간에 끊김(4분)
      { id: "s4", userId: "u2", status: "INTERRUPTED", mode: "SHORT", firstTokenAt: t("2026-09-09T03:00:00Z"), endedAt: t("2026-09-09T03:04:00Z"), feedbackStatus: "NONE" },
      // 운영자
      { id: "s5", userId: "admin-1", status: "ENDED", mode: "FULL", firstTokenAt: t("2026-09-09T04:00:00Z"), endedAt: t("2026-09-09T04:20:00Z"), feedbackStatus: "SUCCEEDED" },
    ]);
    mocks.prisma.interviewTurn.groupBy.mockResolvedValue([
      { sessionId: "s3", _count: { _all: 6 } },
      { sessionId: "s4", _count: { _all: 2 } },
    ]);

    const res = await run();
    const { interviews } = res.body;
    const steps = Object.fromEntries(interviews.steps.map((row) => [row.key, [row.sessions, row.users]]));
    expect(steps).toEqual({
      created: [4, 2],
      connected: [3, 2],
      answered: [2, 2],
      used: [2, 2],
      feedback: [1, 1],
    });
    expect(interviews).toEqual(expect.objectContaining({ interrupted: 1, refunded: 2, shortMode: 1, medianSeconds: 420 }));
    const turnWhere = mocks.prisma.interviewTurn.groupBy.mock.calls[0][0].where;
    expect(turnWhere.sessionId.in).not.toContain("s5");
  });

  it("면접 세션이 없으면 발언을 조회하지 않는다", async () => {
    const res = await run();
    expect(mocks.prisma.interviewTurn.groupBy).not.toHaveBeenCalled();
    expect(res.body.interviews.steps[0]).toEqual({ key: "created", label: "시작 누름", sessions: 0, users: 0 });
    expect(res.body.interviews.medianSeconds).toBeNull();
  });

  it("팝업마다 뜬 사람·누른 사람·닫은 사람을 세고 공지 제목을 붙인다", async () => {
    const noticeId = "11111111-2222-3333-4444-555555555555";
    const goneId = "99999999-2222-3333-4444-555555555555";
    mocks.prisma.clientEvent.findMany.mockResolvedValue([
      { visitorId: "v1", name: "content_cta_click", detail: "m:interview-popup:open" },
      { visitorId: "v1", name: "content_cta_click", detail: "m:interview-popup:go" },
      { visitorId: "v2", name: "content_cta_click", detail: "d:interview-popup:open" },
      { visitorId: "v2", name: "content_cta_click", detail: "d:interview-popup:never" },
      { visitorId: "v3", name: "content_cta_click", detail: "d:interview-popup:open" },
      { visitorId: "v3", name: "content_cta_click", detail: "d:interview-popup:open" },
      { visitorId: "v3", name: "content_cta_click", detail: "d:interview-popup:close" },
      { visitorId: "v1", name: "content_cta_click", detail: `m:notice-popup:${noticeId}:open` },
      { visitorId: "v1", name: "content_cta_click", detail: `m:notice-popup:${noticeId}:today` },
      { visitorId: "v4", name: "content_cta_click", detail: `d:notice-popup:${goneId}:open` },
      // 팝업이 아닌 것·꼴이 다른 것은 버린다
      { visitorId: "v5", name: "content_cta_click", detail: "m:guide-end:slug" },
      { visitorId: "v5", name: "content_cta_click", detail: "m:notice-popup:------------------------------------:open" },
    ]);
    mocks.prisma.siteNotice.findMany.mockResolvedValue([{ id: noticeId, title: "11월 이벤트" }]);

    const res = await run();
    expect(mocks.prisma.siteNotice.findMany.mock.calls[0][0].where.id.in.sort()).toEqual([noticeId, goneId].sort());
    expect(res.body.popups).toEqual([
      { key: "interview", label: "AI 모의 면접 출시 팝업", kind: "interview", shown: 3, clicked: 1, closed: 1, hidden: 1 },
      { key: `notice:${noticeId}`, label: "11월 이벤트", kind: "notice", shown: 1, clicked: 0, closed: 0, hidden: 1 },
      { key: `notice:${goneId}`, label: "지운 공지 팝업", kind: "notice", shown: 1, clicked: 0, closed: 0, hidden: 0 },
    ]);
  });

  it("팝업 기록이 없으면 공지를 조회하지 않고 빈 목록을 준다", async () => {
    const res = await run();
    expect(mocks.prisma.siteNotice.findMany).not.toHaveBeenCalled();
    expect(res.body.popups).toEqual([]);
  });
});
