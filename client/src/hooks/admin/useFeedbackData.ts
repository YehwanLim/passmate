import { useCallback, useEffect, useState } from "react";

import { adminApiFetch } from "@/lib/adminApi";

export type FeedbackSegment = "ALL" | "PROMOTER" | "DETRACTOR" | "LEGACY";

export type SurveyScores = Record<string, number | null>;

export interface FeedbackItem {
  id: string;
  analysisId: string;
  scores: SurveyScores;
  averageScore: number | null;
  legacyRating: "THUMBS_UP" | "THUMBS_DOWN" | null;
  comment: string | null;
  createdAt: string;
  userEmail: string | null;
  userName: string | null;
  company: string | null;
  jobKeyword: string | null;
  questionText: string | null;
  modelName: string | null;
  analyzedAt: string | null;
}

export interface FeedbackSummary {
  surveyCount: number;
  withComment: number;
  questionAverages: Record<string, number | null>;
}

export interface UseFeedbackDataParams {
  search: string;
  segment: FeedbackSegment;
  commentsOnly: boolean;
  page: number;
  pageSize: number;
}

const EMPTY_SUMMARY: FeedbackSummary = {
  surveyCount: 0,
  withComment: 0,
  questionAverages: {},
};

export function useFeedbackData({
  search,
  segment,
  commentsOnly,
  page,
  pageSize,
}: UseFeedbackDataParams) {
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [summary, setSummary] = useState<FeedbackSummary>(EMPTY_SUMMARY);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());

  const refresh = useCallback(() => setTick(value => value + 1), []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          search,
          segment,
          commentsOnly: String(commentsOnly),
          page: String(page),
          pageSize: String(pageSize),
        });
        const data = await adminApiFetch<{
          items: FeedbackItem[];
          total: number;
          summary: FeedbackSummary;
        }>(`/api/admin/feedback?${params}`);
        if (cancelled) return;
        setItems(data.items);
        setTotal(data.total);
        setSummary(data.summary ?? EMPTY_SUMMARY);
        setIsLoading(false);
        setLastRefreshed(new Date());
      } catch (cause) {
        if (cancelled) return;
        setError(
          cause instanceof Error
            ? cause.message
            : "피드백을 불러오지 못했습니다."
        );
        setIsLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [commentsOnly, page, pageSize, search, segment, tick]);

  return {
    items,
    summary,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    isLoading,
    error,
    refresh,
    lastRefreshed,
  };
}
