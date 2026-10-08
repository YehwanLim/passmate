import { useState } from "react";
import { useLocation, useSearch } from "wouter";
import { ArrowLeft, ArrowRight, Check, ExternalLink, X } from "lucide-react";

import { COMPANY_REPORT_SAMPLE } from "@/constants/companyReportSample";
import SiteHeader from "@/components/SiteHeader";
import { AccordionQuestionRow } from "@/components/report/AccordionQuestionRow";
import { MiniNavigator } from "@/components/report/MiniNavigator";
import { ReportAuthGate } from "@/components/report/ReportAuthGate";
import { ReportHeroFrame } from "@/components/report/ReportHeroFrame";
import { useAnalysisReport } from "@/hooks/useAnalysisReport";
import { useScrollSpy } from "@/hooks/useScrollSpy";
import { isRenderableCompanyReport, type CompanyReportData } from "@/types/companyReport";
import { COMPANY_HERO_ID, COMPANY_REPORT_NAV_SECTIONS } from "./companyReportNavigation";
import {
  COMPANY_REPORT_DISCLAIMER,
  CompanySectionHeading,
  ExternalSourceLink,
  HeadlineCard,
  INVESTMENT_DISCLAIMER,
  PhaseBadge,
  RelevanceBadge,
  SourceNote,
  Timeline,
  renderCompanyText,
} from "./companyReportParts";

/**
 * 표지 한 줄의 글자 크기. 프롬프트는 28자 이내를 요구하지만 모델이 30~45자를 자주 내놓는다.
 * 서버가 자르면 문장이 깨지니 화면에서 줄인다. 프로덕션 실측(2026-09-08)으로 한 글자 평균 폭이 약 0.83em
 * (띄어쓰기·영문 포함)이고 컨테이너(max-w-3xl)가 768px 이므로, 데스크톱에서 두 줄에 들어가려면
 * 글자 크기 ≤ 1850px / 글자 수 여야 한다. 28자면 기본 4.05rem(64.8px)이 딱 맞는다.
 */
export function heroTitleSizeClass(oneLiner: string): string {
  const length = oneLiner.replace(/\*\*/g, "").trim().length;
  if (length > 46) return "text-[1.7rem] sm:text-[2rem] md:text-[2.2rem]";
  if (length > 40) return "text-[1.8rem] sm:text-[2.2rem] md:text-[2.5rem]";
  if (length > 34) return "text-[1.9rem] sm:text-[2.5rem] md:text-[2.85rem]";
  if (length > 28) return "text-[1.95rem] sm:text-[2.8rem] md:text-[3.4rem]";
  return "text-[2.08rem] sm:text-[3.15rem] md:text-[4.05rem]";
}

/** 발행처가 제목과 같거나 검색 제공자의 리다이렉트 호스트(옛 리포트·샘플)면 숨긴다. */
function isVisiblePublisher(source: { title: string; publisher: string }): boolean {
  return source.publisher.length > 0 && source.publisher !== source.title && !source.publisher.endsWith("vertexaisearch.cloud.google.com");
}

// ── 데이터 로딩 ──────────────────────────────────────────────────────────────

interface LoadedReport {
  analysisId: string;
  company: string;
  jobRole: string;
  report: CompanyReportData;
  sample?: boolean;
}

const MISSING_MESSAGE = "기업 분석 리포트를 찾을 수 없습니다.";
const FAILED_MESSAGE = "기업 분석 리포트를 불러오지 못했습니다.";

function AuthenticatedCompanyReport() {
  const [, navigate] = useLocation();
  const requestedAnalysisId = new URLSearchParams(window.location.search).get("analysisId");
  const { data: loaded, isLoading, error } = useAnalysisReport<LoadedReport>(requestedAnalysisId, {
    missingMessage: MISSING_MESSAGE,
    failedMessage: FAILED_MESSAGE,
    parse: (payload) => {
      // 자소서 분석 id 로 들어오면 자소서 리포트로 보낸다.
      if (payload?.kind === "RESUME") {
        navigate(`/report-new?analysisId=${encodeURIComponent(payload.id ?? requestedAnalysisId ?? "")}`);
        return null;
      }
      if (!isRenderableCompanyReport(payload?.ai_response_json)) {
        throw new Error("저장된 기업 분석 리포트 형식이 올바르지 않습니다.");
      }
      return {
        analysisId: payload.id ?? requestedAnalysisId ?? "",
        company: payload.company_name ?? "",
        jobRole: payload.job_role ?? "",
        report: payload.ai_response_json,
      };
    },
  });

  if (isLoading) {
    return <main className="flex min-h-screen items-center justify-center bg-stage px-6 text-center text-sm text-ink-4">기업 분석 리포트를 불러오는 중이에요.</main>;
  }
  if (error || !loaded) {
    return <main className="flex min-h-screen items-center justify-center bg-stage px-6 text-center text-sm text-danger">{error ?? FAILED_MESSAGE}</main>;
  }
  return <CompanyReportContent {...loaded} />;
}

// ── 본문 ──────────────────────────────────────────────────────────────────────

function CompanyReportContent({ company, jobRole, report, sample = false }: LoadedReport) {
  const [, navigate] = useLocation();
  const activeSection = useScrollSpy(COMPANY_REPORT_NAV_SECTIONS);
  const [openQuestionIndex, setOpenQuestionIndex] = useState<number | null>(0);
  const asOf = report.reportMeta?.asOf || report.brief.asOf || "";
  const numbers = report.financialSnapshot;
  const role = report.roleInContext;
  // 모델 응답이 선택 배열을 빼먹어도 화면이 죽지 않도록 렌더 직전에 기본값을 채운다.
  const keywords = report.brief.keywords ?? [];
  const sources = report.sources ?? [];
  const segments = report.businessMap.segments ?? [];
  const focusItems = report.focusBusinesses.items ?? [];
  const translated = report.focusBusinesses.translatedTalentKeywords ?? [];
  const keyFigures = numbers.keyFigures ?? [];
  const disclosures = numbers.recentDisclosures ?? [];
  const issues = report.currentIssues ?? [];
  const problems = role.problemsItSolves ?? [];
  const roleNews = role.recentNewsForRole ?? [];
  const opportunities = report.opportunitiesAndRisks.opportunities ?? [];
  const risks = report.opportunitiesAndRisks.risks ?? [];
  const candidates = report.businessCandidates ?? [];
  const questions = report.interviewPrep.questions ?? [];
  const primarySources = report.interviewPrep.primarySources ?? [];

  // 자소서 리포트(ReportBlock)와 같은 흰 블록. 섹션마다 한 장씩 쌓는다.
  const sectionClass = "report-section-anchor rounded-3xl bg-surface px-5 py-7 sm:px-10 sm:py-9";
  const cardClass = "rounded-2xl border border-line-soft bg-fill-soft p-5";
  const panelClass = "rounded-2xl bg-fill-soft p-6 sm:p-7";
  const labelClass = "text-[14px] font-bold text-ink-4";
  const smallLabelClass = "text-[13px] font-bold text-ink-4";
  const actionButtonClass = "inline-flex h-11 items-center justify-center rounded-[12px] px-[18px] text-[15px] font-semibold transition-colors";
  const ctaButtonClass = "w-full sm:w-auto min-h-12 px-6 py-3 rounded-[12px] text-[15px] font-bold transition-colors flex items-center justify-center gap-2";

  return (
    <main className="min-h-screen bg-stage font-sans text-ink">
      <div className="print:hidden">
        <SiteHeader variant="light" />
      </div>
      <MiniNavigator sections={COMPANY_REPORT_NAV_SECTIONS} activeSection={activeSection} tone="light" />

      <article className="mx-auto flex w-full max-w-[1040px] flex-col gap-6 px-4 pb-24 pt-8 sm:px-6 lg:px-0">
        <div className="flex items-center justify-between gap-3 print:hidden">
          <button onClick={() => window.history.back()} className="inline-flex h-10 items-center gap-2 rounded-[10px] text-[15px] font-semibold text-ink-4 transition-colors hover:text-ink">
            <ArrowLeft className="size-4" />
            <span>뒤로</span>
          </button>
          {sample ? (
            <button className={`${actionButtonClass} bg-brand text-white hover:bg-brand-hover`} onClick={() => navigate("/company-analysis")}>
              기업 분석 시작하기
            </button>
          ) : (
            <button className={`${actionButtonClass} bg-fill text-ink-2 hover:bg-line`} onClick={() => navigate("/my#company")}>
              기업 리포트
            </button>
          )}
        </div>
        {sample ? (
          <div role="note" className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-2xl bg-surface px-5 py-3.5 text-[14px]">
            <span className="font-bold text-ink">샘플 리포트 · {company} · {asOf} 기준</span>
            <span className="text-ink-3 text-pretty">실제 리포트는 지원 기업과 직무를 입력하면 같은 구성으로 새로 생성돼요.</span>
          </div>
        ) : null}
        {/* 표지 */}
        <header id={COMPANY_HERO_ID}>
          <ReportHeroFrame eyebrow={<>Company Brief · {company}{jobRole ? ` · ${jobRole}` : ""}</>}>
            <div className="relative min-w-0 py-12 text-center sm:py-14 md:py-[4.25rem]">
              <p className="mb-5 text-[15px] sm:text-base font-semibold text-ink-4">{company}는</p>
              <h1 className={`mx-auto max-w-3xl ${heroTitleSizeClass(report.brief.oneLiner)} font-bold leading-[1.12] tracking-[-0.03em] text-navy text-balance`}>
                {renderCompanyText(report.brief.oneLiner)}
              </h1>
              <p className="mx-auto mt-6 max-w-2xl text-[16px] sm:text-[19px] leading-[1.8] text-ink-3 text-balance">
                {renderCompanyText(report.brief.positionInIndustry)}
              </p>
            </div>
            <div className="relative flex min-w-0 flex-wrap justify-center gap-2.5 pb-6">
              {keywords.map((keyword, index) => (
                <span key={`${keyword}-${index}`} className="inline-flex min-h-7 max-w-full items-center rounded-[8px] py-0.5 bg-fill px-2.5 text-[13px] font-semibold text-ink-3">{keyword}</span>
              ))}
            </div>
            <p className="relative text-center text-[13px] tabular-nums text-ink-4">
              기준일 {asOf} · 출처 {sources.length}건
            </p>
          </ReportHeroFrame>
        </header>

        {/* 01 돈 버는 구조 */}
        <section id="company-business" className={sectionClass}>
          <CompanySectionHeading index="01" title="무엇을 팔아 돈을 버나" deck={report.businessMap.summary} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {segments.map((segment, index) => (
              <div key={`${segment.name}-${index}`} className={cardClass}>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-[17px] font-bold text-ink">{renderCompanyText(segment.name)}</p>
                  {segment.phase ? <PhaseBadge label={segment.phase} /> : null}
                </div>
                <p className="text-[15px] leading-[1.8] text-ink-3">{renderCompanyText(segment.whatItDoes)}</p>
                {segment.weight ? <p className="mt-3 text-[13px] text-ink-4">{renderCompanyText(segment.weight)}</p> : null}
              </div>
            ))}
          </div>
          {report.businessMap.customersAndCompetitors ? (
            <p className="mt-8 text-[15px] leading-[1.85] text-ink-3 max-w-2xl">{renderCompanyText(report.businessMap.customersAndCompetitors)}</p>
          ) : null}
          <SourceNote />
        </section>

        {/* 02 밀고 있는 사업 */}
        <section id="company-focus" className={sectionClass}>
          <CompanySectionHeading index="02" title="요즘 힘을 싣는 사업" />
          {report.focusBusinesses.statedDirection ? (
            <blockquote className="mb-8 rounded-2xl bg-fill-soft px-5 py-4 text-[15px] leading-[1.85] text-ink-3">
              {renderCompanyText(report.focusBusinesses.statedDirection)}
            </blockquote>
          ) : null}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {focusItems.map((item, index) => (
              <div key={`${item.name}-${index}`} className={cardClass}>
                <div className="mb-3 flex items-start justify-between gap-3">
                  <p className="text-[17px] font-bold text-ink">{renderCompanyText(item.name)}</p>
                  <RelevanceBadge relevance={item.relevanceToRole} />
                </div>
                <p className="text-[15px] leading-[1.8] text-ink-2">{renderCompanyText(item.whatChanged)}</p>
                <p className="mt-3 text-[14px] leading-[1.8] text-ink-3">{renderCompanyText(item.evidence)}</p>
                <p className="mt-3 text-[14px] leading-[1.8] text-ink-4">{renderCompanyText(item.whyNow)}</p>
              </div>
            ))}
          </div>
          {translated.length > 0 ? (
            <div className={`mt-8 ${panelClass}`}>
              <p className={`mb-4 ${labelClass}`}>인재상 문구를 사업 언어로</p>
              <ul className="space-y-3">
                {translated.map((pair, index) => (
                  <li key={`${pair.stated}-${index}`} className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_24px_minmax(0,2fr)] gap-2 text-[15px] leading-[1.7]">
                    <span className="text-ink-4">{pair.stated}</span>
                    <span aria-hidden="true" className="hidden sm:block text-ink-5">→</span>
                    <span className="text-ink-2">{renderCompanyText(pair.meaning)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <SourceNote />
        </section>

        {/* 03 숫자로 보는 회사 */}
        <section id="company-numbers" className={sectionClass}>
          <CompanySectionHeading index="03" title="매출·이익·주가 한눈에" />
          {keyFigures.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {keyFigures.slice(0, 4).map((figure, index) => (
                <div key={`${figure.label}-${index}`} className={cardClass}>
                  <p className={`mb-2 ${smallLabelClass}`}>{figure.label}</p>
                  <p className="text-[22px] font-bold tabular-nums tracking-[-0.03em] text-ink leading-tight">{figure.value}</p>
                  <p className="mt-2 text-[12px] text-ink-4">{figure.period}</p>
                </div>
              ))}
            </div>
          ) : null}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <p className={`mb-3 ${labelClass}`}>매출</p>
              <p className="text-[15px] leading-[1.85] text-ink-3">{renderCompanyText(numbers.revenueTrend)}</p>
            </div>
            <div>
              <p className={`mb-3 ${labelClass}`}>이익</p>
              <p className="text-[15px] leading-[1.85] text-ink-3">{renderCompanyText(numbers.profitTrend)}</p>
            </div>
          </div>
          {numbers.listed ? (
            <div className={`mt-8 ${panelClass}`}>
              <p className={`mb-2 ${labelClass}`}>시장과 공시{numbers.market ? ` · ${numbers.market}` : ""}</p>
              {numbers.marketView ? <p className="text-[15px] leading-[1.85] text-ink-3">{renderCompanyText(numbers.marketView)}</p> : null}
              {disclosures.length > 0 ? (
                <ul className="mt-5 space-y-2">
                  {disclosures.map((disclosure, index) => (
                    <li key={`${disclosure.when}-${index}`} className="flex items-start gap-3 text-[14px] leading-[1.7] text-ink-3">
                      <span className="shrink-0 tabular-nums text-ink-4">{disclosure.when}</span>
                      <span>{disclosure.title}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              <p className="mt-6 text-[12px] text-ink-4">{INVESTMENT_DISCLAIMER}</p>
            </div>
          ) : numbers.fundingNote ? (
            <div className={`mt-8 ${panelClass}`}>
              <p className={`mb-2 ${labelClass}`}>투자와 기업가치</p>
              <p className="text-[15px] leading-[1.85] text-ink-3">{renderCompanyText(numbers.fundingNote)}</p>
            </div>
          ) : null}
          {numbers.forApplicant ? (
            <p className="mt-8 text-[15px] leading-[1.85] text-ink-2 max-w-2xl">{renderCompanyText(numbers.forApplicant, true)}</p>
          ) : null}
          <SourceNote />
        </section>

        {/* 04 최근 1년의 국면 */}
        <section id="company-issues" className={sectionClass}>
          <CompanySectionHeading index="04" title="최근 1년 주요 이슈" />
          <Timeline
            entries={issues.map((issue) => ({
              when: issue.when,
              title: issue.title,
              body: (
                <>
                  <span>{renderCompanyText(issue.fact)}</span>{" "}
                  <span className="text-ink-2">{renderCompanyText(issue.whyItMatters)}</span>
                </>
              ),
              tail: renderCompanyText(issue.forApplicant, true),
            }))}
          />
          <SourceNote />
        </section>

        {/* 05 이 직무의 자리 */}
        <section id="company-role" className={sectionClass}>
          <CompanySectionHeading index="05" title={`지원 직무가 하는 일${jobRole ? ` · ${jobRole}` : ""}`} deck={role.whereItSits} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            <div>
              <p className={`mb-4 ${labelClass}`}>이 직무가 지금 푸는 문제</p>
              <ul className="space-y-3">
                {problems.map((problem, index) => (
                  <li key={`${problem}-${index}`} className="flex items-start gap-2.5 text-[15px] leading-[1.7] text-ink-2">
                    <span className="mt-[9px] size-[5px] shrink-0 rounded-full bg-ink-5" /><span>{renderCompanyText(problem)}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className={`mb-4 ${labelClass}`}>지금 뽑는 이유(가설)</p>
              <p className="text-[15px] leading-[1.85] text-ink-3">{renderCompanyText(role.whyHiringNow)}</p>
            </div>
          </div>
          {role.postingReading ? (
            <div className={`mb-8 ${panelClass}`}>
              <p className={`mb-3 ${labelClass}`}>채용공고 읽기</p>
              <p className="text-[15px] leading-[1.85] text-ink-3">{renderCompanyText(role.postingReading)}</p>
            </div>
          ) : null}
          {roleNews.length > 0 ? (
            <>
              <p className={`mb-5 ${labelClass}`}>이 직무와 연결된 최신 소식</p>
              <Timeline
                dense
                entries={roleNews.map((news) => ({
                  when: news.when,
                  title: news.title,
                  body: renderCompanyText(news.fact),
                  tail: renderCompanyText(news.whyForRole),
                }))}
              />
            </>
          ) : null}
          <SourceNote />
        </section>

        {/* 06 기회와 리스크 */}
        <section id="company-risks" className={sectionClass}>
          <CompanySectionHeading index="06" title="회사의 기회와 걱정거리" deck="지원자의 시선으로 골랐어요. 면접에서 '우리 회사의 숙제가 뭐라고 보나요'에 답할 재료입니다." />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
            <div>
              <p className="mb-5 flex items-center gap-2 text-[15px] font-bold text-ok"><Check className="w-4 h-4 text-ok" strokeWidth={3} />기회</p>
              {opportunities.map((item, index) => (
                <HeadlineCard key={`${item.headline}-${index}`} headline={renderCompanyText(item.headline)} text={item.text} tone="opportunity" />
              ))}
            </div>
            <div>
              <p className="mb-5 flex items-center gap-2 text-[15px] font-bold text-danger"><X className="w-4 h-4 text-danger" strokeWidth={3} />리스크</p>
              {risks.map((item, index) => (
                <HeadlineCard key={`${item.headline}-${index}`} headline={renderCompanyText(item.headline)} text={item.text} tone="risk" />
              ))}
            </div>
          </div>
          <SourceNote />
        </section>

        {/* 07 맡고 싶은 사업 */}
        <section id="company-candidates" className={sectionClass}>
          <CompanySectionHeading index="07" title="자소서에 쓸 사업 소재" deck="자소서에 쓸 만한 사업과 각도입니다. 문장이 아니라 방향이니, 본인 경험으로 채워 주세요." />
          <div className="grid grid-cols-1 gap-5">
            {candidates.map((candidate, index) => (
              <div key={`${candidate.name}-${index}`} className="rounded-2xl border border-line-soft bg-fill-soft p-6 sm:p-7">
                <div className="mb-4 flex items-center gap-3">
                  <span className="text-[22px] font-bold leading-none tabular-nums text-ink-5">{String(index + 1).padStart(2, "0")}</span>
                  <p className="text-[19px] font-bold tracking-[-0.02em] text-ink">{renderCompanyText(candidate.name)}</p>
                </div>
                <p className="text-[15px] leading-[1.85] text-ink-3">{renderCompanyText(candidate.whyForThisRole)}</p>
                <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <p className="mb-2 text-[13px] font-bold text-brand-ink">잡을 각도</p>
                    <p className="text-[14px] leading-[1.8] text-ink-2">{renderCompanyText(candidate.angle)}</p>
                  </div>
                  <div>
                    <p className={`mb-2 ${smallLabelClass}`}>연결하면 좋은 경험</p>
                    <p className="text-[14px] leading-[1.8] text-ink-3">{renderCompanyText(candidate.experienceToPrepare)}</p>
                  </div>
                </div>
                {candidate.seedSentence ? (
                  <blockquote className="mt-6 rounded-xl bg-surface px-4 py-3 text-[15px] leading-[1.8] text-ink-2">
                    {renderCompanyText(candidate.seedSentence)}
                  </blockquote>
                ) : null}
              </div>
            ))}
          </div>
          {sample ? (
            <div className="mt-8 flex flex-col sm:flex-row items-center gap-3">
              <button
                onClick={() => navigate("/company-analysis")}
                className={`${ctaButtonClass} bg-brand text-white hover:bg-brand-hover`}
              >
                <span>내 지원 기업으로 기업 분석 받기</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => navigate("/entitlements#company")}
                className={`${ctaButtonClass} bg-fill text-ink-2 hover:bg-line`}
              >
                이용권 보기
              </button>
            </div>
          ) : (
            <div className="mt-8 flex flex-col sm:flex-row items-center gap-3">
              <button
                onClick={() => navigate(`/analyze?company=${encodeURIComponent(company)}&jobKeyword=${encodeURIComponent(jobRole)}`)}
                className={`${ctaButtonClass} bg-brand text-white hover:bg-brand-hover`}
              >
                <span>이 각도로 쓴 자소서, 채용 담당자 시선으로 확인하기</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              {report.reportMeta?.linkedResumeAnalysisId ? (
                <button
                  onClick={() => navigate(`/report-new?analysisId=${encodeURIComponent(report.reportMeta?.linkedResumeAnalysisId ?? "")}`)}
                  className={`${ctaButtonClass} bg-fill text-ink-2 hover:bg-line`}
                >
                  연결된 자소서 분석 보기
                </button>
              ) : null}
            </div>
          )}
          <SourceNote />
        </section>

        {/* 08 면접 전 체크리스트 */}
        <section id="company-interview" className={sectionClass}>
          <CompanySectionHeading index="08" title="면접 예상 질문과 읽을 자료" />
          <div>
            {questions.map((item, index) => (
              <AccordionQuestionRow
                key={`${index}-${item.question}`}
                index={index}
                question={renderCompanyText(item.question)}
                open={openQuestionIndex === index}
                onToggle={() => setOpenQuestionIndex(openQuestionIndex === index ? null : index)}
              >
                <div className="mb-5 rounded-2xl bg-fill-soft px-5 py-4 sm:ml-12">
                  <p className={`mb-2 ${smallLabelClass}`}>답변 방향</p>
                  <p className="text-[15px] text-ink-3 leading-[1.75]">{renderCompanyText(item.direction, true)}</p>
                </div>
              </AccordionQuestionRow>
            ))}
          </div>
          {primarySources.length > 0 ? (
            <div className="mt-8">
              <p className={`mb-4 ${labelClass}`}>더 읽어볼 1차 자료</p>
              <ul className="space-y-2">
                {primarySources.map((primary, index) => (
                  <li key={`${primary.label}-${index}`}>
                    <ExternalSourceLink href={primary.url} className="inline-flex items-center gap-2 text-[15px] font-semibold text-ink-2 hover:text-brand-ink">
                      <ExternalLink className="w-3.5 h-3.5 text-ink-5" />{primary.label}
                    </ExternalSourceLink>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <SourceNote />
        </section>

        {/* 09 부록: 출처와 기준일 */}
        <section id="company-sources" className={sectionClass}>
          <CompanySectionHeading index="09" title="출처와 기준일" />
          <p className="text-[14px] leading-[1.8] text-ink-3 mb-2">기준일 {asOf}. {COMPANY_REPORT_DISCLAIMER}</p>
          <p className="text-[12px] text-ink-4 mb-8">링크는 검색 제공자의 리다이렉트 주소라 시간이 지나면 열리지 않을 수 있어요. 제목과 발행처로 원문을 찾아 주세요.</p>
          <ol className="space-y-3">
            {sources.map((source, index) => (
              <li key={`${source.id}-${index}`} className="grid grid-cols-[32px_1fr] gap-3 text-[15px] leading-[1.7]">
                <span className="tabular-nums text-ink-5">{source.id}.</span>
                <span className="min-w-0">
                  <span className="text-ink-2">{source.title}</span>
                  {isVisiblePublisher(source) ? <span className="text-ink-4"> · {source.publisher}</span> : null}
                  <ExternalSourceLink href={source.url} className="ml-2 inline-flex items-center gap-1 text-[13px] font-semibold text-ink-4 hover:text-brand-ink">
                    <ExternalLink className="w-3 h-3" />열기
                  </ExternalSourceLink>
                  {source.excerpt ? <span className="block text-[13px] leading-[1.7] text-ink-4">{source.excerpt}</span> : null}
                </span>
              </li>
            ))}
          </ol>
          {report.reportMeta?.searchEntryPointHtml ? (
            // Google 검색 그라운딩 약관: 검색 제안 칩을 그대로 표시한다. 스크립트가 없는 마크업임을 프로브로 확인했다.
            <div className="mt-8 rounded-2xl border border-line bg-surface p-3 text-ink" dangerouslySetInnerHTML={{ __html: report.reportMeta.searchEntryPointHtml }} />
          ) : null}
        </section>

        <footer className="pt-10 pb-8">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 text-[12px] text-ink-4">
            <p>Pre:View 2026. All rights reserved.</p>
            <button onClick={() => navigate("/company-analysis")} className="underline-offset-4 hover:underline">다른 회사 분석하기</button>
          </div>
        </footer>
      </article>
    </main>
  );
}

export default function CompanyReport() {
  // 공개 샘플은 로그인·조회 없이 굳힌 상수를 그대로 렌더한다.
  // useSearch: 빌드 프리렌더(entry-server.tsx)에는 window 가 없고, 하이드레이션 첫 패스는 Router 의 ssrSearch 를 읽는다.
  const isSample = new URLSearchParams(useSearch()).get("sample") === "1";
  if (isSample) {
    return (
      <CompanyReportContent
        analysisId="sample"
        company={COMPANY_REPORT_SAMPLE.company}
        jobRole={COMPANY_REPORT_SAMPLE.jobRole}
        report={COMPANY_REPORT_SAMPLE.report}
        sample
      />
    );
  }
  const redirect = `${window.location.pathname}${window.location.search}`;
  return (
    <ReportAuthGate loginRedirect={redirect} message="로그인 후 기업 분석 리포트를 확인할 수 있어요." tone="light">
      <AuthenticatedCompanyReport />
    </ReportAuthGate>
  );
}
