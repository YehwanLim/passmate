import type { CSSProperties, ReactNode } from "react";

import { parseHighlightedText } from "./reportFirstImpression";

export const COMPANY_REPORT_DISCLAIMER =
  "AI가 공개 자료를 검색해 정리한 브리프입니다. 수치와 날짜는 부록의 출처 원문에서 확인하세요.";
export const INVESTMENT_DISCLAIMER =
  "주가·시가총액·공시 내용은 사실 서술이며 투자 조언이 아닙니다.";
export const SOURCE_NOTE = "출처는 부록 '출처와 기준일'에서 확인할 수 있어요.";

// 자소서 리포트의 마커펜 밑줄과 같은 어휘. 기업 리포트는 한 톤(에메랄드)만 쓴다.
const EMPHASIS_STYLE: CSSProperties = {
  backgroundImage: "linear-gradient(to top, rgba(105,211,177,0.34) 0 6px, transparent 6px)",
  boxDecorationBreak: "clone",
  WebkitBoxDecorationBreak: "clone",
};

/** `**문장**` 을 강조로 그린다. emphasize=false 면 마커만 벗기고 평문으로. 태그는 parseHighlightedText 가 제거한다. */
export function renderCompanyText(text: string | null | undefined, emphasize = false): ReactNode[] {
  return parseHighlightedText(text ?? "").map((segment, index) => (
    emphasize && segment.kind === "bold"
      ? <strong key={`${segment.text}-${index}`} className="rounded-[2px] font-semibold text-zinc-100" style={EMPHASIS_STYLE}>{segment.text}</strong>
      : <span key={`${segment.text}-${index}`}>{segment.text}</span>
  ));
}

/** http/https 만 링크로 취급한다(모델이 만들어낸 스킴 오남용 방지). */
export function isHttpUrl(value: string): boolean {
  try {
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

/** 모델이 준 출처 URL이 http/https 일 때만 링크로, 아니면 평문으로 그린다. */
export function ExternalSourceLink({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  if (!isHttpUrl(href)) {
    return <span className={className}>{children}</span>;
  }
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
    </a>
  );
}

export function CompanySectionNumber({ value }: { value: string }) {
  return <span className="mr-3.5 font-semibold tabular-nums text-zinc-700">{value}</span>;
}

export function CompanySectionHeading({ index, title, deck }: { index: string; title: string; deck?: string }) {
  return (
    <>
      <h3 className="text-2xl sm:text-3xl font-semibold text-white mb-6 tracking-tight text-balance">
        <CompanySectionNumber value={index} />{title}
      </h3>
      {deck ? <p className="text-base text-zinc-400 mb-12 max-w-2xl leading-[1.75] text-pretty">{renderCompanyText(deck)}</p> : null}
    </>
  );
}

/** 섹션 끝의 출처 안내 한 줄(스펙 §7-1: 항목별 각주 칩 대신). */
export function SourceNote() {
  return <p className="mt-10 text-xs text-zinc-600">{SOURCE_NOTE}</p>;
}

export function PhaseBadge({ label }: { label: string }) {
  return <span className="inline-block rounded-md border border-white/[0.07] bg-white/[0.04] px-2.5 py-1 text-[11px] font-semibold tracking-[0.02em] text-zinc-400">{label}</span>;
}

/** 직무 연관도(직접/간접/무관). 직접만 하늘색, 간접은 회색, 무관은 그리지 않는다. */
export function RelevanceBadge({ relevance }: { relevance: string }) {
  const level = relevance.startsWith("직접") ? "direct" : relevance.startsWith("간접") ? "indirect" : "none";
  if (level === "none") return null;
  return (
    <span className={`inline-block rounded-md px-2.5 py-1 text-[11px] font-semibold ${
      level === "direct"
        ? "border border-sky-300/20 bg-sky-300/[0.08] text-sky-300"
        : "border border-white/[0.07] bg-white/[0.04] text-zinc-400"
    }`}>
      {level === "direct" ? "직무와 직접 연결" : "직무와 간접 연결"}
    </span>
  );
}

export interface TimelineEntry {
  when: string;
  title: string;
  body: ReactNode;
  tail?: ReactNode;
}

/** 좌측 날짜 레일 세로 타임라인(04 국면, 05 직무 소식). */
export function Timeline({ entries, dense = false }: { entries: TimelineEntry[]; dense?: boolean }) {
  return (
    <ol className="relative border-l border-white/[0.08] pl-6 space-y-8">
      {entries.map((entry, index) => (
        <li key={`${entry.when}-${index}`} className="relative">
          <span aria-hidden="true" className="absolute -left-[29px] top-1.5 size-[9px] rounded-full border border-white/[0.2] bg-[#09090B]" />
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500 tabular-nums">{entry.when}</p>
          <p className={`${dense ? "text-[15px]" : "text-[17px]"} font-semibold leading-[1.45] tracking-[-0.01em] text-zinc-50`}>{entry.title}</p>
          <div className={`mt-2 ${dense ? "text-[14px]" : "text-[15px]"} leading-[1.85] text-zinc-400`}>{entry.body}</div>
          {entry.tail ? <div className="mt-2 text-[14px] leading-[1.8] text-zinc-300">{entry.tail}</div> : null}
        </li>
      ))}
    </ol>
  );
}

export function HeadlineCard({ headline, text, tone }: { headline: ReactNode; text: string; tone: "opportunity" | "risk" }) {
  const dot = tone === "opportunity"
    ? "bg-emerald-400/85 shadow-[0_0_8px_rgba(52,211,153,0.35)]"
    : "bg-rose-400/70 shadow-[0_0_8px_rgba(251,113,133,0.25)]";
  return (
    <div className="mt-7 border-t border-white/[0.05] pt-7 first:mt-0 first:border-t-0 first:pt-0">
      <p className="mb-2.5 flex items-center gap-2.5 text-[17px] font-semibold leading-[1.45] tracking-[-0.01em] text-zinc-50">
        <span aria-hidden="true" className={`mx-[3px] inline-block size-[7px] shrink-0 rounded-full ${dot}`} />
        <span>{headline}</span>
      </p>
      <p className="pl-[23px] text-[15px] leading-[1.85] text-zinc-400">{renderCompanyText(text, true)}</p>
    </div>
  );
}
