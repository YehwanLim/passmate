import { ChevronLeft } from "lucide-react";
import { useLocation } from "wouter";
import SiteHeader from "@/components/SiteHeader";
import NewApplicationForm from "@/components/my/NewApplicationForm";
import SkeletonCard from "@/components/my/SkeletonCard";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { WORKSPACE_COPY } from "./workspaceCopy";

const COPY = WORKSPACE_COPY.newApplicationForm;

/** /my/new — 새 지원서 만들기 전체 화면. 만들면 그 지원서 작성 화면(/my/:id)으로 바꿔 끼운다(뒤로 가기에 빈 폼이 남지 않게). */
export default function NewApplication() {
  const [, navigate] = useLocation();
  const { isLoading } = useRequireAuth({ redirectPath: "/my/new" });

  return (
    <div className="min-h-screen bg-stage pb-28">
      <SiteHeader variant="light" />
      <main className="container max-w-3xl pt-8">
        <button
          type="button"
          onClick={() => navigate("/my")}
          className="-ml-1.5 inline-flex items-center gap-0.5 rounded-lg px-1.5 py-1 text-[14px] font-semibold text-ink-3 hover:bg-fill"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          {COPY.back}
        </button>
        <h1 className="mt-3 text-[28px] font-bold tracking-[-0.03em] text-ink">{COPY.pageTitle}</h1>
        <p className="mt-1.5 text-[15px] text-ink-4">{COPY.pageSubtitle}</p>
        <div className="mt-7">
          {isLoading ? (
            <SkeletonCard variant="analysis" />
          ) : (
            <NewApplicationForm
              onCreated={(id) => navigate(`/my/${id}`, { replace: true })}
              onCancel={() => navigate("/my")}
              onRequireLogin={() => navigate("/login?redirect=%2Fmy%2Fnew")}
            />
          )}
        </div>
      </main>
    </div>
  );
}
