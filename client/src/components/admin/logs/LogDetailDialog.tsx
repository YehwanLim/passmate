import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AlertCircle, Clock, Cpu, User, FileText, Code } from "lucide-react";
import type { ErrorLogItem } from "@/hooks/admin/useErrorLogs";

interface LogDetailDialogProps {
  log: ErrorLogItem | null;
  isOpen: boolean;
  onClose: () => void;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function LogDetailDialog({ log, isOpen, onClose }: LogDetailDialogProps) {
  if (!log) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl h-[85vh] flex flex-col p-6 gap-4">
        <DialogHeader className="pb-2 border-b">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <Badge variant="destructive" className="font-semibold text-xs">
              {log.errorCode}
            </Badge>
            {log.httpStatus && (
              <Badge variant="outline" className="text-red-500 border-red-500/30">
                HTTP {log.httpStatus}
              </Badge>
            )}
          </div>
          <DialogTitle className="text-lg font-bold truncate">
            에러 로그 상세 분석
          </DialogTitle>
          <DialogDescription className="text-xs">
            로그 식별자: {log.id}
          </DialogDescription>
        </DialogHeader>

        {/* 요약 메타 카드 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-muted/40 p-3 rounded-lg border">
          <div className="flex items-center gap-2 min-w-0">
            <User className="size-3.5 text-muted-foreground flex-shrink-0" />
            <span className="truncate" title={log.userEmail ?? "–"}>
              {log.userEmail ?? "알 수 없는 유저"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Cpu className="size-3.5 text-muted-foreground flex-shrink-0" />
            <span className="truncate">{log.modelName ?? "–"}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="size-3.5 text-muted-foreground flex-shrink-0" />
            <span>{formatDate(log.createdAt)}</span>
          </div>
        </div>

        {/* 내용 탭 분리: 에러 메시지, 원본 자소서 */}
        <Tabs defaultValue="error" className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid grid-cols-2 w-[240px] h-8 p-0.5">
            <TabsTrigger value="error" className="text-xs h-7 py-0">
              에러 메시지
            </TabsTrigger>
            <TabsTrigger value="resume" className="text-xs h-7 py-0">
              원본 자소서
            </TabsTrigger>
          </TabsList>

          {/* 1. 에러 상세 로그 */}
          <TabsContent value="error" className="flex-1 min-h-0 mt-3">
            <div className="p-0 h-full flex flex-col">
              <div className="flex items-center gap-1.5 text-xs font-bold text-destructive mb-2 uppercase">
                <AlertCircle className="size-4" />
                Raw Error Stack / Response Message
              </div>
              <ScrollArea className="flex-1 rounded-lg border bg-muted/20 p-4">
                <pre className="text-xs font-mono text-foreground whitespace-pre-wrap leading-normal">
                  {log.errorMessage || "에러 스택 내용이 비어있습니다."}
                </pre>
              </ScrollArea>
            </div>
          </TabsContent>

          {/* 2. 자소서 원본 (질문 + 본문) */}
          <TabsContent value="resume" className="flex-1 min-h-0 mt-3 space-y-4">
            <div className="h-full flex flex-col gap-4">
              <div className="flex-1 flex flex-col min-h-0">
                <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground mb-1.5 uppercase">
                  <Code className="size-3.5" />
                  문항 질문
                </div>
                <ScrollArea className="h-[80px] rounded-lg border bg-muted/20 p-3.5 text-sm whitespace-pre-wrap">
                  {log.questionText || "(질문 없음)"}
                </ScrollArea>
              </div>

              <div className="flex-[2] flex flex-col min-h-0">
                <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground mb-1.5 uppercase">
                  <FileText className="size-3.5" />
                  작성 이력서
                </div>
                <ScrollArea className="flex-1 rounded-lg border bg-muted/20 p-3.5 text-sm whitespace-pre-wrap">
                  {log.inputText || "(이력서 내용 없음)"}
                </ScrollArea>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
