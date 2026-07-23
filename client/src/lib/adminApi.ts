import { getAuthorizationHeader } from "@/lib/apiAuth";

export class AdminApiError extends Error {
  status: number;
  requestId: string | null;

  constructor(status: number, requestId: string | null) {
    super("관리자 데이터를 불러오지 못했습니다.");
    this.name = "AdminApiError";
    this.status = status;
    this.requestId = requestId;
  }
}

export async function adminApiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const authorization = await getAuthorizationHeader();
  const response = await fetch(path, {
    ...init,
    headers: {
      ...authorization,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });
  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json") ? await response.json() : null;
  if (!response.ok) {
    throw new AdminApiError(response.status, payload?.requestId ?? null);
  }
  return payload as T;
}
