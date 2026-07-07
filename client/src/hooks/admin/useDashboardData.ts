import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

// ============================================================
// 타입 정의
// ============================================================

export interface KpiData {
  todayVisitors: number | null;    // 오늘 분석 시작한 순 유저 수 (방문자 proxy)
  todaySignups: number | null;     // 오늘 신규 가입자
  todayAnalyses: number | null;    // 오늘 분석 실행 횟수
  todayAiCost: number | null;      // 오늘 AI 비용 (USD)
  onlineUsers: number | null;      // 최근 30분 활성 유저 수
}

export interface ChartPoint {
  date: string;   // "MM/DD" 형태
  count: number;
}

export interface ActivityItem {
  id: string;
  userEmail: string;
  status: "PENDING" | "SUCCESS" | "FAILED";
  createdAt: string;
  modelName: string | null;
}

export interface DashboardData {
  kpi: KpiData;
  signupChart: ChartPoint[];
  analysisChart: ChartPoint[];
  recentActivity: ActivityItem[];
}

type AsyncState<T> = {
  data: T | null;
  isLoading: boolean;
  error: string | null;
};

// ============================================================
// KST 기준 오늘 자정 ISO 문자열 계산
// ============================================================

function getTodayKSTStart(): string {
  const now = new Date();
  // KST = UTC+9
  const kstOffset = 9 * 60;
  const localOffset = now.getTimezoneOffset();
  const kstNow = new Date(now.getTime() + (kstOffset + localOffset) * 60000);

  kstNow.setHours(0, 0, 0, 0);

  // 다시 UTC로 변환하여 ISO 반환
  const utc = new Date(kstNow.getTime() - kstOffset * 60000);
  return utc.toISOString();
}

/** 최근 N일의 날짜 배열 생성 (KST 기준, 오래된 순) */
function getLast7Days(): string[] {
  const days: string[] = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    days.push(
      `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`
    );
  }
  return days;
}

/** DB에서 반환된 date 문자열(YYYY-MM-DD)을 MM/DD로 변환 */
function toMMDD(dateStr: string): string {
  const parts = dateStr.split("-");
  if (parts.length < 3) return dateStr;
  return `${parts[1]}/${parts[2]}`;
}

// ============================================================
// 메인 훅
// ============================================================

/**
 * useDashboardData
 *
 * 관리자 대시보드에 필요한 모든 데이터를 병렬로 조회합니다.
 * - 5분 자동 갱신
 * - 수동 refresh() 호출 지원
 * - 각 데이터 영역은 독립적으로 로딩/에러 상태를 가집니다.
 *
 * @note Supabase RLS 정책상 admin role 사용자만 users/analyses/token_usages를
 *       읽을 수 있어야 합니다. 필요시 SELECT policy를 추가하세요.
 */
export function useDashboardData() {
  const [state, setState] = useState<AsyncState<DashboardData>>({
    data: null,
    isLoading: true,
    error: null,
  });

  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const fetchAll = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    const todayStart = getTodayKSTStart();
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    try {
      // ── 병렬 쿼리 실행 ─────────────────────────────────────
      const [
        signupsRes,
        analysesRes,
        aiCostRes,
        visitorsRes,
        onlineRes,
        signupChartRes,
        analysisChartRes,
        activityRes,
      ] = await Promise.all([
        // 1. 오늘 가입자 수
        supabase
          .from("users")
          .select("id", { count: "exact", head: true })
          .gte("created_at", todayStart),

        // 2. 오늘 분석 횟수
        supabase
          .from("analyses")
          .select("id", { count: "exact", head: true })
          .gte("created_at", todayStart),

        // 3. 오늘 AI 비용 합계
        supabase
          .from("token_usages")
          .select("cost")
          .gte("created_at", todayStart),

        // 4. 오늘 방문자 (오늘 분석을 시작한 순 유저 수 — proxy)
        supabase
          .from("analyses")
          .select("user_id")
          .gte("created_at", todayStart),

        // 5. 현재 온라인 (최근 30분 활성 유저)
        supabase
          .from("analyses")
          .select("user_id")
          .gte("created_at", thirtyMinAgo),

        // 6. 최근 7일 가입 현황 (RPC 없이 클라이언트에서 집계)
        supabase
          .from("users")
          .select("created_at")
          .gte("created_at", sevenDaysAgo)
          .order("created_at", { ascending: true }),

        // 7. 최근 7일 분석 현황
        supabase
          .from("analyses")
          .select("created_at")
          .gte("created_at", sevenDaysAgo)
          .order("created_at", { ascending: true }),

        // 8. 최근 활동 (분석 10건 + 유저 이메일)
        supabase
          .from("analyses")
          .select("id, status, created_at, model_name, users(email)")
          .order("created_at", { ascending: false })
          .limit(10),
      ]);

      // ── KPI 집계 ────────────────────────────────────────────

      const todaySignups = signupsRes.count ?? 0;
      const todayAnalyses = analysesRes.count ?? 0;

      const todayAiCost = (aiCostRes.data ?? []).reduce(
        (sum: number, row: { cost: number | null }) => sum + (row.cost ?? 0),
        0
      );

      // 방문자: 오늘 분석한 순 유저
      const visitorSet = new Set(
        (visitorsRes.data ?? []).map((r: { user_id: string }) => r.user_id)
      );
      const todayVisitors = visitorSet.size;

      // 온라인: 최근 30분 활성 유저
      const onlineSet = new Set(
        (onlineRes.data ?? []).map((r: { user_id: string }) => r.user_id)
      );
      const onlineUsers = onlineSet.size;

      // ── 차트 데이터 집계 (날짜별 카운트) ───────────────────
      const last7Days = getLast7Days();

      const signupByDay: Record<string, number> = {};
      (signupChartRes.data ?? []).forEach((row: { created_at: string }) => {
        const d = new Date(row.created_at);
        const key = `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
        signupByDay[key] = (signupByDay[key] ?? 0) + 1;
      });

      const analysisByDay: Record<string, number> = {};
      (analysisChartRes.data ?? []).forEach((row: { created_at: string }) => {
        const d = new Date(row.created_at);
        const key = `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
        analysisByDay[key] = (analysisByDay[key] ?? 0) + 1;
      });

      const signupChart: ChartPoint[] = last7Days.map((date) => ({
        date,
        count: signupByDay[date] ?? 0,
      }));

      const analysisChart: ChartPoint[] = last7Days.map((date) => ({
        date,
        count: analysisByDay[date] ?? 0,
      }));

      // ── 최근 활동 가공 ──────────────────────────────────────
      const recentActivity: ActivityItem[] = (activityRes.data ?? []).map(
        (row: any) => ({
          id: row.id,
          userEmail: row.users?.email ?? "–",
          status: row.status,
          createdAt: row.created_at,
          modelName: row.model_name ?? null,
        })
      );

      setState({
        data: {
          kpi: {
            todayVisitors,
            todaySignups,
            todayAnalyses,
            todayAiCost,
            onlineUsers,
          },
          signupChart,
          analysisChart,
          recentActivity,
        },
        isLoading: false,
        error: null,
      });
      setLastRefreshed(new Date());
    } catch (err) {
      setState({
        data: null,
        isLoading: false,
        error: err instanceof Error ? err.message : "데이터를 불러오지 못했습니다.",
      });
    }
  }, []);

  // 마운트 + 5분 자동 갱신
  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  return {
    ...state,
    refresh: fetchAll,
    lastRefreshed,
  };
}
