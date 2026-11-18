import type { AdminDateRange, AdminPeriod } from "@/lib/adminPeriod";
import { useAdminResource } from "./useAdminResource";

/** 단계별 고유 수. mobile/desktop 은 기기 정보가 있는 단계(이벤트)에만 있고 나머지는 null. */
export interface FunnelStep { key: string; label: string; count: number; mobile: number | null; desktop: number | null; }
export interface BehaviorSourceRow { source: string; visitors: number; formStarts: number; signups: number; }
export interface BehaviorRetention { visitors: number; returningVisitors: number; signups: number; returningSignups: number; }
/** 방문(탭 세션) 한 번의 체류 시간. 측정된 방문이 없으면 초 값은 null. */
export interface BehaviorEngagedTime {
  visitors: number;
  measured: number;
  medianSeconds: number | null;
  averageSeconds: number | null;
  buckets: { label: string; count: number }[];
}
export interface BehaviorLogin {
  visitors: number;
  inAppVisitors: number;
  inAppKinds: { kind: string; visitors: number }[];
  events: Record<string, number>;
}
export interface FeatureUsageRow { key: string; label: string; uses: number; users: number; }
/** AI 모의 면접 단계별 세션 수·사람 수. 진행 시간은 이용권을 쓰고 끝낸 면접의 중앙값(없으면 null). */
export interface InterviewStepRow { key: string; label: string; sessions: number; users: number; }
export interface BehaviorInterviews {
  steps: InterviewStepRow[];
  interrupted: number;
  refunded: number;
  shortMode: number;
  medianSeconds: number | null;
}
/** 팝업별 고유 방문자 수. 클릭률은 clicked / shown. */
export interface PopupClickRow {
  key: string;
  label: string;
  kind: "interview" | "notice";
  shown: number;
  clicked: number;
  closed: number;
  hidden: number;
}
/** GET /api/admin/behavior (lib/admin-handlers/behavior.js) */
export interface BehaviorData {
  period: AdminPeriod | "custom";
  range?: AdminDateRange;
  funnel: FunnelStep[];
  sources: BehaviorSourceRow[];
  retention: BehaviorRetention;
  engagedTime: BehaviorEngagedTime;
  login: BehaviorLogin;
  features: FeatureUsageRow[];
  interviews: BehaviorInterviews;
  popups: PopupClickRow[];
}

const POLL_MS = 5 * 60 * 1000;

/** 화면은 늘 날짜 범위(KST, 양 끝 포함)로 묻는다 — 서버 period=custom&from&to. */
export function behaviorUrl(range: AdminDateRange): string {
  return `/api/admin/behavior?${new URLSearchParams({ period: "custom", from: range.from, to: range.to })}`;
}

export function useBehaviorData(range: AdminDateRange) {
  return useAdminResource<BehaviorData>(behaviorUrl(range), {
    pollMs: POLL_MS,
    errorMessage: "사용 행동 데이터를 불러오지 못했습니다.",
  });
}
