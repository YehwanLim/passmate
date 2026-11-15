import { describe, expect, it } from "vitest";
import { nextAction, type GuideRef } from "./nextAction";

const guides: GuideRef[] = [
  { slug: "hyundai-motor-cover-letter-questions", company: "현대자동차", category: "자소서" },
  { slug: "hyundai-motor-marketing-interview", company: "현대자동차", category: "면접 후기" },
];
const base = { id: "p1", company_name: "현대 자동차", answered_count: 0, latest_analysis_id: null, latest_status: null };

describe("nextAction", () => {
  it("관심: 같은 회사 문항 해설이 있으면 그 글(공백·대소문자 무시)", () => {
    const action = nextAction({ ...base, stage: "interest" }, guides);
    expect(action).toMatchObject({ kind: "guide-questions", href: "/guide/hyundai-motor-cover-letter-questions", track: "next-action:interest:guide-questions" });
  });

  it("관심: 해설 글이 없으면 작업실에서 쓰기 시작", () => {
    expect(nextAction({ ...base, company_name: "CJ제일제당", stage: "interest" }, guides)).toMatchObject({ kind: "write", href: "/my/p1" });
  });

  it("작성 중: 빈 답이면 이어 쓰기, 답이 있으면 진단, 성공한 분석이 있으면 리포트", () => {
    expect(nextAction({ ...base, stage: "writing" }, guides)?.kind).toBe("continue");
    expect(nextAction({ ...base, stage: "writing", answered_count: 2 }, guides)).toMatchObject({ kind: "diagnose", href: "/my/p1" });
    expect(nextAction({ ...base, stage: "writing", latest_analysis_id: "a1", latest_status: "SUCCESS" }, guides))
      .toMatchObject({ kind: "report", href: "/report-new?analysisId=a1" });
    expect(nextAction({ ...base, stage: "writing", answered_count: 1, latest_analysis_id: "a1", latest_status: "FAILED" }, guides)?.kind).toBe("diagnose");
  });

  it("stage 가 없는 옛 응답은 작성 중으로 본다", () => {
    expect(nextAction({ ...base, answered_count: 1 }, guides)?.kind).toBe("diagnose");
  });

  it("서류 제출: 글이 있으면 면접 미리 준비, 없으면 붙여 넣기", () => {
    expect(nextAction({ ...base, stage: "submitted", answered_count: 1 }, guides))
      .toMatchObject({ kind: "prepare", href: "/my/interview-practice?application=p1" });
    expect(nextAction({ ...base, stage: "submitted" }, guides)).toMatchObject({ kind: "paste", href: "/my/p1" });
  });

  it("서류 합격·면접: 낸 자소서로 면접 연습 + 그 회사 면접 후기 보조 링크", () => {
    const action = nextAction({ ...base, stage: "doc_passed", latest_analysis_id: "a1", latest_status: "SUCCESS" }, guides);
    expect(action).toMatchObject({
      kind: "interview",
      href: "/my/interview-practice?application=p1",
      secondary: { href: "/guide/hyundai-motor-marketing-interview" },
      track: "next-action:doc_passed:interview",
    });
    expect(nextAction({ ...base, stage: "interview", company_name: "LG", answered_count: 1 }, guides)?.secondary).toBeUndefined();
  });

  it("직접 단계는 바로 앞 기본 단계의 할 일", () => {
    const steps = [{ key: "interest" }, { key: "writing" }, { key: "submitted" }, { key: "c_k3m9x2ab", label: "인적성" }, { key: "doc_passed" }, { key: "c_aaaaaaaa", label: "과제" }, { key: "interview" }, { key: "offer" }];
    expect(nextAction({ ...base, answered_count: 1, stage: "c_k3m9x2ab", stage_steps: steps }, guides))
      .toMatchObject({ kind: "prepare", track: "next-action:submitted:prepare" });
    expect(nextAction({ ...base, answered_count: 1, stage: "c_aaaaaaaa", stage_steps: steps }, guides)?.kind).toBe("interview");
  });

  it("최종 합격·불합격은 할 일 없음", () => {
    expect(nextAction({ ...base, stage: "offer" }, guides)).toBeNull();
    expect(nextAction({ ...base, stage: "interview", rejected: true }, guides)).toBeNull();
  });

  it("회사 이름이 비어 있으면 가이드 링크를 붙이지 않는다", () => {
    expect(nextAction({ ...base, company_name: null, stage: "interest" }, guides)?.kind).toBe("write");
  });
});
