// 경험 → 자소서 초안 (POST /api/analyze?draft=1). 사용자가 적은 경험의 사실로만 쓴다.
// 모델 지시는 어겨질 수 있어 서버가 결과를 검사한다: 남의 경험 id 제거, 근거 없는 숫자 → [실제 수치].
// 경험 본문·문항·초안은 로그에 남기지 않는다.
import { isRecord, sanitizeInput } from "./sanitize.js";

export const BLANK_NUMBER = "[실제 수치]";
const MAX_SENTENCES = 30;
const MAX_SENTENCE_CHARS = 400;
const MAX_REASON_CHARS = 120;
const MAX_CHOSEN = 2;
const KINDS = new Set(["job", "experience", "plan"]);
// 숫자 + (선택) 단위. 1,200 / 30% / 3개월 / 2.5배. 공백은 단위가 붙을 때만 토큰에 넣는다.
const NUMBER_TOKEN = /\d[\d,]*(?:\.\d+)?(?:\s*(?:%|퍼센트|명|배|만\s*원|원|만|억|건|개월|개|회|시간|일|주|년|위|점))?/g;

function numberCores(text) {
  return new Set(String(text ?? "").replace(/,/g, "").match(/\d+(?:\.\d+)?/g) ?? []);
}

function experienceText(exp) {
  return [exp.title, exp.period, exp.situation, exp.action, exp.result, ...(exp.tags ?? [])].join(" ");
}

function guardNumbers(text, allowed) {
  let replaced = 0;
  const next = text.replace(NUMBER_TOKEN, (token) => {
    const core = token.replace(/,/g, "").match(/\d+(?:\.\d+)?/)?.[0];
    if (core && allowed.has(core)) return token;
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
