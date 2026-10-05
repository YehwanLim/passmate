// 경험 → 자소서 초안 프롬프트의 단일 정의처. 서버 lib/experience-draft.js 만 쓴다.
// 지시는 규칙 나열보다 JSON 필드 설명에 둔다(모델이 스키마 설명을 더 잘 따른다). 예시 문장은 넣지 않는다 — 베낀다.

const FIELD_MAX = 400;

// 모델이 목표보다 5~25% 길게 쓴다(10-06 실측). 제한 안에 들어오도록 목표를 75% 로 둔다.
export function draftTargetChars(charLimit) {
  return Number.isInteger(charLimit) && charLimit > 0 ? Math.floor(charLimit * 0.75) : 700;
}

function clip(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, FIELD_MAX);
}

function experienceBlock(exp) {
  return [
    `[경험 id=${exp.id}]`,
    `이름: ${clip(exp.title)}`,
    exp.period ? `기간: ${clip(exp.period)}` : null,
    `상황: ${clip(exp.situation)}`,
    `내가 판단하고 한 일: ${clip(exp.action)}`,
    `달라진 것: ${clip(exp.result)}`,
    exp.tags?.length ? `키워드: ${exp.tags.join(", ")}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function postingBlock(posting) {
  const s = posting.summary ?? {};
  const list = (label, items) => (Array.isArray(items) && items.length ? `${label}: ${items.join(" / ")}` : null);
  return [
    "[공고]",
    list("하는 일", s.responsibilities),
    list("자격요건", s.requirements),
    list("우대사항", s.preferred),
    list("키워드", s.keywords),
    `본문 일부: ${String(posting.rawText ?? "").slice(0, 3000)}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildDraftPrompt({ question, charLimit, company, jobKeyword, posting, experiences, avoidExperienceIds }) {
  const target = draftTargetChars(charLimit);
  const companyRule = posting
    ? "회사·직무에 대한 사실은 [공고]에 적힌 것만 쓴다."
    : "공고가 없다. 회사의 사업·제품·수치·문화 같은 회사 고유 사실은 쓰지 않는다. 꼭 필요하면 그 자리에 [회사 조사 필요]를 남긴다.";

  return [
    "너는 신입 공채 지원자의 자기소개서 초안을 함께 쓰는 조력자다. 아래 [경험]에 적힌 사실만 재료로 [문항]에 답한다.",
    "경험에 없는 숫자·성과·역할·직책·기간·도구·인물을 만들지 않는다. 필요한데 경험에 없으면 [실제 수치], [구체적 행동]처럼 대괄호 빈칸으로 남긴다.",
    companyRule,
    "",
    `[지원] 회사: ${company || "미정"} / 직무: ${jobKeyword || "미정"}`,
    `[문항] ${question}`,
    Number.isInteger(charLimit) && charLimit > 0
      ? `[분량] 공백 포함 약 ${target}자. ${charLimit}자를 넘지 않는다`
      : `[분량] 공백 포함 약 ${target}자`,
    posting ? postingBlock(posting) : null,
    avoidExperienceIds?.length
      ? `[피할 경험] ${avoidExperienceIds.join(", ")} — 다른 문항에서 이미 썼다. 더 맞는 경험이 없을 때만 쓴다.`
      : null,
    "",
    ...experiences.map(experienceBlock),
    "",
    "JSON 하나만 반환한다:",
    "{",
    '  "status": "문항에 맞는 경험이 있으면 ok, 어떤 경험도 이 문항의 근거가 되지 못하면 needs_more",',
    '  "chosen": [{ "experienceId": "근거로 고른 경험의 id. 1~2개만 고른다. 나열하지 않는다", "reason": "이 문항에 이 경험을 고른 이유 한 문장" }],',
    '  "sentences": [{',
    '    "text": "초안 한 문장. 순서는 ① 이 직무가 하는 일 ② 그 일에 필요한 역량 ③ 나에게 그 역량이 있다는 한 줄 ④ 근거 경험(상황→내가 한 일→달라진 것. 경험에 적힌 내용만 다시 쓰고, 적혀 있지 않은 동기·감정·다른 사람의 반응은 덧붙이지 않는다) ⑤ 입사 후 이걸 하겠다. 과장 동사와 수식어를 쓰지 않는다. ⑤ 에는 매출·성장률 같은 숫자 목표를 쓰지 않는다",',
    '    "kind": "①② 는 job, ③④ 는 experience, ⑤ 는 plan",',
    '    "sourceIds": ["이 문장의 사실이 나온 경험 id. experience 문장은 반드시 1개 이상이고, ③ 문장도 근거로 고른 경험 id 를 넣는다. job·plan 은 빈 배열"]',
    "  }],",
    '  "needMore": "status 가 needs_more 일 때만: 이 문항에 어떤 경험이 있으면 쓸 수 있는지 한 문장. ok 면 빈 문자열"',
    "}",
  ]
    .filter((line) => line !== null)
    .join("\n");
}
