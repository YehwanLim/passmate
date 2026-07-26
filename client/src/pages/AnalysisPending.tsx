import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { AlertTriangle, FileSearch, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { getAuthorizationHeader } from "@/lib/apiAuth";
import { trackAnalysisComplete, trackAnalysisFailed } from "@/lib/analytics";
import { parseAnalysisRequestStatus } from "@/lib/analysisRequest";

type PendingView = "checking" | "failed" | "unavailable";

function readRequestId(): string | null {
  const requestId = new URLSearchParams(window.location.search).get("requestId");
  return typeof requestId === "string" && requestId.length > 0 ? requestId : null;
}

export default function AnalysisPending() {
  const [, navigate] = useLocation();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const requestId = readRequestId();
  const mountedAt = useRef(performance.now());
  const [retryCount, setRetryCount] = useState(0);
  const [view, setView] = useState<PendingView>("checking");

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }
    if (!requestId) {
      navigate("/analyze");
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;
    setView("checking");

    const poll = async () => {
      controller = new AbortController();
      try {
        const response = await fetch(`/api/analysis-requests/${encodeURIComponent(requestId)}`, {
          headers: await getAuthorizationHeader(),
          signal: controller.signal,
        });
        if (!response.ok) {
          if (response.status === 401) {
            navigate("/login");
            return;
          }
          throw new Error("ANALYSIS_STATUS_UNAVAILABLE");
        }

        const status = parseAnalysisRequestStatus(await response.json());
        if (status.status === "SUCCEEDED" && status.analysisId) {
          trackAnalysisComplete("cover_letter", Math.round(performance.now() - mountedAt.current));
          navigate(`/report-new?analysisId=${encodeURIComponent(status.analysisId)}`);
          return;
        }
        if (status.status === "FAILED") {
          trackAnalysisFailed("cover_letter", "server_error");
          if (!cancelled) setView("failed");
          return;
        }
        if (!cancelled) timer = setTimeout(poll, 3000);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (!cancelled) setView("unavailable");
      }
    };

    void poll();
    return () => {
      cancelled = true;
      controller?.abort();
      if (timer) clearTimeout(timer);
    };
  }, [authLoading, isAuthenticated, navigate, requestId, retryCount]);

  const retryStatusCheck = () => setRetryCount((count) => count + 1);

  return (
    <main className="min-h-screen bg-[#0A0A0A] px-4 text-white">
      <section className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center text-center">
        <div className="mb-7 flex h-16 w-16 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/10">
          {view === "checking" ? (
            <Loader2 className="h-7 w-7 animate-spin text-cyan-300" aria-hidden="true" />
          ) : view === "failed" ? (
            <AlertTriangle className="h-7 w-7 text-amber-300" aria-hidden="true" />
          ) : (
            <FileSearch className="h-7 w-7 text-cyan-300" aria-hidden="true" />
          )}
        </div>

        {view === "checking" && (
          <>
            <h1 className="text-2xl font-semibold tracking-tight">분석 결과를 확인 중이에요</h1>
            <p className="mt-3 max-w-sm text-sm leading-6 text-zinc-400">
              완료되는 즉시 리포트를 자동으로 열어 드릴게요. 화면을 닫아도 분석은 계속됩니다.
            </p>
          </>
        )}
        {view === "unavailable" && (
          <>
            <h1 className="text-2xl font-semibold tracking-tight">결과를 계속 확인하고 있어요</h1>
            <p className="mt-3 max-w-sm text-sm leading-6 text-zinc-400">
              잠시 후 다시 확인해 주세요. 이미 시작된 분석은 중복 실행하지 않습니다.
            </p>
            <Button className="mt-7" onClick={retryStatusCheck}>다시 확인</Button>
          </>
        )}
        {view === "failed" && (
          <>
            <h1 className="text-2xl font-semibold tracking-tight">분석을 완료하지 못했어요</h1>
            <p className="mt-3 max-w-sm text-sm leading-6 text-zinc-400">
              입력 내용은 브라우저에 저장하지 않았습니다. 새 분석을 시작해 주세요.
            </p>
            <Button className="mt-7" onClick={() => navigate("/analyze")}>새 분석 시작</Button>
          </>
        )}
      </section>
    </main>
  );
}
