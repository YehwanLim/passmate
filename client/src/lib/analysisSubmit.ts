import { AuthenticationRequiredError, getAuthorizationHeader } from "@/lib/apiAuth";
import { parseAnalysisReceipt, type AnalysisReceipt } from "@/lib/analysisRequest";

export interface IdempotentRequest {
  fingerprint: string;
  idempotencyKey: string;
}

/**
 * 같은 입력의 재시도는 같은 키를, 입력이 바뀌면 새 키를 쓴다.
 * 서버는 (userId, idempotencyKey) 유니크로 중복 접수를 막는다.
 */
export function resolveIdempotencyKey(
  previous: IdempotentRequest | null,
  fingerprint: string
): IdempotentRequest {
  const idempotencyKey =
    previous?.fingerprint === fingerprint
      ? previous.idempotencyKey
      : crypto.randomUUID();
  return { fingerprint, idempotencyKey };
}

export type AnalysisSubmitResult =
  | { kind: "accepted"; receipt: AnalysisReceipt }
  | { kind: "rejected"; status: number; errorData: unknown }
  | { kind: "parse_error" }
  | { kind: "network_error" }
  | { kind: "auth_required" };

/**
 * 분석 접수 POST. 202 접수증만 돌려주고 리포트 본문은 절대 기대하지 않는다.
 * 실패 종류만 분류하고, 문구로 바꾸는 일은 호출하는 페이지가 한다.
 */
export async function submitAnalysisRequest(
  endpoint: string,
  payload: unknown,
  idempotencyKey: string
): Promise<AnalysisSubmitResult> {
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(await getAuthorizationHeader()),
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(payload),
    });
  } catch (caught) {
    // 세션이 없으면 헤더를 만들다 던진다. 네트워크 오류로 뭉뚱그리면 비로그인 사용자에게 "연결 불안정"이 뜬다.
    if (caught instanceof AuthenticationRequiredError) return { kind: "auth_required" };
    return { kind: "network_error" };
  }

  if (response.status !== 202 && response.status !== 200) {
    let errorData: unknown;
    try {
      errorData = await response.json();
    } catch {
      /* 본문 없음 */
    }
    return { kind: "rejected", status: response.status, errorData };
  }

  try {
    return { kind: "accepted", receipt: parseAnalysisReceipt(await response.json()) };
  } catch {
    return { kind: "parse_error" };
  }
}
