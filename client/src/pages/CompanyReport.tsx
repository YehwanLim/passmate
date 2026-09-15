import { useState } from "react";
import { useLocation, useSearch } from "wouter";
import { ArrowRight, Check, ExternalLink, X } from "lucide-react";

import { COMPANY_REPORT_SAMPLE } from "@/constants/companyReportSample";
import { AccordionQuestionRow } from "@/components/report/AccordionQuestionRow";
import { MiniNavigator } from "@/components/report/MiniNavigator";
import { ReportAuthGate } from "@/components/report/ReportAuthGate";
import { ReportHeroFrame } from "@/components/report/ReportHeroFrame";
import { REPORT_NAV_ACTION_CLASS, ReportTopNav } from "@/components/report/ReportTopNav";
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
    return <main className="flex min-h-screen items-center justify-center bg-[#09090B] px-6 text-center text-sm text-zinc-400">기업 분석 리포트를 불러오는 중이에요.</main>;
  }
  if (error || !loaded) {
    return <main className="flex min-h-screen items-center justify-center bg-[#09090B] px-6 text-center text-sm text-red-400">{error ?? FAILED_MESSAGE}</main>;
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

  const sectionClass = "py-24 section-divider report-section-anchor";

  return (
    <main className="min-h-screen bg-[#09090B] text-zinc-100 font-sans selection:bg-indigo-500/20">
      <MiniNavigator sections={COMPANY_REPORT_NAV_SECTIONS} activeSection={activeSection} />

      <ReportTopNav
        sections={COMPANY_REPORT_NAV_SECTIONS}
        activeSection={activeSection}
        backLabel="뒤로"
        actions={
          sample ? (
            <button className={REPORT_NAV_ACTION_CLASS} onClick={() => navigate("/company-analysis")}>
              기업 분석 시작하기
            </button>
          ) : (
            <button className={REPORT_NAV_ACTION_CLASS} onClick={() => navigate("/my")}>
              내 지원서
            </button>
          )
        }
      />

      <article className="max-w-4xl mx-auto px-6 md:px-8 pb-10 pt-4">
        {sample ? (
          <div role="note" className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-xl border border-sky-500/20 bg-sky-500/[0.06] px-4 py-3 text-[13px] text-sky-200">
            <span className="font-semibold">샘플 리포트 · {company} · {asOf} 기준</span>
            <span className="text-sky-200/70 text-pretty">실제 리포트는 지원 기업과 직무를 입력하면 같은 구성으로 새로 생성돼요.</span>
          </div>
        ) : null}
        {/* 표지 */}
        <header id={COMPANY_HERO_ID} className="pt-8 pb-[6.5rem] section-divider">
          <ReportHeroFrame eyebrow={<>Company Brief · {company}{jobRole ? ` · ${jobRole}` : ""}</>}>
            <div className="relative min-w-0 py-12 text-center sm:py-14 md:py-[4.25rem]">
              <p className="mb-5 text-[15px] sm:text-base text-zinc-300">{company}는</p>
              <h1 className={`mx-auto max-w-3xl ${heroTitleSizeClass(report.brief.oneLiner)} font-semibold leading-[1.04] tracking-tight text-white text-balance`}>
                {renderCompanyText(report.brief.oneLiner)}
              </h1>
              <p className="mx-auto mt-6 max-w-2xl text-[16px] sm:text-[19px] leading-[1.8] text-zinc-300 text-balance">
                {renderCompanyText(report.brief.positionInIndustry)}
              </p>
            </div>
            <div className="relative flex min-w-0 flex-wrap justify-center gap-2.5 pb-6">
              {keywords.map((keyword, index) => (
                <span key={`${keyword}-${index}`} className="max-w-full rounded-full border border-white/[0.12] bg-white/[0.045] px-3.5 py-2 text-xs font-semibold text-zinc-300">{keyword}</span>
              ))}
            </div>
            <p className="relative text-center text-[11px] uppercase tracking-[0.14em] text-zinc-600">
              기준일 {asOf} · 출처 {sources.length}건
            </p>
          </ReportHeroFrame>
        </header>

        {/* 01 돈 버는 구조 */}
        <section id="company-business" className={sectionClass}>
          <CompanySectionHeading index="01" title="무엇을 팔아 돈을 버나" deck={report.businessMap.summary} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {segments.map((segment, index) => (
              <div key={`${segment.name}-${index}`} className="rounded-xl border border-white/[0.08] bg-white/[0.028] p-5">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-[17px] font-semibold text-zinc-50">{renderCompanyText(segment.name)}</p>
                  {segment.phase ? <PhaseBadge label={segment.phase} /> : null}
                </div>
                <p className="text-[15px] leading-[1.8] text-zinc-400">{renderCompanyText(segment.whatItDoes)}</p>
                {segment.weight ? <p className="mt-3 text-[13px] text-zinc-500">{renderCompanyText(segment.weight)}</p> : null}
              </div>
            ))}
          </div>
          {report.businessMap.customersAndCompetitors ? (
            <p className="mt-10 text-[15px] leading-[1.85] text-zinc-300 max-w-2xl">{renderCompanyText(report.businessMap.customersAndCompetitors)}</p>
          ) : null}
          <SourceNote />
        </section>

        {/* 02 밀고 있는 사업 */}
        <section id="company-focus" className={sectionClass}>
          <CompanySectionHeading index="02" title="요즘 힘을 싣는 사업" />
          {report.focusBusinesses.statedDirection ? (
            <blockquote className="mb-12 border-l-2 border-white/[0.12] pl-5 text-[15px] leading-[1.85] text-zinc-400">
              {renderCompanyText(report.focusBusinesses.statedDirection)}
            </blockquote>
          ) : null}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {focusItems.map((item, index) => (
              <div key={`${item.name}-${index}`} className="rounded-xl border border-white/[0.08] bg-white/[0.028] p-5">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <p className="text-[17px] font-semibold text-zinc-50">{renderCompanyText(item.name)}</p>
                  <RelevanceBadge relevance={item.relevanceToRole} />
                </div>
                <p className="text-[15px] leading-[1.8] text-zinc-300">{renderCompanyText(item.whatChanged)}</p>
                <p className="mt-3 text-[14px] leading-[1.8] text-zinc-400">{renderCompanyText(item.evidence)}</p>
                <p className="mt-3 text-[14px] leading-[1.8] text-zinc-500">{renderCompanyText(item.whyNow)}</p>
              </div>
            ))}
          </div>
          {translated.length > 0 ? (
            <div className="mt-12 rounded-xl border border-white/[0.05] bg-white/[0.03] p-6 sm:p-8">
              <p className="mb-5 text-sm font-semibold uppercase tracking-[0.12em] text-zinc-400">인재상 문구를 사업 언어로</p>
              <ul className="space-y-3">
                {translated.map((pair, index) => (
                  <li key={`${pair.stated}-${index}`} className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_24px_minmax(0,2fr)] gap-2 text-[15px] leading-[1.7]">
                    <span className="text-zinc-500">{pair.stated}</span>
                    <span aria-hidden="true" className="hidden sm:block text-zinc-700">→</span>
                    <span className="text-zinc-200">{renderCompanyText(pair.meaning)}</span>
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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
              {keyFigures.slice(0, 4).map((figure, index) => (
                <div key={`${figure.label}-${index}`} className="rounded-xl border border-white/[0.08] bg-white/[0.028] p-5">
                  <p className="text-xs uppercase tracking-[0.12em] text-zinc-500 mb-2">{figure.label}</p>
                  <p className="text-[22px] font-semibold tabular-nums text-zinc-50 leading-tight">{figure.value}</p>
                  <p className="mt-2 text-[12px] text-zinc-600">{figure.period}</p>
                </div>
              ))}
            </div>
          ) : null}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.12em] text-zinc-400 mb-3">매출</p>
              <p className="text-[15px] leading-[1.85] text-zinc-300">{renderCompanyText(numbers.revenueTrend)}</p>
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.12em] text-zinc-400 mb-3">이익</p>
              <p className="text-[15px] leading-[1.85] text-zinc-300">{renderCompanyText(numbers.profitTrend)}</p>
            </div>
          </div>
          {numbers.listed ? (
            <div className="mt-10 rounded-xl border border-white/[0.05] bg-white/[0.03] p-6 sm:p-8">
              <p className="mb-2 text-sm font-semibold uppercase tracking-[0.12em] text-zinc-400">시장과 공시{numbers.market ? ` · ${numbers.market}` : ""}</p>
              {numbers.marketView ? <p className="text-[15px] leading-[1.85] text-zinc-300">{renderCompanyText(numbers.marketView)}</p> : null}
              {disclosures.length > 0 ? (
                <ul className="mt-5 space-y-2">
                  {disclosures.map((disclosure, index) => (
                    <li key={`${disclosure.when}-${index}`} className="flex items-start gap-3 text-[14px] leading-[1.7] text-zinc-400">
                      <span className="shrink-0 tabular-nums text-zinc-600">{disclosure.when}</span>
                      <span>{disclosure.title}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              <p className="mt-6 text-xs text-zinc-600">{INVESTMENT_DISCLAIMER}</p>
            </div>
          ) : numbers.fundingNote ? (
            <div className="mt-10 rounded-xl border border-white/[0.05] bg-white/[0.03] p-6 sm:p-8">
              <p className="mb-2 text-sm font-semibold uppercase tracking-[0.12em] text-zinc-400">투자와 기업가치</p>
              <p className="text-[15px] leading-[1.85] text-zinc-300">{renderCompanyText(numbers.fundingNote)}</p>
            </div>
          ) : null}
          {numbers.forApplicant ? (
            <p className="mt-10 text-[15px] leading-[1.85] text-zinc-200 max-w-2xl">{renderCompanyText(numbers.forApplicant, true)}</p>
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
                  <span className="text-zinc-300">{renderCompanyText(issue.whyItMatters)}</span>
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.12em] text-zinc-400 mb-4">이 직무가 지금 푸는 문제</p>
              <ul className="space-y-3">
                {problems.map((problem, index) => (
                  <li key={`${problem}-${index}`} className="flex items-start gap-2.5 text-[15px] leading-[1.7] text-zinc-200">
                    <span className="mt-[9px] size-[5px] shrink-0 rounded-full bg-zinc-600" /><span>{renderCompanyText(problem)}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.12em] text-zinc-400 mb-4">지금 뽑는 이유(가설)</p>
              <p className="text-[15px] leading-[1.85] text-zinc-300">{renderCompanyText(role.whyHiringNow)}</p>
            </div>
          </div>
          {role.postingReading ? (
            <div className="mb-12 rounded-xl border border-white/[0.05] bg-white/[0.03] p-6 sm:p-8">
              <p className="mb-3 text-sm font-semibold uppercase tracking-[0.12em] text-zinc-400">채용공고 읽기</p>
              <p className="text-[15px] leading-[1.85] text-zinc-300">{renderCompanyText(role.postingReading)}</p>
            </div>
          ) : null}
          {roleNews.length > 0 ? (
            <>
              <p className="text-sm font-semibold uppercase tracking-[0.12em] text-zinc-400 mb-6">이 직무와 연결된 최신 소식</p>
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-14">
            <div>
              <p className="mb-6 flex items-center gap-2 text-[15px] font-bold text-emerald-300/90"><Check className="w-4 h-4 text-emerald-400/60" />기회</p>
              {opportunities.map((item, index) => (
                <HeadlineCard key={`${item.headline}-${index}`} headline={renderCompanyText(item.headline)} text={item.text} tone="opportunity" />
              ))}
            </div>
            <div>
              <p className="mb-6 flex items-center gap-2 text-[15px] font-bold text-rose-300/80"><X className="w-4 h-4 text-rose-400/50" />리스크</p>
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
              <div key={`${candidate.name}-${index}`} className="rounded-xl border border-sky-300/20 bg-sky-300/[0.05] p-6 sm:p-8">
                <div className="mb-4 flex items-center gap-3">
                  <span className="text-[28px] font-extrabold leading-none tracking-[0.08em] text-sky-300/70">{String(index + 1).padStart(2, "0")}</span>
                  <p className="text-[19px] font-semibold text-zinc-50">{renderCompanyText(candidate.name)}</p>
                </div>
                <p className="text-[15px] leading-[1.85] text-zinc-300">{renderCompanyText(candidate.whyForThisRole)}</p>
                <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <p className="text-xs uppercase tracking-[0.12em] text-sky-300/80 mb-2 font-semibold">잡을 각도</p>
                    <p className="text-[14px] leading-[1.8] text-zinc-300">{renderCompanyText(candidate.angle)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.12em] text-zinc-500 mb-2 font-semibold">연결하면 좋은 경험</p>
                    <p className="text-[14px] leading-[1.8] text-zinc-400">{renderCompanyText(candidate.experienceToPrepare)}</p>
                  </div>
                </div>
                {candidate.seedSentence ? (
                  <blockquote className="mt-6 border-l-2 border-sky-300/30 pl-4 text-[15px] italic leading-[1.8] text-zinc-200">
                    {renderCompanyText(candidate.seedSentence)}
                  </blockquote>
                ) : null}
              </div>
            ))}
          </div>
          {sample ? (
            <div className="mt-12 flex flex-col sm:flex-row items-center gap-4">
              <button
                onClick={() => navigate("/company-analysis")}
                className="w-full sm:w-auto px-6 py-3.5 bg-white text-zinc-900 font-medium rounded-lg hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2"
              >
                <span>내 지원 기업으로 기업 분석 받기</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => navigate("/entitlements#company")}
                className="w-full sm:w-auto px-6 py-3.5 bg-zinc-800 text-white font-medium rounded-lg hover:bg-zinc-700 transition-colors"
              >
                이용권 보기
              </button>
            </div>
          ) : (
            <div className="mt-12 flex flex-col sm:flex-row items-center gap-4">
              <button
                onClick={() => navigate(`/analyze?company=${encodeURIComponent(company)}&jobKeyword=${encodeURIComponent(jobRole)}`)}
                className="w-full sm:w-auto px-6 py-3.5 bg-white text-zinc-900 font-medium rounded-lg hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2"
              >
                <span>이 각도로 쓴 자소서, 채용 담당자 시선으로 확인하기</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              {report.reportMeta?.linkedResumeAnalysisId ? (
                <button
                  onClick={() => navigate(`/report-new?analysisId=${encodeURIComponent(report.reportMeta?.linkedResumeAnalysisId ?? "")}`)}
                  className="w-full sm:w-auto px-6 py-3.5 bg-zinc-800 text-white font-medium rounded-lg hover:bg-zinc-700 transition-colors"
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
          <div className="space-y-0">
            {questions.map((item, index) => (
              <AccordionQuestionRow
                key={`${index}-${item.question}`}
                index={index}
                question={renderCompanyText(item.question)}
                open={openQuestionIndex === index}
                onToggle={() => setOpenQuestionIndex(openQuestionIndex === index ? null : index)}
              >
                <div className="pb-8 pl-[70px]">
                  <p className="text-xs uppercase tracking-[0.12em] text-zinc-500 mb-3 font-medium">답변 방향</p>
                  <p className="text-[15px] text-zinc-400 leading-[1.8]">{renderCompanyText(item.direction, true)}</p>
                </div>
              </AccordionQuestionRow>
            ))}
          </div>
          {primarySources.length > 0 ? (
            <div className="mt-12">
              <p className="text-sm font-semibold uppercase tracking-[0.12em] text-zinc-400 mb-4">더 읽어볼 1차 자료</p>
              <ul className="space-y-2">
                {primarySources.map((primary, index) => (
                  <li key={`${primary.label}-${index}`}>
                    <ExternalSourceLink href={primary.url} className="inline-flex items-center gap-2 text-[15px] text-zinc-300 hover:text-white">
                      <ExternalLink className="w-3.5 h-3.5 text-zinc-600" />{primary.label}
                    </ExternalSourceLink>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <SourceNote />
        </section>

        {/* 09 부록: 출처와 기준일 */}
        <section id="company-sources" className="pt-24 pb-20 report-section-anchor">
          <CompanySectionHeading index="09" title="출처와 기준일" />
          <p className="text-[14px] leading-[1.8] text-zinc-400 mb-2">기준일 {asOf}. {COMPANY_REPORT_DISCLAIMER}</p>
          <p className="text-xs text-zinc-600 mb-10">링크는 검색 제공자의 리다이렉트 주소라 시간이 지나면 열리지 않을 수 있어요. 제목과 발행처로 원문을 찾아 주세요.</p>
          <ol className="space-y-3">
            {sources.map((source, index) => (
              <li key={`${source.id}-${index}`} className="grid grid-cols-[32px_1fr] gap-3 text-[15px] leading-[1.7]">
                <span className="tabular-nums text-zinc-600">{source.id}.</span>
                <span className="min-w-0">
                  <span className="text-zinc-200">{source.title}</span>
                  {isVisiblePublisher(source) ? <span className="text-zinc-500"> · {source.publisher}</span> : null}
                  <ExternalSourceLink href={source.url} className="ml-2 inline-flex items-center gap-1 text-[13px] text-zinc-500 hover:text-white">
                    <ExternalLink className="w-3 h-3" />열기
                  </ExternalSourceLink>
                  {source.excerpt ? <span className="block text-[13px] leading-[1.7] text-zinc-500">{source.excerpt}</span> : null}
                </span>
              </li>
            ))}
          </ol>
          {report.reportMeta?.searchEntryPointHtml ? (
            // Google 검색 그라운딩 약관: 검색 제안 칩을 그대로 표시한다. 스크립트가 없는 마크업임을 프로브로 확인했다.
            <div className="mt-12 rounded-xl border border-white/[0.06] bg-white p-3 text-zinc-900" dangerouslySetInnerHTML={{ __html: report.reportMeta.searchEntryPointHtml }} />
          ) : null}
        </section>

        <footer className="pt-16 pb-8">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 text-xs text-zinc-600">
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
    <ReportAuthGate loginRedirect={redirect} message="로그인 후 기업 분석 리포트를 확인할 수 있어요.">
      <AuthenticatedCompanyReport />
    </ReportAuthGate>
  );
}
