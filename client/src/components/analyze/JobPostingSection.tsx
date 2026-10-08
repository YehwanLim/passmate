import { useState } from "react";
import { Info, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { findJobPosting, JOB_POSTINGS, type JobPostingListing } from "@/constants/jobPostings";
import { JOB_POSTING_DETAILS, postingTextOf, type JobPostingDetail } from "@/constants/jobPostingDetails";
import { useNow } from "@/hooks/useNow";
import {
  MAX_POSTING_CHARS,
  MIN_POSTING_CHARS,
  MAX_POSTING_URL_CHARS,
  getJobPostingErrorMessage,
  isValidPostingUrl,
  requestJobPosting,
} from "@/lib/jobPosting";
import { dDayLabel, isOpen, openPostings } from "@/lib/jobPostingDates";
import { cn } from "@/lib/utils";
import type { JobPostingRecord } from "@/types/jobPosting";

import FormSection from "./FormSection";

type Mode = "url" | "text" | "listed";

type Tone = "card" | "light";

// 분석 폼(흰 카드 한 장)과 작업실(이미 흰 카드 안)이 같은 칸을 쓴다. tone 은 바깥 틀만 바꾼다.
const STYLE = {
    help: "space-y-1.5 rounded-xl bg-fill-soft px-4 py-3 text-[13px] leading-relaxed text-ink-3 break-keep",
    tabBar: "flex items-center gap-5 border-b border-line-soft",
    tabOn: "border-ink font-bold text-ink",
    tabOff: "border-transparent text-ink-4 hover:text-ink-2",
    input:
      "h-11 shrink-0 rounded-xl border-line bg-surface px-4 sm:flex-1 text-[15px] text-ink placeholder:text-ink-5 focus-visible:border-brand focus-visible:ring-0",
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
};

// 회사 이름 비교용: 띄어쓰기·(주)·'그룹'을 떼고 소문자로. "CJ제일제당"과 "CJ그룹"이 서로 닿게 한다.
function normalizeCompany(name: string): string {
  return name
    .toLowerCase()
    .replace(/\(주\)|㈜|주식회사|\s/g, "")
    .replace(/그룹$/, "");
}

/** 적은 회사 이름과 비슷한 공고인가 — 한쪽 이름이 다른 쪽에 들어 있거나, 계열사 줄에 적은 이름이 있으면 같은 회사로 본다. */
export function matchesCompany(posting: JobPostingListing, company: string): boolean {
  const typed = normalizeCompany(company);
  if (typed.length < 2) return false;
  const names = [posting.company, posting.shortName].map(normalizeCompany).filter(Boolean);
  if (names.some(name => typed.includes(name) || name.includes(typed))) return true;
  return typed.length >= 3 && normalizeCompany(posting.subtitle).includes(typed);
}

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
 *
 * '접수 중인 공고' 탭(10-09): /jobs 에 올린 공고 중 하나를 고르면 onPickListed 로 알려(부모가 회사를 채운다),
 * '공고 불러오기'는 그 공고의 정리된 본문(postingTextOf)을 붙여넣기와 같은 길로 서버에 보낸다. 로그인 규칙은 그대로다.
 * 탭은 적은 회사 이름과 비슷한 접수 중 공고가 있거나 /jobs/:slug 에서 ?job= 으로 들어왔을 때만 보인다.
 * 쓰는 법 안내는 제목 옆 (i) 를 눌러야 펼쳐진다(10-09, 칸을 조용하게).
 */
export default function JobPostingSection({
  value,
  onChange,
  isAuthenticated,
  onRequireLogin,
  tone = "card",
  initialListedSlug,
  onPickListed,
  company,
}: {
  value: JobPostingRecord | null;
  onChange: (record: JobPostingRecord | null) => void;
  isAuthenticated: boolean;
  onRequireLogin: () => void;
  tone?: Tone;
  /** /jobs/:slug 에서 넘어온 공고. 있으면 '접수 중인 공고' 탭을 그 공고가 골라진 채로 연다 */
  initialListedSlug?: string;
  onPickListed?: (listing: JobPostingListing, detail: JobPostingDetail) => void;
  /** 지원 회사 칸에 적은 이름. 넘기면 이와 비슷한 접수 중 공고만 보인다(빈칸이면 탭이 없다). 안 넘기면(새 지원서) 전부 */
  company?: string;
}) {
  const t = STYLE;
  const initialListed = findJobPosting(initialListedSlug);
  const [selectedMode, setMode] = useState<Mode>(initialListed ? "listed" : "url");
  const [helpOpen, setHelpOpen] = useState(false);
  const [listedSlug, setListedSlug] = useState<string | null>(initialListed?.slug ?? null);
  const now = useNow();
  // 적은 회사와 비슷한 접수 중 공고. 쿼리로 넘어온 공고는 마감됐어도(그 공고로 준비하러 온 것이라) 남기고, 골라진 채로 보이게 맨 위에 둔다.
  const listedOptions = (now ? openPostings(JOB_POSTINGS, now) : []).filter(
    posting => posting.slug !== initialListed?.slug && (company === undefined || matchesCompany(posting, company))
  );
  if (initialListed) listedOptions.unshift(initialListed);
  // 회사 이름을 바꿔 비슷한 공고가 사라지면 탭도 사라지므로 링크 칸으로 돌아간다.
  const mode: Mode = selectedMode === "listed" && listedOptions.length === 0 ? "url" : selectedMode;
  const listed = findJobPosting(listedSlug);
  const listedDetail = listed ? JOB_POSTING_DETAILS[listed.slug] : undefined;
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmedText = text.trim();
  const isTextTooShort = trimmedText.length > 0 && trimmedText.length < MIN_POSTING_CHARS;
  const canFetch =
    !isLoading &&
    (mode === "url"
      ? isValidPostingUrl(url)
      : mode === "text"
        ? trimmedText.length >= MIN_POSTING_CHARS
        : Boolean(listed && listedDetail));

  const pickListed = (slug: string) => {
    setListedSlug(slug);
    setError(null);
    const listing = findJobPosting(slug);
    const detail = listing ? JOB_POSTING_DETAILS[listing.slug] : undefined;
    if (listing && detail) onPickListed?.(listing, detail);
  };

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
        mode === "url"
          ? { url: url.trim() }
          : mode === "text"
            ? { text: trimmedText }
            : { text: postingTextOf(listed as JobPostingListing, listedDetail as JobPostingDetail) }
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

  const helpButton = (
    <button
      type="button"
      onClick={() => setHelpOpen(open => !open)}
      aria-expanded={helpOpen}
      aria-controls="job-posting-help"
      aria-label="채용공고 넣는 법"
      className={cn(
        "inline-flex size-6 items-center justify-center rounded-full transition-colors hover:bg-fill hover:text-ink-2",
        helpOpen ? "text-ink-2" : "text-ink-4"
      )}
    >
      <Info className="size-4" aria-hidden="true" />
    </button>
  );

  if (value) {
    return (
      <FormSection title="채용공고" className="space-y-5" tone={tone}>
        <JobPostingCard record={value} onReplace={reset} />
      </FormSection>
    );
  }

  return (
    <FormSection title="채용공고" titleAside={helpButton} className="space-y-5" tone={tone}>
      <div className="space-y-4">
        {helpOpen && (
          <div id="job-posting-help" className={t.help}>
            <p>지원하려는 공고를 넣으면, 해당 공고를 기준으로 자소서를 분석해드려요.</p>
            <p>링크로 열리지 않는 사이트(원티드 등)는 조금 번거롭더라도 본문을 복사해서 붙여주세요.</p>
          </div>
        )}
        <div className={t.tabBar} role="tablist">
          {(
            [
              ["url", "링크"],
              ["text", "본문 붙여넣기"],
              ...(listedOptions.length > 0 ? ([["listed", "접수 중인 공고"]] as const) : []),
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

      {mode === "listed" ? (
        <div>
          <div
            role="radiogroup"
            aria-label="접수 중인 공고"
            className="max-h-[300px] divide-y divide-line-soft overflow-y-auto rounded-xl border border-line"
          >
            {listedOptions.map(posting => (
              <label key={posting.slug} className="flex cursor-pointer items-start gap-3 px-4 py-3 transition-colors hover:bg-fill-soft">
                <input
                  type="radio"
                  name="listed-job-posting"
                  value={posting.slug}
                  checked={listedSlug === posting.slug}
                  onChange={() => pickListed(posting.slug)}
                  disabled={isLoading}
                  className="mt-1 size-4 shrink-0 accent-[#0064ff]"
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-bold text-ink break-keep">{posting.title}</span>
                  <span className="mt-0.5 block text-[13px] text-ink-4 break-keep">{posting.subtitle}</span>
                </span>
                {now && isOpen(posting.closesAt, now) && (
                  <span className="shrink-0 text-[13px] font-bold text-danger">{dDayLabel(posting.closesAt, now)}</span>
                )}
              </label>
            ))}
          </div>
          <p className={t.hint}>고르면 회사 이름이 채워지고, 문항이 공개된 공고는 문항도 채워져요.</p>
          <div className="mt-3 flex justify-end">
            <FetchButton isLoading={isLoading} disabled={!canFetch} onClick={handleFetch} className={t.fetch} />
          </div>
        </div>
      ) : mode === "url" ? (
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
}: {
  record: JobPostingRecord;
  onReplace: () => void;
}) {
  const t = STYLE;
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
        {hasRequirements && <BulletList title="자격요건" items={summary.requirements} />}
        {hasPreferred && <BulletList title="우대사항" items={summary.preferred} />}
        {showResponsibilities && summary.responsibilities.length > 0 && (
          <BulletList title="담당 업무" items={summary.responsibilities} />
        )}
      </div>

      {summary.keywords.length > 0 && (
        <ul className="flex flex-wrap gap-x-2.5 gap-y-1" aria-label="공고 키워드">
          {summary.keywords.map(keyword => (
            <li
              key={keyword}
              className={t.keywords}
            >
              #{keyword}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function BulletList({ title, items }: { title: string; items: string[] }) {
  const t = STYLE;
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
