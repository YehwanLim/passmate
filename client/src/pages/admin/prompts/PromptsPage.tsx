import { useEffect, useState } from "react";
import { AlertCircle, ArrowRight, MessageSquareCode } from "lucide-react";
import { Link } from "wouter";

import { AdminPageHeader } from "@/components/admin/shared/AdminPageHeader";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { usePrompts } from "@/hooks/admin/usePrompts";
import {
  PROMPT_TYPES,
  type PromptTemplateRecord,
  type PromptType,
} from "@/lib/admin-prompts";
import { cn } from "@/lib/utils";

const PROMPT_TYPE_META: Record<
  PromptType,
  {
    label: string;
    description: string;
    emptyName: string;
  }
> = {
  "resume-analysis": {
    label: "Resume Analysis",
    description: "이력서 분석용 핵심 프롬프트를 관리합니다.",
    emptyName: "Resume Analysis Prompt",
  },
  "cover-letter": {
    label: "Cover Letter",
    description: "자기소개서 초안과 첨삭 흐름에 사용하는 프롬프트입니다.",
    emptyName: "Cover Letter Prompt",
  },
  summary: {
    label: "Summary",
    description: "지원자 정보 요약과 핵심 포인트 정리에 사용합니다.",
    emptyName: "Summary Prompt",
  },
  feedback: {
    label: "Feedback",
    description: "AI 피드백 문구와 개선 제안을 생성하는 프롬프트입니다.",
    emptyName: "Feedback Prompt",
  },
  "interview-questions": {
    label: "Interview Questions",
    description: "맞춤형 면접 질문 생성에 사용하는 프롬프트입니다.",
    emptyName: "Interview Questions Prompt",
  },
};

function formatDate(value: string | Date | null | undefined) {
  if (!value) return "업데이트 없음";

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "업데이트 없음";

  return date.toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  return "프롬프트 목록을 불러오지 못했습니다.";
}

function getDisplayRecord(records: PromptTemplateRecord[]) {
  return records.find(record => record.isActive) ?? records[0] ?? null;
}

function PromptCardSkeleton() {
  return (
    <Card className="h-full">
      <CardHeader className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-6 w-40" />
          </div>
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
        <Skeleton className="h-4 w-full" />
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </CardContent>
      <CardFooter>
        <Skeleton className="h-4 w-28" />
      </CardFooter>
    </Card>
  );
}

export default function PromptsPage() {
  const { loadPrompts } = usePrompts();
  const [records, setRecords] = useState<PromptTemplateRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    async function fetchPrompts() {
      try {
        setIsLoading(true);
        setError(null);

        const nextRecords = await loadPrompts();
        if (!isActive) return;

        setRecords(nextRecords);
      } catch (nextError) {
        if (!isActive) return;
        setError(getErrorMessage(nextError));
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void fetchPrompts();

    return () => {
      isActive = false;
    };
  }, [loadPrompts]);

  const promptCards = PROMPT_TYPES.map(type => {
    const typeRecords = records.filter(record => record.promptType === type);
    const displayRecord = getDisplayRecord(typeRecords);
    const meta = PROMPT_TYPE_META[type];

    return {
      type,
      meta,
      detailHref: `/admin/prompts/${type}`,
      totalVersions: typeRecords.length,
      displayRecord,
    };
  });

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Prompts"
        description="AI 프롬프트를 버전별로 검토하고 운영 버전을 관리합니다."
      />

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {isLoading
          ? PROMPT_TYPES.map(type => <PromptCardSkeleton key={type} />)
          : promptCards.map(
              ({ type, meta, detailHref, totalVersions, displayRecord }) => {
                const badgeLabel = displayRecord
                  ? displayRecord.isActive
                    ? "Active"
                    : "Draft"
                  : "No Version";
                const badgeClassName = displayRecord
                  ? displayRecord.isActive
                    ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700"
                    : "border-amber-500/20 bg-amber-500/10 text-amber-700"
                  : "border-border bg-muted text-muted-foreground";

                return (
                  <Link key={type} href={detailHref} className="block h-full">
                    <Card className="h-full transition-shadow hover:shadow-md">
                      <CardHeader className="space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                              <MessageSquareCode className="size-3.5" />
                              <span>{type}</span>
                            </div>
                            <CardTitle className="mt-2 text-lg">
                              {meta.label}
                            </CardTitle>
                          </div>
                          <Badge
                            variant="outline"
                            className={cn("shrink-0", badgeClassName)}
                          >
                            {badgeLabel}
                          </Badge>
                        </div>
                        <CardDescription>
                          {displayRecord?.description ?? meta.description}
                        </CardDescription>
                      </CardHeader>

                      <CardContent className="space-y-4">
                        <div className="rounded-lg border bg-muted/30 p-4">
                          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                            Prompt
                          </p>
                          <p className="mt-2 text-sm font-semibold text-foreground">
                            {displayRecord?.name ?? meta.emptyName}
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {displayRecord?.version
                              ? `${displayRecord.version} · ${totalVersions} version${totalVersions === 1 ? "" : "s"}`
                              : "아직 저장된 버전이 없습니다."}
                          </p>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="rounded-lg border p-3">
                            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                              Updated
                            </p>
                            <p className="mt-2 text-sm font-medium text-foreground">
                              {formatDate(displayRecord?.updatedAt)}
                            </p>
                          </div>
                          <div className="rounded-lg border p-3">
                            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                              Updated By
                            </p>
                            <p className="mt-2 truncate text-sm font-medium text-foreground">
                              {displayRecord?.updatedBy ?? "미설정"}
                            </p>
                          </div>
                        </div>
                      </CardContent>

                      <CardFooter className="justify-between border-t text-sm text-muted-foreground">
                        <span>세부 버전 보기</span>
                        <ArrowRight className="size-4" />
                      </CardFooter>
                    </Card>
                  </Link>
                );
              }
            )}
      </div>
    </div>
  );
}
