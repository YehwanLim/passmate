import { Calendar, FileText, ClipboardCheck, Building2 } from "lucide-react";
import type { ProjectSummary } from "@/types/my";
import KebabMenu, { createDefaultKebabItems } from "./KebabMenu";
import { formatDate } from "@/lib/formatDate";
import { daysUntil } from "@/lib/workspace";
import { WORKSPACE_COPY } from "@/pages/workspaceCopy";

interface ProjectCardProps {
  project: ProjectSummary;
  onViewQuestions: () => void;
  onViewReport: () => void;
  onDelete?: () => void;
}

function formatChars(chars: number | null): string {
  if (!chars) return "—";
  return chars.toLocaleString();
}

function deadlineBadge(deadline: string | null | undefined): string | null {
  const days = daysUntil(deadline ?? null);
  if (days === null) return null;
  if (days < 0) return WORKSPACE_COPY.deadlinePassed;
  if (days === 0) return WORKSPACE_COPY.deadlineToday;
  return WORKSPACE_COPY.deadlineDays(days);
}

export default function ProjectCard({
  project,
  onViewQuestions,
  onViewReport,
  onDelete,
}: ProjectCardProps) {
  const kebabItems = createDefaultKebabItems({ onDelete });
  const isCompany = project.kind === "COMPANY";
  const keywords = project.keywords ?? [];
  // 상태는 서버가 내려준 최신 analysis 기준으로만 판단한다. 키워드가 비었다고 대기중으로 보지 않는다
  // (구버전 리포트는 키워드 필드가 없을 수 있다).
  const isPending = project.latest_status === "PENDING";
  const isFailed = project.latest_status === "FAILED";
  // "새 지원서"로 만들고 아직 진단받지 않은 지원서: 리포트가 없으니 작성 화면이 주 동작이다.
  const isDraftOnly = !isCompany && !project.latest_analysis_id;
  const summaryFallback = isDraftOnly
    ? WORKSPACE_COPY.draftCard.summary
    : isPending
    ? "아직 분석이 완료되지 않았습니다."
    : isFailed
      ? "분석에 실패했습니다. 다시 시도해 주세요."
      : "한줄 요약이 없는 리포트입니다.";
  const keywordFallback = isPending ? "분석 대기중" : isFailed ? "분석 실패" : null;
  const badge = deadlineBadge(project.deadline);
  const draftTotal = project.draft_question_count ?? 0;

  return (
    <div data-testid="application-card" className="relative border border-zinc-800 bg-zinc-900/80 rounded-xl p-4 lg:px-5 lg:py-4 transition-colors duration-200 hover:border-zinc-700 group">
      {/* 모바일 대응: 케밥 메뉴를 우측 상단 절대위치로 뺌 */}
      <div className="absolute top-3 right-3 lg:hidden z-10">
        {kebabItems.length > 0 && <KebabMenu items={kebabItems} />}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 lg:gap-6">
        {/* ───────────────────────────────────────────────────────────── */}
        {/* 1️⃣ [좌측] 상세 정보 영역 (col-span-3) */}
        {/* ───────────────────────────────────────────────────────────── */}
        <div className="lg:col-span-3 flex flex-col justify-center">
          {/* 회사/직무 — 카드의 메인 타이틀. 직무는 색 칩 대신 제목 아래 부제로 둔다(긴 직무명도 안 잘림). */}
          <div className="flex items-center gap-2.5 min-w-0 flex-wrap">
            {project.id === "mock-proj-1" && (
              <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 whitespace-nowrap">
                샘플
              </span>
            )}
            {isCompany && (
              <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-bold bg-sky-500/15 text-sky-300 border border-sky-400/25 whitespace-nowrap">
                기업 분석
              </span>
            )}
            <h3 className="text-[16px] font-bold text-zinc-50 tracking-tight truncate">
              {project.company_name || project.title || "기업 미지정"}
            </h3>
          </div>
          {project.job_role && (
            <p className="mt-0.5 text-[12.5px] font-medium leading-snug text-zinc-400">
              {project.job_role}
            </p>
          )}
          {(badge || draftTotal > 0) && (
            <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
              {badge && <span className="text-[12px] font-semibold text-zinc-200">{badge}</span>}
              {draftTotal > 0 && (
                <span className="text-[12px] text-zinc-500">
                  {WORKSPACE_COPY.progress(project.answered_count ?? 0, draftTotal)}
                </span>
              )}
            </div>
          )}

          {/* 아이콘 메타 정보 묶음 */}
          {/* 메타는 한 줄로: 두 줄로 쌓으면 카드 높이만 커진다 */}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-zinc-500 font-light">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3 h-3" />
              <span>{formatDate(project.created_at, "ymd-dot")} 작성됨</span>
            </div>
            <div className="flex items-center gap-1.5">
              {isCompany ? <Building2 className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
              <span>{isCompany
                  ? "기업 분석 리포트"
                  : `${isDraftOnly ? draftTotal : project.question_count ?? project.analysis_count}개 문항`}</span>
            </div>
          </div>
        </div>

        {/* ───────────────────────────────────────────────────────────── */}
        {/* 2️⃣ [중앙] 피드백 대시보드 영역 (col-span-6) */}
        {/* ───────────────────────────────────────────────────────────── */}
        <div className="lg:col-span-6 flex flex-col justify-center border-t lg:border-t-0 lg:border-l border-zinc-800/50 pt-3 lg:pt-0 lg:pl-6">
          {/* 진단 전 지원서에는 요약이 없으니 "한줄 요약" 이름표를 달지 않는다 */}
          {!isDraftOnly && (
            <span className="text-[11px] font-semibold text-zinc-500 mb-1 tracking-wide">
              한줄 요약
            </span>
          )}
          <p className="line-clamp-2 text-[14px] text-zinc-100 font-semibold leading-[1.55] break-keep">
            {isDraftOnly ? summaryFallback : `"${project.summary || summaryFallback}"`}
          </p>

          <div className="mt-1.5">
            <div className="flex flex-wrap gap-x-2.5 gap-y-1">
              {keywords.length > 0 ? (
                // 키워드는 앞 4개만 — 다 늘어놓으면 줄이 늘어 카드가 커진다
                keywords.slice(0, 4).map((kw, idx) => (
                  <span key={idx} className="text-[12px] font-medium text-zinc-500">
                    #{kw}
                  </span>
                ))
              ) : keywordFallback ? (
                <span className="text-[12px] font-medium text-zinc-500 bg-zinc-800/50 px-2.5 py-1 rounded-md border border-zinc-700/50">
                  {keywordFallback}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        {/* ───────────────────────────────────────────────────────────── */}
        {/* 3️⃣ [우측] 액션 그룹 (col-span-3) */}
        {/* ───────────────────────────────────────────────────────────── */}
        <div className="lg:col-span-3 flex flex-col border-t lg:border-t-0 lg:border-l border-zinc-800/50 pt-3 lg:pt-0 lg:pl-6">

          {/* 데스크탑: 케밥 메뉴를 버튼 위 전용 줄에 배치(절대위치 제거 → 버튼과 안 겹침) */}
          <div className="hidden lg:flex justify-end -mt-1 -mr-2">
            {kebabItems.length > 0 && <KebabMenu items={kebabItems} />}
          </div>

          <div className="flex flex-row gap-2 my-auto lg:flex-col">
            {isDraftOnly ? (
              <button
                onClick={(e) => { e.stopPropagation(); onViewQuestions(); }}
                className="w-full flex items-center justify-center gap-1.5 h-9 rounded-lg bg-white text-[13px] font-semibold text-black hover:bg-zinc-200 transition-all duration-200"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>{WORKSPACE_COPY.draftCard.open}</span>
              </button>
            ) : (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onViewReport();
                }}
                className="w-full flex items-center justify-center gap-1.5 h-9 rounded-lg bg-white text-[13px] font-semibold text-black hover:bg-zinc-200 transition-all duration-200"
              >
                <ClipboardCheck className="w-3.5 h-3.5" />
                <span>리포트 보기</span>
              </button>
            )}
            {isCompany || isDraftOnly ? null : (
              <button
                onClick={(e) => { e.stopPropagation(); onViewQuestions(); }}
                className="w-full flex items-center justify-center gap-1.5 h-9 rounded-lg border border-zinc-700 bg-zinc-800/40 text-[13px] font-medium text-zinc-300 hover:bg-zinc-700/60 hover:text-zinc-100 transition-all duration-200"
              >
                <FileText className="w-3.5 h-3.5 text-zinc-500" />
                <span>작성한 자소서 보기</span>
              </button>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
