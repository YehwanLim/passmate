import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useScroll,
} from "framer-motion";
import { AlertTriangle, ArrowLeft, ArrowRight, Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";

type PreviewScene = {
  id: string;
  indexLabel: string;
  tab: string;
  eyebrow: string;
  title: string;
  // 구 "이렇게 읽습니다" 섹션의 단계별 읽기 기준을 장면 위에 얹는다.
  lens: string;
};

export const REPORT_PREVIEW_SCENES: PreviewScene[] = [
  {
    id: "impression",
    indexLabel: "01",
    tab: "첫인상",
    eyebrow: "First Read",
    title: "데이터 기반 실행형 PM",
    lens: "먼저, 어떤 사람으로 기억되는지 봅니다",
  },
  {
    id: "diagnosis",
    indexLabel: "02",
    tab: "핵심 진단",
    eyebrow: "Core Diagnosis",
    title: "강점은 뚜렷하지만 회사 맥락이 약합니다",
    lens: "경험이 회사 기준과 만나는지 봅니다",
  },
  {
    id: "line",
    indexLabel: "03",
    tab: "문장 피드백",
    eyebrow: "Line-by-line",
    title: "원문 옆에서 문장별 피드백을 바로 확인합니다",
    lens: "문장마다 근거가 충분한지 봅니다",
  },
  {
    id: "interview",
    indexLabel: "04",
    tab: "예상 질문",
    eyebrow: "Interview Drill",
    title: "면접에서 이어질 질문까지 미리 점검합니다",
    lens: "면접에서 방어 가능한지 봅니다",
  },
];

const DESKTOP_SCROLL_PREVIEW_QUERY =
  "(min-width: 1024px) and (prefers-reduced-motion: no-preference)";

// 빠르게 스크롤해도 장면은 한 번에 하나씩만 넘어가도록 스텝 사이에 두는
// 최소 간격. AnimatePresence(mode="wait")의 퇴장 450ms + 등장 450ms가 다
// 끝나고도 장면이 잠깐 머무를 만큼 잡는다 — 이보다 짧으면 등장 중인 장면을
// 다음 스텝이 끊어서 두 장면씩 휙휙 넘어가는 것처럼 보인다.
const SCENE_STEP_INTERVAL_MS = 1300;

export function getReportPreviewSceneIndex(progress: number) {
  const clampedProgress = Math.min(1, Math.max(0, progress));

  // 장면 수만큼 균등 분할한다. 마지막 장면에 여분 구간을 주면
  // 다음 섹션으로 넘어가기까지 스크롤이 길어져 답답해진다.
  return Math.min(
    REPORT_PREVIEW_SCENES.length - 1,
    Math.floor(clampedProgress * REPORT_PREVIEW_SCENES.length)
  );
}

export function getBoundedReportPreviewSceneIndex(
  currentIndex: number,
  progress: number
) {
  const targetIndex = getReportPreviewSceneIndex(progress);

  if (targetIndex > currentIndex) return currentIndex + 1;
  if (targetIndex < currentIndex) return currentIndex - 1;

  return currentIndex;
}

export const reportKeywords = [
  "데이터분석",
  "가설검증",
  "고객 중심",
  "빠른 실행력",
  "협업",
];

export const hiringMemoryItems = [
  { mark: "✓", text: "논리적으로 일할 것 같다" },
  { mark: "✓", text: "실행력이 좋아 보인다" },
  { mark: "✓", text: "숫자로 결과를 설명할 수 있다" },
  { mark: "△", text: "모빌리티 맥락은 더 필요하다" },
];

export const mentorCommentPreviews = [
  {
    title: "첫인상",
    numberClassName: "text-[#A7A8FF]",
    text: "데이터를 근거로 문제를 찾고 실행까지 옮기는 사람으로 읽힙니다.",
  },
  {
    title: "보완하면 좋을 점",
    numberClassName: "text-[#D9B94B]",
    text: "성과를 모빌리티 고객 여정과 연결하는 한 문장이 더 필요합니다.",
  },
  {
    title: "면접 체크포인트",
    numberClassName: "text-[#69D5B1]",
    text: "고객군 정의와 판단 기준을 꼬리 질문에도 설명할 수 있어야 합니다.",
  },
];

const strengths = [
  "3,000건 이상의 행동 데이터를 직접 수집하고 분석한 점이 실행력을 보여줍니다.",
  "A/B 테스트와 이탈률 개선 수치가 함께 제시되어 성과가 선명합니다.",
  "문제를 발견한 뒤 기획과 운영까지 연결한 경험이 서비스 기획 직무와 잘 맞습니다.",
];

const gaps = [
  "개선한 지표가 현대자동차의 커넥티드 서비스와 어떻게 연결되는지 더 보여줘야 합니다.",
  "분석 기준과 세그먼트 정의가 빠져 있어 면접에서 추가 질문을 받을 수 있습니다.",
  "협업 과정에서 본인이 어떤 기준으로 의사결정을 이끌었는지 한 장면이 더 필요합니다.",
];

const diagnosisPriorities = [
  "커넥티드 서비스의 고객 여정과 개선 경험을 한 문장으로 연결합니다.",
  "핵심 고객군의 정의와 이탈 신호를 구체적으로 적어 분석의 신뢰를 높입니다.",
  "개발·디자인과의 의견 차이를 조정한 본인만의 판단 과정을 보강합니다.",
];

// 실제 리포트처럼 원문은 이어지는 글로 보여주고,
// 피드백이 달린 문장에만 하이라이트를 얹는다.
const previewAnswer = [
  {
    text: "교내 앱 개발 동아리에서 콘텐츠 추천 플랫폼의 초기 버전을 기획하고 운영했습니다.",
    type: "neutral",
  },
  {
    text: "서비스 오픈 후 두 달이 지나도 재방문율이 기대에 미치지 못했고, 감이 아니라 데이터로 원인을 찾아야 한다고 판단했습니다.",
    type: "neutral",
  },
  {
    text: "직접 3,000건 이상의 유저 행동 데이터를 수집하고 분석했습니다.",
    type: "praise",
    mark: "03",
  },
  {
    text: "화면별 로그를 정리해 사용자가 어느 단계에서 오래 머무르고 어디에서 떠나는지 흐름으로 기록했습니다.",
    type: "neutral",
  },
  {
    text: "유저의 클릭 패턴과 체류 시간을 분석한 결과, 개인화가 부족하다는 점을 파악했습니다.",
    type: "improvement",
    mark: "05",
  },
  {
    text: "가설을 세운 뒤에는 팀원들과 우선순위를 정해 개선 항목을 두 가지로 좁혔습니다.",
    type: "neutral",
  },
  {
    text: "분석 결과를 바탕으로 추천 콘텐츠의 노출 순서를 바꾸고, 개발자와 실험 기간 및 성공 기준을 합의했습니다.",
    type: "praise",
    mark: "07",
  },
  {
    text: "2주 단위로 실험을 반복했고, 가설이 틀렸을 때도 원인을 기록해 다음 실험의 기준으로 삼았습니다.",
    type: "neutral",
  },
  {
    text: "메인 화면 이탈률을 35%에서 18%로 낮췄고, 일간 활성 사용자 수를 20% 늘렸습니다.",
    type: "improvement",
    mark: "09",
  },
  {
    text: "이 경험을 통해 문제를 정의하는 기준이 명확해야 팀 전체가 같은 방향으로 움직인다는 것을 배웠습니다.",
    type: "neutral",
  },
] as const;

const interviewQuestions = [
  {
    question:
      "현대자동차의 모빌리티 서비스를 개선한다면 어떤 데이터를 가장 먼저 볼 것 같나요?",
    followUps: [
      "왜 그 데이터가 가장 중요하다고 생각하나요?",
      "해당 데이터를 수집하려면 어떤 기획이 필요할까요?",
    ],
    answerFocus:
      "차량 연동 기능의 진입률, 기능별 이탈 구간, 재사용 빈도를 고객 여정 순서대로 설명해 보세요.",
  },
  {
    question: "글로벌 고객 타겟팅 시 지역별 특성은 어떻게 파악할 계획인가요?",
    followUps: ["현지 조사가 어렵다면 어떤 데이터를 활용할 수 있을까요?"],
    answerFocus:
      "국가별 이용 시간대, 차량 등급, 기능 사용 빈도를 비교해 가설을 세우는 순서를 설명해 보세요.",
  },
  {
    question:
      "추천 노출 순서를 바꿀 때 어떤 지표가 좋아져야 성공이라고 판단했나요?",
    followUps: ["단기 클릭률이 올라도 장기 만족도를 어떻게 확인할 건가요?"],
    answerFocus:
      "첫 화면 이탈률과 7일 재방문율을 함께 보고, 실험군·대조군의 차이를 판단 근거로 제시하세요.",
  },
];

const actionItems = [
  "마무리 문장에 커넥티드 서비스 맥락 추가",
  "데이터 분석 기준과 세그먼트 정의 보강",
  "협업 문항에서 본인 의사결정 과정 구체화",
  "예상 질문별로 판단 근거와 대안까지 한 문장씩 준비",
];

function MiniReportNavigator({
  activeIndex,
  onSelectScene,
}: {
  activeIndex: number;
  onSelectScene: (index: number) => void;
}) {
  return (
    <nav
      className="hidden xl:block w-[132px] flex-shrink-0 pt-5"
      aria-label="리포트 미리보기 목차"
    >
      <div className="report-nav-list sticky top-24">
        {REPORT_PREVIEW_SCENES.map((scene, index) => {
          const active = index === activeIndex;
          return (
            <button
              key={scene.id}
              type="button"
              className={`report-nav-item w-full text-left ${active ? "active" : ""}`}
              onClick={() => onSelectScene(index)}
            >
              <span className="report-nav-index">{scene.indexLabel}.</span>
              <span>{scene.tab}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function FirstImpressionPreview() {
  return (
    <section className="relative py-1 lg:h-full lg:overflow-hidden">
      {/* 회사·직무 컨텍스트는 프레임 헤더가 이미 보여주므로 별도 헤더를 두지 않는다 */}
      <div className="py-2 text-center lg:py-3">
        <p className="mb-2 text-[13px] text-zinc-300">김민지님은</p>
        <h3 className="mx-auto max-w-2xl text-3xl font-semibold leading-[1.05] tracking-tight text-white sm:text-[2.35rem] md:text-[2.7rem]">
          <span className="block">데이터 기반</span>
          <span className="block">실행형 PM</span>
        </h3>
        <p className="mx-auto mt-3 max-w-2xl text-[13px] leading-[1.65] text-zinc-300 sm:text-[15px]">
          데이터 기반 실행력은 강하지만, 현대자동차 기준 모빌리티 임팩트 연결이
          부족합니다.
        </p>
      </div>

      <div className="relative z-10 flex flex-wrap justify-center gap-2 pb-3">
        {reportKeywords.map(keyword => (
          <span
            key={keyword}
            className="rounded-full border border-white/[0.12] bg-white/[0.045] px-3.5 py-2 text-xs font-semibold text-zinc-300"
          >
            {keyword}
          </span>
        ))}
      </div>

      <div className="relative z-0 grid items-start gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.028] p-3">
          <p className="mb-2 text-sm font-semibold text-white">
            채용담당자가 기억할 모습
          </p>
          <ul className="space-y-1.5">
            {hiringMemoryItems.map(item => (
              <li
                key={item.text}
                className="grid grid-cols-[20px_1fr] gap-2 text-[12px] leading-[1.4] text-zinc-300"
              >
                <span
                  className={`mt-0.5 inline-flex size-[18px] items-center justify-center rounded-full border ${
                    item.mark === "✓"
                      ? "border-emerald-300/25 bg-emerald-400/10 text-emerald-200"
                      : "border-amber-300/30 bg-amber-400/10 text-amber-200"
                  }`}
                >
                  {item.mark === "✓" ? (
                    <Check className="size-3" />
                  ) : (
                    <AlertTriangle className="size-3" />
                  )}
                </span>
                <span className="pt-px">{item.text}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-white/[0.08] bg-white/[0.028] p-3">
          <p className="mb-2 text-sm font-semibold text-white">지원자 프로필</p>
          <p className="text-[12px] leading-[1.6] text-zinc-400">
            지원자는 데이터로 고객의 이탈 원인을 좁히고, 실험 결과를 다음
            개선안에 반영하는 방식에 익숙합니다.
          </p>
          <p className="mt-2 text-[12px] leading-[1.6] text-zinc-500">
            현대자동차에서는 이 역량을 커넥티드 서비스의 기능 탐색과 재사용 경험
            개선으로 연결하면 직무 적합도가 더 선명해집니다.
          </p>
        </div>
      </div>

      <div className="mt-3 rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
        <p className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
          현직자 코멘트
        </p>
        <div className="grid gap-3 md:grid-cols-3">
          {mentorCommentPreviews.map((comment, index) => (
            <blockquote key={comment.title} className="min-w-0">
              <div className="mb-1.5 flex items-center gap-2">
                <span
                  className={`text-[24px] font-extrabold leading-none tracking-[0.08em] opacity-60 ${comment.numberClassName}`}
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                <p className="text-[12px] font-bold text-zinc-100">
                  {comment.title}
                </p>
              </div>
              <p className="text-[11px] leading-[1.5] text-zinc-300">
                {comment.text}
              </p>
            </blockquote>
          ))}
        </div>
      </div>
    </section>
  );
}

function DiagnosisPreview() {
  return (
    <section className="flex flex-col py-3 lg:h-full lg:justify-between lg:overflow-hidden">
      <div>
        <h3 className="mb-1 text-xs font-medium uppercase tracking-[0.15em] text-zinc-500">
          02. 핵심 진단
        </h3>
        <p className="mb-4 break-keep text-[21px] font-semibold leading-[1.35] tracking-tight text-white md:text-[25px]">
          강점은 이미 뚜렷합니다.
          <br />
          <span className="text-amber-200">
            현대자동차와 연결되는 한 장면
          </span>
          이 아직 없습니다.
        </p>
      </div>

      <div className="mb-3 grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-emerald-300/[0.14] bg-emerald-300/[0.035] p-3.5">
          <p className="mb-2.5 flex items-center gap-1.5 text-[13px] font-bold text-emerald-300">
            <Check className="h-3.5 w-3.5" />
            강점
          </p>
          <div className="space-y-2">
            {strengths.map(item => (
              <p
                key={item}
                className="grid grid-cols-[10px_1fr] gap-1.5 text-[12px] leading-[1.5] text-zinc-100"
              >
                <span aria-hidden="true" className="text-emerald-300/60">
                  ·
                </span>
                {item}
              </p>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-amber-200/[0.16] bg-amber-200/[0.04] p-3.5">
          <p className="mb-2.5 flex items-center gap-1.5 text-[13px] font-bold text-amber-200">
            <AlertTriangle className="h-3.5 w-3.5" />
            보완점
          </p>
          <div className="space-y-2">
            {gaps.map(item => (
              <p
                key={item}
                className="grid grid-cols-[10px_1fr] gap-1.5 text-[12px] leading-[1.5] text-zinc-100"
              >
                <span aria-hidden="true" className="text-amber-200/60">
                  ·
                </span>
                {item}
              </p>
            ))}
          </div>
        </div>
      </div>

      <div className="mb-3 rounded-xl border border-white/[0.08] bg-white/[0.03] p-3.5">
        <p className="mb-2.5 text-sm font-semibold text-white">
          우선 보완 순서
        </p>
        <ol className="grid gap-2 md:grid-cols-3">
          {diagnosisPriorities.map((item, index) => (
            <li
              key={item}
              className="rounded-lg border border-white/[0.06] bg-black/20 p-2.5"
            >
              <span className="text-[18px] font-extrabold leading-none text-[#A7A8FF] opacity-70">
                {index + 1}
              </span>
              <p className="mt-1.5 text-[11.5px] leading-[1.5] text-zinc-300">
                {item}
              </p>
            </li>
          ))}
        </ol>
      </div>

      <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3.5">
        <div className="grid items-center gap-3 sm:grid-cols-[1fr_20px_1fr]">
          <div>
            <span className="inline-block rounded-md border border-white/[0.05] bg-zinc-800/80 px-2 py-1 text-[10px] font-semibold text-zinc-400">
              지금 읽히는 모습
            </span>
            <p className="mt-1.5 text-[12px] leading-[1.5] text-zinc-400">
              데이터 툴 활용과 실행력은 검증되었으나, 모빌리티 비즈니스 이해가
              약한 주니어
            </p>
          </div>
          <ArrowRight className="hidden h-4 w-4 text-zinc-600 sm:block" />
          <div>
            <span className="inline-block rounded-md border border-emerald-300/[0.2] bg-emerald-300/[0.06] px-2 py-1 text-[10px] font-semibold text-emerald-200">
              보완하면 읽힐 모습
            </span>
            <p className="mt-1.5 text-[12.5px] font-bold leading-[1.5] text-white">
              데이터 인사이트로 고객 경험을 높이는 모빌리티 PM
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function LineAnalysisPreview() {
  return (
    <section className="flex flex-col gap-3 py-1 lg:h-full lg:overflow-hidden">
      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col">
          <h3 className="text-xs font-medium uppercase tracking-[0.15em] text-zinc-500">
            03. 문장별 상세 진단
          </h3>
          <p className="mt-1 text-xl font-semibold tracking-tight text-white">
            원문 옆에서 바로 확인하는 AI 코멘터리
          </p>
        </div>
        <span className="hidden rounded-full border border-white/[0.06] bg-white/[0.025] px-3 py-1.5 text-[11px] font-medium text-zinc-500 sm:inline-flex">
          문항 1 · 피드백이 필요한 문장 4곳
        </span>
      </div>

      <div className="grid gap-4 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
          <div className="mb-3 flex items-center justify-between border-b border-white/[0.06] pb-3 text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500">
            <span>현대자동차 · 김민지 (예시)</span>
            <span>자소서 문항 1</span>
          </div>
          <p className="mb-3 text-[12px] leading-[1.55] text-zinc-400">
            자신이 주도적으로 문제를 발견하고 해결한 경험에 대해 서술해 주세요.
          </p>
          <p className="text-[12.5px] leading-[1.82] text-zinc-400">
            {previewAnswer.map(line =>
              line.type === "neutral" ? (
                <span key={line.text}>{line.text} </span>
              ) : (
                <span key={line.text}>
                  <span
                    className={`box-decoration-clone rounded-[4px] px-1 py-0.5 ${
                      line.type === "praise"
                        ? "bg-emerald-300/[0.18] text-emerald-100"
                        : "bg-amber-200/[0.18] text-amber-100"
                    }`}
                  >
                    <span
                      className={`mr-1 text-[9.5px] font-bold ${
                        line.type === "praise"
                          ? "text-emerald-300"
                          : "text-amber-200"
                      }`}
                    >
                      {line.mark}
                    </span>
                    {line.text}
                  </span>{" "}
                </span>
              )
            )}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:flex lg:h-full lg:flex-col">
          <div className="rounded-xl border border-white/[0.1] bg-white/[0.04] p-3.5 lg:flex-1">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold text-white">소제목 진단</p>
              <span className="rounded-full bg-amber-200/15 px-2 py-0.5 text-[10px] font-semibold text-amber-100">
                보완
              </span>
            </div>
            <p className="text-[12px] leading-[1.55] text-zinc-300">
              성과는 드러나지만, 어떤 비즈니스 문제를 해결했는지 목적을 먼저
              보여주면 좋습니다.
            </p>
            <p className="mt-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
              수정 방향
            </p>
            <p className="mt-1 text-[12px] font-medium leading-[1.5] text-zinc-100">
              서비스 탐색 이탈률 방어를 위한 3,000건의 고객 데이터 분석
            </p>
          </div>

          <div className="rounded-xl border border-amber-200/[0.3] bg-amber-200/[0.07] p-3.5 lg:flex-1">
            <div className="mb-2 flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-white">
                <span className="inline-flex items-center rounded-[4px] bg-amber-200/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-200">
                  문장 05
                </span>
                수정 제안
              </p>
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-200">
                Why
              </span>
            </div>
            <p className="text-[12.5px] font-medium leading-[1.55] text-amber-50">
              고객군을 나눈 기준을 문장 안에 넣어야 합니다.
            </p>
            <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-200/80">
              판단 근거
            </p>
            <p className="mt-1 text-[11px] leading-[1.5] text-zinc-300">
              분석 기준이 보이면, 성과가 재현 가능한 판단으로 읽힙니다.
            </p>
            <p className="mt-2 border-t border-amber-200/[0.14] pt-2 text-[11px] leading-[1.5] text-zinc-400">
              <span className="mr-1 font-semibold text-amber-200/80">
                수정 예시
              </span>
              신규 가입 후 3일 이내 이탈한 고객군에서 추천 콘텐츠 진입률이
              낮다는 점을 확인했습니다.
            </p>
          </div>

          <div className="rounded-xl border border-emerald-300/[0.28] bg-emerald-300/[0.06] p-3.5 sm:col-span-2 lg:flex-1">
            <div className="mb-2 flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-white">
                <span className="inline-flex items-center rounded-[4px] bg-emerald-300/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-200">
                  문장 03
                </span>
                강점으로 유지
              </p>
              <Check className="h-3.5 w-3.5 text-emerald-200" />
            </div>
            <p className="text-[12.5px] font-medium leading-[1.55] text-emerald-50">
              직접 수집한 데이터 규모가 실행력을 설득합니다. 이 수치는 그대로
              남기고, 수집 기준만 한 줄 덧붙이세요.
            </p>
            <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-200/80">
              면접에서 이어질 질문
            </p>
            <p className="mt-1 text-[11px] leading-[1.5] text-zinc-300">
              어떤 기준으로 데이터를 정제했고, 그 기준이 다음 실험에 어떻게
              반영됐는지까지 준비하세요.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function InterviewAndActionPreview() {
  return (
    <section className="flex flex-col gap-4 py-1 lg:h-full lg:overflow-hidden">
      <div className="grid gap-4 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.86fr)]">
        <div>
          <h3 className="text-xs uppercase tracking-[0.15em] text-zinc-500 mb-1 font-medium">
            04. 예상 질문
          </h3>
          <p className="text-xl font-semibold text-white mb-3 tracking-tight">
            면접에서는 이런 질문이 나올 수 있어요
          </p>
          <div className="flex flex-1 flex-col gap-2">
            {interviewQuestions.map((item, index) => (
              <div
                key={item.question}
                className="flex flex-1 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3"
              >
                <div className="flex items-start gap-3 text-left">
                  <span className="mt-0.5 min-w-[25px] text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
                    Q{index + 1}
                  </span>
                  <div className="flex-1">
                    <p className="text-[12px] leading-[1.55] text-zinc-200">
                      {item.question}
                    </p>
                    <div className="mt-2.5 border-t border-white/[0.06] pt-2.5">
                      <p className="text-[11px] font-semibold text-zinc-100">
                        답변에서 설명할 근거
                      </p>
                      <p className="mt-1 text-[11px] leading-[1.5] text-zinc-500">
                        {item.answerFocus}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col">
          <h3 className="text-xs uppercase tracking-[0.15em] text-zinc-500 mb-1 font-medium">
            05. 액션 플랜
          </h3>
          <p className="text-xl font-semibold text-white mb-3 tracking-tight">
            가장 먼저 고칠 부분부터 정리합니다
          </p>
          <div className="flex flex-1 flex-col gap-2">
            {actionItems.map((item, index) => (
              <div
                key={item}
                className="flex flex-1 items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3"
              >
                <div
                  className={`mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border ${index === 0 ? "border-indigo-500 bg-indigo-500" : "border-zinc-700"}`}
                >
                  {index === 0 && <Check className="h-3 w-3 text-white" />}
                </div>
                <div>
                  <p className="text-[12px] leading-[1.45] text-zinc-200">
                    {item}
                  </p>
                  <p className="mt-1 text-[11px] text-emerald-400/50">
                    예상 효과: 지원 회사와 경험의 연결성이 선명해집니다.
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function ActiveReportScene({ activeIndex }: { activeIndex: number }) {
  const activeScene = REPORT_PREVIEW_SCENES[activeIndex];

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={activeScene.id}
        initial={{ opacity: 0, y: 22, filter: "blur(6px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        exit={{ opacity: 0, y: -22, filter: "blur(6px)" }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="pb-16 lg:h-full lg:pb-0"
      >
        {activeScene.id === "impression" && <FirstImpressionPreview />}
        {activeScene.id === "diagnosis" && <DiagnosisPreview />}
        {activeScene.id === "line" && <LineAnalysisPreview />}
        {activeScene.id === "interview" && <InterviewAndActionPreview />}
      </motion.div>
    </AnimatePresence>
  );
}

function ReportPreviewFrame({
  activeIndex,
  onSelectScene,
  goToPreviousScene,
  goToNextScene,
}: {
  activeIndex: number;
  onSelectScene: (index: number) => void;
  goToPreviousScene: () => void;
  goToNextScene: () => void;
}) {
  const activeScene = REPORT_PREVIEW_SCENES[activeIndex];

  return (
    <div className="relative mx-auto w-full min-w-0 max-w-7xl lg:h-[min(42rem,calc(100svh-4rem))]">
      <div className="flex w-full gap-8 lg:h-full">
        <MiniReportNavigator
          activeIndex={activeIndex}
          onSelectScene={onSelectScene}
        />

        {/* 화살표는 목차 컬럼이 아니라 프레임 양 끝에 붙도록 이 래퍼를 기준으로 띄운다 */}
        <div className="relative min-w-0 flex-1 lg:h-full">
          <button
            type="button"
            aria-label="이전 리포트 미리보기"
            className="absolute left-0 top-1/2 z-20 hidden h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/[0.12] bg-[#090909]/90 text-white shadow-xl shadow-black/30 backdrop-blur transition-colors hover:bg-white hover:text-black lg:flex"
            onClick={goToPreviousScene}
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          <button
            type="button"
            aria-label="다음 리포트 미리보기"
            className="absolute right-0 top-1/2 z-20 hidden h-11 w-11 translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/[0.12] bg-[#090909]/90 text-white shadow-xl shadow-black/30 backdrop-blur transition-colors hover:bg-white hover:text-black lg:flex"
            onClick={goToNextScene}
          >
            <ArrowRight className="h-5 w-5" />
          </button>

          <div className="relative flex min-w-0 flex-col overflow-hidden rounded-xl border border-white/[0.1] bg-[#070707] p-4 shadow-2xl shadow-black/40 md:p-5 lg:h-full">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-400/40 to-transparent" />
            <div className="mb-4 flex flex-col gap-3 border-b border-white/[0.07] pb-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <p className="text-[17px] md:text-[19px] font-semibold tracking-tight text-white">
                    이런 리포트를 받게 됩니다
                  </p>
                  <span className="inline-flex items-baseline gap-1.5 rounded-full border border-white/[0.1] bg-white/[0.05] px-3 py-1 text-[12px] font-semibold text-zinc-200">
                    현대자동차 · 서비스 기획
                    <span className="font-normal text-zinc-500">예시</span>
                  </span>
                </div>
                {/* 리포트 본문의 문장 하이라이트와 같은 형광펜 표현으로 현재 장면의 읽기 기준을 보여준다 */}
                <p className="text-[13px] font-medium text-emerald-100">
                  <span className="box-decoration-clone rounded-[4px] bg-emerald-300/[0.13] px-1.5 py-1">
                    {activeScene.indexLabel}. {activeScene.lens}
                  </span>
                </p>
              </div>
              <div className="flex flex-wrap gap-2 xl:hidden">
                {REPORT_PREVIEW_SCENES.map((scene, index) => (
                  <button
                    key={scene.id}
                    type="button"
                    className={`h-8 rounded-md border px-3 text-[12px] font-medium transition-colors ${
                      index === activeIndex
                        ? "border-blue-500/[0.28] bg-blue-500/[0.12] text-blue-200"
                        : "border-white/[0.07] bg-white/[0.03] text-zinc-500 hover:text-zinc-200"
                    }`}
                    onClick={() => onSelectScene(index)}
                  >
                    {scene.indexLabel}. {scene.tab}
                  </button>
                ))}
              </div>
            </div>

            <div className="lg:min-h-0 lg:flex-1">
              <ActiveReportScene activeIndex={activeIndex} />
            </div>

            <div className="mt-3 flex shrink-0 items-center justify-between gap-4 border-t border-white/[0.07] pt-3">
              <div className="flex min-w-0 items-center gap-2 text-[11px] text-zinc-500">
                <span className="font-medium tabular-nums text-zinc-400">
                  {String(activeIndex + 1).padStart(2, "0")} /{" "}
                  {String(REPORT_PREVIEW_SCENES.length).padStart(2, "0")}
                </span>
              </div>

              <div className="flex items-center gap-2 lg:hidden">
                <button
                  type="button"
                  aria-label="이전 리포트 미리보기"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.08] bg-[#090909]/90 text-zinc-400 transition-colors hover:bg-white hover:text-black"
                  onClick={goToPreviousScene}
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label="다음 리포트 미리보기"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.08] bg-[#090909]/90 text-zinc-400 transition-colors hover:bg-white hover:text-black"
                  onClick={goToNextScene}
                >
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ReportShowcase() {
  const [, navigate] = useLocation();
  const [activeIndex, setActiveIndex] = useState(0);
  const [isScrollDriven, setIsScrollDriven] = useState(false);
  const scrollTrackRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: scrollTrackRef,
    offset: ["start start", "end end"],
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia(DESKTOP_SCROLL_PREVIEW_QUERY);
    const updateScrollMode = () => setIsScrollDriven(mediaQuery.matches);

    updateScrollMode();
    mediaQuery.addEventListener("change", updateScrollMode);

    return () => mediaQuery.removeEventListener("change", updateScrollMode);
  }, []);

  // 스크롤 위치가 한 번에 두 장면 이상 건너뛰더라도, 화면은 스텝 간격을
  // 지키며 한 장면씩 따라간다. 스크롤이 멈춘 뒤에도 목표 장면까지 마저 간다.
  const activeIndexRef = useRef(activeIndex);
  activeIndexRef.current = activeIndex;
  const targetProgressRef = useRef(0);
  const lastStepAtRef = useRef(0);
  const stepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stepSceneTowardScroll = () => {
    stepTimerRef.current = null;

    const nextIndex = getBoundedReportPreviewSceneIndex(
      activeIndexRef.current,
      targetProgressRef.current
    );
    if (nextIndex === activeIndexRef.current) return;

    lastStepAtRef.current = Date.now();
    activeIndexRef.current = nextIndex;
    setActiveIndex(nextIndex);
    scheduleSceneStep();
  };

  const scheduleSceneStep = () => {
    if (stepTimerRef.current !== null) return;

    const wait = Math.max(
      0,
      SCENE_STEP_INTERVAL_MS - (Date.now() - lastStepAtRef.current)
    );
    stepTimerRef.current = setTimeout(stepSceneTowardScroll, wait);
  };

  useMotionValueEvent(scrollYProgress, "change", progress => {
    if (!isScrollDriven) return;

    targetProgressRef.current = progress;
    scheduleSceneStep();
  });

  useEffect(() => {
    return () => {
      if (stepTimerRef.current !== null) clearTimeout(stepTimerRef.current);
    };
  }, []);

  const goToPreviousScene = () => {
    // 수동 이동 직후에는 스크롤 보정이 바로 덮어쓰지 않도록 간격을 초기화한다.
    lastStepAtRef.current = Date.now();
    setActiveIndex(index =>
      index === 0 ? REPORT_PREVIEW_SCENES.length - 1 : index - 1
    );
  };

  const goToNextScene = () => {
    lastStepAtRef.current = Date.now();
    setActiveIndex(index => (index + 1) % REPORT_PREVIEW_SCENES.length);
  };

  return (
    <section
      id="service-intro"
      className="py-24 md:py-40 border-t border-white/[0.04]"
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-10">
        <div className="text-center mb-14 md:mb-20">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-gray-600 tracking-widest uppercase mb-4">
            <span className="w-4 h-px bg-gray-700" />
            리포트 미리보기
          </span>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-5">
            합격을 설계하는 인사이트 리포트
          </h2>
          <p className="text-[15px] md:text-[16px] text-gray-500 font-light leading-[1.8] max-w-2xl mx-auto">
            점수를 매기기보다, 면접관이 실제로 판단하는 흐름대로 읽습니다. 실제
            리포트 화면 그대로 — 첫인상부터 문장 근거, 예상 질문까지 확인하세요.
          </p>
        </div>

        <div
          ref={scrollTrackRef}
          className={isScrollDriven ? "relative h-[400vh]" : "relative"}
        >
          <div
            className={
              isScrollDriven
                ? "sticky top-0 flex min-h-screen w-full items-center justify-center py-8"
                : ""
            }
          >
            <ReportPreviewFrame
              activeIndex={activeIndex}
              onSelectScene={setActiveIndex}
              goToPreviousScene={goToPreviousScene}
              goToNextScene={goToNextScene}
            />
          </div>
        </div>

        {/* 리포트를 다 본 직후가 설득이 가장 뜨거운 지점 — 중간 CTA */}
        <div className="mt-14 text-center md:mt-16">
          <button
            className="landing-primary-cta group"
            onClick={() => navigate("/analyze")}
          >
            <span className="relative z-10">내 자소서 분석해보기</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform duration-200" />
          </button>
          <p className="mt-3.5 text-[12.5px] text-zinc-500">
            첫 분석 무료 <span className="text-zinc-700">·</span> 리포트는 1분
            안에
          </p>
        </div>
      </div>
    </section>
  );
}
