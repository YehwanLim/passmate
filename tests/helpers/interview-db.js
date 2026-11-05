// AI 면접 연습 핸들러 테스트용 메모리 DB. Prisma 가운데 핸들러가 실제로 쓰는 조회 모양만 흉내 낸다.
import { randomUUID } from "node:crypto";

export const INTERVIEW_TEST_USER = "11111111-1111-4111-8111-111111111111";
export const INTERVIEW_TEST_ANALYSIS = "22222222-2222-4222-8222-222222222222";

export const SAMPLE_REPORT = {
  interviewQA: [
    { question: "지원 동기를 말씀해 주세요.", followUps: ["왜 이 직무인가요?"], modelAnswer: "**모범 답변**" },
    { question: "로그 분석에서 맡은 역할은?", followUps: [], modelAnswer: "..." },
  ],
  gaps: [{ headline: "**협업 이야기가 빠져 있어요**", text: "..." }, "숫자 근거가 약해요"],
};

function matches(row, where = {}) {
  return Object.entries(where).every(([key, cond]) => {
    if (key === "OR") return cond.some((sub) => matches(row, sub));
    if (key === "reservation") return matches(row.__reservation ?? {}, cond.is ?? cond);
    const value = row[key];
    if (cond !== null && typeof cond === "object" && !(cond instanceof Date)) {
      if ("in" in cond) return cond.in.includes(value);
      if ("gte" in cond && !(value instanceof Date && value >= cond.gte)) return false;
      if ("lte" in cond && !(value instanceof Date && value <= cond.lte)) return false;
      if ("lt" in cond && !(value instanceof Date && value < cond.lt)) return false;
      return true;
    }
    if (cond instanceof Date) return value instanceof Date && value.getTime() === cond.getTime();
    return value === cond;
  });
}

function applyUpdate(row, data) {
  for (const [key, value] of Object.entries(data)) {
    if (value && typeof value === "object" && !(value instanceof Date) && ("increment" in value || "decrement" in value)) {
      row[key] = (row[key] ?? 0) + (value.increment ?? 0) - (value.decrement ?? 0);
    } else {
      row[key] = value;
    }
  }
  row.updatedAt = new Date();
  return row;
}

export function createInterviewMemoryDb({
  interviewEnabled = true,
  interviewCredits = 1,
  report = SAMPLE_REPORT,
  analysisStatus = "SUCCESS",
  now = () => new Date(),
} = {}) {
  const state = {
    sessions: [],
    turns: [],
    reservations: [],
    audits: [],
    entitlement: { userId: INTERVIEW_TEST_USER, bonusCreditsGranted: 0, premiumCreditsGranted: 0, companyCreditsGranted: 0, interviewCreditsGranted: interviewCredits },
    settings: { premiumEnabled: false, companyAnalysisEnabled: false, interviewEnabled },
    analysis: {
      id: INTERVIEW_TEST_ANALYSIS,
      userId: INTERVIEW_TEST_USER,
      kind: "RESUME",
      status: analysisStatus,
      inputText: "[문항 1]\n저는 동아리에서 로그 3,000건을 모아 분석했습니다.",
      aiResponseJson: report,
      project: { company: "한빛모빌리티", jobKeyword: "서비스 기획" },
      jobPosting: null,
    },
  };

  const withRelations = (session) => ({
    ...session,
    analysis: { project: state.analysis.project },
    __reservation: state.reservations.find((reservation) => reservation.id === session.reservationId) ?? null,
  });

  const db = {
    state,
    $queryRaw: async () => [],
    $transaction: async (work) => work(db),
    auditEvent: { create: async ({ data }) => { state.audits.push(data); return data; } },
    entitlementSetting: { findUnique: async () => ({ ...state.settings }) },
    analysisEntitlement: {
      upsert: async () => ({ ...state.entitlement }),
      findUnique: async () => ({ ...state.entitlement }),
      update: async ({ data }) => applyUpdate(state.entitlement, data),
    },
    analysisReservation: {
      count: async ({ where }) => state.reservations.filter((row) => matches(row, where)).length,
      create: async ({ data }) => { const row = { id: randomUUID(), ...data }; state.reservations.push(row); return row; },
      updateMany: async ({ where, data }) => {
        const rows = state.reservations.filter((row) => matches(row, where));
        rows.forEach((row) => applyUpdate(row, data));
        return { count: rows.length };
      },
    },
    analysis: {
      findFirst: async ({ where }) => (matches(state.analysis, where) ? { ...state.analysis } : null),
    },
    interviewSession: {
      findUnique: async ({ where, include }) => {
        const row = where.id
          ? state.sessions.find((session) => session.id === where.id)
          : state.sessions.find((session) => session.userId === where.userId_idempotencyKey.userId && session.idempotencyKey === where.userId_idempotencyKey.idempotencyKey);
        if (!row) return null;
        return include ? { ...withRelations(row), analysis: { aiResponseJson: state.analysis.aiResponseJson, project: state.analysis.project }, turns: state.turns.filter((turn) => turn.sessionId === row.id).sort((a, b) => a.seq - b.seq) } : { ...row };
      },
      findFirst: async ({ where, include }) => {
        const row = state.sessions.map(withRelations).find((session) => matches(session, where));
        if (!row) return null;
        return include ? { ...row, analysis: { aiResponseJson: state.analysis.aiResponseJson, project: state.analysis.project }, turns: state.turns.filter((turn) => turn.sessionId === row.id).sort((a, b) => a.seq - b.seq) } : row;
      },
      findMany: async ({ where, take, orderBy }) => {
        let rows = state.sessions.map(withRelations).filter((session) => matches(session, where));
        if (orderBy?.createdAt === "desc") rows = rows.sort((a, b) => b.createdAt - a.createdAt);
        return take ? rows.slice(0, take) : rows;
      },
      count: async ({ where }) => state.sessions.map(withRelations).filter((session) => matches(session, where)).length,
      create: async ({ data }) => {
        const row = {
          id: randomUUID(),
          tokenIssueCount: 0,
          firstTokenAt: null,
          hardDeadlineAt: null,
          endedAt: null,
          endReason: null,
          earlyRefundAt: null,
          clientReportedUsage: null,
          feedbackStatus: "NONE",
          feedbackJson: null,
          feedbackAttempts: 0,
          feedbackHadVideo: false,
          feedbackModel: null,
          createdAt: now(),
          updatedAt: now(),
          ...data,
        };
        state.sessions.push(row);
        return { ...row };
      },
      update: async ({ where, data }) => {
        const row = state.sessions.find((session) => session.id === where.id);
        if (!row) throw Object.assign(new Error("not found"), { code: "P2025" });
        return { ...applyUpdate(row, data) };
      },
      updateMany: async ({ where, data }) => {
        const rows = state.sessions.map(withRelations).filter((session) => matches(session, where));
        rows.forEach((row) => applyUpdate(state.sessions.find((session) => session.id === row.id), data));
        return { count: rows.length };
      },
    },
    interviewTurn: {
      count: async ({ where }) => state.turns.filter((turn) => matches(turn, where)).length,
      findMany: async ({ where, select }) => {
        const rows = state.turns.filter((turn) => matches(turn, where)).sort((a, b) => a.seq - b.seq);
        return select ? rows.map((row) => Object.fromEntries(Object.keys(select).map((key) => [key, row[key]]))) : rows;
      },
      aggregate: async ({ where }) => ({ _count: { _all: state.turns.filter((turn) => matches(turn, where)).length } }),
      upsert: async ({ where, create, update }) => {
        const existing = state.turns.find((turn) => turn.sessionId === where.sessionId_seq.sessionId && turn.seq === where.sessionId_seq.seq);
        if (existing) return applyUpdate(existing, update);
        const row = { id: randomUUID(), createdAt: now(), ...create };
        state.turns.push(row);
        return row;
      },
    },
  };
  return db;
}
