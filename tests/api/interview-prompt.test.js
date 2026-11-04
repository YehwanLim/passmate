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
