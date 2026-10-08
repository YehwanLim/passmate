import { useRef, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { useLocation } from "wouter";
import SiteHeader from "@/components/SiteHeader";
import ApplicationEditor from "@/components/my/ApplicationEditor";
import NewApplicationForm, { type NewApplicationInfo } from "@/components/my/NewApplicationForm";
import SkeletonCard from "@/components/my/SkeletonCard";
import { findJobPosting } from "@/constants/jobPostings";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { deadlineDateInput } from "@/lib/jobPostingDates";
import { readQueryParam } from "@/lib/readQueryParam";
import {
  createApplication,
  fetchApplication,
  saveApplicationQuestions,
  updateApplicationMeta,
  WorkspaceApiError,
  type ApplicationQuestionDraft,
} from "@/lib/workspace";
import type { JobPostingRecord } from "@/types/jobPosting";
import { WORKSPACE_COPY } from "./workspaceCopy";

const COPY = WORKSPACE_COPY.newApplicationForm;
const EMPTY_QUESTION: ApplicationQuestionDraft = { prompt: "", charLimit: null, answer: "" };

const sameQuestions = (a: ApplicationQuestionDraft[], b: ApplicationQuestionDraft[]) => JSON.stringify(a) === JSON.stringify(b);

/**
 * /my/new — 새 지원서도 작성 화면과 같은 편집기(A안)로 빈 채로 연다.
 * 다 적고 "지원서 만들기"를 누르면 지원서를 만들고, 그 사이 친 글까지 저장한 뒤 /my/:id 로 바꿔 끼운다.
 * 공고를 붙이면 회사·직무를 채우기만 한다 — 만들기는 사람이 정한다(10-08).
 * 채용 공고 한 장(/jobs/:slug)의 "내 경험으로 초안 쓰기"는 ?job= 으로 와서 회사·마감일을 미리 채운다(10-09).
 */
export default function NewApplication() {
  const [, navigate] = useLocation();
  const [jobListing] = useState(() => findJobPosting(readQueryParam("job", 80)));
  // 로그인하고 돌아와도 같은 공고로 채워지게 쿼리를 그대로 들고 간다.
  const { isLoading } = useRequireAuth({ redirectPath: jobListing ? `/my/new?job=${jobListing.slug}` : "/my/new" });
  const [questions, setQuestions] = useState<ApplicationQuestionDraft[]>([EMPTY_QUESTION]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [info, setInfo] = useState<NewApplicationInfo>(() => ({
    company: jobListing?.company ?? "",
    jobKeyword: "",
    deadline: jobListing ? deadlineDateInput(jobListing.closesAt) : "",
  }));
  const [posting, setPosting] = useState<JobPostingRecord | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const companyRef = useRef<HTMLInputElement>(null);
  // 만드는 동안 친 글을 놓치지 않으려고 최신 값을 따로 쥔다.
  const latest = useRef({ questions, posting });
  latest.current = { questions, posting };

  const create = async (nextInfo: NewApplicationInfo = info) => {
    if (creating || !nextInfo.company.trim()) return;
    setCreating(true);
    setError(null);
    const sent = latest.current.questions;
    try {
      const { id } = await createApplication({
        company: nextInfo.company.trim(),
        ...(nextInfo.jobKeyword.trim() ? { jobKeyword: nextInfo.jobKeyword.trim() } : {}),
        // <input type="date"> 는 날짜만 준다. 마감은 그날 23:59 KST 로 본다.
        deadline: nextInfo.deadline ? `${nextInfo.deadline}T23:59:00+09:00` : null,
        questions: sent,
      });
      // 공고 붙이기·뒤늦은 글 저장은 실패해도 지원서는 만들어졌다 — 작성 화면에서 이어서 하면 된다.
      const attached = latest.current.posting;
      if (attached) await updateApplicationMeta(id, { jobPostingId: attached.id }).catch(() => undefined);
      const now = latest.current.questions;
      if (!sameQuestions(now, sent)) {
        await fetchApplication(id)
          .then((detail) => saveApplicationQuestions(id, now, detail.questions_updated_at))
          .catch(() => undefined);
      }
      navigate(`/my/${id}`, { replace: true });
    } catch (caught) {
      setError(caught instanceof WorkspaceApiError && caught.code === "PROJECT_LIMIT_REACHED" ? COPY.limitReached : COPY.createFailed);
      setCreating(false);
    }
  };

  const attachPosting = (record: JobPostingRecord | null) => {
    setPosting(record);
    if (!record) return;
    // 직접 적은 값은 덮어쓰지 않는다.
    const next = {
      ...info,
      company: info.company.trim() ? info.company : record.summary.company.trim().slice(0, 100),
      jobKeyword: info.jobKeyword.trim() ? info.jobKeyword : record.summary.role.trim().slice(0, 100),
    };
    setInfo(next);
  };

  const updateQuestion = (index: number, patch: Partial<ApplicationQuestionDraft>) =>
    setQuestions((current) => current.map((q, i) => (i === index ? { ...q, ...patch } : q)));

  return (
    <div className="min-h-screen bg-stage pb-28">
      <SiteHeader variant="light" />
      <div className="sticky top-14 z-30 border-b border-line bg-surface/95 backdrop-blur">
        <div className="container flex h-14 max-w-6xl items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => navigate("/my")}
              className="-ml-1.5 inline-flex shrink-0 items-center gap-0.5 rounded-lg px-1.5 py-1 text-[13.5px] font-semibold text-ink-3 hover:bg-fill"
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
              <span className="hidden sm:inline">{WORKSPACE_COPY.page.title}</span>
            </button>
            <h1 className="truncate text-[16px] font-bold tracking-[-0.02em] text-ink">{COPY.pageTitle}</h1>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span className="hidden text-[12.5px] text-ink-4 sm:inline" aria-live="polite">{creating ? COPY.creating : COPY.saveHintShort}</span>
            {/* 좁은 화면에선 지원 정보 칸이 원고지 아래로 내려가서, 위 막대에도 만들기 버튼을 둔다 */}
            <button
              type="button"
              onClick={() => {
                if (info.company.trim()) void create();
                else {
                  setError(COPY.companyRequired);
                  companyRef.current?.focus();
                }
              }}
              disabled={creating}
              className="h-9 rounded-[10px] bg-brand px-3.5 text-[13.5px] font-bold text-white transition-colors hover:bg-brand-hover disabled:opacity-40"
            >
              {COPY.submit}
            </button>
          </div>
        </div>
      </div>

      <div className="container max-w-6xl pt-6">
        {isLoading ? (
          <SkeletonCard variant="analysis" />
        ) : (
          <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="min-w-0">
              <ApplicationEditor
                questions={questions}
                activeIndex={Math.min(activeIndex, questions.length - 1)}
                onSelect={setActiveIndex}
                onChange={updateQuestion}
                onAdd={() => {
                  setQuestions((current) => [...current, EMPTY_QUESTION]);
                  setActiveIndex(questions.length);
                }}
                onRemove={(index) => {
                  setQuestions((current) => current.filter((_, i) => i !== index));
                  setActiveIndex(0);
                }}
                heading={<p className="text-[15px] font-bold text-brand-ink">{info.company.trim() || COPY.pageTitle}</p>}
                draft={null}
                // 초안은 지원서가 만들어진 뒤에 쓸 수 있다 — 회사부터 적게 한다.
                onRequestDraft={() => {
                  if (info.company.trim()) {
                    void create();
                  } else {
                    setError(COPY.companyFirst);
                    companyRef.current?.focus();
                  }
                }}
                onApplyDraft={() => undefined}
                onCloseDraft={() => undefined}
                experienceTitles={new Map()}
                experienceCount={null}
                draftLimitReached={false}
              />
            </div>
            <aside className="lg:sticky lg:top-32">
              <NewApplicationForm
                posting={posting}
                onPosting={attachPosting}
                info={info}
                onInfo={(next) => { setInfo(next); if (error) setError(null); }}
                onCommit={(next) => { setInfo(next); void create(next); }}
                onRequireLogin={() => navigate("/login?redirect=%2Fmy%2Fnew")}
                initialListedSlug={jobListing?.slug}
                onPickListed={(listing) => {
                  // 직접 적은 값은 덮어쓰지 않는다.
                  setInfo((current) => ({
                    ...current,
                    company: current.company.trim() ? current.company : listing.company,
                    deadline: current.deadline || deadlineDateInput(listing.closesAt),
                  }));
                }}
                companyRef={companyRef}
                error={error}
                busy={creating}
              />
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
