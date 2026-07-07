import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

// ============================================================
// 타입 정의
// ============================================================

export interface AiUsageSummary {
  todayTokens: {
    prompt: number;
    completion: number;
    total: number;
  };
  todayCost: number;
  avgResponseTimeMs: number;
  failureRate: number; // 퍼센트 (0~100)
}

export interface ModelUsageItem {
  modelName: string;
  provider: string;
  calls: number;
  tokens: number;
  cost: number;
}

export interface HourlyUsagePoint {
  hour: string; // "00시", "01시" ... "23시"
  tokens: number;
  cost: number;
}

export interface DailyUsagePoint {
  date: string; // "MM/DD"
  tokens: number;
  cost: number;
}

export interface AiUsageData {
  summary: AiUsageSummary;
  modelUsage: ModelUsageItem[];
  hourlyUsage: HourlyUsagePoint[];
  dailyUsage: DailyUsagePoint[];
}

type AsyncState<T> = {
  data: T | null;
  isLoading: boolean;
  error: string | null;
};

// ============================================================
// 시간 계산 유틸리티 (KST 기준)
// ============================================================

function getTodayKSTStart(): string {
  const now = new Date();
  const kstOffset = 9 * 60;
  const localOffset = now.getTimezoneOffset();
  const kstNow = new Date(now.getTime() + (kstOffset + localOffset) * 60000);
  kstNow.setHours(0, 0, 0, 0);
  return new Date(kstNow.getTime() - kstOffset * 60000).toISOString();
}

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

// ============================================================
// 훅 구현
// ============================================================

export function useAiUsageData() {
  const [state, setState] = useState<AsyncState<AiUsageData>>({
    data: null,
    isLoading: true,
    error: null,
  });
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const fetchUsage = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    const todayStart = getTodayKSTStart();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    try {
      // ── 병렬 쿼리 실행 ─────────────────────────────────────
      const [
        todayTokensRes,
        todayAnalysesRes,
        sevenDaysTokensRes,
        sevenDaysAnalysesRes,
      ] = await Promise.all([
        // 1. 오늘의 토큰/비용 로그 전체
        supabase
          .from("token_usages")
          .select("prompt_tokens, completion_tokens, total_tokens, cost, created_at, model_name, model_provider")
          .gte("created_at", todayStart),

        // 2. 오늘의 분석 로그 (응답 시간, 실패율 계산용)
        supabase
          .from("analyses")
          .select("status, response_time_ms")
          .gte("created_at", todayStart),

        // 3. 최근 7일 토큰 로그 (일별 차트용)
        supabase
          .from("token_usages")
          .select("total_tokens, cost, created_at")
          .gte("created_at", sevenDaysAgo),

        // 4. 모델별 누적 비율용 (최근 7일 전체 모델별 통계)
        supabase
          .from("token_usages")
          .select("model_name, model_provider, total_tokens, cost")
          .gte("created_at", sevenDaysAgo),
      ]);

      if (
        todayTokensRes.error ||
        todayAnalysesRes.error ||
        sevenDaysTokensRes.error ||
        sevenDaysAnalysesRes.error
      ) {
        throw new Error("데이터베이스 조회 중 오류가 발생했습니다.");
      }

      // ── 1. 오늘 요약 데이터 집계 ───────────────────────────
      const todayTokensData = todayTokensRes.data ?? [];
      const todayAnalysesData = todayAnalysesRes.data ?? [];

      let todayPrompt = 0;
      let todayCompletion = 0;
      let todayTotal = 0;
      let todayCost = 0;

      todayTokensData.forEach((row: any) => {
        todayPrompt += row.prompt_tokens ?? 0;
        todayCompletion += row.completion_tokens ?? 0;
        todayTotal += row.total_tokens ?? 0;
        todayCost += row.cost ?? 0;
      });

      // 평균 응답 시간 및 실패율 계산
      let totalResTime = 0;
      let successCount = 0;
      let failedCount = 0;

      todayAnalysesData.forEach((row: any) => {
        if (row.response_time_ms) {
          totalResTime += row.response_time_ms;
          successCount++;
        }
        if (row.status === "FAILED") {
          failedCount++;
        }
      });

      const totalCalls = todayAnalysesData.length;
      const avgResponseTimeMs = successCount > 0 ? Math.round(totalResTime / successCount) : 0;
      const failureRate = totalCalls > 0 ? Math.round((failedCount / totalCalls) * 100) : 0;

      // ── 2. 모델별 사용량 분석 (최근 7일 기준) ───────────────
      const modelUsageMap = new Map<string, ModelUsageItem>();
      const rawModelData = sevenDaysAnalysesRes.data ?? [];

      rawModelData.forEach((row: any) => {
        const key = row.model_name || "Unknown";
        const existing = modelUsageMap.get(key) || {
          modelName: key,
          provider: row.model_provider || "Unknown",
          calls: 0,
          tokens: 0,
          cost: 0,
        };

        existing.calls += 1;
        existing.tokens += row.total_tokens ?? 0;
        existing.cost += row.cost ?? 0;

        modelUsageMap.set(key, existing);
      });

      const modelUsage = Array.from(modelUsageMap.values()).sort((a, b) => b.cost - a.cost);

      // ── 3. 시간대별 데이터 집계 (오늘 기준 0~23시) ───────────
      const hourlyMap: Record<number, { tokens: number; cost: number }> = {};
      for (let i = 0; i < 24; i++) {
        hourlyMap[i] = { tokens: 0, cost: 0 };
      }

      todayTokensData.forEach((row: any) => {
        const date = new Date(row.created_at);
        // KST 시간 추출
        const kstHour = (date.getUTCHours() + 9) % 24;
        hourlyMap[kstHour].tokens += row.total_tokens ?? 0;
        hourlyMap[kstHour].cost += row.cost ?? 0;
      });

      const hourlyUsage: HourlyUsagePoint[] = Object.entries(hourlyMap).map(([h, val]) => ({
        hour: `${String(h).padStart(2, "0")}시`,
        tokens: val.tokens,
        cost: val.cost,
      }));

      // ── 4. 일별 데이터 집계 (최근 7일) ─────────────────────
      const last7Days = getLast7Days();
      const dailyMap: Record<string, { tokens: number; cost: number }> = {};
      last7Days.forEach((date) => {
        dailyMap[date] = { tokens: 0, cost: 0 };
      });

      const sevenDaysTokensData = sevenDaysTokensRes.data ?? [];
      sevenDaysTokensData.forEach((row: any) => {
        const d = new Date(row.created_at);
        const kstDate = new Date(d.getTime() + 9 * 60 * 60 * 1000);
        const key = `${String(kstDate.getUTCMonth() + 1).padStart(2, "0")}/${String(
          kstDate.getUTCDate()
        ).padStart(2, "0")}`;
        if (dailyMap[key]) {
          dailyMap[key].tokens += row.total_tokens ?? 0;
          dailyMap[key].cost += row.cost ?? 0;
        }
      });

      const dailyUsage: DailyUsagePoint[] = last7Days.map((date) => ({
        date,
        tokens: dailyMap[date].tokens,
        cost: dailyMap[date].cost,
      }));

      setState({
        data: {
          summary: {
            todayTokens: {
              prompt: todayPrompt,
              completion: todayCompletion,
              total: todayTotal,
            },
            todayCost,
            avgResponseTimeMs,
            failureRate,
          },
          modelUsage,
          hourlyUsage,
          dailyUsage,
        },
        isLoading: false,
        error: null,
      });
      setLastRefreshed(new Date());
    } catch (err) {
      setState({
        data: null,
        isLoading: false,
        error: err instanceof Error ? err.message : "AI 통계 데이터를 로드하지 못했습니다.",
      });
    }
  }, []);

  useEffect(() => {
    fetchUsage();
    // 5분마다 실시간 자동 갱신
    const interval = setInterval(fetchUsage, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchUsage]);

  return {
    ...state,
    refresh: fetchUsage,
    lastRefreshed,
  };
}
