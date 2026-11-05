// AI 면접 연습 라우트 본문. /api/account/interview-sessions 아래에 얹는다(12함수 한도).
//   POST   /interview-sessions                  세션 생성(이용권 예약)
//   GET    /interview-sessions?analysisId=      내 세션 목록
//   GET    /interview-sessions/:id              세션 상세(대화 글·피드백)
//   POST   /interview-sessions/:id/token        입장권 발급·재발급
//   POST   /interview-sessions/:id/turns        대화 글 저장(멱등)
//   POST   /interview-sessions/:id/end          종료
// 대화 글·자소서·토큰은 로그와 감사 이벤트에 남기지 않는다.

import { ApiError, sendJson, sendRateLimited, withApiHandler } from "../api-handler.js";
import { recordAuditEvent } from "../audit-log.js";
import { requireActiveApplicationUser } from "../auth.js";
import { getEntitlementSummary, reserveAnalysis } from "../billing/analysis-entitlements.js";
import { isInterviewEnabled } from "./interview-switch.js";
import { buildJobPostingBlock } from "../analysis/resume-analysis.js";
import { parseReport, stripEmphasis } from "../analysis/report-fields.js";
import prisma from "../prisma.js";
import { USER_RATE_LIMITS, consumeUserRateLimit } from "../rate-limit.js";
import { isRecord, sanitizeInput } from "../sanitize.js";
import { pickInterviewer } from "../../shared/interviewPersona.js";
import { INTERVIEW_PROMPT_VERSION, buildInterviewerInstruction } from "../../shared/prompts/interviewPrompt.js";
import {
  InterviewConcurrencyLimitError,
  allocateInterviewSession,
  claimTokenIssue,
  endInterviewSession,
  expireStaleInterviewSessions,
  releaseTokenIssue,
} from "./interview-lifecycle.js";
import { LIVE_MODEL, buildLiveSessionConfig, issueLiveToken, liveSocketUrl, readLiveApiKey } from "./live-token.js";

// 동의 문구를 바꾸면 올린다(client/src/lib/interview/interviewApi.ts 와 같은 값). 옛 문구에 동의한 요청은 거절된다.
export const INTERVIEW_CONSENT_VERSION = "interview-consent-2026-11-06";
export const INTERVIEW_LIMITS = Object.freeze({
  turnChars: 4000,
  sessionChars: 60_000,
  turnsPerRequest: 50,
  turnsPerSession: 400,
  listTake: 20,
});
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;
const MODES = new Set(["FULL", "SHORT"]);
const END_REASONS = new Set(["user-stop", "time-up", "error", "closed", "reconnect-failed"]);
const SPEAKERS = new Set(["CANDIDATE", "INTERVIEWER"]);

const SESSION_SELECT = {
  id: true,
  userId: true,
  analysisId: true,
  reservationId: true,
  mode: true,
  status: true,
  liveModel: true,
  firstTokenAt: true,
  hardDeadlineAt: true,
  tokenIssueCount: true,
  endedAt: true,
  endReason: true,
  createdAt: true,
  feedbackStatus: true,
  feedbackJson: true,
  feedbackAttempts: true,
  feedbackHadVideo: true,
  analysis: { select: { project: { select: { company: true, jobKeyword: true } } } },
};

function invalid() {
  return new ApiError("INVALID_REQUEST", 400);
}

function header(req, name) {
  const value = req.headers?.[name] ?? req.headers?.[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function sessionIdOf(req) {
  const id = req.query?.sessionId;
  if (typeof id !== "string" || !UUID_PATTERN.test(id)) throw new ApiError("NOT_FOUND", 404);
  return id;
}

/** 화면에 내려 줄 세션 모양. userId·reservationId 같은 내부 값은 뺀다. */
export function sessionView(session, turns = null) {
  return {
    id: session.id,
    analysis_id: session.analysisId,
    mode: session.mode,
    status: session.status,
    company: session.analysis?.project?.company ?? null,
    job_role: session.analysis?.project?.jobKeyword ?? null,
    first_token_at: session.firstTokenAt?.toISOString() ?? null,
    hard_deadline_at: session.hardDeadlineAt?.toISOString() ?? null,
    token_issue_count: session.tokenIssueCount,
    ended_at: session.endedAt?.toISOString() ?? null,
    end_reason: session.endReason ?? null,
    created_at: session.createdAt.toISOString(),
    feedback_status: session.feedbackStatus,
    feedback: session.feedbackStatus === "SUCCEEDED" ? session.feedbackJson ?? null : null,
    feedback_attempts: session.feedbackAttempts ?? 0,
    feedback_had_video: session.feedbackHadVideo,
    ...(turns ? { turns: turns.map(turnView) } : {}),
  };
}

function turnView(turn) {
  return { seq: turn.seq, speaker: turn.speaker, text: turn.text, interrupted: turn.interrupted, partial: turn.partial, offset_ms: turn.offsetMs };
}

/** 리포트 JSON 에서 면접 재료를 꺼낸다. 서버 검증이 없던 필드라 모양을 직접 방어한다. */
export function interviewMaterialFromReport(aiResponseJson) {
  const report = parseReport(aiResponseJson);
  const questions = Array.isArray(report?.interviewQA)
    ? report.interviewQA
        .filter((item) => isRecord(item) && typeof item.question === "string" && item.question.trim())
        .map((item) => ({
          question: stripEmphasis(item.question),
          followUps: Array.isArray(item.followUps) ? item.followUps.filter((text) => typeof text === "string" && text.trim()).map(stripEmphasis).slice(0, 3) : [],
        }))
    : [];
  const gaps = Array.isArray(report?.gaps)
    ? report.gaps
        .map((gap) => (typeof gap === "string" ? gap : isRecord(gap) ? gap.headline ?? gap.text : null))
        .filter((text) => typeof text === "string" && text.trim())
        .map(stripEmphasis)
    : [];
  return { questions, gaps };
}

/**
 * 면접에 쓸 자소서 리포트를 소유권·종류·상태까지 확인해 읽는다. 없거나 남의 것이면 404.
 * 기업 리포트(COMPANY)는 질문 모양이 달라 받지 않는다.
 */
export async function loadInterviewSource(db, { analysisId, userId }) {
  if (typeof analysisId !== "string" || !UUID_PATTERN.test(analysisId)) throw new ApiError("NOT_FOUND", 404);
  const analysis = await db.analysis.findFirst({
    where: { id: analysisId, userId, kind: "RESUME", status: "SUCCESS" },
    select: {
      id: true,
      inputText: true,
      aiResponseJson: true,
      project: { select: { company: true, jobKeyword: true } },
      jobPosting: { select: { rawText: true, summaryJson: true } },
    },
  });
  if (!analysis) throw new ApiError("NOT_FOUND", 404);
  const material = interviewMaterialFromReport(analysis.aiResponseJson);
  if (material.questions.length === 0) throw new ApiError("INTERVIEW_SOURCE_UNAVAILABLE", 422);
  return {
    analysisId: analysis.id,
    company: analysis.project?.company ?? null,
    jobRole: analysis.project?.jobKeyword ?? null,
    coverLetter: analysis.inputText,
    postingBlock: analysis.jobPosting ? buildJobPostingBlock(analysis.jobPosting) : "",
    ...material,
  };
}

export function normalizeCreateRequest(body) {
  if (!isRecord(body)) throw invalid();
  const allowed = new Set(["analysisId", "mode", "consentVersion"]);
  if (!Object.keys(body).every((key) => allowed.has(key))) throw invalid();
  if (typeof body.analysisId !== "string" || !UUID_PATTERN.test(body.analysisId)) throw invalid();
  const mode = body.mode ?? "FULL";
  if (!MODES.has(mode)) throw invalid();
  // 동의 문구 버전이 다르면 화면이 옛 문구를 보여 준 것이다. 동의 없이 음성·영상을 보내게 두지 않는다.
  if (body.consentVersion !== INTERVIEW_CONSENT_VERSION) throw new ApiError("INTERVIEW_CONSENT_REQUIRED", 400);
  return { analysisId: body.analysisId, mode, consentVersion: body.consentVersion };
}

export function normalizeTurns(body) {
  if (!isRecord(body) || !Array.isArray(body.turns)) throw invalid();
  if (body.turns.length === 0 || body.turns.length > INTERVIEW_LIMITS.turnsPerRequest) throw invalid();
  return body.turns.map((turn) => {
    if (!isRecord(turn)) throw invalid();
    if (!Number.isInteger(turn.seq) || turn.seq < 0 || turn.seq >= INTERVIEW_LIMITS.turnsPerSession) throw invalid();
    if (!SPEAKERS.has(turn.speaker)) throw invalid();
    if (typeof turn.text !== "string" || turn.text.length > INTERVIEW_LIMITS.turnChars) throw invalid();
    if (!Number.isInteger(turn.offsetMs) || turn.offsetMs < 0) throw invalid();
    return {
      seq: turn.seq,
      speaker: turn.speaker,
      text: sanitizeInput(turn.text),
      interrupted: turn.interrupted === true,
      partial: turn.partial === true,
      offsetMs: turn.offsetMs,
    };
  });
}

export function normalizeEndRequest(body) {
  if (!isRecord(body)) throw invalid();
  if (!END_REASONS.has(body.reason)) throw invalid();
  const usage = body.clientReportedUsage;
  const clientReportedUsage = isRecord(usage) && JSON.stringify(usage).length <= 4000 ? usage : null;
  return { reason: body.reason, clientReportedUsage };
}

async function loadOwnedSession(db, { sessionId, userId }) {
  const session = await db.interviewSession.findFirst({ where: { id: sessionId, userId }, select: SESSION_SELECT });
  if (!session) throw new ApiError("NOT_FOUND", 404);
  return session;
}

function noStore(res) {
  res.setHeader?.("Cache-Control", "no-store");
}

/** 세션 생성·목록. */
export function createInterviewSessionsHandler({
  db = prisma,
  requireUser = requireActiveApplicationUser,
  getSummary = getEntitlementSummary,
  reserve = reserveAnalysis,
  consumeRateLimit = consumeUserRateLimit,
  expireStale = expireStaleInterviewSessions,
  loadSource = loadInterviewSource,
  now = () => new Date(),
} = {}) {
  return async function interviewSessionsHandler(req, res) {
    return withApiHandler(req, res, async (requestId) => {
      const { applicationUser } = await requireUser(req, db);
      const userId = applicationUser.id;
      await expireStale({ db, userId, now: now() });

      if (req.method === "GET") {
        const analysisId = req.query?.analysisId;
        if (analysisId !== undefined && (typeof analysisId !== "string" || !UUID_PATTERN.test(analysisId))) throw invalid();
        const sessions = await db.interviewSession.findMany({
          where: { userId, ...(analysisId ? { analysisId } : {}) },
          orderBy: { createdAt: "desc" },
          take: INTERVIEW_LIMITS.listTake,
          select: SESSION_SELECT,
        });
        return sendJson(res, 200, { sessions: sessions.map((session) => sessionView(session)) }, requestId);
      }
      if (req.method !== "POST") throw new ApiError("METHOD_NOT_ALLOWED", 405);

      const idempotencyKey = header(req, "Idempotency-Key");
      if (typeof idempotencyKey !== "string" || !IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey)) throw new ApiError("INVALID_IDEMPOTENCY_KEY", 400);
      const request = normalizeCreateRequest(req.body);
      // 소유권은 일하기 전에 확인한다. 리포트가 없으면 이용권을 예약하지 않는다.
      await loadSource(db, { analysisId: request.analysisId, userId });

      let allocation;
      try {
        allocation = await allocateInterviewSession({
          db,
          userId,
          analysisId: request.analysisId,
          idempotencyKey,
          mode: request.mode,
          consentVersion: request.consentVersion,
          liveModel: LIVE_MODEL,
          promptVersion: INTERVIEW_PROMPT_VERSION,
          getSummary,
          reserve,
          consumeRateLimit,
          policy: USER_RATE_LIMITS.interviewSession,
          now: now(),
        });
      } catch (error) {
        if (error instanceof InterviewConcurrencyLimitError) throw new ApiError("INTERVIEW_IN_PROGRESS", 409);
        if (error?.code === "INTERVIEW_CREDITS_EXHAUSTED") throw new ApiError("INTERVIEW_CREDITS_EXHAUSTED", 409);
        if (error?.code === "P2002") throw new ApiError("INTERVIEW_IN_PROGRESS", 409);
        throw error;
      }

      if (allocation.type === "conflict") throw new ApiError("IDEMPOTENCY_KEY_REUSED", 409);
      if (allocation.type === "disabled") throw new ApiError("INTERVIEW_DISABLED", 503);
      if (allocation.type === "exhausted") throw new ApiError("INTERVIEW_CREDITS_EXHAUSTED", 409);
      if (allocation.type === "rate_limited") return sendRateLimited(res, allocation.rate, requestId);

      if (allocation.type === "created") {
        await recordAuditEvent({ actorId: userId, db, outcome: "CREATED", requestId, targetId: allocation.session.id, targetType: "interview_session" });
      }
      const session = await loadOwnedSession(db, { sessionId: allocation.session.id, userId });
      return sendJson(res, allocation.type === "stored" ? 200 : 201, { session: sessionView(session) }, requestId);
    });
  };
}

/** 세션 상세와 하위 동작(token·turns·end). query.sessionId 와 query.action 은 라우터가 채운다. */
export function createInterviewSessionDetailHandler({
  db = prisma,
  requireUser = requireActiveApplicationUser,
  expireStale = expireStaleInterviewSessions,
  loadSource = loadInterviewSource,
  issueToken = issueLiveToken,
  apiKey = readLiveApiKey,
  consumeRateLimit = consumeUserRateLimit,
  now = () => new Date(),
} = {}) {
  return async function interviewSessionDetailHandler(req, res) {
    return withApiHandler(req, res, async (requestId) => {
      const { applicationUser } = await requireUser(req, db);
      const userId = applicationUser.id;
      const sessionId = sessionIdOf(req);
      const action = req.query?.action ?? null;
      await expireStale({ db, userId, now: now() });

      if (action === null) {
        if (req.method !== "GET") throw new ApiError("METHOD_NOT_ALLOWED", 405);
        const session = await loadOwnedSession(db, { sessionId, userId });
        const turns = await db.interviewTurn.findMany({ where: { sessionId }, orderBy: { seq: "asc" } });
        noStore(res);
        return sendJson(res, 200, { session: sessionView(session, turns) }, requestId);
      }
      if (req.method !== "POST") throw new ApiError("METHOD_NOT_ALLOWED", 405);

      if (action === "token") {
        const session = await loadOwnedSession(db, { sessionId, userId });
        // 스위치는 생성 때만이 아니라 입장권마다 본다. 사고 때 관리자가 끄면 진행 중인 세션도 더는 연결하지 못한다.
        if (!(await isInterviewEnabled(db))) throw new ApiError("INTERVIEW_DISABLED", 503);
        const source = await loadSource(db, { analysisId: session.analysisId, userId });
        const claim = await db.$transaction(async (tx) => {
          const rate = await consumeRateLimit(tx, { userId, policy: USER_RATE_LIMITS.interviewToken, now: now() });
          if (!rate.allowed) return { ok: false, code: "RATE_LIMITED", rate };
          return claimTokenIssue(tx, sessionId, now());
        });
        if (!claim.ok) {
          if (claim.code === "RATE_LIMITED") return sendRateLimited(res, claim.rate, requestId);
          if (claim.code === "NOT_FOUND") throw new ApiError("NOT_FOUND", 404);
          throw new ApiError(claim.code, claim.code === "INTERVIEW_CAPACITY" ? 503 : 409);
        }

        const config = buildLiveSessionConfig({
          systemInstruction: buildInterviewerInstruction({ ...source, mode: session.mode }),
          // 브라우저가 같은 규칙으로 고른 사진과 목소리를 맞춘다.
          voiceName: pickInterviewer(sessionId).voice,
        });
        let token;
        try {
          ({ token } = await issueToken({ apiKey: apiKey(), config, expireAt: claim.expireAt, newSessionExpireAt: claim.newSessionExpireAt, model: session.liveModel }));
        } catch (error) {
          await releaseTokenIssue(db, sessionId);
          // 토큰 응답 본문은 로그에 남기지 않는다. 코드만 전달한다.
          throw new ApiError(error?.code === "LIVE_API_KEY_MISSING" ? "INTERVIEW_DISABLED" : "INTERVIEW_TOKEN_FAILED", error?.code === "LIVE_API_KEY_MISSING" ? 503 : 502);
        }
        if (claim.first) {
          await recordAuditEvent({ actorId: userId, db, outcome: "STARTED", requestId, targetId: sessionId, targetType: "interview_session" });
        }
        noStore(res);
        return sendJson(res, 200, {
          socket_url: liveSocketUrl(token),
          model: session.liveModel,
          expires_at: claim.expireAt.toISOString(),
          hard_deadline_at: claim.session.hardDeadlineAt.toISOString(),
          token_issue_count: claim.session.tokenIssueCount,
        }, requestId);
      }

      if (action === "turns") {
        const turns = normalizeTurns(req.body);
        const session = await loadOwnedSession(db, { sessionId, userId });
        if (!["ACTIVE", "ENDED", "INTERRUPTED"].includes(session.status) || session.feedbackStatus !== "NONE") {
          throw new ApiError("INTERVIEW_NOT_OPEN", 409);
        }
        const saved = await db.$transaction(async (tx) => {
          const existing = await tx.interviewTurn.aggregate({ where: { sessionId }, _count: { _all: true } });
          const existingChars = await tx.interviewTurn.findMany({ where: { sessionId }, select: { text: true } });
          const used = existingChars.reduce((sum, turn) => sum + turn.text.length, 0);
          const incoming = turns.reduce((sum, turn) => sum + turn.text.length, 0);
          if (existing._count._all + turns.length > INTERVIEW_LIMITS.turnsPerSession || used + incoming > INTERVIEW_LIMITS.sessionChars) {
            throw new ApiError("INTERVIEW_TRANSCRIPT_TOO_LONG", 413);
          }
          let count = 0;
          for (const turn of turns) {
            // 같은 (세션, 순번) 은 한 번만 저장한다. 다시 보낸 글이 더 완전하면(partial → 확정) 덮어쓴다.
            await tx.interviewTurn.upsert({
              where: { sessionId_seq: { sessionId, seq: turn.seq } },
              create: { sessionId, ...turn },
              update: turn.partial ? {} : turn,
            });
            count += 1;
          }
          return count;
        });
        return sendJson(res, 200, { saved }, requestId);
      }

      if (action === "end") {
        const request = normalizeEndRequest(req.body);
        await loadOwnedSession(db, { sessionId, userId });
        const result = await db.$transaction(async (tx) => endInterviewSession(tx, sessionId, { ...request, now: now() }));
        await recordAuditEvent({
          actorId: userId,
          db,
          outcome: result.refunded ? "ENDED_REFUNDED" : "ENDED",
          requestId,
          targetId: sessionId,
          targetType: "interview_session",
        });
        const session = await loadOwnedSession(db, { sessionId, userId });
        return sendJson(res, 200, { session: sessionView(session), refunded: result.refunded }, requestId);
      }

      throw new ApiError("NOT_FOUND", 404);
    });
  };
}
