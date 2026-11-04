// 면접 뒤 피드백. 대화 글은 서버 DB 에서 읽고 브라우저는 사진만 보낸다. 사진은 저장하지 않는다.
// 202 로 접수한 뒤 배경에서 모델을 부르고, 성공하면 이용권을 확정한다. 3번 실패하면 돌려준다.
// 말하는 범위: 답변의 구조·근거, 시선·자세·구도처럼 보이는 행동. 표정·감정·점수는 코드로도 걸러 낸다.

import { ApiError, sendError, sendJson, withApiHandler } from "../api-handler.js";
import { recordAuditEvent } from "../audit-log.js";
import { requireActiveApplicationUser } from "../auth.js";
import { cancelAnalysisReservation, finalizeAnalysisReservation } from "../billing/analysis-entitlements.js";
import { callGeminiGenerate, firstCandidateText, parseModelJsonTolerant } from "../analysis/model-client.js";
import prisma from "../prisma.js";
import { isRecord } from "../sanitize.js";
import { FEEDBACK_DELIVERY_CATEGORIES, buildFeedbackPrompt } from "../../shared/prompts/interviewPrompt.js";
import { INTERVIEW_RULES } from "./interview-lifecycle.js";
import { interviewMaterialFromReport } from "./interview-sessions.js";

export const FEEDBACK_MODEL = "gemini-3.8-flash";
export const FEEDBACK_TIMEOUT_MS = 120_000;
export const PHOTO_LIMITS = Object.freeze({ count: 12, totalBytes: 2 * 1024 * 1024, eachBytes: 400 * 1024, minSupporting: 3 });
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BASE64_PATTERN = /^[A-Za-z0-9+/]+=*$/;
// 외모·감정·점수 표현. 프롬프트가 아니라 여기(후처리)에만 둔다 — 프롬프트에 적으면 모델이 베낀다.
const FORBIDDEN_PATTERN = /(외모|옷차림|잘생|예쁘|뚱뚱|날씬|나이가|성별|장애|우울|불안해|자신감이 없|자신감 있|긴장한 듯|긴장해 보|소심|내향|외향|성격|합격 가능|불합격|떨어질|\d+\s*점|\d+\s*%|등급)/;

export function normalizeFeedbackRequest(body) {
  if (!isRecord(body)) throw new ApiError("INVALID_REQUEST", 400);
  if (typeof body.sessionId !== "string" || !UUID_PATTERN.test(body.sessionId)) throw new ApiError("INVALID_REQUEST", 400);
  const photos = body.photos ?? [];
  if (!Array.isArray(photos) || photos.length > PHOTO_LIMITS.count) throw new ApiError("INVALID_REQUEST", 400);
  let total = 0;
  for (const photo of photos) {
    if (typeof photo !== "string" || photo.length === 0 || !BASE64_PATTERN.test(photo)) throw new ApiError("INVALID_REQUEST", 400);
    const bytes = Math.floor((photo.length * 3) / 4);
    if (bytes > PHOTO_LIMITS.eachBytes) throw new ApiError("PAYLOAD_TOO_LARGE", 413);
    total += bytes;
  }
  if (total > PHOTO_LIMITS.totalBytes) throw new ApiError("PAYLOAD_TOO_LARGE", 413);
  return { sessionId: body.sessionId, photos };
}

function cleanText(value, max = 600) {
  if (typeof value !== "string") return "";
  const text = value.replace(/\*\*/g, "").trim();
  return text.length > max ? text.slice(0, max) : text;
}

function allowed(text) {
  return text.length > 0 && !FORBIDDEN_PATTERN.test(text);
}

/**
 * 모델 출력을 저장할 모양으로 다듬는다. 금지 표현이 든 항목은 전체 실패가 아니라 그 항목만 버린다.
 * 사진 3장 미만에서 보인 행동은 습관으로 단정하지 않으므로 뺀다.
 * @returns {object|null} 쓸 수 있는 내용이 없으면 null
 */
export function sanitizeFeedback(raw, { photoCount }) {
  if (!isRecord(raw)) return null;
  const summary = cleanText(raw.summary, 800);
  const answers = Array.isArray(raw.answers)
    ? raw.answers
        .filter(isRecord)
        .map((answer) => ({
          question: cleanText(answer.question, 300),
          whatWorked: cleanText(answer.whatWorked),
          whatToImprove: cleanText(answer.whatToImprove),
          nextAttempt: cleanText(answer.nextAttempt, 800),
          evidenceTurnSeqs: Array.isArray(answer.evidenceTurnSeqs) ? answer.evidenceTurnSeqs.filter((seq) => Number.isInteger(seq) && seq >= 0).slice(0, 10) : [],
        }))
        .filter((answer) => answer.question && (answer.whatToImprove || answer.whatWorked))
        .filter((answer) => [answer.whatWorked, answer.whatToImprove, answer.nextAttempt].every((text) => text === "" || allowed(text)))
        .slice(0, 10)
    : [];
  const items = photoCount > 0 && isRecord(raw.delivery) && Array.isArray(raw.delivery.items)
    ? raw.delivery.items
        .filter(isRecord)
        .map((item) => ({
          category: item.category,
          observation: cleanText(item.observation, 300),
          suggestion: cleanText(item.suggestion, 300),
          supportingPhotoCount: Number.isInteger(item.supportingPhotoCount) ? item.supportingPhotoCount : 0,
        }))
        .filter((item) => FEEDBACK_DELIVERY_CATEGORIES.includes(item.category))
        .filter((item) => item.supportingPhotoCount >= PHOTO_LIMITS.minSupporting && item.supportingPhotoCount <= photoCount)
        .filter((item) => allowed(item.observation) && allowed(item.suggestion))
        .slice(0, 3)
    : [];
  if (!allowed(summary) && answers.length === 0) return null;
  return {
    summary: allowed(summary) ? summary : "",
    answers,
    delivery: { available: photoCount > 0, photoCount, items },
    disclaimer: "자동 받아쓰기와 사진 몇 장을 바탕으로 쓴 글이라 실제와 다를 수 있어요.",
  };
}

async function callGeminiFeedback({ prompt, photos }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY missing");
  const parts = [{ text: prompt }, ...photos.map((data) => ({ inlineData: { mimeType: "image/jpeg", data } }))];
  const { data } = await callGeminiGenerate({
    apiKey,
    modelName: FEEDBACK_MODEL,
    timeoutMs: FEEDBACK_TIMEOUT_MS,
    body: { contents: [{ role: "user", parts }], generationConfig: { responseMimeType: "application/json" } },
  });
  return parseModelJsonTolerant(firstCandidateText(data));
}

/** 배경에서 돈다. 모델 응답·대화 글은 로그에 남기지 않는다. */
export async function runInterviewFeedback({ db, sessionId, userId, photos, callModel = callGeminiFeedback, requestId, now = () => new Date() }) {
  const session = await db.interviewSession.findFirst({
    where: { id: sessionId, userId },
    include: {
      turns: { orderBy: { seq: "asc" } },
      analysis: { select: { aiResponseJson: true, project: { select: { company: true, jobKeyword: true } } } },
    },
  });
  if (!session || session.feedbackStatus !== "PENDING") return;

  await db.interviewSession.update({ where: { id: sessionId }, data: { feedbackStatus: "CALLING" } });
  let feedback = null;
  try {
    const { questions } = interviewMaterialFromReport(session.analysis.aiResponseJson);
    const prompt = buildFeedbackPrompt({
      company: session.analysis.project?.company,
      jobRole: session.analysis.project?.jobKeyword,
      transcript: session.turns,
      photoCount: photos.length,
      questions,
    });
    feedback = sanitizeFeedback(await callModel({ prompt, photos }), { photoCount: photos.length });
  } catch {
    feedback = null;
  }

  await db.$transaction(async (tx) => {
    if (feedback) {
      await tx.interviewSession.update({
        where: { id: sessionId },
        data: { feedbackStatus: "SUCCEEDED", feedbackJson: feedback, feedbackHadVideo: photos.length > 0, feedbackModel: FEEDBACK_MODEL, feedbackAttempts: { increment: 1 } },
      });
      if (session.reservationId) await finalizeAnalysisReservation(tx, session.reservationId, userId);
      return;
    }
    const attempts = session.feedbackAttempts + 1;
    await tx.interviewSession.update({ where: { id: sessionId }, data: { feedbackStatus: "FAILED", feedbackAttempts: attempts } });
    // 마지막 시도까지 실패하면 돌려준다. 대화 글은 남겨 다시 볼 수 있게 한다.
    if (attempts >= INTERVIEW_RULES.feedbackMaxAttempts && session.reservationId) {
      await cancelAnalysisReservation(tx, session.reservationId, userId);
    }
  });
  await recordAuditEvent({ actorId: userId, db, outcome: feedback ? "FEEDBACK_SUCCEEDED" : "FEEDBACK_FAILED", requestId, targetId: sessionId, targetType: "interview_session" });
}

/** POST /api/analyze?interview_feedback=1 — 접수 뒤 202. 업로드만 끝나면 탭을 닫아도 진행된다. */
export function createInterviewFeedbackHandler({
  db = prisma,
  requireUser = requireActiveApplicationUser,
  callModel = callGeminiFeedback,
  enqueueBackgroundWork = (work) => work(),
  now = () => new Date(),
} = {}) {
  return async function interviewFeedbackHandler(req, res) {
    return withApiHandler(req, res, async (requestId) => {
      if (req.method !== "POST") return sendError(res, 405, "METHOD_NOT_ALLOWED", requestId);
      const { applicationUser } = await requireUser(req, db);
      const userId = applicationUser.id;
      const { sessionId, photos } = normalizeFeedbackRequest(req.body);

      const claimed = await db.$transaction(async (tx) => {
        const session = await tx.interviewSession.findFirst({ where: { id: sessionId, userId } });
        if (!session) throw new ApiError("NOT_FOUND", 404);
        if (!["ENDED", "INTERRUPTED"].includes(session.status)) throw new ApiError("INTERVIEW_NOT_ENDED", 409);
        if (session.feedbackStatus === "SUCCEEDED") return { type: "done" };
        if (session.feedbackStatus === "PENDING" || session.feedbackStatus === "CALLING") return { type: "running" };
        if (session.feedbackAttempts >= INTERVIEW_RULES.feedbackMaxAttempts) throw new ApiError("INTERVIEW_FEEDBACK_EXHAUSTED", 409);
        const turns = await tx.interviewTurn.count({ where: { sessionId, speaker: "CANDIDATE" } });
        if (turns === 0) throw new ApiError("INTERVIEW_TRANSCRIPT_EMPTY", 422);
        await tx.interviewSession.update({ where: { id: sessionId }, data: { feedbackStatus: "PENDING" } });
        return { type: "claimed" };
      });

      if (claimed.type === "done") return sendJson(res, 200, { feedback_status: "SUCCEEDED" }, requestId);
      if (claimed.type === "running") return sendJson(res, 202, { feedback_status: "PENDING" }, requestId);

      try {
        enqueueBackgroundWork(() => runInterviewFeedback({ db, sessionId, userId, photos, callModel, requestId, now }));
      } catch {
        await db.interviewSession.update({ where: { id: sessionId }, data: { feedbackStatus: "FAILED", feedbackAttempts: { increment: 1 } } });
        return sendError(res, 503, "INTERVIEW_FEEDBACK_FAILED", requestId);
      }
      return sendJson(res, 202, { feedback_status: "PENDING" }, requestId);
    });
  };
}
