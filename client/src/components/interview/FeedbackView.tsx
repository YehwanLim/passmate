import { DELIVERY_CATEGORY_LABEL, INTERVIEW_FEEDBACK_COPY } from "@/copy/interviewCopy";
import type { InterviewFeedback, InterviewTurnPayload } from "@/lib/interview/interviewApi";

function formatOffset(ms: number) {
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/** 면접 뒤 피드백과 대화 글. 점수·등급은 어디에도 없다. */
export default function FeedbackView({ feedback, turns, hadVideo }: { feedback: InterviewFeedback; turns: InterviewTurnPayload[]; hadVideo: boolean }) {
  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-surface px-6 py-7 md:px-8">
        <p className="text-[15px] leading-relaxed text-ink-2 text-pretty">{feedback.summary}</p>
        <p className="mt-3 text-[13px] text-ink-4">{feedback.disclaimer}</p>
      </section>

      {feedback.answers.map((answer, index) => (
        <section key={`${index}-${answer.question}`} className="rounded-3xl bg-surface px-6 py-7 md:px-8">
          <p className="text-[13px] font-bold text-brand-ink">질문 {index + 1}</p>
          <h3 className="mt-1.5 text-[18px] font-bold text-ink text-balance">{answer.question}</h3>
          {answer.whatWorked && (
            <div className="mt-4">
              <p className="text-[13px] font-semibold text-ink-4">설득된 부분</p>
              <p className="mt-1 text-[15px] leading-relaxed text-ink-2 text-pretty">{answer.whatWorked}</p>
            </div>
          )}
          {answer.whatToImprove && (
            <div className="mt-4">
              <p className="text-[13px] font-semibold text-ink-4">다음에 바꿔 볼 점</p>
              <p className="mt-1 text-[15px] leading-relaxed text-ink-2 text-pretty">{answer.whatToImprove}</p>
            </div>
          )}
          {answer.nextAttempt && (
            <div className="mt-4 rounded-2xl bg-fill-soft px-4 py-3.5">
              <p className="text-[13px] font-semibold text-ink-4">{INTERVIEW_FEEDBACK_COPY.nextAttempt}</p>
              <p className="mt-1 text-[15px] leading-relaxed text-ink-2 text-pretty">{answer.nextAttempt}</p>
            </div>
          )}
        </section>
      ))}

      <section className="rounded-3xl bg-surface px-6 py-7 md:px-8">
        <h3 className="text-[18px] font-bold text-ink">{INTERVIEW_FEEDBACK_COPY.deliveryHeading}</h3>
        {!hadVideo || !feedback.delivery.available ? (
          <p className="mt-2 text-[15px] text-ink-4">{INTERVIEW_FEEDBACK_COPY.deliveryUnavailable}</p>
        ) : feedback.delivery.items.length === 0 ? (
          <p className="mt-2 text-[15px] text-ink-4">사진 {feedback.delivery.photoCount}장에서 반복해 보인 행동은 없었어요.</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {feedback.delivery.items.map((item) => (
              <li key={item.category} className="rounded-2xl bg-fill-soft px-4 py-3.5">
                <p className="text-[13px] font-semibold text-ink-4">{DELIVERY_CATEGORY_LABEL[item.category]}</p>
                <p className="mt-1 text-[15px] leading-relaxed text-ink-2 text-pretty">{item.observation}</p>
                <p className="mt-1.5 text-[15px] leading-relaxed text-ink-3 text-pretty">{item.suggestion}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <TranscriptList turns={turns} />
    </div>
  );
}

export function TranscriptList({ turns }: { turns: InterviewTurnPayload[] }) {
  return (
    <section className="rounded-3xl bg-surface px-6 py-7 md:px-8">
      <h3 className="text-[18px] font-bold text-ink">{INTERVIEW_FEEDBACK_COPY.transcriptHeading}</h3>
      <p className="mt-1 text-[13px] text-ink-4">{INTERVIEW_FEEDBACK_COPY.transcriptHint}</p>
      {turns.length === 0 ? (
        <p className="mt-4 text-[15px] text-ink-4">저장된 대화가 없어요.</p>
      ) : (
        <ol className="mt-5 space-y-3">
          {turns.map((turn) => (
            <li key={turn.seq} className={`flex gap-3 text-[15px] leading-relaxed ${turn.speaker === "CANDIDATE" ? "text-ink" : "text-ink-3"}`}>
              <span className="w-10 shrink-0 pt-0.5 text-[12px] tabular-nums text-ink-5">{formatOffset(turn.offsetMs)}</span>
              <p className="text-pretty">
                <span className="mr-1.5 font-semibold">{turn.speaker === "CANDIDATE" ? "나" : "면접관"}</span>
                {turn.text}
                {turn.interrupted && <span className="ml-1 text-[12px] text-ink-5">(끊김)</span>}
                {turn.partial && <span className="ml-1 text-[12px] text-ink-5">(일부)</span>}
              </p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
