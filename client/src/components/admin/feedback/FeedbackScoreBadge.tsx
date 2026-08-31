import { Badge } from "@/components/ui/badge";
import type { FeedbackItem } from "@/hooks/admin/useFeedbackData";

/**
 * 평균 점수를 색으로 구분한다. 기준은 추천 의향에 쓰는 NPS 관례와 맞춘다 —
 * 9 이상 좋음, 7 이상 보통, 그 아래는 확인이 필요한 응답.
 */
export function scoreTone(score: number): "good" | "fair" | "poor" {
  if (score >= 9) return "good";
  if (score >= 7) return "fair";
  return "poor";
}

const TONE_CLASS: Record<ReturnType<typeof scoreTone>, string> = {
  good: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  fair: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  poor: "bg-destructive/10 text-destructive border-destructive/20",
};

interface FeedbackScoreBadgeProps {
  item: Pick<FeedbackItem, "averageScore" | "legacyRating">;
}

export function FeedbackScoreBadge({ item }: FeedbackScoreBadgeProps) {
  // 설문 이전(👍/👎)에 남은 응답은 점수가 없다. 0점으로 뭉개면 평균이 왜곡되므로
  // 그대로 과거 형식임을 드러낸다.
  if (item.averageScore == null) {
    if (!item.legacyRating) {
      return <span className="text-xs text-muted-foreground">–</span>;
    }
    return (
      <Badge variant="outline" className="text-[10px] font-medium px-1.5 py-0.5">
        {item.legacyRating === "THUMBS_UP" ? "👍 과거" : "👎 과거"}
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className={`text-[11px] font-semibold tabular-nums px-2 py-0.5 ${TONE_CLASS[scoreTone(item.averageScore)]}`}
    >
      {item.averageScore.toFixed(1)}
    </Badge>
  );
}
