import { useCallback, useState } from "react";

import type { PurchaseProduct } from "@/lib/pricing";
import { useAdminResource } from "./useAdminResource";

/** GET /api/admin/notifications (lib/admin-handlers/notifications.js) */
export interface AdminNotifications {
  since: string;
  mentoringRequested: { count: number; items: { id: string; sessionType: string; createdAt: string; startsAt: string | null }[] };
  payments: { count: number; items: { id: string; userId: string; createdAt: string; product: PurchaseProduct | "UNKNOWN" }[] };
  failedAnalyses: { count: number; items: { id: string; createdAt: string; errorCode: string | null }[] };
}

export const NOTIFICATIONS_SEEN_KEY = "preview.admin.notificationsSeenAt";
const DAY_MS = 24 * 60 * 60 * 1000;
const POLL_MS = 5 * 60 * 1000;

type StorageLike = Pick<Storage, "getItem" | "setItem">;

function browserStorage(): StorageLike | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/**
 * 알림함을 마지막으로 연 시각. 관리자 개인 브라우저의 편의값일 뿐이라 없거나 못 읽으면 24시간 전으로 본다.
 * (권한·데이터의 근거가 아니다 — 서버는 since 를 30일 안으로 다시 자른다.)
 */
export function readSeenAt(storage: StorageLike | null, now = new Date()): Date {
  const fallback = new Date(now.getTime() - DAY_MS);
  try {
    const raw = storage?.getItem(NOTIFICATIONS_SEEN_KEY);
    const parsed = raw ? new Date(raw) : null;
    return parsed && !Number.isNaN(parsed.getTime()) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export function writeSeenAt(storage: StorageLike | null, at: Date): void {
  try {
    storage?.setItem(NOTIFICATIONS_SEEN_KEY, at.toISOString());
  } catch {
    // 저장이 막힌 브라우저(사생활 보호 창 등)에서는 다음에 다시 24시간 기준으로 보인다.
  }
}

/** 배지 수 = 멘토링 확정 대기 + 마지막 확인 뒤 새 결제 + 마지막 확인 뒤 실패 분석. */
export function notificationTotal(data: AdminNotifications | null): number {
  if (!data) return 0;
  return data.mentoringRequested.count + data.payments.count + data.failedAnalyses.count;
}

export function useAdminNotifications() {
  const [seenAt, setSeenAt] = useState(() => readSeenAt(browserStorage()));
  const resource = useAdminResource<AdminNotifications>(
    `/api/admin/notifications?since=${encodeURIComponent(seenAt.toISOString())}`,
    { pollMs: POLL_MS, errorMessage: "알림을 불러오지 못했습니다." },
  );

  const markSeen = useCallback(() => {
    const now = new Date();
    writeSeenAt(browserStorage(), now);
    setSeenAt(now);
  }, []);

  return { ...resource, total: notificationTotal(resource.data), markSeen };
}
