import { UI_LABELS } from "@/constants/labels";
import type { JobPostingRecord } from "@/types/jobPosting";
import type { PostingFit } from "@/types/report";
import { renderRichText } from "../richText";

// 모델 출력값(드러남/약함/언급 없음)은 프롬프트 계약이라 그대로 두고, 화면에는 짧은 말로 바꿔 보여 준다.
// 강조는 색 톤으로만 하고 카드·배지 장식은 두지 않는다.
const STATUS_DISPLAY: Record<string, { label: string; tone: string }> = {
  드러남: { label: "채웠어요", tone: "text-ok bg-ok-soft" },
  약함: { label: "약해요", tone: "text-blank bg-blank-soft" },
  "언급 없음": { label: "안 보여요", tone: "text-danger bg-danger-soft" },
};
const NEUTRAL_STATUS_TONE = "text-ink-3 bg-fill";

/** `회사 · 직무` 를 우선, 둘 다 비면 공고 제목. 셋 다 비면 null. */
function getPostingIdentity(jobPosting: JobPostingRecord | null | undefined): string | null {
  const summary = jobPosting?.summary;
  if (!summary) return null;
  const pair = [summary.company, summary.role].map((part) => part?.trim() ?? "").filter(Boolean).join(" · ");
  return pair || summary.title?.trim() || null;
}

function getHostname(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** 공고 적합도: 공고 요건별 채웠어요/약해요/안 보여요, 공고에만 있는 내용, 문항별로 넣을 것. 공고를 붙인 리포트에만, ReportBlock 안에 그린다. */
export function PostingFitSection({
  postingFit,
  jobPosting,
}: {
  postingFit: PostingFit;
  jobPosting?: JobPostingRecord | null;
}) {
  const identity = getPostingIdentity(jobPosting);
  const hostname = getHostname(jobPosting?.sourceUrl);
  const missingKeywords = (postingFit.missingKeywords ?? []).filter((keyword) => keyword?.trim());
  const questionAdvice = (postingFit.questionAdvice ?? []).filter((item) => item?.advice?.trim());

  return (
    <div>
      {(identity || hostname) && (
        <p className="mb-4 text-[14px] text-ink-4">
          {identity ? UI_LABELS.POSTING_FIT_BASIS(identity) : null}
          {identity && hostname ? " · " : null}
          {hostname}
        </p>
      )}

      <p className="mb-3 max-w-3xl text-[19px] font-bold leading-snug tracking-[-0.01em] text-ink text-balance">{renderRichText(postingFit.headline)}</p>
      <p className="mb-8 max-w-3xl text-[15px] leading-[1.75] text-ink-3">{renderRichText(postingFit.verdict)}</p>

      {/* Requirement matches */}
      <div className="mb-8">
        <p className="mb-2 text-[14px] font-bold text-ink-4">{UI_LABELS.POSTING_FIT_MATCHES}</p>
        <ul className="divide-y divide-line-soft border-y border-line-soft">
          {postingFit.requirementMatches.map((match, i) => {
            const display = STATUS_DISPLAY[match.status];
            const tone = display?.tone ?? NEUTRAL_STATUS_TONE;
            const statusLabel = display?.label ?? match.status;
            const evidence = match.evidence?.trim();
            const advice = match.advice?.trim();
            return (
              <li key={i} className="py-4 sm:grid sm:grid-cols-[84px_1fr] sm:gap-4">
                <div className="mb-2.5 sm:mb-0 sm:pt-0.5">
                  <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[13px] font-bold whitespace-nowrap ${tone}`}>{statusLabel}</span>
                </div>
                <div>
                  <p className="text-[16px] font-bold leading-[1.55] text-ink">{renderRichText(match.requirement)}</p>
                  {evidence ? (
                    <p className="mt-1.5 text-[14px] leading-[1.7] text-ink-4">
                      <span className="font-semibold text-ink-4">{UI_LABELS.POSTING_FIT_EVIDENCE} · </span>{renderRichText(evidence)}
                    </p>
                  ) : null}
                  {advice ? (
                    <p className="mt-1 text-[14px] leading-[1.7] text-ink-2">
                      <span className="font-semibold text-ink-4">{UI_LABELS.POSTING_FIT_ADVICE} · </span>{renderRichText(advice)}
                    </p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {missingKeywords.length > 0 || questionAdvice.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-7">
          {/* Missing keywords */}
          {missingKeywords.length > 0 ? (
            <div>
              <p className="mb-3 text-[14px] font-bold text-ink-4">{UI_LABELS.POSTING_FIT_MISSING}</p>
              <p className="text-[16px] font-bold leading-[1.6] text-ink">{missingKeywords.join(" · ")}</p>
            </div>
          ) : null}

          {/* Question advice */}
          {questionAdvice.length > 0 ? (
            <div>
              <p className="mb-3 text-[14px] font-bold text-ink-4">{UI_LABELS.POSTING_FIT_QUESTION_ADVICE}</p>
              <ul className="space-y-3">
                {questionAdvice.map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="shrink-0 pt-[3px] text-[13px] font-semibold tabular-nums text-ink-5 whitespace-nowrap">{UI_LABELS.QUESTION} {item.questionIndex}</span>
                    <p className="text-[15px] text-ink-2 leading-[1.7]">{renderRichText(item.advice)}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
