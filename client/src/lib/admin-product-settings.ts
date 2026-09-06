import type { PurchaseProduct } from "./pricing";
import { supabase } from "./supabase";

export interface AdminProductSetting {
  product: PurchaseProduct;
  contentId: string | null;
  paymentUrl: string;
  active: boolean;
  resumeCredits: number;
  companyCredits: number;
}

export interface ProductSettingPatch {
  contentId?: string | null;
  paymentUrl?: string;
  active?: boolean;
}

type JsonRecord = Record<string, unknown>;

function isProductSetting(value: unknown): value is AdminProductSetting {
  if (typeof value !== "object" || value === null) return false;
  const row = value as JsonRecord;
  return (
    typeof row.product === "string" &&
    (row.contentId === null || typeof row.contentId === "string") &&
    typeof row.paymentUrl === "string" &&
    typeof row.active === "boolean" &&
    typeof row.resumeCredits === "number" &&
    typeof row.companyCredits === "number"
  );
}

async function requestProductSettings(init: RequestInit, fallback: string): Promise<AdminProductSetting[]> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    throw new Error("관리자 세션이 만료되었습니다. 다시 로그인해 주세요.");
  }

  const response = await fetch("/api/admin/product-settings", {
    ...init,
    headers: { ...init.headers, "Content-Type": "application/json", Authorization: `Bearer ${token}` },
  });
  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json") ? ((await response.json()) as JsonRecord) : null;

  if (!response.ok) {
    throw new Error(payload && typeof payload.error === "string" ? payload.error : fallback);
  }
  if (!payload || !Array.isArray(payload.products) || !payload.products.every(isProductSetting)) {
    throw new Error(fallback);
  }
  return payload.products;
}

export function fetchProductSettings(): Promise<AdminProductSetting[]> {
  return requestProductSettings({}, "결제 상품 설정을 불러오지 못했습니다.");
}

export function updateProductSetting(product: PurchaseProduct, patch: ProductSettingPatch): Promise<AdminProductSetting[]> {
  return requestProductSettings(
    { method: "PATCH", body: JSON.stringify({ product, ...patch }) },
    "결제 상품 설정을 저장하지 못했습니다.",
  );
}
