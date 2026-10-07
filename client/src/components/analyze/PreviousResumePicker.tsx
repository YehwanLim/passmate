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
          className="fixed inset-0 z-[210] flex items-center justify-center bg-ink/40 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="previous-resume-title"
            className="w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_12px_32px_rgba(25,31,40,0.12)]"
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: 0.18 }}
            onClick={event => event.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-line px-6 py-5">
              <div>
                <p className="mb-1 text-xs font-medium tracking-wide text-brand-ink">
                  저장된 지원서
                </p>
                <h2
                  id="previous-resume-title"
                  className="text-lg font-semibold text-ink"
                >
                  이전 지원서 불러오기
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-2 text-ink-4 transition-colors hover:bg-fill hover:text-ink"
                aria-label="이전 지원서 목록 닫기"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[min(60vh,520px)] overflow-y-auto p-4">
              {isLoading ? (
                <div className="flex min-h-40 items-center justify-center gap-3 text-sm text-ink-4">
                  <Loader2 className="h-4 w-4 animate-spin text-brand" />
                  저장된 지원서를 불러오는 중이에요
                </div>
              ) : error ? (
                <div className="px-3 py-8 text-center text-sm leading-relaxed text-ink-3">
                  {error}
                </div>
              ) : resumes.length === 0 ? (
                <div className="px-3 py-8 text-center text-sm leading-relaxed text-ink-4">
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
                        className="w-full rounded-xl border border-line bg-surface px-4 py-3.5 text-left transition-colors hover:border-brand/40 hover:bg-brand-hover/[0.05] disabled:cursor-wait disabled:opacity-60"
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-ink">
                              {project.title}
                            </p>
                            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-ink-4">
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
                            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-brand" />
                          ) : (
                            <span className="shrink-0 text-xs font-medium text-brand-ink">
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
