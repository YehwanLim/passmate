import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { AlertTriangle, FileSearch, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { AuthenticationRequiredError, getAuthorizationHeader } from "@/lib/apiAuth";
import { trackAnalysisComplete, trackAnalysisFailed } from "@/lib/analytics";
import { parseAnalysisRequestStatus, type AnalysisKind } from "@/lib/analysisRequest";
import { pickCompanyPendingStep } from "./companyPendingCopy";

type PendingView = "checking" | "failed" | "unavailable" | "timeout";

// 서버 TTL(125초)보다 넉넉한 상한. 서버리스 함수가 상태를 못 쓰고 죽는 등
// FAILED 전이가 영영 오지 않는 경우 무한 스피너 대신 탈출구를 보여준다.
const MAX_PENDING_WAIT_MS = 180_000;

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
  const [isContextIrrelevant, setIsContextIrrelevant] = useState(false);
  const [kind, setKind] = useState<AnalysisKind>("RESUME");
  const [elapsedMs, setElapsedMs] = useState(0);

  // 대기 문구를 경과 시간에 따라 바꾸기 위한 1초 틱. 기다리는 동안에만 돈다.
  useEffect(() => {
    if (view !== "checking") return;
    setElapsedMs(0);
    const ticker = setInterval(() => setElapsedMs(performance.now() - mountedAt.current), 1000);
    return () => clearInterval(ticker);
  }, [view, retryCount]);

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
        if (!cancelled) setKind(status.kind);
        const analyticsType = status.kind === "COMPANY" ? "company_report" : "cover_letter";
        if (status.status === "SUCCEEDED" && status.analysisId) {
          trackAnalysisComplete(analyticsType, Math.round(performance.now() - mountedAt.current));
          navigate(status.kind === "COMPANY"
            ? `/company-report?analysisId=${encodeURIComponent(status.analysisId)}`
            : `/report-new?analysisId=${encodeURIComponent(status.analysisId)}`);
          return;
        }
        if (status.status === "FAILED") {
          const contextIrrelevant = status.error === "CONTEXT_IRRELEVANT";
          trackAnalysisFailed(analyticsType, contextIrrelevant ? "context_irrelevant" : "server_error");
          if (!cancelled) {
            setIsContextIrrelevant(contextIrrelevant);
            setView("failed");
          }
          return;
        }
        if (!cancelled) {
          if (performance.now() - mountedAt.current > MAX_PENDING_WAIT_MS) {
            setView("timeout");
          } else {
            timer = setTimeout(poll, 3000);
          }
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (error instanceof AuthenticationRequiredError) {
          navigate("/login");
          return;
        }
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

  const retryStatusCheck = () => {
    mountedAt.current = performance.now();
    setView("checking");
    setRetryCount((count) => count + 1);
  };

  const isCompany = kind === "COMPANY";
  const companyStep = pickCompanyPendingStep(elapsedMs);
  const checkingTitle = isCompany ? companyStep.title : "분석 결과를 확인 중이에요";
  const checkingLines = isCompany
    ? companyStep.lines
    : ["완료되는 즉시 리포트를 자동으로 열어 드릴게요.", "화면을 닫아도 분석은 계속됩니다."];

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
            <h1 className="text-2xl font-semibold tracking-tight text-balance" aria-live="polite">
              {checkingTitle}
            </h1>
            {/* 문장 단위 줄바꿈: PC에서는 한 문장이 한 줄, 모바일에서는 이어서 흐른다. */}
            <p className="mt-3 max-w-sm text-sm leading-6 text-zinc-400 text-pretty">
              {checkingLines.map((line, index) => (
                <span key={`${index}-${line}`} className="sm:block">
                  {line}
                  {index < checkingLines.length - 1 ? " " : null}
                </span>
              ))}
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
        {view === "timeout" && (
          <>
            <h1 className="text-2xl font-semibold tracking-tight">분석이 평소보다 오래 걸리고 있어요</h1>
            <p className="mt-3 max-w-sm text-sm leading-6 text-zinc-400">
              완료된 리포트는 내 지원서에서도 확인할 수 있어요. 잠시 후 다시 확인해 주세요.
            </p>
            <div className="mt-7 flex gap-3">
              <Button onClick={retryStatusCheck}>다시 확인</Button>
              <Button variant="outline" onClick={() => navigate("/my")}>내 지원서에서 확인</Button>
            </div>
          </>
        )}
        {view === "failed" && (
          <>
            <h1 className="text-2xl font-semibold tracking-tight">
              {isContextIrrelevant
                ? (isCompany ? "확인할 수 있는 기업이 아니에요" : "자소서 내용을 확인해 주세요")
                : "분석을 완료하지 못했어요"}
            </h1>
            <p className="mt-3 max-w-sm text-sm leading-6 text-zinc-400">
              {isContextIrrelevant
                ? (isCompany
                    ? "입력한 회사명을 공개 자료에서 찾지 못했어요. 정확한 회사명으로 다시 시도해 주세요."
                    : "입력한 내용이 자기소개서로 보기 어려워 분석하지 못했어요. 실제 자소서 문항과 답변으로 다시 시도해 주세요.")
                : "입력 내용은 브라우저에 저장하지 않았습니다. 새 분석을 시작해 주세요."}{" "}
              이번 분석의 이용권은 차감되지 않았어요.
            </p>
            <Button className="mt-7" onClick={() => navigate(kind === "COMPANY" ? "/company-analysis" : "/analyze")}>
              {isCompany ? "새 기업 분석 시작" : "새 분석 시작"}
            </Button>
            <p className="mt-5 text-xs leading-5 text-zinc-500">
              문제가 반복되면{" "}
              <a
                href="mailto:hansitoring@gmail.com"
                className="text-zinc-300 underline underline-offset-2 transition-colors hover:text-white"
              >
                hansitoring@gmail.com
              </a>
              으로 알려 주세요.
            </p>
          </>
        )}
      </section>
    </main>
  );
}
