import { useParams, Link } from "wouter";
import { useAnalysisDetail } from "@/hooks/admin/useAnalysisDetail";
import { AdminErrorAlert } from "@/components/admin/shared/AdminErrorAlert";
import { AdminPageHeader } from "@/components/admin/shared/AdminPageHeader";
import { AnalysisStatusBadge } from "@/components/admin/resume-analysis/AnalysisStatusBadge";
import { AnalysisMetaCards } from "@/components/admin/resume-analysis/detail/AnalysisMetaCards";
import { InsightTab } from "@/components/admin/resume-analysis/detail/InsightTab";
import { PreviewTab } from "@/components/admin/resume-analysis/detail/PreviewTab";
import { PromptTab } from "@/components/admin/resume-analysis/detail/PromptTab";
import { RawTab } from "@/components/admin/resume-analysis/detail/RawTab";
import { SourceTab } from "@/components/admin/resume-analysis/detail/SourceTab";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle, ArrowLeft } from "lucide-react";
import { calculateInsightSummary, sumTokenUsages, toReportObject } from "./analysisDetailFormat";

export default function AnalysisDetailPage() {
  const params = useParams<{ id: string }>();
  const analysisId = params?.id ?? "";
  const { detail, isLoading, error } = useAnalysisDetail(analysisId);

  if (error) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin/resume-analysis">
            <ArrowLeft className="size-4 mr-1.5" />
            목록으로
          </Link>
        </Button>
        <AdminErrorAlert message={error} />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-16 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-[300px] md:col-span-1" />
          <Skeleton className="h-[300px] md:col-span-2" />
        </div>
      </div>
    );
  }

  if (!detail) return null;

  const totals = sumTokenUsages(detail);
  const report = toReportObject(detail.ai_response_json);
  const insight = calculateInsightSummary(detail, report);

  return (
    <div className="space-y-6">
      {/* 뒤로 가기 */}
      <Button variant="ghost" size="sm" className="gap-1.5 -ml-2" asChild>
        <Link href="/admin/resume-analysis">
          <ArrowLeft className="size-4" />
          분석 목록
        </Link>
      </Button>

      {/* 헤더 */}
      <AdminPageHeader
        title={`Resume Analysis 상세`}
        description={`ID: ${detail.id}`}
        actions={
          <div className="flex items-center gap-2">
            <AnalysisStatusBadge
              status={detail.status}
              errorCode={detail.error_code}
            />
          </div>
        }
      />

      {/* 에러 상세 메시지 표시 (있을 때만) */}
      {detail.error_message && (
        <Alert
          variant="destructive"
          className="bg-destructive/5 border-destructive/20 text-destructive"
        >
          <AlertCircle className="size-4 flex-shrink-0" />
          <AlertDescription className="text-sm font-mono whitespace-pre-wrap">
            {detail.error_message}
          </AlertDescription>
        </Alert>
      )}

      <AnalysisMetaCards detail={detail} totals={totals} />

      {/* 탭 구조: 사용자 리포트, 관리자 인사이트, 원문, Prompt, Raw JSON */}
      <Tabs defaultValue="preview" className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5 lg:w-[760px]">
          <TabsTrigger value="preview" className="text-xs">
            리포트 미리보기
          </TabsTrigger>
          <TabsTrigger value="insight" className="text-xs">
            관리자 인사이트
          </TabsTrigger>
          <TabsTrigger value="source" className="text-xs">
            원문 비교
          </TabsTrigger>
          <TabsTrigger value="prompt" className="text-xs">
            Prompt
          </TabsTrigger>
          <TabsTrigger value="raw" className="text-xs">
            Raw JSON
          </TabsTrigger>
        </TabsList>

        <PreviewTab detail={detail} report={report} />
        <InsightTab detail={detail} insight={insight} totals={totals} />
        <SourceTab detail={detail} report={report} />
        <PromptTab detail={detail} />
        <RawTab detail={detail} />
      </Tabs>
    </div>
  );
}
