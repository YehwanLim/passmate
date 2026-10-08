import { kstLabel, periodWhere, readPeriod } from "../admin-period.js";
import { USER_RATE_LIMITS } from "../rate-limit.js";
import { CLIENT_EVENT_NAMES } from "../site-visits.js";
import { VISIT_ROW_CAP, excludeAdminVisits } from "./dashboard.js";
import { createAdminHandler } from "./create-admin-handler.js";
import prisma from "../prisma.js";

/**
 * 사용 행동 — 사람들이 어디서 와서 어디까지 가고 다시 오는지를 실제 기록으로 센다.
 * 원천: site_visits(익명 방문, 로그인 뒤엔 userId 가 붙음), client_events(퍼널·로그인 이벤트, detail 앞 글자가 기기),
 * DB(가입·분석·결제·경험), api_rate_limit_buckets(크레딧을 안 쓰는 무료 기능의 요청 수).
 * 응답에는 숫자와 유입원 라벨만 담는다 — 이메일·자소서 본문 없음.
 */

export const DIRECT_SOURCE_LABEL = "직접 유입·알 수 없음";
const SOURCE_ROW_CAP = 12;
const EVENT_ROW_CAP = 100_000;
const ANALYZE_PATH = "/analyze";
const LOGIN_EVENT_NAMES = Object.freeze(
  ["login_prompt_in_app", "google_button_unavailable", "google_signin_failed", "kakao_start_failed"].filter((name) =>
    CLIENT_EVENT_NAMES.includes(name),
  ),
);
const FREE_FEATURE_ROUTES = Object.freeze([
  { key: "experienceExtract", label: "경험 자동 채우기", route: USER_RATE_LIMITS.experienceExtract.route },
  { key: "experienceDraft", label: "경험 → 초안", route: USER_RATE_LIMITS.experienceDraft.route },
  { key: "jobPosting", label: "공고 불러오기", route: USER_RATE_LIMITS.jobPosting.route },
]);

// 로그인하고 돌아올 때 찍히는 referrer 는 유입원이 아니다(같은 방문자의 원래 유입원은 이전 방문에 남아 있다).
const LOGIN_RETURN_HOST = /^(accounts\.google\.[a-z.]+|kauth\.kakao\.com|[a-z0-9-]+\.supabase\.co)$/i;

export function referrerHost(referrer) {
  if (!referrer) return null;
  try {
    const host = new URL(referrer).hostname || null;
    return host && !LOGIN_RETURN_HOST.test(host) ? host : null;
  } catch {
    return null;
  }
}

/** client_events.detail 은 `m`·`d` 또는 `m:hero` 꼴이다. 그 밖(로그인 오류 문구 등)은 기기를 모른다. */
export function deviceOf(detail) {
  const match = typeof detail === "string" ? /^([md])(?::|$)/.exec(detail) : null;
  return match ? match[1] : null;
}

function uniqueVisitorsByDevice(events) {
  const all = new Set();
  const mobile = new Set();
  const desktop = new Set();
  events.forEach(({ visitorId, detail }) => {
    all.add(visitorId);
    const device = deviceOf(detail);
    if (device === "m") mobile.add(visitorId);
    if (device === "d") desktop.add(visitorId);
  });
  return { all, count: all.size, mobile: mobile.size, desktop: desktop.size };
}

/** 방문자(탭 세션) ↔ 사용자 연결. 로그인한 뒤의 방문·이벤트에만 userId 가 실린다. */
function linkVisitorsToUsers(visits, events) {
  const usersByVisitor = new Map();
  const visitorsByUser = new Map();
  [...visits, ...events].forEach(({ visitorId, userId }) => {
    if (!userId) return;
    if (!usersByVisitor.has(visitorId)) usersByVisitor.set(visitorId, new Set());
    usersByVisitor.get(visitorId).add(userId);
    if (!visitorsByUser.has(userId)) visitorsByUser.set(userId, new Set());
    visitorsByUser.get(userId).add(visitorId);
  });
  return { usersByVisitor, visitorsByUser };
}

/**
 * 단계별 고유 수. 단계마다 따로 센다(앞 단계를 거쳤는지 강제하지 않는다) — 폼 주소로 바로 들어온 사람도 있어서다.
 * 방문·폼 열람은 방문자 기준, 가입 이후는 사용자 기준이다.
 */
export function summarizeFunnel({ visits, events, signupIds, analyses, payments }) {
  const visitors = new Set(visits.map((row) => row.visitorId));
  const analyzeViewers = new Set(visits.filter((row) => row.path === ANALYZE_PATH).map((row) => row.visitorId));
  const formStart = uniqueVisitorsByDevice(events.filter((row) => row.name === "analyze_form_start"));
  const submit = uniqueVisitorsByDevice(events.filter((row) => row.name === "analyze_submit_click"));
  const analyzed = new Set(analyses.filter((row) => row.status === "SUCCESS").map((row) => row.userId));
  const paid = new Set(payments.map((row) => row.userId));
  return [
    { key: "visit", label: "방문", count: visitors.size, mobile: null, desktop: null },
    { key: "analyzeView", label: "분석 폼 열람", count: analyzeViewers.size, mobile: null, desktop: null },
    { key: "formStart", label: "작성 시작", count: formStart.count, mobile: formStart.mobile, desktop: formStart.desktop },
    { key: "submit", label: "제출 클릭", count: submit.count, mobile: submit.mobile, desktop: submit.desktop },
    { key: "signup", label: "가입", count: signupIds.size, mobile: null, desktop: null },
    { key: "analysis", label: "분석 완료", count: analyzed.size, mobile: null, desktop: null },
    { key: "payment", label: "결제", count: paid.size, mobile: null, desktop: null },
  ];
}

/**
 * 유입원별 고유 방문자와, 그 방문자 중 작성을 시작한 수·기간 안에 가입한 수.
 * utm_source 가 있으면 그것, 없으면 referrer 호스트로 묶는다. 한 방문자가 여러 유입원으로 들어왔으면 각각 센다.
 * 유입원 행이 하나도 없는 방문자는 주소창 직접 입력이거나 referrer 를 숨긴 앱(카카오톡 등)이다.
 */
export function summarizeSources({ visits, events, signupIds }) {
  const { usersByVisitor } = linkVisitorsToUsers(visits, events);
  const starters = new Set(events.filter((row) => row.name === "analyze_form_start").map((row) => row.visitorId));
  const signedUp = (visitorId) => [...(usersByVisitor.get(visitorId) ?? [])].some((userId) => signupIds.has(userId));

  const bySource = new Map();
  const sourced = new Set();
  const all = new Set();
  visits.forEach(({ visitorId, referrer, utmSource }) => {
    all.add(visitorId);
    const label = utmSource || referrerHost(referrer);
    if (!label) return;
    sourced.add(visitorId);
    if (!bySource.has(label)) bySource.set(label, new Set());
    bySource.get(label).add(visitorId);
  });
  const toRow = (source, ids) => ({
    source,
    visitors: ids.size,
    formStarts: [...ids].filter((id) => starters.has(id)).length,
    signups: [...ids].filter(signedUp).length,
  });
  const rows = [...bySource.entries()]
    .map(([source, ids]) => toRow(source, ids))
    .sort((a, b) => b.visitors - a.visitors)
    .slice(0, SOURCE_ROW_CAP);
  const direct = new Set([...all].filter((id) => !sourced.has(id)));
  if (direct.size > 0) rows.push(toRow(DIRECT_SOURCE_LABEL, direct));
  return rows;
}

/** 서로 다른 KST 날짜 이틀 이상 들어온 방문자, 그리고 기간 안 가입자 중 이틀 이상 들어온 사람. */
export function summarizeRetention({ visits, events, signupIds }) {
  const daysByVisitor = new Map();
  visits.forEach(({ visitorId, createdAt }) => {
    if (!daysByVisitor.has(visitorId)) daysByVisitor.set(visitorId, new Set());
    daysByVisitor.get(visitorId).add(kstLabel(createdAt));
  });
  const returningVisitors = [...daysByVisitor.values()].filter((days) => days.size >= 2).length;

  const { visitorsByUser } = linkVisitorsToUsers(visits, events);
  let returningSignups = 0;
  signupIds.forEach((userId) => {
    const days = new Set();
    (visitorsByUser.get(userId) ?? new Set()).forEach((visitorId) => {
      (daysByVisitor.get(visitorId) ?? new Set()).forEach((day) => days.add(day));
    });
    if (days.size >= 2) returningSignups += 1;
  });

  return { visitors: daysByVisitor.size, returningVisitors, signups: signupIds.size, returningSignups };
}

/** 앱 안 브라우저(Google 로그인이 막히는 WebView)로 들어온 고유 방문자와 종류, 로그인 화면 이벤트 건수. */
export function summarizeLogin({ visits, events }) {
  const all = new Set();
  const inApp = new Set();
  const byKind = new Map();
  visits.forEach(({ visitorId, inAppBrowser }) => {
    all.add(visitorId);
    if (!inAppBrowser) return;
    inApp.add(visitorId);
    if (!byKind.has(inAppBrowser)) byKind.set(inAppBrowser, new Set());
    byKind.get(inAppBrowser).add(visitorId);
  });
  const loginEvents = Object.fromEntries(LOGIN_EVENT_NAMES.map((name) => [name, 0]));
  events.forEach(({ name }) => {
    if (Object.hasOwn(loginEvents, name)) loginEvents[name] += 1;
  });
  return {
    visitors: all.size,
    inAppVisitors: inApp.size,
    inAppKinds: [...byKind.entries()]
      .map(([kind, ids]) => ({ kind, visitors: ids.size }))
      .sort((a, b) => b.visitors - a.visitors),
    events: loginEvents,
  };
}

/** 기능별 사용 횟수와 사용자 수. 무료 기능은 레이트리밋 버킷의 요청 수라 환불된 요청은 빠진다. */
export function summarizeFeatures({ analyses, experiences, buckets }) {
  const tally = (rows, userOf, amountOf = () => 1) => {
    const users = new Set();
    let uses = 0;
    rows.forEach((row) => {
      const amount = amountOf(row);
      if (amount <= 0) return;
      uses += amount;
      users.add(userOf(row));
    });
    return { uses, users: users.size };
  };
  const succeeded = (kind) => analyses.filter((row) => row.status === "SUCCESS" && row.kind === kind);
  return [
    { key: "resume", label: "자소서 분석", ...tally(succeeded("RESUME"), (row) => row.userId) },
    { key: "company", label: "기업 분석", ...tally(succeeded("COMPANY"), (row) => row.userId) },
    { key: "experience", label: "경험 저장", ...tally(experiences, (row) => row.userId) },
    ...FREE_FEATURE_ROUTES.map(({ key, label, route }) => ({
      key,
      label,
      ...tally(
        buckets.filter((row) => row.route === route),
        (row) => row.subjectKey,
        (row) => Number(row.requestCount) || 0,
      ),
    })),
  ];
}

export default createAdminHandler({ route: "api/admin/behavior", methods: ["GET"] }, async ({ req, res }) => {
  const period = readPeriod(req.query, new Date());
  const createdAt = periodWhere(period);
  const [rawVisits, rawEvents, users, analyses, payments, experiences, buckets, admins] = await Promise.all([
    prisma.siteVisit.findMany({
      where: { createdAt },
      select: { visitorId: true, userId: true, path: true, createdAt: true, referrer: true, utmSource: true, inAppBrowser: true },
      take: VISIT_ROW_CAP,
    }),
    prisma.clientEvent.findMany({
      where: { createdAt },
      select: { visitorId: true, userId: true, name: true, detail: true },
      take: EVENT_ROW_CAP,
    }),
    prisma.user.findMany({ where: { createdAt }, select: { id: true } }),
    prisma.analysis.findMany({ where: { createdAt }, select: { userId: true, kind: true, status: true } }),
    prisma.paymentEntitlement.findMany({ where: { createdAt }, select: { userId: true } }),
    prisma.experience.findMany({ where: { createdAt }, select: { userId: true } }),
    prisma.apiRateLimitBucket.findMany({
      where: { route: { in: FREE_FEATURE_ROUTES.map((feature) => feature.route) }, windowStart: periodWhere(period) },
      select: { subjectKey: true, route: true, requestCount: true },
    }),
    prisma.user.findMany({ where: { role: "admin" }, select: { id: true } }),
  ]);

  // 운영자 본인의 사용은 전부 뺀다(방문·이벤트는 같은 탭 세션째로).
  const adminIds = new Set(admins.map((row) => row.id).filter(Boolean));
  const adminVisitorIds = new Set(
    [...rawVisits, ...rawEvents].filter((row) => row.userId && adminIds.has(row.userId)).map((row) => row.visitorId),
  );
  const visits = excludeAdminVisits(rawVisits, adminIds);
  const events = rawEvents.filter((row) => !adminVisitorIds.has(row.visitorId));
  const notAdmin = (row) => !adminIds.has(row.userId);
  const signupIds = new Set(users.map((row) => row.id).filter((id) => !adminIds.has(id)));
  const memberAnalyses = analyses.filter(notAdmin);
  const memberPayments = payments.filter(notAdmin);
  const adminSubjects = new Set([...adminIds].map((id) => `user:${id}`));

  return res.status(200).json({
    period: period.key,
    funnel: summarizeFunnel({ visits, events, signupIds, analyses: memberAnalyses, payments: memberPayments }),
    sources: summarizeSources({ visits, events, signupIds }),
    retention: summarizeRetention({ visits, events, signupIds }),
    login: summarizeLogin({ visits, events }),
    features: summarizeFeatures({
      analyses: memberAnalyses,
      experiences: experiences.filter(notAdmin),
      buckets: buckets.filter((row) => !adminSubjects.has(row.subjectKey)),
    }),
  });
});
