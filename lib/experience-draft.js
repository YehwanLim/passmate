// 경험 → 자소서 초안 (POST /api/analyze?draft=1). 사용자가 적은 경험의 사실로만 쓴다.
// 모델 지시는 어겨질 수 있어 서버가 결과를 검사한다: 남의 경험 id 제거, 근거 없는 숫자 → [실제 수치].
// 경험 본문·문항·초안은 로그에 남기지 않는다.
import { buildDraftPrompt } from "../shared/prompts/draftPrompt.js";
import { ApiError, sendError, sendJson, sendRateLimited, withApiHandler } from "./api-handler.js";
import { MAX_PROMPT_CHARS } from "./application-drafts.js";
import { requireActiveApplicationUser } from "./auth.js";
import { callGeminiGenerate, firstCandidateText, parseModelJsonTolerant } from "./model-client.js";
import prisma from "./prisma.js";
import { USER_RATE_LIMITS, consumeUserRateLimit, refundUserRateLimit } from "./rate-limit.js";
import { isRecord, sanitizeInput } from "./sanitize.js";

export const BLANK_NUMBER = "[실제 수치]";
const MAX_SENTENCES = 30;
const MAX_SENTENCE_CHARS = 400;
const MAX_REASON_CHARS = 120;
const MAX_CHOSEN = 2;
const KINDS = new Set(["job", "experience", "plan"]);
const DRAFT_MODEL = "gemini-2.5-flash";
const DRAFT_TIMEOUT_MS = 60000;
const MAX_EXPERIENCES = 40;
const MAX_AVOID = 10;
const MAX_CHAR_LIMIT = 10000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// 숫자 + (선택) 단위. 1,200 / 30% / 3개월 / 2.5배. 공백은 단위가 붙을 때만 토큰에 넣는다.
const NUMBER_TOKEN = /\d[\d,]*(?:\.\d+)?(?:\s*(?:%|퍼센트|명|배|만\s*원|원|만|억|건|개월|개|회|시간|일|주|년|위|점))?/g;

// "09" 와 "9", "2.80" 과 "2.8" 을 같게 본다.
function canonical(core) {
  return String(Number(core));
}

// 근거 글에 있는 숫자. "2024.09" 처럼 점으로 쓴 날짜는 소수로도, 연·월로도 인정한다.
function numberCores(text) {
  const cores = new Set();
  for (const match of String(text ?? "").replace(/,/g, "").match(/\d+(?:\.\d+)?/g) ?? []) {
    cores.add(canonical(match));
    if (match.includes(".")) for (const part of match.split(".")) cores.add(canonical(part));
  }
  return cores;
}

function experienceText(exp) {
  return [exp.title, exp.period, exp.situation, exp.action, exp.result, ...(exp.tags ?? [])].join(" ");
}

function guardNumbers(text, allowed) {
  let replaced = 0;
  const next = text.replace(NUMBER_TOKEN, (token) => {
    const core = token.replace(/,/g, "").match(/\d+(?:\.\d+)?/)?.[0];
    if (core && allowed.has(canonical(core))) return token;
    replaced += 1;
    return BLANK_NUMBER;
  });
  return { text: next, replaced };
}

function cleanLine(value, max) {
  return typeof value === "string" ? sanitizeInput(value).replace(/\s+/g, " ").trim().slice(0, max) : "";
}

export function normalizeDraftOutput(output, { experiences, postingText }) {
  if (!isRecord(output)) return null;
  if (output.status === "needs_more") {
    const needMore = cleanLine(output.needMore, MAX_REASON_CHARS * 2);
    return needMore ? { status: "needs_more", needMore } : null;
  }
  if (output.status !== "ok" || !Array.isArray(output.sentences)) return null;

  const byId = new Map(experiences.map((exp) => [exp.id, exp]));
  const chosen = [];
  for (const item of Array.isArray(output.chosen) ? output.chosen : []) {
    if (!isRecord(item) || !byId.has(item.experienceId)) continue;
    if (chosen.some((c) => c.experienceId === item.experienceId)) continue;
    chosen.push({
      experienceId: item.experienceId,
      title: byId.get(item.experienceId).title,
      reason: cleanLine(item.reason, MAX_REASON_CHARS),
    });
    if (chosen.length >= MAX_CHOSEN) break;
  }

  const chosenText = chosen.map((c) => experienceText(byId.get(c.experienceId))).join(" ");
  const postingNumbers = numberCores(postingText);
  let replacedNumbers = 0;
  const sentences = [];
  for (const raw of output.sentences.slice(0, MAX_SENTENCES)) {
    if (!isRecord(raw)) continue;
    const text = cleanLine(raw.text, MAX_SENTENCE_CHARS);
    if (!text) continue;
    const kind = KINDS.has(raw.kind) ? raw.kind : "experience";
    const sourceIds = [...new Set((Array.isArray(raw.sourceIds) ? raw.sourceIds : []).filter((id) => byId.has(id)))];
    const allowed =
      kind === "experience"
        ? numberCores(sourceIds.length ? sourceIds.map((id) => experienceText(byId.get(id))).join(" ") : chosenText)
        : postingNumbers;
    const guarded = guardNumbers(text, allowed);
    replacedNumbers += guarded.replaced;
    sentences.push({ text: guarded.text, kind, sourceIds, unsourced: kind === "experience" && sourceIds.length === 0 });
  }
  if (sentences.length === 0) return null;

  let draftText = "";
  sentences.forEach((s, i) => {
    if (i > 0) draftText += sentences[i - 1].kind === s.kind ? " " : "\n\n";
    draftText += s.text;
  });
  return { status: "ok", chosen, sentences, draftText, charCount: draftText.length, replacedNumbers };
}

// 모델이 별칭을 "e1"·" E1 " 처럼 써도 "E1" 로 맞춘다. 나머지 검사는 normalizeDraftOutput 이 한다.
function canonicalAlias(value) {
  return typeof value === "string" ? value.trim().toUpperCase() : value;
}

function canonicalAliases(output) {
  if (!isRecord(output)) return output;
  return {
    ...output,
    chosen: Array.isArray(output.chosen)
      ? output.chosen.map((c) => (isRecord(c) ? { ...c, experienceId: canonicalAlias(c.experienceId) } : c))
      : output.chosen,
    sentences: Array.isArray(output.sentences)
      ? output.sentences.map((s) =>
          isRecord(s) && Array.isArray(s.sourceIds) ? { ...s, sourceIds: s.sourceIds.map(canonicalAlias) } : s,
        )
      : output.sentences,
  };
}

export function normalizeDraftRequest(body) {
  const invalid = () => new ApiError("INVALID_REQUEST", 400);
  if (!isRecord(body)) throw invalid();
  const allowed = new Set(["projectId", "prompt", "charLimit", "avoidExperienceIds"]);
  if (!Object.keys(body).every((key) => allowed.has(key))) throw invalid();
  if (typeof body.projectId !== "string" || !UUID_PATTERN.test(body.projectId)) throw invalid();
  if (typeof body.prompt !== "string" || body.prompt.length > MAX_PROMPT_CHARS) throw invalid();
  const prompt = sanitizeInput(body.prompt);
  if (!prompt) throw invalid();
  let charLimit = null;
  if (body.charLimit !== undefined && body.charLimit !== null) {
    if (!Number.isInteger(body.charLimit) || body.charLimit < 1 || body.charLimit > MAX_CHAR_LIMIT) throw invalid();
    charLimit = body.charLimit;
  }
  const avoid = body.avoidExperienceIds ?? [];
  if (!Array.isArray(avoid) || avoid.length > MAX_AVOID || !avoid.every((id) => typeof id === "string" && id.length <= 64)) {
    throw invalid();
  }
  return { projectId: body.projectId, prompt, charLimit, avoidExperienceIds: avoid };
}

async function callGeminiDraft(promptText) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY missing");
  const { data } = await callGeminiGenerate({
    apiKey,
    modelName: DRAFT_MODEL,
    timeoutMs: DRAFT_TIMEOUT_MS,
    body: {
      contents: [{ role: "user", parts: [{ text: promptText }] }],
      generationConfig: { responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 1024 } },
    },
  });
  return parseModelJsonTolerant(firstCandidateText(data));
}

export function createExperienceDraftHandler({
  callModel = callGeminiDraft,
  consumeRateLimit = consumeUserRateLimit,
  refundRateLimit = refundUserRateLimit,
  db = prisma,
  requireUser = requireActiveApplicationUser,
  now = () => new Date(),
} = {}) {
  return async function experienceDraftHandler(req, res) {
    return withApiHandler(req, res, async (requestId) => {
      if (req.method !== "POST") return sendError(res, 405, "METHOD_NOT_ALLOWED", requestId);

      const { applicationUser } = await requireUser(req, db);
      const userId = applicationUser.id;
      const request = normalizeDraftRequest(req.body);

      const project = await db.project.findFirst({
        where: { id: request.projectId, userId },
        select: {
          id: true,
          company: true,
          jobKeyword: true,
          jobPostingId: true,
          questions: { select: { draftExperienceIds: true } },
        },
      });
      if (!project) throw new ApiError("NOT_FOUND", 404);

      const experiences = await db.experience.findMany({
        where: { userId },
        orderBy: { updatedAt: "desc" },
        take: MAX_EXPERIENCES,
        select: { id: true, title: true, period: true, situation: true, action: true, result: true, tags: true },
      });
      if (experiences.length === 0) throw new ApiError("NO_EXPERIENCES", 422);

      const posting = project.jobPostingId
        ? await db.jobPosting.findFirst({
            where: { id: project.jobPostingId, userId },
            select: { rawText: true, summaryJson: true },
          })
        : null;

      // 모델에는 uuid 대신 짧은 별칭(E1, E2…)을 보인다. 긴 uuid 는 모델이 틀리게 베껴 출처가 사라졌다(10-06 E2E).
      const aliasOf = new Map(experiences.map((e, i) => [e.id, `E${i + 1}`]));
      const idOf = new Map(experiences.map((e, i) => [`E${i + 1}`, e.id]));
      const aliased = experiences.map((e) => ({ ...e, id: aliasOf.get(e.id) }));

      // 다른 문항에서 이미 쓴 경험은 되도록 피한다. 본인 경험만 남긴다.
      const avoid = [
        ...new Set([...project.questions.flatMap((q) => q.draftExperienceIds ?? []), ...request.avoidExperienceIds]),
      ]
        .map((id) => aliasOf.get(id))
        .filter(Boolean);

      const startedAt = now();
      const policy = USER_RATE_LIMITS.experienceDraft;
      const rate = await consumeRateLimit(db, { userId, policy, now: startedAt });
      if (!rate.allowed) return sendRateLimited(res, rate, requestId);
      const refund = () => refundRateLimit(db, { userId, policy, now: startedAt });

      const promptText = buildDraftPrompt({
        question: request.prompt,
        charLimit: request.charLimit,
        company: project.company,
        jobKeyword: project.jobKeyword,
        posting: posting ? { summary: posting.summaryJson, rawText: posting.rawText } : null,
        experiences: aliased,
        avoidExperienceIds: avoid,
      });

      let draft = null;
      try {
        draft = normalizeDraftOutput(canonicalAliases(await callModel(promptText)), {
          experiences: aliased,
          postingText: posting?.rawText ?? "",
        });
      } catch {
        draft = null; // 경험·초안 본문은 로그에 남기지 않는다.
      }
      if (!draft) {
        await refund();
        throw new ApiError("DRAFT_FAILED", 502);
      }
      if (draft.status === "needs_more") {
        await refund();
        return sendJson(
          res,
          200,
          { status: "needs_more", need_more: draft.needMore, remaining_today: rate.remaining + 1 },
          requestId,
        );
      }
      return sendJson(
        res,
        200,
        {
          status: "ok",
          chosen: draft.chosen.map((c) => ({ experience_id: idOf.get(c.experienceId), title: c.title, reason: c.reason })),
          sentences: draft.sentences.map((s) => ({
            text: s.text,
            kind: s.kind,
            source_ids: s.sourceIds.map((alias) => idOf.get(alias)),
            unsourced: s.unsourced,
          })),
          draft_text: draft.draftText,
          char_count: draft.charCount,
          replaced_numbers: draft.replacedNumbers,
          remaining_today: rate.remaining,
        },
        requestId,
      );
    });
  };
}
