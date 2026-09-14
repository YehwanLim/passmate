import { useEffect, useRef, useState } from "react";

import { AuthenticationRequiredError, getAuthorizationHeader } from "@/lib/apiAuth";
import type { JobPostingSummary } from "@/types/jobPosting";

/** GET /api/analysis/:id 응답 중 화면이 읽는 최상위 필드. 본문 형식 검증은 호출자의 parse 가 한다. */
export interface AnalysisPayload {
  id?: string;
  kind?: string;
  company_name?: string | null;
  job_role?: string | null;
  ai_response_json?: unknown;
  /** 채용공고를 붙여 분석한 자소서 리포트에만 있다 */
  job_posting?: { id: string; source_url: string | null; summary: JobPostingSummary } | null;
}

const SESSION_EXPIRED_MESSAGE = "로그인이 만료되었어요. 다시 로그인한 뒤 리포트를 열어 주세요.";

/**
 * 저장된 분석 하나를 인증 헤더와 함께 불러온다. 자소서·기업 리포트가 같은 셸을 쓴다.
 * parse 가 null 을 돌려주면 호출자가 다른 화면으로 보낸 것으로 보고 상태를 바꾸지 않는다.
 * parse 가 던지는 Error 의 message 는 그대로 화면 오류 문구가 된다.
 */
export function useAnalysisReport<T>(
  requestedAnalysisId: string | null,
  options: {
    missingMessage: string;
    failedMessage: string;
    parse: (payload: AnalysisPayload) => T | null;
  },
) {
  const { missingMessage, failedMessage } = options;
  const parseRef = useRef(options.parse);
  parseRef.current = options.parse;

  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!requestedAnalysisId) {
      setError(missingMessage);
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        setData(null);
        setError(null);
        setIsLoading(true);
        const response = await fetch(`/api/analysis/${encodeURIComponent(requestedAnalysisId)}`, {
          headers: await getAuthorizationHeader(),
        });
        const payload = await response.json();

        if (cancelled) return;

        if (!response.ok) {
          throw new Error(payload?.message || payload?.error || failedMessage);
        }

        const parsed = parseRef.current(payload as AnalysisPayload);
        if (parsed === null) return;
        setData(parsed);
      } catch (caught) {
        if (cancelled) return;
        if (caught instanceof AuthenticationRequiredError) {
          setError(SESSION_EXPIRED_MESSAGE);
        } else {
          setError(caught instanceof Error ? caught.message : failedMessage);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [requestedAnalysisId, missingMessage, failedMessage]);

  return { data, isLoading, error };
}
