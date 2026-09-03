import { ArrowRight, Gift } from "lucide-react"
import { Link } from "wouter"

import { UI_LABELS } from "../constants/labels"

// =============================================================================
// FeedbackRewardBanner — 리포트 상단 피드백 보상 배너
// =============================================================================
// 하단 카드(FeedbackSection)는 리포트를 끝까지 읽어야 보인다. 보상을 아직 안
// 받은 계정에는 리포트 첫 화면에서도 한 줄로 알려, 설문 유입을 늘린다.
// 이미 받은 계정에는 아무것도 그리지 않는다 — 지키지 못할 약속을 반복하지
// 않는다는 하단 카드의 원칙을 그대로 따른다.
// =============================================================================

interface FeedbackRewardBannerProps {
  /** DB Analysis ID — 설문 페이지로 넘길 대상 */
  analysisId: string
  /** 보상 미수령 여부 (useFeedbackRewardAvailable) */
  rewardAvailable: boolean
}

export default function FeedbackRewardBanner({
  analysisId,
  rewardAvailable,
}: FeedbackRewardBannerProps) {
  if (!rewardAvailable) return null

  return (
    <div className="print:hidden mt-6 flex flex-col gap-3 rounded-xl border border-cyan-300/[0.16] bg-cyan-300/[0.05] px-4 py-3.5 sm:flex-row sm:items-center sm:px-5">
      <div className="flex min-w-0 items-center gap-3">
        <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg border border-cyan-300/[0.18] bg-cyan-300/[0.08]">
          <Gift className="size-3.5 text-cyan-200" />
        </span>
        <p className="min-w-0 text-[13px] leading-5 text-zinc-300">
          {UI_LABELS.FEEDBACK_BANNER_TEXT}
        </p>
      </div>
      <Link
        href={`/feedback?analysisId=${encodeURIComponent(analysisId)}`}
        className="inline-flex shrink-0 items-center gap-1.5 text-[13px] font-semibold text-cyan-200 transition-colors hover:text-white sm:ml-auto"
      >
        <span>{UI_LABELS.FEEDBACK_BANNER_CTA}</span>
        <ArrowRight className="size-3.5" />
      </Link>
    </div>
  )
}
