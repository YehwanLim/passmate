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

const FETCH_BUTTON_CLASS =
  "h-11 rounded-xl bg-white px-5 text-sm font-semibold text-black hover:bg-zinc-200 disabled:opacity-40";

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
}: {
  value: JobPostingRecord | null;
  onChange: (record: JobPostingRecord | null) => void;
  isAuthenticated: boolean;
  onRequireLogin: () => void;
}) {
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
      <FormSection icon={FileText} title="채용공고" className="space-y-5">
        <JobPostingCard record={value} onReplace={reset} />
      </FormSection>
    );
  }

  return (
    <FormSection icon={FileText} title="채용공고" className="space-y-5">
      <div>
        <p className="text-sm text-zinc-500 leading-relaxed break-keep">
          지원하는 공고를 붙이면 자격요건·우대사항에 맞춰 자소서를 읽어 드려요.
        </p>
        <div className="mt-4 flex items-center gap-4 border-b border-white/[0.08]" role="tablist">
          {(
            [
              ["url", "URL 입력"],
              ["text", "텍스트 붙여넣기"],
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
                mode === key
                  ? "border-white text-white"
                  : "border-transparent text-zinc-500 hover:text-zinc-300"
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
            채용공고 URL
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
              className="h-11 flex-1 rounded-xl border-white/[0.08] bg-white/[0.04] px-4 text-[15px] text-white placeholder:text-zinc-600 focus-visible:border-blue-500/40 focus-visible:ring-2 focus-visible:ring-blue-500/20"
            />
            <FetchButton isLoading={isLoading} disabled={!canFetch} onClick={handleFetch} />
          </div>
          <p className="mt-2 text-xs text-zinc-600 break-keep">
            URL을 못 읽는 사이트(원티드 등)는 공고 본문을 복사해 텍스트로 붙여 주세요.
          </p>
        </div>
      ) : (
        <div>
          <label htmlFor="job-posting-text" className="sr-only">
            채용공고 본문
          </label>
          <Textarea
            id="job-posting-text"
            value={text}
            disabled={isLoading}
            onChange={event => {
              setText(event.target.value.slice(0, MAX_POSTING_CHARS));
              setError(null);
            }}
            placeholder="수행 업무·자격요건·우대사항이 담긴 공고 본문을 붙여 넣어 주세요."
            className="min-h-[160px] border-white/[0.08] bg-white/[0.04] text-white placeholder:text-zinc-600 rounded-xl text-[15px] focus:border-blue-500/40 focus:ring-2 focus:ring-blue-500/20"
          />
          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="text-xs text-zinc-500">
              {isTextTooShort ? `최소 ${MIN_POSTING_CHARS}자 이상 입력해 주세요` : ""}
            </span>
            <span className="text-xs text-zinc-600 tabular-nums">
              {text.length.toLocaleString()} / {MAX_POSTING_CHARS.toLocaleString()}
            </span>
          </div>
          <div className="mt-3 flex justify-end">
            <FetchButton isLoading={isLoading} disabled={!canFetch} onClick={handleFetch} />
          </div>
        </div>
      )}

      <p
        aria-live="polite"
        className={cn(
          "text-[13px]",
          error ? "text-red-400" : isLoading ? "text-zinc-500" : "sr-only"
        )}
      >
        {error ?? (isLoading ? "공고를 읽고 있어요. 잠시만 기다려 주세요." : "")}
      </p>
    </FormSection>
  );
}

function FetchButton({
  isLoading,
  disabled,
  onClick,
}: {
  isLoading: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <Button type="button" onClick={onClick} disabled={disabled} className={FETCH_BUTTON_CLASS}>
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
}: {
  record: JobPostingRecord;
  onReplace: () => void;
}) {
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
          <p className="text-[11px] uppercase tracking-wider text-zinc-500">불러온 공고</p>
          <p className="mt-1 text-[15px] font-semibold text-white break-keep">
            {getJobPostingTitle(record)}
          </p>
          {meta.length > 0 && (
            <p className="mt-1 text-xs text-zinc-500">{meta.join(" · ")}</p>
          )}
        </div>
        <button
          type="button"
          onClick={onReplace}
          className="shrink-0 text-[12.5px] text-zinc-400 underline-offset-4 transition-colors hover:text-white hover:underline"
        >
          다른 공고로 바꾸기
        </button>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {hasRequirements && <BulletList title="자격요건" items={summary.requirements} />}
        {hasPreferred && <BulletList title="우대사항" items={summary.preferred} />}
        {showResponsibilities && summary.responsibilities.length > 0 && (
          <BulletList title="책임 업무" items={summary.responsibilities} />
        )}
      </div>

      {summary.keywords.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="공고 키워드">
          {summary.keywords.map(keyword => (
            <li
              key={keyword}
              className="text-[12px] px-2.5 py-1 rounded-lg bg-white/[0.05] border border-white/[0.06] text-zinc-200"
            >
              {keyword}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function BulletList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-2.5">{title}</p>
      <ul className="space-y-1.5">
        {items.map(item => (
          <li key={item} className="flex gap-2 text-[13.5px] leading-relaxed text-zinc-300 break-keep">
            <span aria-hidden="true" className="text-zinc-600">
              ·
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
