import { useState } from "react";
import { FileText, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  MAX_POSTING_CHARS,
  MIN_POSTING_CHARS,
  MAX_POSTING_URL_CHARS,
  getJobPostingErrorMessage,
  isValidPostingUrl,
  requestJobPosting,
} from "@/lib/jobPosting";
import { cn } from "@/lib/utils";
import type { JobPostingRecord } from "@/types/jobPosting";

import FormSection from "./FormSection";

type Mode = "url" | "text";

type Tone = "dark" | "light";

// 분석 폼(어두운 화면)과 작업실(밝은 화면)이 같은 칸을 쓴다. 분석 폼까지 새 디자인으로 바뀌면 dark 를 지운다.
const TONE = {
  dark: {
    intro: "text-sm text-zinc-500 leading-relaxed break-keep",
    tabBar: "mt-4 flex items-center gap-4 border-b border-white/[0.08]",
    tabOn: "border-white text-white",
    tabOff: "border-transparent text-zinc-500 hover:text-zinc-300",
    input:
      "h-11 flex-1 rounded-xl border-white/[0.08] bg-white/[0.04] px-4 text-[15px] text-white placeholder:text-zinc-600 focus-visible:border-blue-500/40 focus-visible:ring-2 focus-visible:ring-blue-500/20",
    textarea:
      "min-h-[160px] border-white/[0.08] bg-white/[0.04] text-white placeholder:text-zinc-600 rounded-xl text-[15px] focus:border-blue-500/40 focus:ring-2 focus:ring-blue-500/20",
    hint: "mt-2 text-xs text-zinc-600 break-keep",
    tooShort: "text-xs text-zinc-500",
    count: "text-xs text-zinc-600 tabular-nums",
    error: "text-red-400",
    loading: "text-zinc-500",
    fetch: "h-11 rounded-xl bg-white px-5 text-sm font-semibold text-black hover:bg-zinc-200 disabled:opacity-40",
    cardLabel: "text-[11px] uppercase tracking-wider text-zinc-500",
    cardTitle: "mt-1 text-[15px] font-semibold text-white break-keep",
    cardMeta: "mt-1 text-xs text-zinc-500",
    replace: "shrink-0 text-[12.5px] text-zinc-400 underline-offset-4 transition-colors hover:text-white hover:underline",
    keywords: "text-[12px] px-2.5 py-1 rounded-lg bg-white/[0.05] border border-white/[0.06] text-zinc-200",
    listTitle: "text-xs font-medium uppercase tracking-wider text-zinc-500 mb-2.5",
    listItem: "flex gap-2 text-[13.5px] leading-relaxed text-zinc-300 break-keep",
    listDot: "text-zinc-600",
  },
  light: {
    intro: "text-[14px] text-ink-4 leading-relaxed break-keep",
    tabBar: "mt-4 flex items-center gap-5 border-b border-line-soft",
    tabOn: "border-ink font-bold text-ink",
    tabOff: "border-transparent text-ink-4 hover:text-ink-2",
    input:
      "h-11 flex-1 rounded-xl border-line bg-surface px-4 text-[15px] text-ink placeholder:text-ink-5 focus-visible:border-brand focus-visible:ring-0",
    textarea:
      "min-h-[160px] border-line bg-surface text-ink placeholder:text-ink-5 rounded-xl text-[15px] focus:border-brand focus:ring-0",
    hint: "mt-2 text-[13px] text-ink-4 break-keep",
    tooShort: "text-[13px] text-danger",
    count: "text-[13px] text-ink-4 tabular-nums",
    error: "text-danger",
    loading: "text-ink-4",
    fetch: "h-11 rounded-xl bg-ink px-5 text-[14px] font-semibold text-white hover:bg-ink-2 disabled:opacity-40",
    cardLabel: "text-[12px] font-semibold text-ink-4",
    cardTitle: "mt-1 text-[16px] font-bold text-ink break-keep",
    cardMeta: "mt-1 text-[13px] text-ink-4",
    replace: "shrink-0 text-[13px] font-semibold text-brand-ink underline-offset-4 hover:underline",
    keywords: "text-[13px] text-ink-4",
    listTitle: "text-[13px] font-semibold text-ink-3 mb-2",
    listItem: "flex gap-2 text-[14px] leading-relaxed text-ink-2 break-keep",
    listDot: "text-ink-5",
  },
} satisfies Record<Tone, Record<string, string>>;

export function getJobPostingTitle(record: JobPostingRecord): string {
  const { title, company, role } = record.summary;
  return title || [company, role].filter(Boolean).join(" · ") || "채용공고";
}

function hostnameOf(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/**
 * 자소서 분석 폼의 선택 입력: 채용공고를 URL 또는 붙여넣기로 받아 서버가 정리한 요약을 카드로 보여준다.
 * 로그인 없이 폼은 쓸 수 있지만 공고 읽기는 서버 자원을 쓰므로 비로그인 클릭은 onRequireLogin 으로 넘긴다.
 */
export default function JobPostingSection({
  value,
  onChange,
  isAuthenticated,
  onRequireLogin,
  tone = "dark",
}: {
  value: JobPostingRecord | null;
  onChange: (record: JobPostingRecord | null) => void;
  isAuthenticated: boolean;
  onRequireLogin: () => void;
  tone?: Tone;
}) {
  const t = TONE[tone];
  const [mode, setMode] = useState<Mode>("url");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmedText = text.trim();
  const isTextTooShort = trimmedText.length > 0 && trimmedText.length < MIN_POSTING_CHARS;
  const canFetch =
    !isLoading &&
    (mode === "url" ? isValidPostingUrl(url) : trimmedText.length >= MIN_POSTING_CHARS);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
  };

  const reset = () => {
    setUrl("");
    setText("");
    setError(null);
    setMode("url");
    onChange(null);
  };

  const handleFetch = async () => {
    if (!isAuthenticated) {
      onRequireLogin();
      return;
    }
    if (!canFetch) return;

    setIsLoading(true);
    setError(null);
    try {
      const result = await requestJobPosting(
        mode === "url" ? { url: url.trim() } : { text: trimmedText }
      );
      if (result.kind === "accepted") {
        onChange(result.record);
        return;
      }
      if (result.kind === "auth_required") {
        onRequireLogin();
        return;
      }
      if (result.kind === "network_error") {
        setError("네트워크가 불안정해요. 잠시 후 다시 시도해 주세요.");
        return;
      }
      setError(getJobPostingErrorMessage(result.code, result.status));
      // URL 을 못 읽는 사이트(원티드 등)는 본문 붙여넣기로 곧장 유도한다.
      if (result.code === "POSTING_URL_UNREADABLE") setMode("text");
    } finally {
      setIsLoading(false);
    }
  };

  if (value) {
    return (
      <FormSection icon={FileText} title="채용공고" className="space-y-5" tone={tone}>
        <JobPostingCard record={value} onReplace={reset} tone={tone} />
      </FormSection>
    );
  }

  return (
    <FormSection icon={FileText} title="채용공고" className="space-y-5" tone={tone}>
      <div>
        <p className={t.intro}>
          지원하려는 공고를 넣으면, 해당 공고를 기준으로 자소서를 분석해드려요.
        </p>
        <div className={t.tabBar} role="tablist">
          {(
            [
              ["url", "링크"],
              ["text", "본문 붙여넣기"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={mode === key}
              onClick={() => switchMode(key)}
              className={cn(
                "-mb-px border-b-2 pb-2.5 text-[13px] font-medium transition-colors",
                mode === key ? t.tabOn : t.tabOff
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {mode === "url" ? (
        <div>
          <label htmlFor="job-posting-url" className="sr-only">
            채용 공고 링크
          </label>
          <div className="flex flex-col gap-2.5 sm:flex-row">
            <Input
              id="job-posting-url"
              type="url"
              inputMode="url"
              value={url}
              maxLength={MAX_POSTING_URL_CHARS}
              onChange={event => {
                setUrl(event.target.value);
                setError(null);
              }}
              onKeyDown={event => {
                if (event.key === "Enter" && canFetch) {
                  event.preventDefault();
                  void handleFetch();
                }
              }}
              placeholder="https://"
              disabled={isLoading}
              className={t.input}
            />
            <FetchButton isLoading={isLoading} disabled={!canFetch} onClick={handleFetch} className={t.fetch} />
          </div>
          <p className={t.hint}>
            링크로 열리지 않는 사이트(원티드 등)는 조금 번거롭더라도 본문을 복사해서 붙여주세요.
          </p>
        </div>
      ) : (
        <div>
          <label htmlFor="job-posting-text" className="sr-only">
            공고 본문
          </label>
          <Textarea
            id="job-posting-text"
            value={text}
            disabled={isLoading}
            onChange={event => {
              setText(event.target.value.slice(0, MAX_POSTING_CHARS));
              setError(null);
            }}
            placeholder="담당 업무, 자격요건, 우대사항이 있는 부분을 그대로 붙여 주세요."
            className={t.textarea}
          />
          <div className="mt-2 flex items-center justify-between gap-3">
            <span className={t.tooShort}>
              {isTextTooShort ? `최소 ${MIN_POSTING_CHARS}자 이상 입력해 주세요` : ""}
            </span>
            <span className={t.count}>
              {text.length.toLocaleString()} / {MAX_POSTING_CHARS.toLocaleString()}
            </span>
          </div>
          <div className="mt-3 flex justify-end">
            <FetchButton isLoading={isLoading} disabled={!canFetch} onClick={handleFetch} className={t.fetch} />
          </div>
        </div>
      )}

      <p
        aria-live="polite"
        className={cn(
          "text-[13px]",
          error ? t.error : isLoading ? t.loading : "sr-only"
        )}
      >
        {error ?? (isLoading ? "공고를 읽는 중입니다." : "")}
      </p>
    </FormSection>
  );
}

function FetchButton({
  isLoading,
  disabled,
  onClick,
  className,
}: {
  isLoading: boolean;
  disabled: boolean;
  onClick: () => void;
  className: string;
}) {
  return (
    <Button type="button" onClick={onClick} disabled={disabled} className={className}>
      {isLoading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
          공고 읽는 중...
        </>
      ) : (
        "공고 불러오기"
      )}
    </Button>
  );
}

function JobPostingCard({
  record,
  onReplace,
  tone,
}: {
  record: JobPostingRecord;
  onReplace: () => void;
  tone: Tone;
}) {
  const t = TONE[tone];
  const { summary } = record;
  const host = hostnameOf(record.sourceUrl);
  const meta = [host, record.charCount ? `본문 ${record.charCount.toLocaleString()}자` : null].filter(
    Boolean
  );
  const hasRequirements = summary.requirements.length > 0;
  const hasPreferred = summary.preferred.length > 0;
  const showResponsibilities = !hasRequirements && !hasPreferred;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className={t.cardLabel}>지원 공고</p>
          <p className={t.cardTitle}>
            {getJobPostingTitle(record)}
          </p>
          {meta.length > 0 && (
            <p className={t.cardMeta}>{meta.join(" · ")}</p>
          )}
        </div>
        <button
          type="button"
          onClick={onReplace}
          className={t.replace}
        >
          다른 공고 넣기
        </button>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {hasRequirements && <BulletList title="자격요건" items={summary.requirements} tone={tone} />}
        {hasPreferred && <BulletList title="우대사항" items={summary.preferred} tone={tone} />}
        {showResponsibilities && summary.responsibilities.length > 0 && (
          <BulletList title="담당 업무" items={summary.responsibilities} tone={tone} />
        )}
      </div>

      {summary.keywords.length > 0 && (
        <ul className={tone === "light" ? "flex flex-wrap gap-x-2.5 gap-y-1" : "flex flex-wrap gap-2"} aria-label="공고 키워드">
          {summary.keywords.map(keyword => (
            <li
              key={keyword}
              className={t.keywords}
            >
              {tone === "light" ? `#${keyword}` : keyword}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function BulletList({ title, items, tone = "dark" }: { title: string; items: string[]; tone?: Tone }) {
  const t = TONE[tone];
  return (
    <div>
      <p className={t.listTitle}>{title}</p>
      <ul className="space-y-1.5">
        {items.map(item => (
          <li key={item} className={t.listItem}>
            <span aria-hidden="true" className={t.listDot}>
              ·
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
