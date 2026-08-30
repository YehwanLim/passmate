import { ApiError, sendError, sendJson, withApiHandler } from "./api-handler.js";
import { requireActiveApplicationUser } from "./auth.js";
import { consumeUserRateLimit } from "./rate-limit.js";
import prisma from "./prisma.js";

// 문항 분리는 크레딧을 쓰지 않는 편의 기능이라 레이트리밋만으로 비용을 통제한다.
export const RESUME_SPLIT_RATE_LIMIT = Object.freeze({
  route: "analyze-split",
  limit: 10,
  windowMs: 15 * 60 * 1000,
});

// 원문 자소서는 문항 텍스트가 포함돼 분석 상한(6,000자)보다 넉넉히 받는다.
const MIN_TEXT_CHARS = 200;
const MAX_TEXT_CHARS = 20000;
const MAX_PAIRS = 5;
const MAX_QUESTION_CHARS = 300;
const SPLIT_MODEL = "gemini-2.5-flash-lite";
const SPLIT_TIMEOUT_MS = 30000;

const SPLIT_INSTRUCTIONS = [
  "다음은 자기소개서 문서에서 추출한 원문 텍스트다.",
  "문서를 문항(질문)과 답변 쌍으로 나눠라.",
  "규칙:",
  "- 원문에 있는 문장을 그대로 보존하고, 내용을 창작하거나 요약하지 않는다.",
  "- 번호나 머리글은 question에서 제거한다.",
  "- 문항 구분이 없으면 전체를 하나의 답변으로 두고 question은 빈 문자열로 둔다.",
  `- 쌍은 최대 ${MAX_PAIRS}개, question은 ${MAX_QUESTION_CHARS}자 이내.`,
  '- JSON으로만 응답한다: {"questions":[{"question":"...","answer":"..."}]}',
].join("\n");

/** 모델 출력(형태 미보장)을 최대 5쌍의 {question, answer}로 다듬는다. 쓸 수 없으면 null. */
export function normalizeSplitOutput(output) {
  const rawPairs = Array.isArray(output)
    ? output
    : Array.isArray(output?.questions)
      ? output.questions
      : null;
  if (!rawPairs) return null;

  const pairs = rawPairs
    .filter(
      (pair) =>
        pair !== null &&
        typeof pair === "object" &&
        typeof pair.question === "string" &&
        typeof pair.answer === "string",
    )
    .map((pair) => ({
      question: pair.question.trim().slice(0, MAX_QUESTION_CHARS),
      answer: pair.answer.trim(),
    }))
    .filter((pair) => pair.answer.length > 0)
    .slice(0, MAX_PAIRS);

  return pairs.length > 0 ? pairs : null;
}

async function callGeminiSplit(text) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY missing");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SPLIT_TIMEOUT_MS);
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${SPLIT_MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: `${SPLIT_INSTRUCTIONS}\n\n---\n${text}` }] }],
          generationConfig: { responseMimeType: "application/json" },
        }),
        signal: controller.signal,
      },
    );
    if (!response.ok) throw new Error(`Model request failed: ${response.status}`);
    const data = await response.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) throw new Error("Empty model response");
    return JSON.parse(rawText);
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeRequest(body) {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    throw new ApiError("INVALID_REQUEST", 400);
  }
  if (!Object.keys(body).every((key) => key === "text") || typeof body.text !== "string") {
    throw new ApiError("INVALID_REQUEST", 400);
  }
  const text = body.text.trim();
  if (text.length < MIN_TEXT_CHARS || text.length > MAX_TEXT_CHARS) {
    throw new ApiError("INVALID_REQUEST", 400);
  }
  return text;
}

export function createResumeSplitHandler({
  callModel = callGeminiSplit,
  consumeRateLimit = consumeUserRateLimit,
  db = prisma,
  requireUser = requireActiveApplicationUser,
} = {}) {
  return async function resumeSplitHandler(req, res) {
    return withApiHandler(req, res, async (requestId) => {
      if (req.method !== "POST") {
        return sendError(res, 405, "METHOD_NOT_ALLOWED", requestId);
      }

      const { applicationUser } = await requireUser(req, db);
      const text = normalizeRequest(req.body);

      const rate = await consumeRateLimit(db, {
        userId: applicationUser.id,
        policy: RESUME_SPLIT_RATE_LIMIT,
      });
      if (!rate.allowed) {
        res.setHeader?.("Retry-After", String(rate.retryAfterSeconds));
        return sendError(res, 429, "RATE_LIMITED", requestId);
      }

      let questions;
      try {
        questions = normalizeSplitOutput(await callModel(text));
      } catch {
        // 자소서 본문은 로그에 남기지 않는다.
        throw new ApiError("SPLIT_FAILED", 502);
      }
      if (!questions) {
        throw new ApiError("SPLIT_FAILED", 502);
      }

      return sendJson(res, 200, { questions }, requestId);
    });
  };
}
