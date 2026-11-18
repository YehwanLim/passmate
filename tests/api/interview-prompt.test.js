import { describe, expect, it } from "vitest";

import { INTERVIEW_KICKOFF_TEXT, buildInterviewerInstruction } from "../../shared/prompts/interviewPrompt.js";

const questions = Array.from({ length: 9 }, (_, index) => ({ question: `질문 ${index + 1}`, followUps: [] }));

describe("면접관 지시문", () => {
  it("실제 면접처럼 인사·아이스브레이킹·자기소개 뒤에 자소서 질문으로 넘어가고, 마무리에 마지막 한마디를 묻는다", () => {
    const text = buildInterviewerInstruction({ company: "한빛모빌리티", jobRole: "서비스 기획", coverLetter: "본문", questions, gaps: [], mode: "FULL" });
    const start = text.indexOf("[첫 시작]");
    const plan = text.indexOf("[질문 계획]");
    expect(start).toBeGreaterThan(-1);
    expect(plan).toBeGreaterThan(start);
    const opening = text.slice(start, plan);
    expect(opening).toMatch(/인사/);
    expect(opening).toMatch(/컨디션/);
    expect(opening).toMatch(/1분 정도 자기소개/);
    expect(text).toMatch(/마지막으로 하고 싶은 말/);
    expect(INTERVIEW_KICKOFF_TEXT).toMatch(/인사부터/);
  });

  it("말투는 차분하고 사무적이며 칭찬·격려를 쓰지 않는다", () => {
    const text = buildInterviewerInstruction({ coverLetter: "본문", questions, gaps: [], mode: "FULL" });
    expect(text).toMatch(/\[말투\] 차분하고 사무적인/);
    expect(text).toMatch(/칭찬·공감·격려의 말, 감탄사, 느낌표는 쓰지 않습니다/);
    expect(text).toMatch(/과장된 환영이나 격려는 하지 않습니다/);
  });

  it("조금 차갑게 캐묻되 깎아내리거나 반말·언성은 쓰지 않는다(11-08 사용자: 적당히 무섭지만 겁주지 않게)", () => {
    const text = buildInterviewerInstruction({ coverLetter: "본문", questions, gaps: [], mode: "FULL" });
    expect(text).toMatch(/조금 차갑게 느껴지지만, 무례하지는 않습니다/);
    expect(text).toMatch(/깎아내리거나 비꼬지 않고, 반말이나 언성을 높이는 말은 하지 않습니다/);
    expect(text).toMatch(/핵심만 짧게 다시 말해 달라고 요청합니다/);
    expect(text).toMatch(/근거를 한 번 확인합니다/);
  });

  it("자기소개에 시간을 쓰므로 질문은 실전 7개, 짧은 연습 2개까지만 싣는다", () => {
    const full = buildInterviewerInstruction({ coverLetter: "본문", questions, gaps: [], mode: "FULL" });
    const short = buildInterviewerInstruction({ coverLetter: "본문", questions, gaps: [], mode: "SHORT" });
    expect(full).toContain("7. 질문 7");
    expect(full).not.toContain("8. 질문 8");
    expect(short).toContain("2. 질문 2");
    expect(short).not.toContain("3. 질문 3");
    expect(short).toMatch(/짧은 연습이므로/);
    expect(full).not.toMatch(/짧은 연습이므로/);
  });
});
