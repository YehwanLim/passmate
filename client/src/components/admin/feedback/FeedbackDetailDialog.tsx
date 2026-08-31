import { useLocation } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { FeedbackScoreBadge } from "./FeedbackScoreBadge";
import { UI_LABELS } from "@/constants/labels";
import { Building2, Clock, Cpu, FileText, User } from "lucide-react";
import type { FeedbackItem } from "@/hooks/admin/useFeedbackData";

interface FeedbackDetailDialogProps {
  feedback: FeedbackItem | null;
  isOpen: boolean;
  onClose: () => void;
}

const SCORE_MAX = UI_LABELS.FEEDBACK_SCORE_MAX;

function formatDate(iso: string | null): string {
  if (!iso) return "–";
  return new Date(iso).toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function FeedbackDetailDialog({
  feedback,
  isOpen,
  onClose,
}: FeedbackDetailDialogProps) {
  const [, navigate] = useLocation();
  if (!feedback) return null;

  const target = [feedback.company, feedback.jobKeyword].filter(Boolean).join(" · ");

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-6 gap-4">
        <DialogHeader className="pb-2 border-b">
          <div className="flex items-center gap-2 mb-1.5">
            <FeedbackScoreBadge item={feedback} />
            <span className="text-xs text-muted-foreground">평균 (10점 만점)</span>
          </div>
          <DialogTitle className="text-lg font-bold">설문 응답 상세</DialogTitle>
          <DialogDescription className="text-xs">
            {formatDate(feedback.createdAt)} 접수
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-muted/40 p-3 rounded-lg border">
          <div className="flex items-center gap-2 min-w-0">
            <User className="size-3.5 text-muted-foreground flex-shrink-0" />
            <span className="truncate" title={feedback.userEmail ?? undefined}>
              {feedback.userEmail ?? "알 수 없는 유저"}
            </span>
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <Building2 className="size-3.5 text-muted-foreground flex-shrink-0" />
            <span className="truncate">{target || "–"}</span>
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <Cpu className="size-3.5 text-muted-foreground flex-shrink-0" />
            <span className="truncate">{feedback.modelName ?? "–"}</span>
          </div>
        </div>

        <ScrollArea className="flex-1 min-h-0 pr-3">
          <div className="space-y-4">
            {/* 문항별 점수 */}
            <section>
              <h3 className="text-xs font-semibold text-muted-foreground mb-2">
                문항별 점수
              </h3>
              <div className="space-y-2.5">
                {UI_LABELS.FEEDBACK_SURVEY_QUESTIONS.map((item) => {
                  const score = feedback.scores?.[item.key] ?? null;
                  return (
                    <div key={item.key}>
                      <div className="flex items-baseline justify-between gap-3 mb-1">
                        <span className="text-xs text-foreground">{item.question}</span>
                        <span className="text-xs font-semibold tabular-nums shrink-0">
                          {score == null ? "–" : `${score}/${SCORE_MAX}`}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-foreground/70 rounded-full"
                          style={{ width: `${((score ?? 0) / SCORE_MAX) * 100}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* 주관식 */}
            <section>
              <h3 className="text-xs font-semibold text-muted-foreground mb-1.5">
                주관식 답변
              </h3>
              <p className="text-sm whitespace-pre-wrap rounded-lg border bg-background p-3 leading-relaxed">
                {feedback.comment || "답변 없음"}
              </p>
            </section>

            {/* 대상 문항 */}
            <section>
              <h3 className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1.5">
                <FileText className="size-3.5" />
                평가한 리포트의 문항
              </h3>
              <p className="text-sm whitespace-pre-wrap rounded-lg border bg-muted/30 p-3 leading-relaxed text-muted-foreground">
                {feedback.questionText || "–"}
              </p>
            </section>

            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Clock className="size-3.5" />
              분석 생성: {formatDate(feedback.analyzedAt)}
            </p>
          </div>
        </ScrollArea>

        <div className="flex justify-end pt-2 border-t">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              onClose();
              navigate(`/admin/resume-analysis/${feedback.analysisId}`);
            }}
          >
            분석 상세 보기
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
