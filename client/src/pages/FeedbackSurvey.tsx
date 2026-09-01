import { useMemo } from "react"
import { useLocation } from "wouter"
import { ArrowLeft, Loader2 } from "lucide-react"

import FeedbackSurveyForm from "@/components/FeedbackSurveyForm"
import { UI_LABELS } from "@/constants/labels"
import { useRequireAuth } from "@/hooks/useRequireAuth"

/**
 * FeedbackSurvey — /feedback?analysisId=...
 *
 * 리포트 하단 안내 카드에서 넘어오는 설문 페이지. 리포트 화면을 길게 만들지
 * 않으면서, 설문 작성을 별도의 행동으로 분리한다.
 */
export default function FeedbackSurvey() {
  const [location, navigate] = useLocation()

  const analysisId = useMemo(() => {
    const value = new URLSearchParams(window.location.search).get("analysisId")
    return value && value.length > 0 ? value : null
  }, [location])

  const reportPath = analysisId
    ? `/report-new?analysisId=${encodeURIComponent(analysisId)}`
    : "/my"

  const { isLoading } = useRequireAuth({ redirectPath: `/feedback${window.location.search}` })

  const backButton = (
    <button
      onClick={() => navigate(reportPath)}
      className="inline-flex items-center gap-2 rounded-lg border border-white/[0.12] px-4 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:bg-white/[0.06] hover:text-white"
    >
      <ArrowLeft className="h-3.5 w-3.5" />
      {UI_LABELS.FEEDBACK_BACK_TO_REPORT}
    </button>
  )

  return (
    <main className="min-h-screen bg-[#0A0A0A] px-4 py-16 text-white">
      <div className="mx-auto max-w-2xl">
        <button
          onClick={() => navigate(reportPath)}
          className="mb-8 inline-flex items-center gap-2 text-sm text-zinc-500 transition-colors hover:text-zinc-200"
        >
          <ArrowLeft className="h-4 w-4" />
          {UI_LABELS.FEEDBACK_BACK_TO_REPORT}
        </button>

        <h1 className="text-2xl font-semibold tracking-tight">
          {UI_LABELS.FEEDBACK_TITLE}
        </h1>
        <p className="mt-2 mb-8 text-sm leading-6 text-zinc-500">
          {UI_LABELS.FEEDBACK_SUBTITLE}
        </p>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-zinc-600" aria-hidden="true" />
          </div>
        ) : analysisId ? (
          <FeedbackSurveyForm
            analysisId={analysisId}
            renderDoneActions={() => backButton}
          />
        ) : (
          <div className="rounded-2xl border border-white/[0.06] bg-zinc-900/40 px-8 py-10 text-center">
            <p className="text-sm text-zinc-400">
              {UI_LABELS.FEEDBACK_MISSING_ANALYSIS}
            </p>
            <div className="mt-6">{backButton}</div>
          </div>
        )}
      </div>
    </main>
  )
}
