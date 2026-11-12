import { useId, useRef, useState } from "react";
import { Check } from "lucide-react";
import { useLocation } from "wouter";
import type { JobPostingListing } from "@/constants/jobPostings";
import { saveAnalyzeDraft } from "@/lib/analyzeDraft";
import { checkDraft, type DraftCheckItem } from "@/lib/draftCheck";
import { sendFunnelEvent } from "@/lib/siteVisits";

/** 점검할 만한 최소 글자 수. 이보다 짧으면 버튼을 막는다(길이 항목은 200자 기준으로 따로 짚는다). */
const MIN_CHECK_CHARS = 30;

// 처음 보는 사람이 "뭘 해 주는 건지" 한눈에 알도록 보여주는 예시 결과. 실제 규칙이 내는 문장과 같은 꼴이다.
const SAMPLE_ROWS: DraftCheckItem[] = [
  { key: "opening", status: "improve", title: "첫 문장", detail: "\"저는 어릴 때부터…\"처럼 배경으로 시작해요. 결론부터 꺼내면 어떨까요?" },
  { key: "cliche", status: "improve", title: "흔한 표현", detail: "누구나 쓰는 말이 보여요: \"열심히\", \"성실\"." },
  { key: "numbers", status: "good", title: "숫자로 보여준 결과", detail: "숫자가 들어 있어 결과가 눈에 잘 들어와요." },
];

function ResultRow({ item, compact = false }: { item: DraftCheckItem; compact?: boolean }) {
  const good = item.status === "good";
  return (
    <li className={`flex gap-3 border-b border-line-soft last:border-b-0 ${compact ? "py-2.5" : "py-3"}`}>
      <span
        aria-hidden="true"
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${good ? "bg-fill text-ink-4" : "bg-ink text-white"}`}
      >
        {good ? <Check className="h-3 w-3" /> : <span className="text-[11px] font-bold">!</span>}
      </span>
      <div className="min-w-0">
        <p className="text-[14px] font-semibold text-ink">
          {item.title}
          <span className={`ml-2 text-[13px] font-medium ${good ? "text-ink-4" : "text-ink-2"}`}>
            {good ? "좋아요" : "다듬어 볼까요"}
          </span>
        </p>
        <p className="mt-0.5 text-[14px] leading-relaxed text-ink-3 [word-break:keep-all]">{item.detail}</p>
      </div>
    </li>
  );
}

/**
 * 공고 화면의 "내 자소서 30초 점검". 글은 브라우저 안에서만 규칙으로 보고 서버로 보내지 않는다.
 * "이 글로 분석하기"를 누를 때만 분석 폼 초안(sessionStorage)으로 넘기고, 공고는 ?job= 으로 넘긴다.
 */
export function DraftQuickCheck({ listing }: { listing: JobPostingListing }) {
  const [, navigate] = useLocation();
  const [text, setText] = useState("");
  const [limit, setLimit] = useState("");
  const [results, setResults] = useState<DraftCheckItem[] | null>(null);
  const focusedRef = useRef(false);
  const textId = useId();
  const limitId = useId();

  // 밝은 공고 화면에서 한눈에 띄도록 검정 카드로 둔다(11-13 시안 A안). 결과가 나오면 예시는 치운다.
  const showSample = !results;
  const trimmed = text.trim();
  const canCheck = trimmed.length >= MIN_CHECK_CHARS;

  const runCheck = () => {
    if (!canCheck) return;
    const parsedLimit = Number.parseInt(limit, 10);
    setResults(checkDraft(trimmed, Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : null));
    void sendFunnelEvent("content_cta_click", `job-check:run:${listing.slug}`);
  };

  const goAnalyze = () => {
    void sendFunnelEvent("content_cta_click", `job-check:go:${listing.slug}`);
    saveAnalyzeDraft({
      company: listing.company,
      jobRole: "",
      questions: [{ id: crypto.randomUUID(), question: "", answer: trimmed }],
      jobPosting: null,
    });
    navigate(`/analyze?job=${listing.slug}`);
  };

  const field = "border-white/15 bg-white/[0.08] text-white placeholder:text-white/40 focus:border-white/40";
  const muted = "text-white/60";

  const sample = showSample && (
    <div className="rounded-[16px] bg-surface px-4 py-3">
      <p className="pt-1 text-[13px] font-semibold text-ink-4">이렇게 짚어 드려요</p>
      <ul aria-label="점검 예시">
        {SAMPLE_ROWS.map(item => (
          <ResultRow key={item.key} item={item} compact />
        ))}
      </ul>
    </div>
  );

  return (
    <section
      className="rounded-[24px] bg-ink px-5 py-6 text-white md:px-8 md:py-8"
    >
      <div className={showSample ? "grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:items-start" : ""}>
        <div>
          <h2 className="text-[22px] font-extrabold leading-[1.35] tracking-[-0.03em] text-balance [word-break:keep-all] md:text-[26px]">
            {listing.company} 자소서, 내기 전에 30초만 점검해 보세요
          </h2>
          <p className={`mt-2 text-[15px] leading-relaxed [word-break:keep-all] ${muted}`}>
            쓰던 문단을 붙여넣으면 바로 짚어 드려요. 로그인 없이 무료, 글은 서버로 보내지 않아요.
          </p>
          <label htmlFor={textId} className="sr-only">
            자소서 문단
          </label>
          <textarea
            id={textId}
            value={text}
            onFocus={() => {
              if (focusedRef.current) return;
              focusedRef.current = true;
              void sendFunnelEvent("content_cta_click", `job-check:focus:${listing.slug}`);
            }}
            onChange={event => {
              setText(event.target.value);
              setResults(null);
            }}
            rows={5}
            placeholder="쓰던 자소서 문단을 붙여넣어 주세요."
            className={`mt-5 w-full resize-y rounded-[14px] border px-4 py-3 text-[15px] leading-relaxed outline-none ${field}`}
          />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <label htmlFor={limitId} className={`flex items-center gap-2 text-[14px] ${muted}`}>
              글자 수 제한
              <input
                id={limitId}
                inputMode="numeric"
                value={limit}
                onChange={event => {
                  setLimit(event.target.value.replace(/\D/g, "").slice(0, 5));
                  setResults(null);
                }}
                placeholder="예: 700"
                className={`h-9 w-24 rounded-[10px] border px-3 text-[14px] outline-none ${field}`}
              />
              <span className="text-white/40">(선택)</span>
            </label>
            <button
              type="button"
              onClick={runCheck}
              disabled={!canCheck}
              className="ml-auto h-11 rounded-[12px] bg-white px-6 text-[15px] font-bold text-ink transition-opacity disabled:opacity-40"
            >
              점검하기
            </button>
          </div>
        </div>
        {sample}
      </div>

      {results && (
        <div className="mt-6 rounded-[16px] bg-surface px-5 py-2 text-ink">
          <ul aria-label="점검 결과">
            {results.map(item => (
              <ResultRow key={item.key} item={item} />
            ))}
          </ul>
          <div className="-mx-5 mt-2 rounded-b-[16px] border-t border-line-soft bg-fill-soft px-5 py-4">
            <p className="text-[14px] leading-relaxed text-ink-2 [word-break:keep-all]">
              여기까지는 겉모양이에요. 채용 담당자가 이 글을 어떻게 읽을지는 전체 리포트에서 알려 드려요. 가입하면 무료로 1회 받을 수 있어요.
            </p>
            <button
              type="button"
              onClick={goAnalyze}
              className="mt-3 h-11 w-full rounded-[12px] bg-brand text-[15px] font-bold text-white transition-colors hover:bg-brand-hover sm:w-auto sm:px-6"
            >
              이 글로 분석하기
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
