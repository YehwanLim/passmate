import { useState } from "react"
import { Check, Send } from "lucide-react"
import { UI_LABELS } from "../constants/labels"
import { getAuthorizationHeader } from "@/lib/apiAuth"

// =============================================================================
// FeedbackSurveyForm — 리포트 만족도 설문 본문
// =============================================================================
// 설문 페이지(/feedback)에서 쓴다. 리포트 하단에는 안내 카드(FeedbackSection)만
// 두고, 실제 작성은 이 화면으로 넘어와서 한다.
//
// 설문은 전부 채워야 제출된다. 점수와 주관식이 같이 있어야 응답 하나가 의미를
// 갖고, 제출 조건과 보상 조건이 갈리면 "다 썼는데 왜 안 주냐"가 생긴다.
// 서버(api/feedback.js)도 같은 조건으로 검사하므로 여기 검사는 안내용이다.
// =============================================================================

type SurveyState = "filling" | "submitting" | "submitted"

const QUESTIONS = UI_LABELS.FEEDBACK_SURVEY_QUESTIONS
const MIN_COMMENT_LENGTH = UI_LABELS.FEEDBACK_MIN_COMMENT_LENGTH
const MAX_COMMENT_LENGTH = 2000
const SCALE = Array.from(
  { length: UI_LABELS.FEEDBACK_SCORE_MAX - UI_LABELS.FEEDBACK_SCORE_MIN + 1 },
  (_, index) => UI_LABELS.FEEDBACK_SCORE_MIN + index
)

interface FeedbackSurveyFormProps {
  analysisId: string
  /** 제출이 끝난 뒤 보여줄 이동 버튼 등 */
  renderDoneActions?: () => React.ReactNode
}

export default function FeedbackSurveyForm({
  analysisId,
  renderDoneActions,
}: FeedbackSurveyFormProps) {
  const [state, setState] = useState<SurveyState>("filling")
  const [scores, setScores] = useState<Record<string, number>>({})
  const [comment, setComment] = useState("")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [creditGranted, setCreditGranted] = useState(false)

  const answered = QUESTIONS.filter(q => scores[q.key] != null).length
  const written = comment.trim().length
  const isComplete = answered === QUESTIONS.length && written >= MIN_COMMENT_LENGTH
  const canSubmit = isComplete && state === "filling"

  const submitSurvey = async () => {
    if (!canSubmit) return

    setState("submitting")
    setErrorMessage(null)

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await getAuthorizationHeader()),
        },
        body: JSON.stringify({ analysisId, scores, comment: comment.trim() }),
      })

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }

      const payload = (await res.json().catch(() => null)) as {
        credit_granted?: boolean
      } | null

      setCreditGranted(Boolean(payload?.credit_granted))
      setState("submitted")
    } catch {
      setErrorMessage(UI_LABELS.FEEDBACK_ERROR)
      setState("filling")
    }
  }

  // ═══════════════════════════════════════════════════════════
  // RENDER: 완료 상태
  // ═══════════════════════════════════════════════════════════
  if (state === "submitted") {
    return (
      <div className="bg-zinc-900/40 border border-white/[0.06] rounded-2xl px-6 sm:px-8 py-10 text-center">
        <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-4">
          <Check className="w-5 h-5 text-emerald-400" />
        </div>
        <p className="text-sm text-white font-medium mb-1">
          {creditGranted
            ? UI_LABELS.FEEDBACK_REWARD_GRANTED_TITLE
            : UI_LABELS.FEEDBACK_THANKS_TITLE}
        </p>
        <p className="text-xs text-zinc-500">
          {creditGranted
            ? UI_LABELS.FEEDBACK_REWARD_GRANTED_DESC
            : UI_LABELS.FEEDBACK_ALREADY_REWARDED}
        </p>
        {renderDoneActions && <div className="mt-7">{renderDoneActions()}</div>}
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════
  // RENDER: 설문 작성
  // ═══════════════════════════════════════════════════════════
  const isBusy = state === "submitting"

  return (
    <div className="bg-zinc-900/40 border border-white/[0.06] rounded-2xl px-6 sm:px-8 py-8">
      {/* 점수 문항 */}
      <div className="space-y-6">
        {QUESTIONS.map((item, index) => {
          const selected = scores[item.key]
          return (
            <div key={item.key}>
              <p className="text-sm text-zinc-200 mb-3">
                <span className="text-zinc-600 tabular-nums mr-2">
                  {String(index + 1).padStart(2, "0")}
                </span>
                {item.question}
              </p>

              <div
                role="radiogroup"
                aria-label={item.question}
                className="flex gap-1 sm:gap-1.5"
              >
                {SCALE.map(score => {
                  const active = selected === score
                  return (
                    <button
                      key={score}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      aria-label={`${score}점`}
                      disabled={isBusy}
                      onClick={() =>
                        setScores(prev => ({ ...prev, [item.key]: score }))
                      }
                      className={`
                        flex-1 h-9 rounded-lg text-xs font-medium tabular-nums
                        border transition-all duration-150
                        ${
                          active
                            ? "bg-white text-black border-white"
                            : "bg-zinc-800/40 text-zinc-500 border-white/[0.06] hover:text-zinc-200 hover:border-white/20"
                        }
                        disabled:opacity-50 disabled:cursor-not-allowed
                      `}
                    >
                      {score}
                    </button>
                  )
                })}
              </div>

              <div className="flex justify-between mt-1.5 text-[11px] text-zinc-600">
                <span>{UI_LABELS.FEEDBACK_SCORE_LOW_HINT}</span>
                <span>{UI_LABELS.FEEDBACK_SCORE_HIGH_HINT}</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* 주관식 */}
      <div className="mt-8 pt-8 border-t border-white/[0.06]">
        <p className="text-sm text-zinc-200 mb-3">
          <span className="text-zinc-600 tabular-nums mr-2">
            {String(QUESTIONS.length + 1).padStart(2, "0")}
          </span>
          {UI_LABELS.FEEDBACK_COMMENT_TITLE}
        </p>

        <textarea
          value={comment}
          onChange={e => setComment(e.target.value)}
          disabled={isBusy}
          rows={6}
          maxLength={MAX_COMMENT_LENGTH}
          placeholder={UI_LABELS.FEEDBACK_COMMENT_PLACEHOLDER}
          className="w-full resize-none rounded-xl bg-zinc-800/40 border border-white/[0.08] px-4 py-3 text-sm text-white leading-6 placeholder:text-zinc-600 focus:outline-none focus:border-white/20 disabled:opacity-50"
        />

        <p
          className={`mt-2 text-xs tabular-nums ${
            written >= MIN_COMMENT_LENGTH ? "text-emerald-400" : "text-zinc-600"
          }`}
        >
          {written}/{MIN_COMMENT_LENGTH}자
        </p>
      </div>

      {/* 제출 */}
      <div className="mt-6 pt-6 border-t border-white/[0.06] flex flex-col sm:flex-row sm:items-center gap-3">
        <span className="text-xs text-zinc-600">
          {UI_LABELS.FEEDBACK_PROGRESS_HINT.replace("{answered}", String(answered))}
        </span>

        <button
          onClick={submitSurvey}
          disabled={!canSubmit}
          className={`
            sm:ml-auto inline-flex items-center justify-center gap-2
            px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200
            ${
              canSubmit
                ? "bg-white text-black hover:bg-gray-200"
                : "bg-zinc-800/40 text-zinc-600 border border-white/[0.04] cursor-not-allowed"
            }
          `}
        >
          <Send className="w-3.5 h-3.5" />
          <span>
            {isBusy ? UI_LABELS.FEEDBACK_SUBMITTING : UI_LABELS.FEEDBACK_SUBMIT}
          </span>
        </button>
      </div>

      {errorMessage && (
        <p className="text-xs text-red-400 mt-3 animate-fade-in">{errorMessage}</p>
      )}
    </div>
  )
}
