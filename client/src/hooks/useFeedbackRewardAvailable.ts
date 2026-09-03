import { useEffect, useState } from "react"

import { useAuth } from "@/contexts/AuthContext"
import { fetchEntitlementSummary } from "@/lib/entitlements"
import { supabase } from "@/lib/supabase"

// =============================================================================
// useFeedbackRewardAvailable — 피드백 보상 미수령 여부
// =============================================================================
// 보상은 계정당 1회라, 이미 받은 계정에 "1회 더 드려요"를 계속 띄우면 지키지
// 못할 약속이 된다. 엔타이틀먼트에서 수령 여부를 받아 노출을 가른다.
// 조회에 실패하면 false — 없는 약속을 하느니 안 하는 편이 낫다.
// 리포트 화면의 상단 배너와 하단 카드가 함께 쓴다.
// =============================================================================

export function useFeedbackRewardAvailable() {
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

  return rewardAvailable
}
