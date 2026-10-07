import type { ReactNode } from "react";

import { MARKER_CLASS } from "@/components/report/richText";
import { parseHighlightedText } from "./reportFirstImpression";

export const COMPANY_REPORT_DISCLAIMER =
  "AI가 공개 자료를 검색해 정리한 브리프입니다. 수치와 날짜는 부록의 출처 원문에서 확인하세요.";
export const INVESTMENT_DISCLAIMER =
  "주가·시가총액·공시 내용은 사실 서술이며 투자 조언이 아닙니다.";
export const SOURCE_NOTE = "출처는 부록 '출처와 기준일'에서 확인할 수 있어요.";

/** `**문장**` 을 자소서 리포트와 같은 형광펜(초록 한 톤)으로 그린다. emphasize=false 면 마커만 벗기고 평문으로. 태그는 parseHighlightedText 가 제거한다. */
export function renderCompanyText(text: string | null | undefined, emphasize = false): ReactNode[] {
  return parseHighlightedText(text ?? "").map((segment, index) => (
    emphasize && segment.kind === "bold"
      ? <strong key={`${segment.text}-${index}`} className={`font-bold text-ink ${MARKER_CLASS.ok}`}>{segment.text}</strong>
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
  return <span className="mr-3 tabular-nums text-ink-5">{value}</span>;
}

export function CompanySectionHeading({ index, title, deck }: { index: string; title: string; deck?: string }) {
  return (
    <div className="mb-7">
      <h3 className="text-[22px] font-bold leading-[1.35] tracking-[-0.03em] text-ink text-balance sm:text-[24px]">
        <CompanySectionNumber value={index} />{title}
      </h3>
      {deck ? <p className="mt-2 max-w-2xl text-[15px] leading-[1.7] text-ink-4 text-pretty">{renderCompanyText(deck)}</p> : null}
    </div>
  );
}

/** 섹션 끝의 출처 안내 한 줄(스펙 §7-1: 항목별 각주 칩 대신). */
export function SourceNote() {
  return <p className="mt-8 text-[12px] text-ink-4">{SOURCE_NOTE}</p>;
}

export function PhaseBadge({ label }: { label: string }) {
  return <span className="inline-block shrink-0 rounded-[8px] bg-fill px-2.5 py-1 text-[13px] font-semibold text-ink-3">{label}</span>;
}

/** 직무 연관도(직접/간접/무관). 직접만 파란색, 간접은 회색, 무관은 그리지 않는다. */
export function RelevanceBadge({ relevance }: { relevance: string }) {
  const level = relevance.startsWith("직접") ? "direct" : relevance.startsWith("간접") ? "indirect" : "none";
  if (level === "none") return null;
  return (
    <span className={`inline-block shrink-0 rounded-[8px] px-2.5 py-1 text-[13px] font-semibold ${
      level === "direct"
        ? "bg-brand-soft text-brand-ink"
        : "bg-fill text-ink-3"
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
    <ol className="relative border-l border-line pl-6 space-y-8">
      {entries.map((entry, index) => (
        <li key={`${entry.when}-${index}`} className="relative">
          <span aria-hidden="true" className="absolute -left-[29px] top-1.5 size-[9px] rounded-full border-2 border-ink-5 bg-surface" />
          <p className="mb-1.5 text-[13px] font-semibold text-ink-4 tabular-nums">{entry.when}</p>
          <p className={`${dense ? "text-[15px]" : "text-[17px]"} font-bold leading-[1.45] tracking-[-0.01em] text-ink`}>{entry.title}</p>
          <div className={`mt-2 ${dense ? "text-[14px]" : "text-[15px]"} leading-[1.85] text-ink-3`}>{entry.body}</div>
          {entry.tail ? <div className="mt-2 text-[14px] leading-[1.8] text-ink-2">{entry.tail}</div> : null}
        </li>
      ))}
    </ol>
  );
}

export function HeadlineCard({ headline, text, tone }: { headline: ReactNode; text: string; tone: "opportunity" | "risk" }) {
  const dot = tone === "opportunity" ? "bg-ok" : "bg-danger";
  return (
    <div className="mt-6 border-t border-line-soft pt-6 first:mt-0 first:border-t-0 first:pt-0">
      <p className="mb-2.5 flex items-center gap-2.5 text-[17px] font-bold leading-[1.45] tracking-[-0.01em] text-ink">
        <span aria-hidden="true" className={`mx-[3px] inline-block size-[7px] shrink-0 rounded-full ${dot}`} />
        <span>{headline}</span>
      </p>
      <p className="pl-[23px] text-[15px] leading-[1.85] text-ink-3">{renderCompanyText(text, true)}</p>
    </div>
  );
}
