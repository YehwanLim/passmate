// 면접 뒤 피드백. 대화 글은 서버 DB 에서 읽고 브라우저는 사진만 보낸다. 사진은 저장하지 않는다.
// 202 로 접수한 뒤 배경에서 모델을 부르고, 성공하면 이용권을 확정한다.
// 실패 셈법: 모델·서버 장애(5xx·시간 초과·망가진 응답)로 3번 실패하면 돌려준다. 사진이 거절되면 같은 시도 안에서 사진 없이 한 번 더 부른다.
// 결과에 쓸 내용이 없는 것(금지 표현만 돌아옴)은 장애가 아니라 실패로만 세고 돌려주지 않는다 — 대화 글에 금지어를 섞어 환불을 유도하는 길을 막는다.
// 말하는 범위: 답변의 구조·근거, 시선·자세·구도처럼 보이는 행동. 표정·감정·점수는 코드로도 걸러 낸다.

import { ApiError, sendError, sendJson, sendRateLimited, withApiHandler } from "../api-handler.js";
import { recordAuditEvent } from "../audit-log.js";
import { requireActiveApplicationUser } from "../auth.js";
import { cancelAnalysisReservation, finalizeAnalysisReservation } from "../billing/analysis-entitlements.js";
import { callGeminiGenerate, firstCandidateText, parseModelJsonTolerant } from "../analysis/model-client.js";
import prisma from "../prisma.js";
import { USER_RATE_LIMITS, consumeUserRateLimit } from "../rate-limit.js";
import { isRecord } from "../sanitize.js";
import { FEEDBACK_DELIVERY_CATEGORIES, buildFeedbackPrompt } from "../../shared/prompts/interviewPrompt.js";
import { INTERVIEW_RULES } from "./interview-lifecycle.js";
import { interviewMaterialFromReport } from "./interview-sessions.js";
import { isInterviewEnabled } from "./interview-switch.js";
import { readLiveApiKey } from "./live-token.js";

export const FEEDBACK_MODEL = "gemini-3.8-flash";
export const FEEDBACK_TIMEOUT_MS = 120_000;
export const PHOTO_LIMITS = Object.freeze({ count: 12, totalBytes: 2 * 1024 * 1024, eachBytes: 400 * 1024, minSupporting: 3 });
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BASE64_PATTERN = /^[A-Za-z0-9+/]+=*$/;
/** JPEG 는 FF D8 FF 로 시작하고, base64 로는 "/9j/" 다. 브라우저가 canvas.toDataURL("image/jpeg") 로 만든 사진만 받는다. */
const JPEG_BASE64_PREFIX = "/9j/";
// 외모·감정·점수·합격 판단 표현. 프롬프트가 아니라 여기(후처리)에만 둔다 — 프롬프트에 적으면 모델이 베낀다.
// 지원자 말을 인용한 숫자("전환율 15%", "4.0점")나 "성격" 같은 일상어는 잡지 않는다 — 정상 피드백이 통째로 버려졌다(11-05 점검).
const FORBIDDEN_PATTERN = /(외모|옷차림|잘생|예쁘|뚱뚱|날씬|나이가 많|나이가 어|성별|장애가|우울해|불안해 보|자신감이 없어|자신감 있어 보|긴장한 듯|긴장해 보|소심해|내향적|외향적|합격 가능|합격할 수|불합격|떨어질 것|점수를 매기|점수는|\d+\s*점 만점|등급은)/;

export function normalizeFeedbackRequest(body) {
  if (!isRecord(body)) throw new ApiError("INVALID_REQUEST", 400);
  if (typeof body.sessionId !== "string" || !UUID_PATTERN.test(body.sessionId)) throw new ApiError("INVALID_REQUEST", 400);
  const photos = body.photos ?? [];
  if (!Array.isArray(photos) || photos.length > PHOTO_LIMITS.count) throw new ApiError("INVALID_REQUEST", 400);
  let total = 0;
  for (const photo of photos) {
    if (typeof photo !== "string" || !photo.startsWith(JPEG_BASE64_PREFIX) || !BASE64_PATTERN.test(photo)) throw new ApiError("INVALID_REQUEST", 400);
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
        .filter((answer) => [answer.question, answer.whatWorked, answer.whatToImprove, answer.nextAttempt].every((text) => text === "" || allowed(text)))
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
  // 입장권과 같은 키(운영에서는 전용 키만). 면접 비용을 분석 비용과 분리해 본다.
  const apiKey = readLiveApiKey();
  if (!apiKey) throw new Error("INTERVIEW_GEMINI_API_KEY missing");
  const parts = [{ text: prompt }, ...photos.map((data) => ({ inlineData: { mimeType: "image/jpeg", data } }))];
  const { data } = await callGeminiGenerate({
    apiKey,
    modelName: FEEDBACK_MODEL,
    timeoutMs: FEEDBACK_TIMEOUT_MS,
    body: { contents: [{ role: "user", parts }], generationConfig: { responseMimeType: "application/json" } },
  });
  return parseModelJsonTolerant(firstCandidateText(data));
}

/** 제공자가 요청 자체를 거절한 것(4xx). 사진이 들어 있었다면 사진 탓으로 보고 사진 없이 다시 부른다. */
function isRequestRejected(error) {
  const status = error?.statusCode;
  return Number.isInteger(status) && status >= 400 && status < 500 && status !== 429;
}

/**
 * 모델을 부르고 결과를 분류한다.
 * @returns {Promise<{ outcome: "ok", feedback, hadVideo: boolean } | { outcome: "error" } | { outcome: "unusable" }>}
 */
async function generateFeedback({ callModel, basePrompt, photos }) {
  let activePhotos = photos;
  for (;;) {
    try {
      const prompt = basePrompt(activePhotos.length);
      const feedback = sanitizeFeedback(await callModel({ prompt, photos: activePhotos }), { photoCount: activePhotos.length });
      if (!feedback) return { outcome: "unusable" };
      return { outcome: "ok", feedback, hadVideo: activePhotos.length > 0 };
    } catch (error) {
      if (activePhotos.length > 0 && isRequestRejected(error)) {
        activePhotos = [];
        continue;
      }
      return { outcome: "error" };
    }
  }
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

  // 접수(PENDING)를 내가 가져간 경우에만 부른다. 같은 세션의 두 함수가 모델을 두 번 부르지 않는다.
  const { count: calling } = await db.interviewSession.updateMany({ where: { id: sessionId, feedbackStatus: "PENDING" }, data: { feedbackStatus: "CALLING" } });
  if (calling === 0) return;

  let result;
  try {
    const { questions } = interviewMaterialFromReport(session.analysis.aiResponseJson);
    const basePrompt = (photoCount) => buildFeedbackPrompt({
      company: session.analysis.project?.company,
      jobRole: session.analysis.project?.jobKeyword,
      transcript: session.turns,
      photoCount,
      questions,
    });
    result = await generateFeedback({ callModel, basePrompt, photos });
  } catch {
    result = { outcome: "error" };
  }

  await db.$transaction(async (tx) => {
    if (result.outcome === "ok") {
      const { count } = await tx.interviewSession.updateMany({
        where: { id: sessionId, feedbackStatus: "CALLING" },
        data: { feedbackStatus: "SUCCEEDED", feedbackJson: result.feedback, feedbackHadVideo: result.hadVideo, feedbackModel: FEEDBACK_MODEL, feedbackAttempts: { increment: 1 } },
      });
      if (count > 0 && session.reservationId) await finalizeAnalysisReservation(tx, session.reservationId, userId);
      return;
    }
    const attempts = session.feedbackAttempts + 1;
    // 실패 종류를 남긴다. 24시간 뒤 정리 작업이 장애(error)만 돌려주고 내용 없음(unusable)은 확정하는 근거다. 화면에는 SUCCEEDED 일 때만 내려간다.
    const { count } = await tx.interviewSession.updateMany({
      where: { id: sessionId, feedbackStatus: "CALLING" },
      data: { feedbackStatus: "FAILED", feedbackAttempts: attempts, feedbackJson: { failure: result.outcome } },
    });
    if (count === 0 || attempts < INTERVIEW_RULES.feedbackMaxAttempts || !session.reservationId) return;
    // 마지막 시도까지: 장애였으면 돌려주고, 내용이 없는 응답이었으면 이용권은 쓴 것으로 확정한다. 대화 글은 어느 쪽이든 남는다.
    if (result.outcome === "error") await cancelAnalysisReservation(tx, session.reservationId, userId);
    else await finalizeAnalysisReservation(tx, session.reservationId, userId);
  });
  await recordAuditEvent({
    actorId: userId,
    db,
    outcome: result.outcome === "ok" ? "FEEDBACK_SUCCEEDED" : result.outcome === "error" ? "FEEDBACK_FAILED" : "FEEDBACK_UNUSABLE",
    requestId,
    targetId: sessionId,
    targetType: "interview_session",
  });
}

/** POST /api/analyze?interview_feedback=1 — 접수 뒤 202. 업로드만 끝나면 탭을 닫아도 진행된다. */
export function createInterviewFeedbackHandler({
  db = prisma,
  requireUser = requireActiveApplicationUser,
  callModel = callGeminiFeedback,
  consumeRateLimit = consumeUserRateLimit,
  enqueueBackgroundWork = (work) => work(),
  now = () => new Date(),
} = {}) {
  return async function interviewFeedbackHandler(req, res) {
    return withApiHandler(req, res, async (requestId) => {
      if (req.method !== "POST") return sendError(res, 405, "METHOD_NOT_ALLOWED", requestId);
      const { applicationUser } = await requireUser(req, db);
      const userId = applicationUser.id;
      const { sessionId, photos } = normalizeFeedbackRequest(req.body);
      if (!(await isInterviewEnabled(db))) throw new ApiError("INTERVIEW_DISABLED", 503);

      const claimed = await db.$transaction(async (tx) => {
        const session = await tx.interviewSession.findFirst({ where: { id: sessionId, userId } });
        if (!session) throw new ApiError("NOT_FOUND", 404);
        if (!["ENDED", "INTERRUPTED"].includes(session.status)) throw new ApiError("INTERVIEW_NOT_ENDED", 409);
        if (session.feedbackStatus === "SUCCEEDED") return { type: "done" };
        if (session.feedbackStatus === "PENDING" || session.feedbackStatus === "CALLING") return { type: "running" };
        if (session.feedbackAttempts >= INTERVIEW_RULES.feedbackMaxAttempts) throw new ApiError("INTERVIEW_FEEDBACK_EXHAUSTED", 409);
        const turns = await tx.interviewTurn.count({ where: { sessionId, speaker: "CANDIDATE" } });
        if (turns === 0) throw new ApiError("INTERVIEW_TRANSCRIPT_EMPTY", 422);
        const rate = await consumeRateLimit(tx, { userId, policy: USER_RATE_LIMITS.interviewFeedback, now: now() });
        if (!rate.allowed) return { type: "rate_limited", rate };
        // 상태 조건부 갱신으로 선점한다. 동시에 두 요청이 와도 모델은 한 번만 부른다.
        const { count } = await tx.interviewSession.updateMany({
          where: { id: sessionId, feedbackStatus: { in: ["NONE", "FAILED"] } },
          data: { feedbackStatus: "PENDING" },
        });
        return { type: count > 0 ? "claimed" : "running" };
      });

      if (claimed.type === "done") return sendJson(res, 200, { feedback_status: "SUCCEEDED" }, requestId);
      if (claimed.type === "running") return sendJson(res, 202, { feedback_status: "PENDING" }, requestId);
      if (claimed.type === "rate_limited") return sendRateLimited(res, claimed.rate, requestId);

      try {
        enqueueBackgroundWork(() => runInterviewFeedback({ db, sessionId, userId, photos, callModel, requestId, now }));
      } catch {
        await db.interviewSession.updateMany({ where: { id: sessionId, feedbackStatus: "PENDING" }, data: { feedbackStatus: "FAILED", feedbackAttempts: { increment: 1 }, feedbackJson: { failure: "error" } } });
        return sendError(res, 503, "INTERVIEW_FEEDBACK_FAILED", requestId);
      }
      return sendJson(res, 202, { feedback_status: "PENDING" }, requestId);
    });
  };
}
