import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const homeSource = readFileSync(new URL("./Home.tsx", import.meta.url), "utf8");
const pricingSource = readFileSync(
  new URL("../components/PricingSection.tsx", import.meta.url),
  "utf8"
);
const reportShowcaseSource = readFileSync(
  new URL("../components/ReportShowcase.tsx", import.meta.url),
  "utf8"
);
const founderSource = readFileSync(
  new URL("../components/FounderSection.tsx", import.meta.url),
  "utf8"
);

describe("home onboarding copy", () => {
  it("does not promise report features that are not shown in the actual report", () => {
    expect(homeSource).not.toContain("종합 점수");
    expect(homeSource).not.toContain("경험 팩트 체크");
    expect(homeSource).not.toContain("킬러 소재");
    expect(homeSource).not.toContain("예상 질문 3건");
    expect(homeSource).not.toContain("점수 82점");
  });

  it("presents core analysis as a reading flow instead of abstract feature cards", () => {
    expect(homeSource).toContain("PassMate는 자소서를 이렇게 읽습니다");
    expect(homeSource).toContain("먼저, 어떤 사람으로 기억되는지 봅니다");
    expect(homeSource).toContain("경험이 회사 기준과 만나는지 봅니다");
    expect(homeSource).toContain("문장마다 근거가 충분한지 봅니다");
    expect(homeSource).toContain("면접에서 방어 가능한지 봅니다");
    expect(homeSource).toContain("reading-flow-track");
    expect(homeSource).toContain("reading-stage-panel");
    expect(homeSource).not.toContain("onMouseEnter={() => setActiveReadingStep(index)}");
    expect(homeSource).not.toContain("현직자 기준으로 설계된 6가지 분석 엔진");
    expect(homeSource).not.toContain("직무 적합도 (JD Fit) 매칭");
    expect(homeSource).not.toContain("분석 엔진");
  });

  it("describes analysis usage without starter/pro feature tiers", () => {
    expect(pricingSource).toContain("첫 분석 1회 무료");
    expect(pricingSource).toContain("2회권");
    expect(pricingSource).toContain("₩9,900");
    expect(pricingSource).toContain("추가 분석은 2회권으로 이용");
    expect(pricingSource).not.toContain("Starter");
    expect(pricingSource).not.toContain("Pro Pass");
    expect(pricingSource).not.toContain("Starter와 동일한 전체 리포트");
    expect(pricingSource).not.toContain("Starter 전 기능 포함");
    expect(pricingSource).not.toContain("JD 맞춤형 딥다이브");
    expect(pricingSource).not.toContain("킬러 소재 발굴");
  });

  it("renders the report preview natively instead of screenshot images", () => {
    expect(reportShowcaseSource).not.toContain("report-step-");
    expect(reportShowcaseSource).not.toContain("<img");
    expect(reportShowcaseSource).toContain("REPORT_PREVIEW_SCENES");
    expect(reportShowcaseSource).toContain("문장 피드백");
    expect(reportShowcaseSource).toContain("예상 질문");
  });

  it("keeps report preview marketing copy and uses direct navigation controls", () => {
    expect(reportShowcaseSource).toContain("합격을 설계하는 인사이트 리포트");
    expect(reportShowcaseSource).toContain("ReportPreviewFrame");
    expect(reportShowcaseSource).toContain("goToPreviousScene");
    expect(reportShowcaseSource).toContain("goToNextScene");
    expect(reportShowcaseSource).toContain("MiniReportNavigator");
    expect(reportShowcaseSource).toContain("ActiveReportScene");
    expect(reportShowcaseSource).toContain("AnimatePresence");
    expect(reportShowcaseSource).toContain("source-text-body");
    expect(reportShowcaseSource).toContain("section-tab");
    expect(reportShowcaseSource).not.toContain("캡처가 아닌");
    expect(reportShowcaseSource).not.toContain("미니 리포트입니다");
    expect(reportShowcaseSource).not.toContain("grid-cols-4 gap-2");
    expect(reportShowcaseSource).not.toContain("max-h-[840px] overflow-y-auto");
    expect(reportShowcaseSource).not.toContain(">이전<");
    expect(reportShowcaseSource).not.toContain(">다음<");
  });

  it("uses a founder note instead of a placeholder founder avatar", () => {
    expect(founderSource).toContain("왜 PassMate를 만들었나요?");
    expect(founderSource).toContain("합격하는 자소서는 글을 잘 쓰는 문서가 아니라");
    expect(founderSource).toContain("founderSignals");
    expect(founderSource).not.toContain("파운더");
    expect(founderSource).not.toContain("<User");
    expect(founderSource).not.toContain("현직 대기업 PM이 직접 설계한");
    expect(founderSource).not.toContain("진짜");
  });
});
