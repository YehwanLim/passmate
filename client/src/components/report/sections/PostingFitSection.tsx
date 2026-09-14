import { UI_LABELS } from "@/constants/labels";
import type { JobPostingRecord } from "@/types/jobPosting";
import type { PostingFit } from "@/types/report";
import { SectionNumber } from "../SectionNumber";
import { renderRichText } from "../richText";

// 모델 출력값(드러남/약함/언급 없음)은 프롬프트 계약이라 그대로 두고, 화면에는 짧은 말로 바꿔 보여 준다.
// 강조는 색 톤으로만 하고 카드·배지 장식은 두지 않는다.
const STATUS_DISPLAY: Record<string, { label: string; tone: string }> = {
  드러남: { label: "적합", tone: "text-emerald-300 bg-emerald-400/10 border-emerald-400/15" },
  약함: { label: "미흡", tone: "text-amber-200 bg-amber-400/10 border-amber-400/15" },
  "언급 없음": { label: "없음", tone: "text-rose-200 bg-rose-400/10 border-rose-400/15" },
};
const NEUTRAL_STATUS_TONE = "text-zinc-300 bg-white/[0.04] border-white/[0.06]";

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

/** ACT 2.5 — 공고 적합도: 공고 요건별 적합/미흡/없음, 공고에만 있는 내용, 문항별로 넣을 것. 공고를 붙인 리포트에만 그린다. */
export function PostingFitSection({
  postingFit,
  jobPosting,
  indexLabel,
}: {
  postingFit: PostingFit;
  jobPosting?: JobPostingRecord | null;
  indexLabel: string;
}) {
  const identity = getPostingIdentity(jobPosting);
  const hostname = getHostname(jobPosting?.sourceUrl);
  const missingKeywords = (postingFit.missingKeywords ?? []).filter((keyword) => keyword?.trim());
  const questionAdvice = (postingFit.questionAdvice ?? []).filter((item) => item?.advice?.trim());

  return (
    <section id="section-posting-fit" className="py-24 section-divider report-section-anchor">
      <h3 className="text-2xl sm:text-3xl font-semibold text-white mb-4 tracking-tight"><SectionNumber value={indexLabel} />{UI_LABELS.POSTING_FIT_TITLE}</h3>
      {(identity || hostname) && (
        <p className="text-sm text-zinc-500 mb-10">
          {identity ? UI_LABELS.POSTING_FIT_BASIS(identity) : null}
          {identity && hostname ? " · " : null}
          {hostname}
        </p>
      )}

      <p className="text-xl sm:text-2xl font-medium text-white leading-snug tracking-[-0.01em] max-w-3xl mb-5 text-balance">{renderRichText(postingFit.headline)}</p>
      <p className="text-base text-zinc-400 mb-14 max-w-2xl leading-[1.75]">{renderRichText(postingFit.verdict)}</p>

      {/* Requirement matches */}
      <div className="mb-14">
        <p className="text-sm text-zinc-400 uppercase tracking-[0.12em] mb-5 font-semibold">{UI_LABELS.POSTING_FIT_MATCHES}</p>
        <ul className="divide-y divide-white/[0.05] border-y border-white/[0.05]">
          {postingFit.requirementMatches.map((match, i) => {
            const display = STATUS_DISPLAY[match.status];
            const tone = display?.tone ?? NEUTRAL_STATUS_TONE;
            const statusLabel = display?.label ?? match.status;
            const evidence = match.evidence?.trim();
            const advice = match.advice?.trim();
            return (
              <li key={i} className="py-5 sm:grid sm:grid-cols-[92px_1fr] sm:gap-5">
                <div className="mb-2.5 sm:mb-0 sm:pt-0.5">
                  <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[12px] font-semibold whitespace-nowrap ${tone}`}>{statusLabel}</span>
                </div>
                <div>
                  <p className="text-[16px] font-medium leading-[1.6] text-zinc-100">{renderRichText(match.requirement)}</p>
                  {evidence ? (
                    <p className="mt-2 text-[14px] leading-[1.75] text-zinc-400">
                      <span className="font-semibold text-zinc-500">{UI_LABELS.POSTING_FIT_EVIDENCE} · </span>{renderRichText(evidence)}
                    </p>
                  ) : null}
                  {advice ? (
                    <p className="mt-1.5 text-[14px] leading-[1.75] text-zinc-200">
                      <span className="font-semibold text-zinc-400">{UI_LABELS.POSTING_FIT_ADVICE} · </span>{renderRichText(advice)}
                    </p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {missingKeywords.length > 0 || questionAdvice.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Missing keywords */}
          {missingKeywords.length > 0 ? (
            <div className="py-2">
              <p className="text-sm text-zinc-400 uppercase tracking-[0.12em] mb-5 font-semibold">{UI_LABELS.POSTING_FIT_MISSING}</p>
              <div className="flex flex-wrap gap-2.5">
                {missingKeywords.map((keyword) => (
                  <span key={keyword} className="px-4 py-2 text-sm text-zinc-300 border border-dashed border-white/[0.16] rounded-lg font-medium">{keyword}</span>
                ))}
              </div>
            </div>
          ) : null}

          {/* Question advice */}
          {questionAdvice.length > 0 ? (
            <div className="py-2">
              <p className="text-sm text-zinc-400 uppercase tracking-[0.12em] mb-5 font-semibold">{UI_LABELS.POSTING_FIT_QUESTION_ADVICE}</p>
              <ul className="space-y-4">
                {questionAdvice.map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="shrink-0 pt-[3px] text-[13px] font-semibold tabular-nums text-zinc-500 whitespace-nowrap">{UI_LABELS.QUESTION} {item.questionIndex}</span>
                    <p className="text-[15px] text-zinc-200 leading-[1.7]">{renderRichText(item.advice)}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
