import { AuthenticationRequiredError, getAuthorizationHeader } from "@/lib/apiAuth";
import type { JobPostingRecord, JobPostingSummary } from "@/types/jobPosting";

// 서버 lib/job-posting.js 와 같은 상한. 한쪽만 바꾸지 않는다(analyzeConstants.ts 와 같은 규칙).
export const MAX_POSTING_CHARS = 6000;
export const MIN_POSTING_CHARS = 200;
export const MAX_POSTING_URL_CHARS = 2048;

export type JobPostingRequestInput = { url: string } | { text: string };

export type JobPostingResult =
  | { kind: "accepted"; record: JobPostingRecord }
  | { kind: "rejected"; code: string; status: number }
  | { kind: "auth_required" }
  | { kind: "network_error" };

interface JobPostingResponse {
  job_posting_id: string;
  source_url: string | null;
  summary: JobPostingSummary;
  char_count: number;
}

/** http/https 이고 길이 상한 안인 URL 만 공고 주소로 받는다. */
export function isValidPostingUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_POSTING_URL_CHARS) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * POST /api/analyze/posting. 공고를 요약 레코드로 바꿔 돌려준다.
 * 실패 종류만 분류하고, 문구는 getJobPostingErrorMessage 가 맡는다.
 */
export async function requestJobPosting(
  input: JobPostingRequestInput
): Promise<JobPostingResult> {
  let response: Response;
  try {
    response = await fetch("/api/analyze/posting", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(await getAuthorizationHeader()),
      },
      body: JSON.stringify(input),
    });
  } catch (caught) {
    if (caught instanceof AuthenticationRequiredError) return { kind: "auth_required" };
    return { kind: "network_error" };
  }

  if (response.status === 401) return { kind: "auth_required" };

  if (!response.ok) {
    let code = "";
    try {
      const body = (await response.json()) as { error?: unknown };
      if (typeof body?.error === "string") code = body.error;
    } catch {
      /* 본문 없음 */
    }
    return { kind: "rejected", code, status: response.status };
  }

  try {
    const body = (await response.json()) as JobPostingResponse;
    return {
      kind: "accepted",
      record: {
        id: body.job_posting_id,
        sourceUrl: body.source_url ?? null,
        summary: body.summary,
        charCount: body.char_count,
      },
    };
  } catch {
    return { kind: "network_error" };
  }
}

export function getJobPostingErrorMessage(code: string, status?: number): string {
  switch (code) {
    case "POSTING_URL_UNREADABLE":
      return "URL에서 공고 본문을 읽지 못했어요. 공고 내용을 복사해 텍스트로 붙여 주세요.";
    case "POSTING_NOT_RECOGNIZED":
      return "채용공고로 보이지 않아요. 수행 업무와 자격요건이 담긴 본문을 붙여 주세요.";
    case "POSTING_EXTRACT_FAILED":
      return "공고를 정리하지 못했어요. 잠시 후 다시 시도해 주세요.";
    case "RATE_LIMITED":
      return "공고 불러오기 요청이 많아요. 15분 뒤 다시 시도해 주세요.";
    case "INVALID_REQUEST":
      return "공고 URL 또는 본문을 확인해 주세요.";
    default:
      if (status === 429) return "공고 불러오기 요청이 많아요. 15분 뒤 다시 시도해 주세요.";
      return "공고를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.";
  }
}
