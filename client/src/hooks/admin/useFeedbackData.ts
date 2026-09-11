import { useAdminPagedResource } from "./useAdminPagedResource";

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

interface FeedbackPayload {
  items: FeedbackItem[];
  total: number;
  summary: FeedbackSummary;
}

export function useFeedbackData({ search, segment, commentsOnly, page, pageSize }: UseFeedbackDataParams) {
  const { rows: items, data, total, totalPages, isLoading, error, refresh, lastRefreshed } = useAdminPagedResource<FeedbackItem, FeedbackPayload>(
    "/api/admin/feedback",
    { search, segment, commentsOnly, page, pageSize },
    pageSize,
    { select: (payload) => ({ rows: payload.items, total: payload.total }), errorMessage: "피드백을 불러오지 못했습니다." },
  );

  return {
    items,
    // 요약은 필터와 무관한 전체 기준이라 마지막 성공 응답의 값을 그대로 쓴다.
    summary: data?.summary ?? EMPTY_SUMMARY,
    total,
    totalPages,
    isLoading,
    error,
    refresh,
    lastRefreshed,
  };
}
