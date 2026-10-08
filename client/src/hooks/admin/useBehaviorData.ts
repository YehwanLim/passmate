import type { AdminPeriod } from "@/lib/adminPeriod";
import { useAdminResource } from "./useAdminResource";

/** 단계별 고유 수. mobile/desktop 은 기기 정보가 있는 단계(이벤트)에만 있고 나머지는 null. */
export interface FunnelStep { key: string; label: string; count: number; mobile: number | null; desktop: number | null; }
export interface BehaviorSourceRow { source: string; visitors: number; formStarts: number; signups: number; }
export interface BehaviorRetention { visitors: number; returningVisitors: number; signups: number; returningSignups: number; }
export interface BehaviorLogin {
  visitors: number;
  inAppVisitors: number;
  inAppKinds: { kind: string; visitors: number }[];
  events: Record<string, number>;
}
export interface FeatureUsageRow { key: string; label: string; uses: number; users: number; }
/** GET /api/admin/behavior (lib/admin-handlers/behavior.js) */
export interface BehaviorData {
  period: AdminPeriod;
  funnel: FunnelStep[];
  sources: BehaviorSourceRow[];
  retention: BehaviorRetention;
  login: BehaviorLogin;
  features: FeatureUsageRow[];
}

const POLL_MS = 5 * 60 * 1000;

export function useBehaviorData(period: AdminPeriod) {
  return useAdminResource<BehaviorData>(`/api/admin/behavior?period=${period}`, {
    pollMs: POLL_MS,
    errorMessage: "사용 행동 데이터를 불러오지 못했습니다.",
  });
}
