import { Calendar, FileText, ClipboardCheck } from "lucide-react";
import type { ProjectSummary } from "@/types/my";
import KebabMenu, { createDefaultKebabItems } from "./KebabMenu";

interface ProjectCardProps {
  project: ProjectSummary;
  onViewQuestions: () => void;
  onViewReport: () => void;
  onDelete?: () => void;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

function formatChars(chars: number | null): string {
  if (!chars) return "—";
  return chars.toLocaleString();
}

export default function ProjectCard({
  project,
  onViewQuestions,
  onViewReport,
  onDelete,
}: ProjectCardProps) {
  const kebabItems = createDefaultKebabItems({ onDelete });

  return (
    <div className="relative border border-zinc-800 bg-zinc-900/80 rounded-2xl p-6 lg:p-7 transition-all duration-300 hover:border-zinc-700 hover:shadow-lg hover:shadow-black/20 group">
      {/* 모바일 대응: 케밥 메뉴를 우측 상단 절대위치로 뺌 */}
      <div className="absolute top-6 right-5 lg:hidden z-10">
        {kebabItems.length > 0 && <KebabMenu items={kebabItems} />}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
        {/* ───────────────────────────────────────────────────────────── */}
        {/* 1️⃣ [좌측] 상세 정보 영역 (col-span-3) */}
        {/* ───────────────────────────────────────────────────────────── */}
        <div className="lg:col-span-3 flex flex-col justify-center">
          {/* 회사/직무 — 카드의 메인 타이틀 (한 번만, 크게, 직무는 오른쪽 태그) */}
          <div className="flex items-center gap-2.5 mb-5 min-w-0 flex-wrap">
            {project.id === "mock-proj-1" && (
              <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 whitespace-nowrap">
                샘플
              </span>
            )}
            <h3 className="text-[20px] font-bold text-zinc-50 tracking-tight truncate">
              {project.company_name || project.title || "기업 미지정"}
            </h3>
            {project.job_role && (
              <span className="shrink-0 inline-flex items-center px-2.5 py-1 rounded-md bg-blue-500/10 border border-blue-400/20 text-[12px] font-semibold text-blue-300">
                {project.job_role}
              </span>
            )}
          </div>

          {/* 아이콘 메타 정보 묶음 */}
          <div className="flex flex-col gap-2.5 text-[12px] text-zinc-500 font-light">
            <div className="flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5" />
              <span>{formatDate(project.created_at)} 작성됨</span>
            </div>
            <div className="flex items-center gap-2">
              <FileText className="w-3.5 h-3.5" />
              <span>{project.question_count ?? project.analysis_count}개 문항</span>
            </div>
          </div>
        </div>

        {/* ───────────────────────────────────────────────────────────── */}
        {/* 2️⃣ [중앙] 피드백 대시보드 영역 (col-span-6) */}
        {/* ───────────────────────────────────────────────────────────── */}
        <div className="lg:col-span-6 flex flex-col justify-center border-t lg:border-t-0 lg:border-l border-zinc-800/50 pt-5 lg:pt-0 lg:pl-8">
          <span className="text-[12px] font-semibold text-zinc-500 mb-2.5 tracking-wide">
            한줄 요약
          </span>
          <p className="text-[17px] text-zinc-100 font-semibold leading-[1.6] mb-6 line-clamp-2">
            "{project.summary || "아직 분석이 완료되지 않았습니다."}"
          </p>

          <div className="mt-auto">
            <div className="flex flex-wrap gap-2.5">
              {project.keywords && project.keywords.length > 0 ? (
                project.keywords.map((kw, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center px-4 py-2 rounded-lg bg-blue-500/20 border border-blue-400/30 text-[14px] font-bold text-blue-300 shadow-[0_0_15px_rgba(59,130,246,0.1)]"
                  >
                    {kw}
                  </span>
                ))
              ) : (
                <span className="text-[14px] font-medium text-zinc-500 bg-zinc-800/50 px-4 py-2 rounded-lg border border-zinc-700/50">
                  분석 대기중
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ───────────────────────────────────────────────────────────── */}
        {/* 3️⃣ [우측] 액션 그룹 (col-span-3) */}
        {/* ───────────────────────────────────────────────────────────── */}
        <div className="lg:col-span-3 flex flex-col border-t lg:border-t-0 lg:border-l border-zinc-800/50 pt-6 lg:pt-0 lg:pl-8">

          {/* 데스크탑: 케밥 메뉴를 버튼 위 전용 줄에 배치(절대위치 제거 → 버튼과 안 겹침) */}
          <div className="hidden lg:flex justify-end -mt-2 -mr-2">
            {kebabItems.length > 0 && <KebabMenu items={kebabItems} />}
          </div>

          <div className="flex flex-col gap-3 my-auto lg:py-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onViewReport();
              }}
              className="w-full flex items-center justify-center gap-1.5 h-10 rounded-lg bg-blue-600 text-[13px] font-semibold text-white hover:bg-blue-500 transition-all duration-200"
            >
              <ClipboardCheck className="w-3.5 h-3.5" />
              <span>리포트 보기</span>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onViewQuestions();
              }}
              className="w-full flex items-center justify-center gap-1.5 h-10 rounded-lg border border-zinc-700 bg-zinc-800/40 text-[13px] font-medium text-zinc-300 hover:bg-zinc-700/60 hover:text-zinc-100 transition-all duration-200"
            >
              <FileText className="w-3.5 h-3.5 text-zinc-500" />
              <span>작성한 자소서 보기</span>
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
