/**
 * 공고 화면의 "내 자소서 30초 점검" — AI 없이 정해진 규칙으로만 본다.
 * 글은 브라우저 밖으로 나가지 않는다. 점수·퍼센트는 쓰지 않고 항목마다 좋아요/다듬어 볼까요만 낸다.
 * 내용 판단(채용 담당자 시선)은 전체 리포트의 몫이라 여기서는 겉모양만 짚는다.
 */

export type DraftCheckKey = "length" | "opening" | "numbers" | "cliche" | "longSentence" | "repeat";

export interface DraftCheckItem {
  key: DraftCheckKey;
  status: "good" | "improve";
  title: string;
  detail: string;
}

/** 분석 폼 최소 글자 수(MIN_TOTAL_CHARS)와 같다. */
const MIN_CHARS = 200;
const LONG_OPENING = 80;
const LONG_SENTENCE = 120;
const REPEAT_LIMIT = 4;

// 첫 문장이 이런 말로 시작하면 결론보다 배경을 먼저 꺼낸 것이다.
const BACKGROUND_OPENING =
  /^(저는\s*)?(어릴|어렸을|어린\s*시절|초등|중학|고등|대학\s*(교|생)?\s*(시절|\d\s*학년|입학)|학창|유년|어머니|아버지|부모님|\d+\s*살)/;

// 근거 없이 쓰면 누구나 쓸 수 있는 말. 화면에는 찾은 것만 보여준다.
const CLICHES = [
  "열심히",
  "최선을 다",
  "성실",
  "책임감",
  "많은 것을 배웠",
  "많은 것을 느꼈",
  "소통 능력",
  "다양한 경험",
  "귀사",
  "항상 노력",
  "밝은 성격",
  "끈기",
] as const;

// 반복 세기에서 빼는 말. 문장을 잇는 말과 서술 끝맺음은 여러 번 나오는 게 자연스럽다.
const STOPWORDS = new Set([
  "저는", "제가", "저의", "그리고", "하지만", "그래서", "또한", "이를", "통해", "있는", "있었습니다", "있습니다",
  "했습니다", "합니다", "하였습니다", "되었습니다", "됐습니다", "위해", "대한", "하는", "하여", "것을", "것이",
  "것은", "같은", "때문에", "그때", "이런", "그런", "이후", "당시", "가장", "많은", "함께", "다른",
]);
const PARTICLE = /(으로|에서|에게|까지|부터|처럼|보다|이라|라고|과의|와의|을|를|이|가|은|는|의|에|로|도|과|와|만)$/;

export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?。])\s+|\n+/)
    .map(sentence => sentence.trim())
    .filter(Boolean);
}

function preview(sentence: string, length = 30): string {
  return sentence.length > length ? `${sentence.slice(0, length)}…` : sentence;
}

function checkLength(text: string, limit: number | null): DraftCheckItem {
  const count = text.length;
  const title = "길이";
  if (limit && limit > 0) {
    const enough = Math.ceil(limit * 0.8);
    if (count > limit) {
      return { key: "length", status: "improve", title, detail: `${limit}자 제한보다 ${count - limit}자 넘어요. 덜어 낼 문장을 찾아볼까요?` };
    }
    if (count < enough) {
      return {
        key: "length",
        status: "improve",
        title,
        detail: `지금 ${count}자예요. ${limit}자 제한이면 ${enough}자는 넘게 채우는 게 좋아요.`,
      };
    }
    return { key: "length", status: "good", title, detail: `${limit}자 제한에 ${count}자, 알맞게 채웠어요.` };
  }
  if (count < MIN_CHARS) {
    return { key: "length", status: "improve", title, detail: `지금 ${count}자예요. 한 문항은 ${MIN_CHARS}자는 넘어야 경험이 보여요.` };
  }
  return { key: "length", status: "good", title, detail: `${count}자, 내용을 담기에 충분해요.` };
}

function checkOpening(first: string): DraftCheckItem {
  const title = "첫 문장";
  if (BACKGROUND_OPENING.test(first)) {
    return {
      key: "opening",
      status: "improve",
      title,
      detail: `"${preview(first, 20)}"처럼 배경으로 시작해요. 하고 싶은 말(결론)부터 꺼내면 어떨까요?`,
    };
  }
  if (first.length > LONG_OPENING) {
    return { key: "opening", status: "improve", title, detail: `첫 문장이 ${first.length}자로 길어요. 결론만 짧게 먼저 말해 볼까요?` };
  }
  return { key: "opening", status: "good", title, detail: "첫 문장이 짧고 바로 본론으로 들어가요." };
}

function checkNumbers(text: string): DraftCheckItem {
  const title = "숫자로 보여준 결과";
  if (/\d/.test(text) || /(두|세|네)\s*배|절반/.test(text)) {
    return { key: "numbers", status: "good", title, detail: "숫자가 들어 있어 결과가 눈에 잘 들어와요." };
  }
  return {
    key: "numbers",
    status: "improve",
    title,
    detail: "숫자가 하나도 없어요. 기간·인원·전후 변화를 숫자로 보여주면 훨씬 좋아질 것 같아요.",
  };
}

function checkCliches(text: string): DraftCheckItem {
  const title = "흔한 표현";
  const found = CLICHES.filter(word => text.includes(word));
  if (found.length === 0) {
    return { key: "cliche", status: "good", title, detail: "누구나 쓰는 다짐 표현 없이 썼어요." };
  }
  return {
    key: "cliche",
    status: "improve",
    title,
    detail: `누구나 쓰는 말이 보여요: ${found.map(word => `"${word}"`).join(", ")}. 그렇게 했던 장면 하나로 바꿔 보면 어떨까요?`,
  };
}

function checkLongSentences(sentences: string[]): DraftCheckItem {
  const title = "긴 문장";
  const long = sentences.filter(sentence => sentence.length > LONG_SENTENCE);
  if (long.length === 0) {
    return { key: "longSentence", status: "good", title, detail: "문장 길이가 읽기 편해요." };
  }
  const more = long.length > 1 ? ` 외 ${long.length - 1}문장` : "";
  return {
    key: "longSentence",
    status: "improve",
    title,
    detail: `"${preview(long[0])}"${more}이 ${LONG_SENTENCE}자를 넘어요. 두 문장으로 나눠 볼까요?`,
  };
}

function checkRepeats(text: string): DraftCheckItem {
  const title = "같은 말 반복";
  const counts = new Map<string, number>();
  for (const raw of text.match(/[가-힣A-Za-z]{2,}/g) ?? []) {
    if (STOPWORDS.has(raw)) continue;
    const stem = raw.length >= 3 ? raw.replace(PARTICLE, "") : raw;
    if (stem.length < 2 || STOPWORDS.has(stem)) continue;
    counts.set(stem, (counts.get(stem) ?? 0) + 1);
  }
  const repeated = Array.from(counts.entries())
    .filter(([, count]) => count >= REPEAT_LIMIT)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  if (repeated.length === 0) {
    return { key: "repeat", status: "good", title, detail: "같은 낱말을 지나치게 되풀이하지 않았어요." };
  }
  return {
    key: "repeat",
    status: "improve",
    title,
    detail: `${repeated.map(([word, count]) => `"${word}" ${count}번`).join(", ")}. 몇 군데는 다른 말로 바꿔 볼까요?`,
  };
}

/** 빈 글이면 빈 배열. 순서는 화면에 보이는 순서다. */
export function checkDraft(rawText: string, limit: number | null = null): DraftCheckItem[] {
  const text = rawText.trim();
  if (!text) return [];
  const sentences = splitSentences(text);
  return [
    checkLength(text, limit),
    checkOpening(sentences[0] ?? text),
    checkNumbers(text),
    checkCliches(text),
    checkLongSentences(sentences),
    checkRepeats(text),
  ];
}
