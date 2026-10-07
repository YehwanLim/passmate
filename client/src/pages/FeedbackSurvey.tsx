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
      className="inline-flex h-11 items-center gap-2 rounded-[10px] bg-fill px-4 text-sm font-semibold text-ink-2 transition-colors hover:bg-line"
    >
      <ArrowLeft className="h-3.5 w-3.5" />
      {UI_LABELS.FEEDBACK_BACK_TO_REPORT}
    </button>
  )

  return (
    <main className="min-h-screen bg-stage px-4 py-16 text-ink">
      <div className="mx-auto max-w-2xl">
        <button
          onClick={() => navigate(reportPath)}
          className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-ink-4 transition-colors hover:text-ink-2"
        >
          <ArrowLeft className="h-4 w-4" />
          {UI_LABELS.FEEDBACK_BACK_TO_REPORT}
        </button>

        <h1 className="text-[28px] font-bold tracking-[-0.03em] text-ink">
          {UI_LABELS.FEEDBACK_TITLE}
        </h1>
        <p className="mt-1.5 mb-8 text-[15px] leading-6 text-ink-4">
          {UI_LABELS.FEEDBACK_SUBTITLE}
        </p>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-ink-4" aria-hidden="true" />
          </div>
        ) : analysisId ? (
          <FeedbackSurveyForm
            analysisId={analysisId}
            renderDoneActions={() => backButton}
          />
        ) : (
          <div className="rounded-[20px] bg-surface px-8 py-10 text-center">
            <p className="text-sm text-ink-3">
              {UI_LABELS.FEEDBACK_MISSING_ANALYSIS}
            </p>
            <div className="mt-6">{backButton}</div>
          </div>
        )}
      </div>
    </main>
  )
}
