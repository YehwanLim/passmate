import { supabase } from "./supabase";

export interface PremiumSalesSettings {
  premiumEnabled: boolean;
  /** 기업 분석 리포트 생성·판매 스위치. 구버전 서버 응답에 없으면 false. */
  companyAnalysisEnabled: boolean;
}

type JsonRecord = Record<string, unknown>;

async function requestPremiumSalesSettings(
  init: RequestInit,
  fallback: string,
): Promise<PremiumSalesSettings> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    throw new Error("관리자 세션이 만료되었습니다. 다시 로그인해 주세요.");
  }

  const response = await fetch("/api/admin/entitlements", {
    ...init,
    headers: {
      ...init.headers,
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json")
    ? await response.json() as JsonRecord
    : null;

  if (!response.ok) {
    throw new Error(
      payload && typeof payload.error === "string" ? payload.error : fallback,
    );
  }
  if (!payload || typeof payload.premiumEnabled !== "boolean") {
    throw new Error(fallback);
  }

  return {
    premiumEnabled: payload.premiumEnabled,
    companyAnalysisEnabled: payload.companyAnalysisEnabled === true,
  };
}

export function fetchPremiumSalesSettings(): Promise<PremiumSalesSettings> {
  return requestPremiumSalesSettings(
    {},
    "결제 판매 상태를 불러오지 못했습니다.",
  );
}

export function updatePremiumSalesEnabled(
  premiumEnabled: boolean,
): Promise<PremiumSalesSettings> {
  return requestPremiumSalesSettings(
    { method: "PATCH", body: JSON.stringify({ premiumEnabled }) },
    "결제 판매 상태를 변경하지 못했습니다.",
  );
}

export function updateCompanyAnalysisEnabled(
  companyAnalysisEnabled: boolean,
): Promise<PremiumSalesSettings> {
  return requestPremiumSalesSettings(
    { method: "PATCH", body: JSON.stringify({ companyAnalysisEnabled }) },
    "기업 분석 스위치를 변경하지 못했습니다.",
  );
}
