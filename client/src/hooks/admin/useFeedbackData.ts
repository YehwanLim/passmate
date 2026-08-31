import { useCallback, useEffect, useState } from "react";

import { adminApiFetch } from "@/lib/adminApi";

export type FeedbackRatingFilter = "ALL" | "THUMBS_UP" | "THUMBS_DOWN";

export interface FeedbackItem {
  id: string;
  analysisId: string;
  rating: "THUMBS_UP" | "THUMBS_DOWN";
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
  thumbsUp: number;
  thumbsDown: number;
  withComment: number;
}

export interface UseFeedbackDataParams {
  search: string;
  rating: FeedbackRatingFilter;
  commentsOnly: boolean;
  page: number;
  pageSize: number;
}

const EMPTY_SUMMARY: FeedbackSummary = {
  thumbsUp: 0,
  thumbsDown: 0,
  withComment: 0,
};

export function useFeedbackData({
  search,
  rating,
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
          rating,
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
  }, [commentsOnly, page, pageSize, rating, search, tick]);

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
