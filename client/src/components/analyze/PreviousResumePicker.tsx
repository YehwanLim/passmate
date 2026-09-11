import { AnimatePresence, motion } from "framer-motion";
import { BriefcaseBusiness, CalendarDays, Loader2, X } from "lucide-react";

import type { ProjectSummary } from "@/types/my";

function formatSavedDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "작성일 미상";

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

/** 저장된 지원서 목록 모달. 고르면 onPick(latest_analysis_id) 로 알린다. */
export default function PreviousResumePicker({
  open,
  resumes,
  isLoading,
  error,
  applyingId,
  onPick,
  onClose,
}: {
  open: boolean;
  resumes: ProjectSummary[];
  isLoading: boolean;
  error: string | null;
  applyingId: string | null;
  onPick: (analysisId: string) => void;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[210] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="previous-resume-title"
            className="w-full max-w-xl overflow-hidden rounded-2xl border border-white/[0.1] bg-[#141414] shadow-2xl"
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: 0.18 }}
            onClick={event => event.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-white/[0.08] px-6 py-5">
              <div>
                <p className="mb-1 text-xs font-medium tracking-wide text-cyan-300">
                  저장된 지원서
                </p>
                <h2
                  id="previous-resume-title"
                  className="text-lg font-semibold text-white"
                >
                  이전 지원서 불러오기
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-white/[0.07] hover:text-white"
                aria-label="이전 지원서 목록 닫기"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[min(60vh,520px)] overflow-y-auto p-4">
              {isLoading ? (
                <div className="flex min-h-40 items-center justify-center gap-3 text-sm text-zinc-500">
                  <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
                  저장된 지원서를 불러오는 중이에요
                </div>
              ) : error ? (
                <div className="px-3 py-8 text-center text-sm leading-relaxed text-zinc-400">
                  {error}
                </div>
              ) : resumes.length === 0 ? (
                <div className="px-3 py-8 text-center text-sm leading-relaxed text-zinc-500">
                  아직 불러올 이전 지원서가 없어요.
                </div>
              ) : (
                <div className="space-y-2">
                  {resumes.map(project => {
                    const analysisId = project.latest_analysis_id!;
                    const isApplying = applyingId === analysisId;

                    return (
                      <button
                        key={project.id}
                        type="button"
                        disabled={Boolean(applyingId)}
                        onClick={() => onPick(analysisId)}
                        className="w-full rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3.5 text-left transition-colors hover:border-cyan-400/25 hover:bg-cyan-400/[0.05] disabled:cursor-wait disabled:opacity-60"
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-zinc-100">
                              {project.title}
                            </p>
                            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-zinc-500">
                              <span className="inline-flex items-center gap-1.5">
                                <BriefcaseBusiness className="h-3.5 w-3.5" />
                                {project.job_role || "직무 미지정"}
                              </span>
                              <span className="inline-flex items-center gap-1.5">
                                <CalendarDays className="h-3.5 w-3.5" />
                                {formatSavedDate(project.created_at)}
                              </span>
                            </div>
                          </div>
                          {isApplying ? (
                            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-cyan-400" />
                          ) : (
                            <span className="shrink-0 text-xs font-medium text-cyan-300">
                              불러오기
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
