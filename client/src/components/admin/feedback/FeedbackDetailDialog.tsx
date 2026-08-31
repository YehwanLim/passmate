import { useLocation } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, Clock, Cpu, FileText, User } from "lucide-react";
import type { FeedbackItem } from "@/hooks/admin/useFeedbackData";

interface FeedbackDetailDialogProps {
  feedback: FeedbackItem | null;
  isOpen: boolean;
  onClose: () => void;
}

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

  const isPositive = feedback.rating === "THUMBS_UP";
  const target = [feedback.company, feedback.jobKeyword]
    .filter(Boolean)
    .join(" · ");

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-6 gap-4">
        <DialogHeader className="pb-2 border-b">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <Badge
              variant={isPositive ? "secondary" : "destructive"}
              className="font-semibold text-xs"
            >
              {isPositive ? "👍 만족" : "👎 불만족"}
            </Badge>
            {feedback.comment && (
              <Badge variant="outline" className="text-xs">
                코멘트 있음
              </Badge>
            )}
          </div>
          <DialogTitle className="text-lg font-bold">피드백 상세</DialogTitle>
          <DialogDescription className="text-xs">
            {formatDate(feedback.createdAt)} 접수
          </DialogDescription>
        </DialogHeader>

        {/* 요약 메타 */}
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
            {/* 남긴 코멘트 */}
            <section>
              <h3 className="text-xs font-semibold text-muted-foreground mb-1.5">
                남긴 코멘트
              </h3>
              <p className="text-sm whitespace-pre-wrap rounded-lg border bg-background p-3 leading-relaxed">
                {feedback.comment || "코멘트 없이 평가만 남겼습니다."}
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
