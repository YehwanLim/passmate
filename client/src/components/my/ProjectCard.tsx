import { Calendar, FileText, Type, ChevronRight, Lock, PenLine } from "lucide-react";
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
          {/* 타이틀 영역 (수정 가능한 input 필드) */}
          <div className="relative mb-3 group/title w-full">
            <input
              type="text"
              defaultValue={project.title}
              className="w-full bg-transparent text-[18px] font-bold text-zinc-100 tracking-tight transition-colors focus:outline-none focus:border-b focus:border-zinc-500 pb-1 border-b border-transparent group-hover/title:border-zinc-700"
              placeholder="프로젝트 제목을 입력하세요"
              onClick={(e) => e.stopPropagation()}
            />
            <PenLine className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600 opacity-0 group-hover/title:opacity-100 transition-opacity pointer-events-none" />
          </div>

          {/* 회사/직무 메타 정보 */}
          <div className="flex flex-col gap-1 mb-5">
            <span className="text-[14px] font-medium text-zinc-300">
              {project.company_name || "기업 미지정"}
            </span>
            {project.job_role && (
              <span className="text-[13px] text-zinc-500">
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
              <span>{project.analysis_count}개 문항</span>
            </div>
          </div>
        </div>

        {/* ───────────────────────────────────────────────────────────── */}
        {/* 2️⃣ [중앙] 피드백 대시보드 영역 (col-span-6) */}
        {/* ───────────────────────────────────────────────────────────── */}
        <div className="lg:col-span-6 flex flex-col justify-center border-t lg:border-t-0 lg:border-l border-zinc-800/50 pt-5 lg:pt-0 lg:pl-8">
          <span className="text-[13px] font-bold text-blue-400 mb-2.5 tracking-wider uppercase flex items-center gap-2">
            AI One-liner
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
        {/* 3️⃣ [우측] 액션 그룹 및 BM 확장 영역 (col-span-3) */}
        {/* ───────────────────────────────────────────────────────────── */}
        <div className="lg:col-span-3 flex flex-col justify-between border-t lg:border-t-0 lg:border-l border-zinc-800/50 pt-6 lg:pt-0 lg:pl-8 relative">
          
          {/* 데스크탑: 케밥 메뉴를 우측 상단 정위치 */}
          <div className="hidden lg:block absolute -top-2 -right-2">
            {kebabItems.length > 0 && <KebabMenu items={kebabItems} />}
          </div>

          <div className="flex flex-col gap-2.5 lg:mt-6">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onViewQuestions();
              }}
              className="w-full flex items-center justify-between px-4 h-10 rounded-xl border border-zinc-700/50 bg-zinc-800/30 text-[13px] font-medium text-zinc-400 hover:bg-zinc-700/50 hover:text-zinc-200 transition-all duration-200"
            >
              <span>문항 상세 보기</span>
              <ChevronRight className="w-3.5 h-3.5 text-zinc-500" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onViewReport();
              }}
              className="w-full flex items-center justify-between px-4 h-10 rounded-xl border border-zinc-700/50 bg-zinc-800/50 text-[13px] font-medium text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100 transition-all duration-200"
            >
              <span>AI 리포트 보기</span>
              <ChevronRight className="w-3.5 h-3.5 text-zinc-500" />
            </button>
          </div>

          {/* BM Placeholder (멘토링 연결) */}
          <div className="mt-5 lg:mt-auto pt-4 border-t border-zinc-800/50">
            <button
              disabled
              className="w-full flex flex-col items-center justify-center py-3.5 rounded-xl bg-gradient-to-br from-zinc-800/40 to-zinc-900/40 border border-zinc-700/50 border-dashed text-zinc-500 cursor-not-allowed group/bm relative overflow-hidden transition-colors hover:border-zinc-600"
            >
              <div className="flex items-center gap-1.5 mb-1 z-10">
                <span className="text-[13px] font-bold text-zinc-300 opacity-80 group-hover/bm:opacity-100 transition-opacity">
                  🔥 1:1 현직자 멘토링
                </span>
                <Lock className="w-3.5 h-3.5 opacity-70" />
              </div>
              <span className="text-[11px] font-medium tracking-widest text-orange-400/70 z-10">
                [🚀 준비 중]
              </span>
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
