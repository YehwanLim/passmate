import type { AnalysisDetail } from "@/hooks/admin/useAnalysisDetail";

// 분석 상세 화면의 순수 포맷·정규화 헬퍼. 탭 컴포넌트들이 함께 쓴다.

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function fmtMs(ms: number | null): string {
  if (ms == null) return "–";
  return `${ms.toLocaleString("ko-KR")} ms (${(ms / 1000).toFixed(2)}s)`;
}

export function fmtCost(usd: number | null): string {
  if (usd === null || usd === 0) return "–";
  return `$${usd.toFixed(6)}`;
}

// JSON 깔끔하게 포맷팅
export function formatJson(json: any): string {
  try {
    if (typeof json === "string") {
      return JSON.stringify(JSON.parse(json), null, 2);
    }
    return JSON.stringify(json, null, 2);
  } catch {
    return String(json);
  }
}

export type ReportObject = Record<string, any>;

export function toReportObject(value: unknown): ReportObject | null {
  if (!value) return null;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? parsed
        : null;
    } catch {
      return null;
    }
  }
  return typeof value === "object" && !Array.isArray(value)
    ? (value as ReportObject)
    : null;
}

export function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

// strengths/gaps는 구버전 문자열 배열과 신버전 {headline, text} 객체 배열이 섞여 온다.
export function diagnosisTextList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(item => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object") {
        const { headline, text } = item as { headline?: unknown; text?: unknown };
        if (typeof text === "string") {
          return typeof headline === "string" && headline.trim()
            ? `${headline.trim()} — ${text}`
            : text;
        }
      }
      return "";
    })
    .filter(item => item.trim().length > 0);
}

export function textValue(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

export interface TokenTotals {
  prompt: number;
  completion: number;
  total: number;
  cost: number;
}

export function sumTokenUsages(detail: AnalysisDetail): TokenTotals {
  return {
    prompt: detail.token_usages.reduce((s, t) => s + t.prompt_tokens, 0),
    completion: detail.token_usages.reduce((s, t) => s + t.completion_tokens, 0),
    total: detail.token_usages.reduce((s, t) => s + t.total_tokens, 0),
    cost: detail.token_usages.reduce((s, t) => s + (t.cost ?? 0), 0),
  };
}

export function calculateInsightSummary(detail: AnalysisDetail, report: ReportObject | null) {
  const reportSections = [
    report?.companyInsight,
    report?.firstImpression,
    report?.strengths,
    report?.gaps,
    report?.pmComment,
    report?.questionTabs,
    report?.actionPlan,
    report?.interviewQA,
  ].filter(Boolean).length;
  const projectCount = detail.project_analyses.length;
  const successCount = detail.project_analyses.filter(
    (analysis: { status: string }) => analysis.status === "SUCCESS"
  ).length;

  return {
    reportSections,
    projectCount,
    successCount,
    hasUserPreview: reportSections >= 3,
    hasCompanyFit:
      Boolean(report?.companyInsight) || diagnosisTextList(report?.strengths).length > 0,
    hasActionableFeedback:
      Array.isArray(report?.questionTabs) || diagnosisTextList(report?.gaps).length > 0,
  };
}

export type InsightSummary = ReturnType<typeof calculateInsightSummary>;
