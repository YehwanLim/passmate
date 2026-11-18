// AI 모의 면접 서버 API. 응답 필드명은 서버(lib/interview/interview-sessions.js)와 맞춘다.
import { getAuthorizationHeader } from "@/lib/apiAuth";

export const INTERVIEW_CONSENT_VERSION = "interview-consent-2026-11-09";
export type InterviewMode = "FULL" | "SHORT";
export type InterviewSessionStatus = "CREATED" | "ACTIVE" | "ENDED" | "INTERRUPTED" | "CANCELLED";
export type InterviewFeedbackStatus = "NONE" | "PENDING" | "CALLING" | "SUCCEEDED" | "FAILED";

export type InterviewTurnPayload = {
  seq: number;
  speaker: "CANDIDATE" | "INTERVIEWER";
  text: string;
  interrupted: boolean;
  partial: boolean;
  offsetMs: number;
};

export type InterviewFeedback = {
  summary: string;
  answers: Array<{ question: string; whatWorked: string; whatToImprove: string; nextAttempt: string; evidenceTurnSeqs: number[] }>;
  delivery: { available: boolean; photoCount: number; items: Array<{ category: "GAZE" | "POSTURE" | "FRAMING"; observation: string; suggestion: string; supportingPhotoCount: number }> };
  disclaimer: string;
};

export type InterviewSession = {
  id: string;
  analysisId: string;
  mode: InterviewMode;
  status: InterviewSessionStatus;
  company: string | null;
  jobRole: string | null;
  firstTokenAt: string | null;
  hardDeadlineAt: string | null;
  tokenIssueCount: number;
  endedAt: string | null;
  endReason: string | null;
  createdAt: string;
  feedbackStatus: InterviewFeedbackStatus;
  feedback: InterviewFeedback | null;
  /** 피드백 생성을 시도한 횟수. 상한(3)에 닿으면 다시 요청할 수 없다. */
  feedbackAttempts: number;
  feedbackHadVideo: boolean;
  turns?: InterviewTurnPayload[];
};

export type InterviewToken = { socketUrl: string; model: string; expiresAt: string; hardDeadlineAt: string; tokenIssueCount: number };

export class InterviewApiError extends Error {
  code: string;
  status: number;
  constructor(code: string, status: number) {
    super(code);
    this.name = "InterviewApiError";
    this.code = code;
    this.status = status;
  }
}

const BASE = "/api/account/interview-sessions";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function parseSession(raw: unknown): InterviewSession {
  if (!isRecord(raw) || typeof raw.id !== "string") throw new InterviewApiError("PARSE_ERROR", 0);
  const turns = Array.isArray(raw.turns)
    ? raw.turns.filter(isRecord).map((turn) => ({
        seq: Number(turn.seq),
        speaker: turn.speaker === "INTERVIEWER" ? "INTERVIEWER" as const : "CANDIDATE" as const,
        text: String(turn.text ?? ""),
        interrupted: turn.interrupted === true,
        partial: turn.partial === true,
        offsetMs: Number(turn.offset_ms ?? 0),
      }))
    : undefined;
  return {
    id: raw.id,
    analysisId: String(raw.analysis_id ?? ""),
    mode: raw.mode === "SHORT" ? "SHORT" : "FULL",
    status: String(raw.status ?? "CREATED") as InterviewSessionStatus,
    company: typeof raw.company === "string" ? raw.company : null,
    jobRole: typeof raw.job_role === "string" ? raw.job_role : null,
    firstTokenAt: typeof raw.first_token_at === "string" ? raw.first_token_at : null,
    hardDeadlineAt: typeof raw.hard_deadline_at === "string" ? raw.hard_deadline_at : null,
    tokenIssueCount: Number(raw.token_issue_count ?? 0),
    endedAt: typeof raw.ended_at === "string" ? raw.ended_at : null,
    endReason: typeof raw.end_reason === "string" ? raw.end_reason : null,
    createdAt: String(raw.created_at ?? ""),
    feedbackStatus: String(raw.feedback_status ?? "NONE") as InterviewFeedbackStatus,
    feedback: isRecord(raw.feedback) ? (raw.feedback as unknown as InterviewFeedback) : null,
    feedbackAttempts: Number(raw.feedback_attempts ?? 0),
    feedbackHadVideo: raw.feedback_had_video === true,
    ...(turns ? { turns } : {}),
  };
}

async function call(path: string, init: RequestInit & { keepalive?: boolean } = {}, authHeader?: { Authorization: string }): Promise<unknown> {
  const auth = authHeader ?? (await getAuthorizationHeader());
  const response = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...auth, ...(init.headers ?? {}) },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const code = isRecord(payload) && typeof payload.error === "string" ? payload.error : `HTTP_${response.status}`;
    throw new InterviewApiError(code, response.status);
  }
  return payload;
}

export function newIdempotencyKey(): string {
  return `interview-${crypto.randomUUID()}`;
}

/** 리포트 없이 시작할 때 보내는 재료. 길이 범위는 서버(INTERVIEW_DIRECT_LIMITS)와 같다. */
export type InterviewDirectSource = { company: string; jobRole: string; coverLetter: string };
export const INTERVIEW_DIRECT_LIMITS = { companyMax: 100, jobRoleMax: 100, coverLetterMin: 200, coverLetterMax: 6000 } as const;

export async function createInterviewSession({
  analysisId,
  direct,
  mode,
  idempotencyKey,
}: { analysisId?: string; direct?: InterviewDirectSource; mode: InterviewMode; idempotencyKey: string }) {
  const source = analysisId ? { analysisId } : direct ? { company: direct.company, jobRole: direct.jobRole, coverLetter: direct.coverLetter } : {};
  const payload = await call(BASE, {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
    body: JSON.stringify({ ...source, mode, consentVersion: INTERVIEW_CONSENT_VERSION }),
  });
  return parseSession(isRecord(payload) ? payload.session : null);
}

export async function listInterviewSessions(analysisId?: string): Promise<InterviewSession[]> {
  const payload = await call(`${BASE}${analysisId ? `?analysisId=${encodeURIComponent(analysisId)}` : ""}`, { method: "GET" });
  const sessions = isRecord(payload) && Array.isArray(payload.sessions) ? payload.sessions : [];
  return sessions.map(parseSession);
}

export async function getInterviewSession(sessionId: string): Promise<InterviewSession> {
  const payload = await call(`${BASE}/${encodeURIComponent(sessionId)}`, { method: "GET", cache: "no-store" });
  return parseSession(isRecord(payload) ? payload.session : null);
}

export async function issueInterviewToken(sessionId: string): Promise<InterviewToken> {
  const payload = await call(`${BASE}/${encodeURIComponent(sessionId)}/token`, { method: "POST", body: "{}" });
  if (!isRecord(payload) || typeof payload.socket_url !== "string") throw new InterviewApiError("PARSE_ERROR", 0);
  return {
    socketUrl: payload.socket_url,
    model: String(payload.model ?? ""),
    expiresAt: String(payload.expires_at ?? ""),
    hardDeadlineAt: String(payload.hard_deadline_at ?? ""),
    tokenIssueCount: Number(payload.token_issue_count ?? 0),
  };
}

/**
 * 대화 글 저장. 탭이 닫히는 순간(pagehide)에는 세션 읽기가 끝나지 않을 수 있어 미리 받아 둔 인증 헤더를 쓰고 keepalive 로 보낸다.
 */
export async function saveInterviewTurns(sessionId: string, turns: InterviewTurnPayload[], options: { authHeader?: { Authorization: string }; keepalive?: boolean } = {}) {
  await call(`${BASE}/${encodeURIComponent(sessionId)}/turns`, { method: "POST", body: JSON.stringify({ turns }), keepalive: options.keepalive }, options.authHeader);
}

export type InterviewEndReason = "user-stop" | "time-up" | "error" | "closed" | "reconnect-failed";

export async function endInterviewSession(sessionId: string, reason: InterviewEndReason, clientReportedUsage: Record<string, unknown> | null, options: { authHeader?: { Authorization: string }; keepalive?: boolean } = {}) {
  const payload = await call(`${BASE}/${encodeURIComponent(sessionId)}/end`, { method: "POST", body: JSON.stringify({ reason, clientReportedUsage }), keepalive: options.keepalive }, options.authHeader);
  return { session: parseSession(isRecord(payload) ? payload.session : null), refunded: isRecord(payload) && payload.refunded === true };
}

export async function requestInterviewFeedback(sessionId: string, photos: string[]): Promise<InterviewFeedbackStatus> {
  const payload = await call("/api/analyze/interview-feedback", { method: "POST", body: JSON.stringify({ sessionId, photos }) });
  return isRecord(payload) && typeof payload.feedback_status === "string" ? (payload.feedback_status as InterviewFeedbackStatus) : "PENDING";
}
