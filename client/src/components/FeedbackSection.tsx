import { useLocation } from "wouter"
import { ArrowRight, MessageSquareQuote } from "lucide-react"

import { UI_LABELS } from "../constants/labels"

// =============================================================================
// FeedbackSection — 리포트 하단 설문 안내 카드
// =============================================================================
// 설문 본문은 /feedback 페이지에 있다. 리포트 화면에는 짧은 안내와 버튼만 둔다.
//
// 보상 수령 여부(rewardAvailable)는 부모가 useFeedbackRewardAvailable 로 한 번만
// 조회해 상단 배너(FeedbackRewardBanner)와 이 카드에 나눠 준다.
// =============================================================================

interface FeedbackSectionProps {
  /** DB Analysis ID (없으면 안내 숨김) */
  analysisId?: string | null
  /** 보상 미수령 여부 — 이미 받은 계정에는 담백한 문구로 떨어뜨린다 */
  rewardAvailable: boolean
}

export default function FeedbackSection({ analysisId, rewardAvailable }: FeedbackSectionProps) {
  const [, navigate] = useLocation()

  if (!analysisId) return null

  return (
    <section className="print:hidden">
      <div className="rounded-3xl bg-surface px-6 py-7 sm:px-10">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="flex min-w-0 items-start gap-3.5">
            <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-fill">
              <MessageSquareQuote className="size-4 text-ink-4" />
            </span>
            <div className="min-w-0">
              <p className="text-[16px] font-bold text-ink">
                {UI_LABELS.FEEDBACK_TEASER_TITLE}
              </p>
              <p className="mt-1 text-[14px] leading-5 text-ink-4">
                {rewardAvailable
                  ? UI_LABELS.FEEDBACK_TEASER_DESC_REWARD
                  : UI_LABELS.FEEDBACK_TEASER_DESC_PLAIN}
              </p>
            </div>
          </div>

          <button
            onClick={() =>
              navigate(`/feedback?analysisId=${encodeURIComponent(analysisId)}`)
            }
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-brand px-5 py-3 text-[14px] font-bold text-white transition-colors duration-200 hover:bg-brand-hover sm:ml-auto"
          >
            <span>
              {rewardAvailable
                ? UI_LABELS.FEEDBACK_TEASER_CTA_REWARD
                : UI_LABELS.FEEDBACK_TEASER_CTA_PLAIN}
            </span>
            <ArrowRight className="size-3.5" />
          </button>
        </div>
      </div>
    </section>
  )
}
