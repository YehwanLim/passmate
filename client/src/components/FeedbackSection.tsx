import { useEffect, useState } from "react"
import { useLocation } from "wouter"
import { ArrowRight, MessageSquareQuote } from "lucide-react"

import { UI_LABELS } from "../constants/labels"
import { useAuth } from "@/contexts/AuthContext"
import { fetchEntitlementSummary } from "@/lib/entitlements"
import { supabase } from "@/lib/supabase"

// =============================================================================
// FeedbackSection — 리포트 하단 설문 안내 카드
// =============================================================================
// 설문 본문은 /feedback 페이지에 있다. 리포트 화면에는 짧은 안내와 버튼만 둔다.
//
// 보상은 계정당 1회라, 이미 받은 계정에 "1회 더 드려요"를 계속 띄우면 지키지
// 못할 약속이 된다. 엔타이틀먼트에서 수령 여부를 받아 문구를 바꾼다.
// 조회에 실패하면 보상 문구 없이 담백한 쪽으로 떨어뜨린다 — 없는 약속을
// 하느니 안 하는 편이 낫다.
// =============================================================================

interface FeedbackSectionProps {
  /** DB Analysis ID (없으면 안내 숨김) */
  analysisId?: string | null
}

export default function FeedbackSection({ analysisId }: FeedbackSectionProps) {
  const [, navigate] = useLocation()
  const { isAuthenticated } = useAuth()
  const [rewardAvailable, setRewardAvailable] = useState(false)

  useEffect(() => {
    if (!isAuthenticated) return

    let cancelled = false
    const load = async () => {
      try {
        const { data } = await supabase.auth.getSession()
        const token = data.session?.access_token
        if (!token) return
        const summary = await fetchEntitlementSummary(token)
        if (!cancelled) setRewardAvailable(!summary.feedbackRewardClaimed)
      } catch {
        // 조회 실패 시 보상 문구를 띄우지 않는다.
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [isAuthenticated])

  if (!analysisId) return null

  return (
    <section className="py-12">
      <div className="rounded-2xl border border-white/[0.06] bg-zinc-900/40 px-6 py-7 sm:px-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="flex min-w-0 items-start gap-3.5">
            <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04]">
              <MessageSquareQuote className="size-4 text-zinc-400" />
            </span>
            <div className="min-w-0">
              <p className="text-base font-medium text-white">
                {UI_LABELS.FEEDBACK_TEASER_TITLE}
              </p>
              <p className="mt-1 text-xs leading-5 text-zinc-500">
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
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-[13px] font-semibold text-black transition-colors duration-200 hover:bg-gray-200 sm:ml-auto"
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
