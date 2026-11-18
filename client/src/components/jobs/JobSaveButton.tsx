import { useEffect, useState } from "react";
import { Link } from "wouter";
import AnalyzeLoginModal from "@/components/analyze/AnalyzeLoginModal";
import { APPLICATION_BOARD_COPY } from "@/copy/applicationBoardCopy";
import type { JobPostingListing } from "@/constants/jobPostings";
import { useAuth } from "@/contexts/AuthContext";
import { useSubmitAfterLogin } from "@/hooks/useSubmitAfterLogin";
import { sendFunnelEvent } from "@/lib/siteVisits";
import { listApplications, saveJobPosting } from "@/lib/workspace";

const COPY = APPLICATION_BOARD_COPY.save;
const RETURN_FLAG = "save";
const BUTTON_CLASS =
  "inline-flex h-11 items-center rounded-[12px] bg-ink px-4 text-[14px] font-semibold text-white transition-colors hover:bg-ink-2 disabled:opacity-60";

/**
 * 공고 담기(11-15). 로그인하지 않았으면 로그인 창을 띄우고, 로그인이 끝나면 자동으로 담는다.
 * 카카오는 페이지를 떠났다 돌아오므로 redirectPath 에 ?save=1 을 붙여 돌아온 뒤 한 번 담고 지운다.
 * 같은 공고를 다시 담아도 서버가 지원서를 하나만 둔다.
 */
export default function JobSaveButton({ listing }: { listing: JobPostingListing }) {
  const { isAuthenticated, isLoading } = useAuth();
  const [state, setState] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const [loginOpen, setLoginOpen] = useState(false);
  const [returnedFromLogin] = useState(
    () => typeof window !== "undefined" && new URLSearchParams(window.location.search).get(RETURN_FLAG) === "1",
  );

  const save = async () => {
    setState("saving");
    try {
      await saveJobPosting({ postingSlug: listing.slug, company: listing.company, deadline: listing.closesAt });
      setState("saved");
    } catch {
      setState("failed");
    }
  };

  const afterLogin = useSubmitAfterLogin({
    isAuthenticated,
    onSubmit: () => {
      if (returnedFromLogin) window.history.replaceState(null, "", window.location.pathname);
      void save();
    },
    initiallyArmed: returnedFromLogin,
  });

  useEffect(() => {
    if (isAuthenticated) setLoginOpen(false);
  }, [isAuthenticated]);

  // 이미 담은 공고인지. 편의 표시라 실패하면 그냥 "담기"로 둔다.
  useEffect(() => {
    if (isLoading || !isAuthenticated) return;
    let alive = true;
    listApplications()
      .then((rows) => {
        if (alive && rows.some((row) => row.posting_slug === listing.slug)) setState("saved");
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [isLoading, isAuthenticated, listing.slug]);

  const onClick = () => {
    void sendFunnelEvent("content_cta_click", `job-save:${listing.slug}`);
    if (!isAuthenticated) {
      afterLogin.arm();
      setLoginOpen(true);
      return;
    }
    void save();
  };

  return (
    <div className="mt-5">
      {state === "saved" ? (
        <Link href="/my" className={BUTTON_CLASS}>
          {COPY.saved}
        </Link>
      ) : (
        <button type="button" onClick={onClick} disabled={state === "saving"} className={BUTTON_CLASS}>
          {state === "saving" ? COPY.saving : COPY.idle}
        </button>
      )}
      <p className={`mt-2 text-[13px] ${state === "failed" ? "text-danger" : "text-ink-4"}`}>
        {state === "failed" ? COPY.failed : COPY.hint}
      </p>
      <AnalyzeLoginModal
        open={loginOpen}
        onClose={() => {
          afterLogin.disarm();
          setLoginOpen(false);
        }}
        redirectPath={`/jobs/${listing.slug}?${RETURN_FLAG}=1`}
        description={COPY.loginDescription}
      />
    </div>
  );
}
