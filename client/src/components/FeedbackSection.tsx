import { useState, useEffect } from "react"
import { ThumbsUp, ThumbsDown, Check, Send } from "lucide-react"
import { UI_LABELS } from "../constants/labels"
import {
  getAnonymousUserId,
  saveFeedbackLocally,
  loadFeedbackLocally,
  type StoredFeedback,
} from "../utils/storage"

// =============================================================================
// FeedbackSection — 리포트 만족도 컴포넌트
// =============================================================================
// 위치: ReportResult 하단 (PM Comment ↔ Premium Upsell 사이)
// 상태 흐름: idle → selected → (reason panel) → submitted
// =============================================================================

type FeedbackState = "idle" | "selected" | "submitting" | "submitted"
type Rating = "THUMBS_UP" | "THUMBS_DOWN"

interface FeedbackSectionProps {
  /** DB Analysis ID (없으면 Feedback 비활성화) */
  analysisId?: string | null
}

export default function FeedbackSection({ analysisId }: FeedbackSectionProps) {
  const [state, setState] = useState<FeedbackState>("idle")
  const [selectedRating, setSelectedRating] = useState<Rating | null>(null)
  const [selectedReason, setSelectedReason] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // ── 로컬 캐시에서 기존 투표 복원 ──
  useEffect(() => {
    if (!analysisId) return
    const cached = loadFeedbackLocally(analysisId)
    if (cached) {
      setSelectedRating(cached.rating)
      setState("submitted")
    }
  }, [analysisId])

  // ── analysisId 없으면 UI 숨김 ──
  if (!analysisId) return null

  // ── API 호출 ──
  const submitFeedback = async (rating: Rating, comment?: string) => {
    setState("submitting")
    setErrorMessage(null)

    const userId = getAnonymousUserId()

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          analysisId,
          userId,
          rating,
          comment: comment || null,
        }),
      })

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }

      // 로컬 캐싱
      const feedbackData: StoredFeedback = {
        rating,
        comment: comment || undefined,
        savedAt: new Date().toISOString(),
      }
      saveFeedbackLocally(analysisId, feedbackData)

      setSelectedRating(rating)
      setState("submitted")
    } catch (e) {
      console.error("[FeedbackSection] 전송 실패:", e)
      setErrorMessage(UI_LABELS.FEEDBACK_ERROR)
      setState("selected")
    }
  }

  // ── 👍 클릭 ──
  const handleThumbsUp = () => {
    setSelectedRating("THUMBS_UP")
    submitFeedback("THUMBS_UP")
  }

  // ── 👎 클릭 → 사유 선택 패널 ──
  const handleThumbsDown = () => {
    setSelectedRating("THUMBS_DOWN")
    setSelectedReason(null)
    setState("selected")
  }

  // ── 사유 선택 후 제출 ──
  const handleReasonSubmit = () => {
    if (!selectedReason) return
    submitFeedback("THUMBS_DOWN", selectedReason)
  }

  // ═══════════════════════════════════════════════════════════
  // RENDER: 완료 상태
  // ═══════════════════════════════════════════════════════════
  if (state === "submitted") {
    return (
      <section className="py-12">
        <div className="bg-zinc-900/40 border border-white/[0.06] rounded-2xl px-8 py-8 text-center">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-4">
            <Check className="w-5 h-5 text-emerald-400" />
          </div>
          <p className="text-sm text-white font-medium mb-1">
            {UI_LABELS.FEEDBACK_THANKS_TITLE}
          </p>
          <p className="text-xs text-zinc-500">
            {UI_LABELS.FEEDBACK_THANKS_DESC}
          </p>
        </div>
      </section>
    )
  }

  // ═══════════════════════════════════════════════════════════
  // RENDER: 기본 상태 (idle) + 사유 선택 패널 (selected)
  // ═══════════════════════════════════════════════════════════
  return (
    <section className="py-12">
      <div className="bg-zinc-900/40 border border-white/[0.06] rounded-2xl px-8 py-8">
        {/* 제목 */}
        <div className="text-center mb-6">
          <p className="text-base text-white font-medium mb-1">
            {UI_LABELS.FEEDBACK_TITLE}
          </p>
          <p className="text-xs text-zinc-500">
            {UI_LABELS.FEEDBACK_SUBTITLE}
          </p>
        </div>

        {/* 👍 / 👎 버튼 */}
        <div className="flex items-center justify-center gap-3 mb-2">
          <button
            onClick={handleThumbsUp}
            disabled={state === "submitting" || state === "selected"}
            className={`
              group inline-flex items-center gap-2.5 px-6 py-3 rounded-xl text-sm font-medium
              transition-all duration-200
              ${
                selectedRating === "THUMBS_UP"
                  ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400 border"
                  : "bg-zinc-800/60 border border-white/[0.08] text-zinc-400 hover:text-emerald-400 hover:border-emerald-500/20 hover:bg-emerald-500/[0.06]"
              }
              disabled:opacity-50 disabled:cursor-not-allowed
            `}
          >
            <ThumbsUp className={`w-4 h-4 transition-transform ${selectedRating !== "THUMBS_UP" ? "group-hover:scale-110" : ""}`} />
            <span>{UI_LABELS.FEEDBACK_THUMBS_UP}</span>
          </button>

          <button
            onClick={handleThumbsDown}
            disabled={state === "submitting"}
            className={`
              group inline-flex items-center gap-2.5 px-6 py-3 rounded-xl text-sm font-medium
              transition-all duration-200
              ${
                selectedRating === "THUMBS_DOWN"
                  ? "bg-red-500/15 border-red-500/30 text-red-400 border"
                  : "bg-zinc-800/60 border border-white/[0.08] text-zinc-400 hover:text-red-400 hover:border-red-500/20 hover:bg-red-500/[0.06]"
              }
              disabled:opacity-50 disabled:cursor-not-allowed
            `}
          >
            <ThumbsDown className={`w-4 h-4 transition-transform ${selectedRating !== "THUMBS_DOWN" ? "group-hover:scale-110" : ""}`} />
            <span>{UI_LABELS.FEEDBACK_THUMBS_DOWN}</span>
          </button>
        </div>

        {/* 에러 메시지 */}
        {errorMessage && (
          <p className="text-xs text-red-400 text-center mt-3 animate-fade-in">
            {errorMessage}
          </p>
        )}

        {/* ─── 👎 사유 선택 패널 ─── */}
        {state === "selected" && selectedRating === "THUMBS_DOWN" && (
          <div className="mt-6 pt-6 border-t border-white/[0.06] animate-fade-in">
            <p className="text-sm text-zinc-300 font-medium mb-4 text-center">
              {UI_LABELS.FEEDBACK_REASON_TITLE}
            </p>

            <div className="flex flex-wrap justify-center gap-2 mb-5">
              {UI_LABELS.FEEDBACK_REASONS.map((reason) => (
                <button
                  key={reason}
                  onClick={() => setSelectedReason(reason)}
                  className={`
                    px-4 py-2 text-xs rounded-lg border transition-all duration-150
                    ${
                      selectedReason === reason
                        ? "bg-white/[0.08] border-white/20 text-white font-medium"
                        : "bg-zinc-800/40 border-white/[0.06] text-zinc-500 hover:text-zinc-300 hover:border-white/[0.12]"
                    }
                  `}
                >
                  {reason}
                </button>
              ))}
            </div>

            <div className="flex justify-center">
              <button
                onClick={handleReasonSubmit}
                disabled={!selectedReason || state === "submitting"}
                className={`
                  inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium
                  transition-all duration-200
                  ${
                    selectedReason
                      ? "bg-white/[0.08] text-white border border-white/[0.15] hover:bg-white/[0.12]"
                      : "bg-zinc-800/40 text-zinc-600 border border-white/[0.04] cursor-not-allowed"
                  }
                `}
              >
                <Send className="w-3.5 h-3.5" />
                <span>{UI_LABELS.FEEDBACK_SUBMIT}</span>
              </button>
            </div>
          </div>
        )}

        {/* 제출 중 로딩 */}
        {state === "submitting" && (
          <div className="mt-4 flex justify-center">
            <div className="w-5 h-5 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin" />
          </div>
        )}
      </div>
    </section>
  )
}
