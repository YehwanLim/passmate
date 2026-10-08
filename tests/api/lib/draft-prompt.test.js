import { describe, expect, it } from "vitest";
import { buildDraftPrompt, draftTargetChars } from "../../../shared/prompts/draftPrompt.js";

const EXP = { id: "e1", title: "손님 불만을 단골로 바꾼 3개월", period: "2024.03~05", situation: "카페 리뷰 2.8점", action: "불만 유형을 표로 정리", result: "재방문 120명", tags: ["고객"] };
const base = { question: "지원 동기를 쓰세요", charLimit: 1000, company: "CJ", jobKeyword: "서비스 기획", posting: null, experiences: [EXP], avoidExperienceIds: [] };

describe("buildDraftPrompt", () => {
  it("목표 글자 수는 제한의 75%, 제한이 없으면 700", () => {
    expect(draftTargetChars(1000)).toBe(750);
    expect(draftTargetChars(null)).toBe(700);
  });

  it("경험 블록에 id 와 네 칸을 넣고 문항·회사·목표 글자 수를 적는다", () => {
    const prompt = buildDraftPrompt(base);
    expect(prompt).toContain("[경험 id=e1]");
    expect(prompt).toContain("재방문 120명");
    expect(prompt).toContain("지원 동기를 쓰세요");
    expect(prompt).toContain("750자. 1000자를 넘지 않는다");
    expect(buildDraftPrompt({ ...base, charLimit: null })).not.toContain("넘지 않는다");
    expect(prompt).toContain("CJ");
  });

  it("자유 양식으로 쓴 경험은 '내용' 한 줄로, 빈 칸 셋은 넣지 않는다", () => {
    const free = { id: "e2", title: "오답 노트 습관", period: null, situation: "", action: "", result: "", body: "틀린 문제를 유형별로 정리했다.\n두 번째 시험에 합격했다.", tags: [] };
    const prompt = buildDraftPrompt({ ...base, experiences: [free] });
    expect(prompt).toContain("내용: 틀린 문제를 유형별로 정리했다. 두 번째 시험에 합격했다.");
    expect(prompt).not.toContain("상황:");
    // 칸으로 쓴 경험(body 없음)은 그대로 칸
    expect(buildDraftPrompt(base)).toContain("상황: 카페 리뷰 2.8점");
    expect(buildDraftPrompt(base)).not.toContain("내용:");
  });

  it("회사 이름은 빈칸으로 두지 않고 그대로 쓰게 한다", () => {
    expect(buildDraftPrompt(base)).toContain("회사 이름 'CJ'은 그대로 쓴다");
    expect(buildDraftPrompt({ ...base, company: null })).not.toContain("회사 이름");
  });

  it("공고가 없으면 회사 사실 금지 문구, 있으면 공고 블록", () => {
    expect(buildDraftPrompt(base)).toContain("[회사 조사 필요]");
    const withPosting = buildDraftPrompt({ ...base, posting: { summary: { requirements: ["데이터 분석"] }, rawText: "공고 본문" } });
    expect(withPosting).toContain("[공고]");
    expect(withPosting).toContain("데이터 분석");
  });

  it("피할 경험이 있으면 그 id 를 적고, 없으면 블록이 없다", () => {
    expect(buildDraftPrompt(base)).not.toContain("[피할 경험]");
    expect(buildDraftPrompt({ ...base, avoidExperienceIds: ["e9"] })).toContain("[피할 경험] e9");
  });

  it("③ 역량 문장에도 근거 경험 id 를 붙이고, 입사 후 문장에는 숫자 목표를 쓰지 않게 한다", () => {
    const prompt = buildDraftPrompt(base);
    expect(prompt).toContain("③ 문장도 근거로 고른 경험 id");
    expect(prompt).toContain("숫자 목표를 쓰지 않는다");
    expect(prompt).toContain("적혀 있지 않은 동기·감정·다른 사람의 반응은 덧붙이지 않는다");
  });

  it("예시 문장을 넣지 않는다(모델이 베낀다) — 따옴표로 된 예문 블록이 없다", () => {
    expect(buildDraftPrompt(base)).not.toMatch(/예시 문장|예:\s*"/);
  });
});
