import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  ListChecks,
  Type,
} from "lucide-react";
import { useEffect, useState } from "react";

type PreviewScene = {
  id: string;
  indexLabel: string;
  tab: string;
  eyebrow: string;
  title: string;
};

export const REPORT_PREVIEW_SCENES: PreviewScene[] = [
  {
    id: "impression",
    indexLabel: "01",
    tab: "첫인상",
    eyebrow: "First Read",
    title: "데이터 기반 실행형 PM",
  },
  {
    id: "diagnosis",
    indexLabel: "02",
    tab: "핵심 진단",
    eyebrow: "Core Diagnosis",
    title: "강점은 뚜렷하지만 회사 맥락이 약합니다",
  },
  {
    id: "line",
    indexLabel: "03",
    tab: "문장 피드백",
    eyebrow: "Line-by-line",
    title: "원문 옆에서 문장별 피드백을 바로 확인합니다",
  },
  {
    id: "interview",
    indexLabel: "04",
    tab: "예상 질문",
    eyebrow: "Interview Drill",
    title: "면접에서 이어질 질문까지 미리 점검합니다",
  },
];

const reportKeywords = ["데이터분석", "가설검증", "고객 중심", "빠른 실행력", "협업"];

const hiringMemoryItems = [
  { mark: "✓", text: "논리적으로 일할 것 같다" },
  { mark: "✓", text: "실행력이 좋아 보인다" },
  { mark: "△", text: "모빌리티 맥락은 더 필요하다" },
];

const strengths = [
  "3,000건 이상의 행동 데이터를 직접 수집하고 분석한 점이 실행력을 보여줍니다.",
  "A/B 테스트와 이탈률 개선 수치가 함께 제시되어 성과가 선명합니다.",
];

const gaps = [
  "개선한 지표가 현대자동차의 커넥티드 서비스와 어떻게 연결되는지 더 보여줘야 합니다.",
  "분석 기준과 세그먼트 정의가 빠져 있어 면접에서 추가 질문을 받을 수 있습니다.",
];

const previewAnswer = [
  {
    text: "교내 앱 개발 동아리에서 콘텐츠 추천 플랫폼의 초기 버전을 기획하고 운영했습니다.",
    type: "neutral",
  },
  {
    text: "직접 3,000건 이상의 유저 행동 데이터를 수집하고 분석했습니다.",
    type: "praise",
  },
  {
    text: "유저의 클릭 패턴과 체류 시간을 분석한 결과, 개인화가 부족하다는 점을 파악했습니다.",
    type: "improvement",
  },
  {
    text: "메인 화면 이탈률을 35%에서 18%로 낮췄고, 일간 활성 사용자 수를 20% 늘렸습니다.",
    type: "praise",
  },
] as const;

const interviewQuestions = [
  {
    question: "현대자동차의 모빌리티 서비스를 개선한다면 어떤 데이터를 가장 먼저 볼 것 같나요?",
    followUps: ["왜 그 데이터가 가장 중요하다고 생각하나요?", "해당 데이터를 수집하려면 어떤 기획이 필요할까요?"],
  },
  {
    question: "글로벌 고객 타겟팅 시 지역별 특성은 어떻게 파악할 계획인가요?",
    followUps: ["현지 조사가 어렵다면 어떤 데이터를 활용할 수 있을까요?"],
  },
];

const actionItems = [
  "마무리 문장에 커넥티드 서비스 맥락 추가",
  "데이터 분석 기준과 세그먼트 정의 보강",
  "협업 문항에서 본인 의사결정 과정 구체화",
];

function MiniReportNavigator({
  activeIndex,
  onSelectScene,
}: {
  activeIndex: number;
  onSelectScene: (index: number) => void;
}) {
  return (
    <nav className="hidden xl:block w-[132px] flex-shrink-0 pt-5" aria-label="리포트 미리보기 목차">
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
    <section className="relative overflow-hidden rounded-2xl border border-white/[0.12] bg-[#0B0B0E] px-5 py-6 sm:px-7 sm:py-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(255,255,255,0.08),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.035),transparent_50%)]" />
      <div className="relative flex flex-col gap-2 border-b border-white/[0.06] pb-4 text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
        <span>PassMate Report</span>
        <span>First Read · 현대자동차</span>
      </div>

      <div className="relative py-10 text-center md:py-12">
        <p className="mb-4 text-[14px] text-zinc-300">김민지님은</p>
        <h3 className="mx-auto max-w-2xl text-[2.2rem] font-semibold leading-[1.05] tracking-tight text-white sm:text-[3rem] md:text-[3.7rem]">
          <span className="block">데이터 기반</span>
          <span className="block">실행형 PM</span>
        </h3>
        <p className="mx-auto mt-6 max-w-2xl text-[15px] leading-[1.75] text-zinc-300 sm:text-[17px]">
          데이터 기반 실행력은 강하지만, 현대자동차 기준 모빌리티 임팩트 연결이 부족합니다.
        </p>
      </div>

      <div className="relative flex flex-wrap justify-center gap-2 pb-6">
        {reportKeywords.map((keyword) => (
          <span key={keyword} className="rounded-full border border-white/[0.07] bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-zinc-400">
            {keyword}
          </span>
        ))}
      </div>

      <div className="relative grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-5">
          <p className="mb-3 text-sm font-semibold text-white">채용담당자가 기억할 모습</p>
          <ul className="space-y-2.5">
            {hiringMemoryItems.map((item) => (
              <li key={item.text} className="grid grid-cols-[18px_1fr] gap-2.5 text-sm leading-[1.55] text-zinc-300">
                <span className="font-semibold text-zinc-100">{item.mark}</span>
                <span>{item.text}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-5">
          <p className="mb-3 text-sm font-semibold text-white">지원자 프로필</p>
          <p className="text-sm leading-[1.7] text-zinc-400">
            문제를 발견하고 근거를 모아 실행으로 옮기는 지원자라는 인상이 먼저 남습니다.
          </p>
        </div>
      </div>
    </section>
  );
}

function DiagnosisPreview() {
  return (
    <section className="py-8">
      <h3 className="text-sm uppercase tracking-[0.15em] text-zinc-500 mb-4 font-medium">02. 핵심 진단</h3>
      <p className="text-2xl font-semibold text-white mb-10 tracking-tight">현대자동차 기준 강점과 보완점</p>

      <div className="grid gap-8 md:grid-cols-2 mb-10">
        <div>
          <p className="text-sm text-emerald-400/70 uppercase tracking-[0.12em] mb-5 font-semibold">강점</p>
          <div className="space-y-5">
            {strengths.map((item) => (
              <p key={item} className="text-[15px] text-zinc-100 leading-[1.8]">{item}</p>
            ))}
          </div>
        </div>
        <div>
          <p className="text-sm text-amber-300/60 uppercase tracking-[0.12em] mb-5 font-semibold">보완점</p>
          <div className="space-y-5">
            {gaps.map((item) => (
              <p key={item} className="text-[15px] text-zinc-300 leading-[1.8]">{item}</p>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-white/[0.05] bg-white/[0.03] p-6">
        <p className="text-sm text-zinc-400 uppercase tracking-[0.12em] mb-5 font-semibold">전략적 포지셔닝</p>
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <span className="inline-block rounded-md border border-white/[0.05] bg-zinc-800/80 px-3 py-1.5 text-xs font-semibold text-zinc-300">현재 위치</span>
            <p className="mt-3 text-sm leading-[1.7] text-zinc-400">데이터 툴 활용과 실행력은 검증되었으나, 모빌리티 비즈니스 이해가 약한 주니어</p>
          </div>
          <div>
            <span className="inline-block rounded-md border border-white/[0.05] bg-zinc-800/80 px-3 py-1.5 text-xs font-semibold text-zinc-300">목표 포지션</span>
            <p className="mt-3 text-[15px] font-bold leading-[1.7] text-white">데이터 인사이트로 고객 경험을 높이는 모빌리티 PM</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function LineAnalysisPreview() {
  return (
    <section className="py-8">
      <h3 className="text-sm uppercase tracking-[0.15em] text-zinc-500 mb-4 font-medium">03. 문장별 상세 진단</h3>
      <p className="text-2xl font-semibold text-white mb-10 tracking-tight">원문과 AI 코멘터리를 나란히 확인합니다</p>

      <div className="grid gap-0 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <div className="lg:pr-8">
          <div className="doc-header mb-5">
            <span>현대자동차</span>
            <span className="separator">·</span>
            <span>김민지</span>
          </div>
          <div className="flex items-center border-b border-white/[0.06] mb-7">
            <button className="section-tab active">문항 1</button>
            <button className="section-tab">문항 2</button>
          </div>
          <p className="question-prompt mb-7">자신이 주도적으로 문제를 발견하고 해결한 경험에 대해 서술해 주세요.</p>

          <div className="source-text-body original-text-dimmed">
            {previewAnswer.map((line, index) => {
              const typeClass = line.type === "praise" ? "praise-hl" : line.type === "improvement" ? "improvement-hl" : "";
              if (!typeClass) return <p key={line.text}>{line.text}</p>;
              return (
                <p key={line.text}>
                  <span className={`annotation-hl ${typeClass}`}>
                    {line.text}
                    <span className="annotation-num">{index}</span>
                  </span>
                </p>
              );
            })}
          </div>
        </div>

        <div className="mt-10 lg:mt-0 lg:border-l lg:border-white/[0.06] lg:pl-8">
          <div className="mb-5 flex items-center justify-between">
            <p className="text-sm font-semibold uppercase tracking-[0.15em] text-zinc-500">AI Commentary</p>
            <div className="view-mode-toggle">
              <button className="view-mode-btn active">목록</button>
              <button className="view-mode-btn">집중</button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-white/[0.06] bg-zinc-900/40 p-5">
              <button className="flex w-full items-center justify-between text-left">
                <span className="panel-header flex items-center gap-3 text-zinc-50"><Type className="h-5 w-5 text-zinc-300" />소제목 진단</span>
                <ChevronDown className="h-4 w-4 text-zinc-500 rotate-180" />
              </button>
              <div className="mt-4 border-t border-white/[0.04] pt-4">
                <p className="commentary-body-text">성과는 드러나지만 추천 개선이 어떤 비즈니스 문제를 해결했는지 목적이 더 명확하면 좋습니다.</p>
                <p className="commentary-label">소제목 수정 제안</p>
                <p className="commentary-headline">서비스 탐색 이탈률 15% 방어를 위한 3,000건의 고객 데이터 분석</p>
              </div>
            </div>

            <div className="rounded-2xl border border-white/[0.06] bg-zinc-900/40 p-5">
              <div className="mb-5 flex items-center gap-3">
                <ListChecks className="h-5 w-5 text-zinc-300" />
                <span className="panel-header text-zinc-50">문장 진단</span>
              </div>
              <div className="commentary-item improvement expanded focused">
                <button className="commentary-trigger">
                  <span className="commentary-num">3</span>
                  <span className="commentary-preview flex-1 min-w-0">분석의 깊이가 다소 얕게 느껴집니다.</span>
                  <ChevronDown className="commentary-chevron rotate-180" />
                </button>
                <div className="commentary-body pt-2">
                  <p className="commentary-body-text">클릭 패턴과 체류 시간만으로 개인화 부족을 도출한 과정에 논리적 비약이 있을 수 있습니다.</p>
                  <p className="commentary-label">개선한 문장</p>
                  <p className="commentary-headline">신규 가입 후 3일 내 특정 기능만 소비하는 고객군에서 이탈률이 두드러짐을 확인했습니다.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function InterviewAndActionPreview() {
  return (
    <section className="py-8">
      <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.86fr)]">
        <div>
          <h3 className="text-sm uppercase tracking-[0.15em] text-zinc-500 mb-4 font-medium">04. 예상 질문</h3>
          <p className="text-2xl font-semibold text-white mb-8 tracking-tight">면접에서는 이런 질문이 나올 수 있어요</p>
          <div className="space-y-0">
            {interviewQuestions.map((item, index) => (
              <div key={item.question} className="border-b border-white/[0.04] last:border-0">
                <div className="flex items-start gap-5 py-5 text-left">
                  <span className="mt-1 min-w-[44px] text-xs font-medium uppercase tracking-[0.12em] text-zinc-500">Q{index + 1}</span>
                  <div className="flex-1">
                    <p className="text-[16px] leading-[1.6] text-zinc-300">{item.question}</p>
                    <ul className="mt-4 space-y-2">
                      {item.followUps.map((followUp) => (
                        <li key={followUp} className="flex items-start gap-2.5 text-[14px] leading-[1.7] text-zinc-500">
                          <ArrowRight className="mt-1.5 h-3 w-3 shrink-0 text-amber-300/35" />
                          {followUp}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-sm uppercase tracking-[0.15em] text-zinc-500 mb-4 font-medium">05. 액션 플랜</h3>
          <p className="text-2xl font-semibold text-white mb-8 tracking-tight">가장 먼저 고칠 부분부터 정리합니다</p>
          <div className="space-y-0">
            {actionItems.map((item, index) => (
              <div key={item} className="flex items-start gap-5 border-b border-white/[0.03] py-5 last:border-0">
                <div className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border ${index === 0 ? "border-indigo-500 bg-indigo-500" : "border-zinc-700"}`}>
                  {index === 0 && <Check className="h-3 w-3 text-white" />}
                </div>
                <div>
                  <p className="text-base leading-[1.6] text-zinc-200">{item}</p>
                  <p className="mt-2 text-sm text-emerald-400/50">예상 효과: 지원 회사와 경험의 연결성이 선명해집니다.</p>
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
        className="min-h-[780px]"
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
  return (
    <div className="relative max-w-7xl mx-auto">
      <button
        type="button"
        aria-label="이전 리포트 미리보기"
        className="absolute left-0 top-[430px] z-20 hidden h-11 w-11 -translate-x-1/2 items-center justify-center rounded-full border border-white/[0.12] bg-[#090909]/90 text-white shadow-xl shadow-black/30 backdrop-blur transition-colors hover:bg-white hover:text-black lg:flex"
        onClick={goToPreviousScene}
      >
        <ArrowLeft className="h-5 w-5" />
      </button>

      <button
        type="button"
        aria-label="다음 리포트 미리보기"
        className="absolute right-0 top-[430px] z-20 hidden h-11 w-11 translate-x-1/2 items-center justify-center rounded-full border border-white/[0.12] bg-[#090909]/90 text-white shadow-xl shadow-black/30 backdrop-blur transition-colors hover:bg-white hover:text-black lg:flex"
        onClick={goToNextScene}
      >
        <ArrowRight className="h-5 w-5" />
      </button>

      <div className="flex gap-8">
        <MiniReportNavigator activeIndex={activeIndex} onSelectScene={onSelectScene} />

        <div className="relative min-h-[900px] flex-1 overflow-hidden rounded-xl border border-white/[0.1] bg-[#070707] p-4 shadow-2xl shadow-black/40 md:p-7">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-400/40 to-transparent" />
          <div className="mb-7 flex flex-col gap-4 border-b border-white/[0.07] pb-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[11px] text-gray-600 tracking-widest uppercase mb-1">PassMate Report Preview</p>
              <p className="text-[15px] text-zinc-200 font-medium">현대자동차 · 서비스 기획</p>
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

          <ActiveReportScene activeIndex={activeIndex} />

          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#070707] to-transparent" />
          <div className="absolute bottom-4 right-4 z-10 flex items-center gap-2 md:bottom-6 md:right-6">
            <button
              type="button"
              aria-label="이전 리포트 미리보기"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.08] bg-[#090909]/90 text-zinc-400 transition-colors hover:bg-white hover:text-black lg:hidden"
              onClick={goToPreviousScene}
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <span className="rounded-full border border-white/[0.07] bg-[#090909]/90 px-3 py-2 text-[12px] text-zinc-600">
              {String(activeIndex + 1).padStart(2, "0")} / {String(REPORT_PREVIEW_SCENES.length).padStart(2, "0")}
            </span>
            <button
              type="button"
              aria-label="다음 리포트 미리보기"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.08] bg-[#090909]/90 text-zinc-400 transition-colors hover:bg-white hover:text-black lg:hidden"
              onClick={goToNextScene}
            >
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ReportShowcase() {
  const [activeIndex, setActiveIndex] = useState(0);

  const goToPreviousScene = () => {
    setActiveIndex((index) =>
      index === 0 ? REPORT_PREVIEW_SCENES.length - 1 : index - 1
    );
  };

  const goToNextScene = () => {
    setActiveIndex((index) => (index + 1) % REPORT_PREVIEW_SCENES.length);
  };

  useEffect(() => {
    const timer = window.setInterval(() => {
      goToNextScene();
    }, 5200);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <section className="py-24 md:py-40 border-t border-white/[0.04]">
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
            강점은 더 선명하게, 빈틈은 더 꼼꼼하게. 자소서가 면접관에게 어떻게 읽힐지 리포트로 확인하세요.
          </p>
        </div>

        <ReportPreviewFrame
          activeIndex={activeIndex}
          onSelectScene={setActiveIndex}
          goToPreviousScene={goToPreviousScene}
          goToNextScene={goToNextScene}
        />
      </div>
    </section>
  );
}
