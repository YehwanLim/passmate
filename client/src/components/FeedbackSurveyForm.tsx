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
      <div className="bg-surface rounded-[20px] px-6 sm:px-8 py-10 text-center">
        <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-ok-soft mb-4">
          <Check className="w-5 h-5 text-ok" />
        </div>
        <p className="text-[15px] text-ink font-semibold mb-1">
          {creditGranted
            ? UI_LABELS.FEEDBACK_REWARD_GRANTED_TITLE
            : UI_LABELS.FEEDBACK_THANKS_TITLE}
        </p>
        <p className="text-[13px] text-ink-4">
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
    <div className="bg-surface rounded-[20px] px-6 sm:px-8 py-8">
      {/* 점수 문항 */}
      <div className="space-y-6">
        {QUESTIONS.map((item, index) => {
          const selected = scores[item.key]
          return (
            <div key={item.key}>
              <p className="text-[15px] font-medium text-ink-2 mb-3">
                <span className="text-ink-4 tabular-nums mr-2">
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
                        flex-1 h-10 rounded-[10px] text-[13px] font-semibold tabular-nums
                        border transition-colors duration-150
                        ${
                          active
                            ? "bg-brand-soft text-brand-ink border-brand"
                            : "bg-surface text-ink-3 border-line hover:bg-fill-soft hover:text-ink-2"
                        }
                        disabled:opacity-50 disabled:cursor-not-allowed
                      `}
                    >
                      {score}
                    </button>
                  )
                })}
              </div>

              <div className="flex justify-between mt-1.5 text-[12px] text-ink-4">
                <span>{UI_LABELS.FEEDBACK_SCORE_LOW_HINT}</span>
                <span>{UI_LABELS.FEEDBACK_SCORE_HIGH_HINT}</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* 주관식 */}
      <div className="mt-8 pt-8 border-t border-line">
        <p className="text-[15px] font-medium text-ink-2 mb-3">
          <span className="text-ink-4 tabular-nums mr-2">
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
          className="w-full resize-none rounded-[12px] bg-surface border border-line px-4 py-3 text-[15px] text-ink leading-6 placeholder:text-ink-5 focus:outline-none focus:border-brand disabled:opacity-50"
        />

        <p
          className={`mt-2 text-xs tabular-nums ${
            written >= MIN_COMMENT_LENGTH ? "text-ok" : "text-ink-4"
          }`}
        >
          {written}/{MIN_COMMENT_LENGTH}자
        </p>
      </div>

      {/* 제출 */}
      <div className="mt-6 pt-6 border-t border-line flex flex-col sm:flex-row sm:items-center gap-3">
        <span className="text-[13px] text-ink-4">
          {UI_LABELS.FEEDBACK_PROGRESS_HINT.replace("{answered}", String(answered))}
        </span>

        <button
          onClick={submitSurvey}
          disabled={!canSubmit}
          className={`
            sm:ml-auto inline-flex items-center justify-center gap-2
            h-11 px-5 rounded-[10px] text-sm font-semibold transition-colors duration-200
            ${
              canSubmit
                ? "bg-brand text-white hover:bg-brand-hover"
                : "bg-fill text-ink-4 cursor-not-allowed"
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
        <p className="text-[13px] text-danger mt-3 animate-fade-in">{errorMessage}</p>
      )}
    </div>
  )
}
