import { useParams, Link } from "wouter";
import { useAnalysisDetail } from "@/hooks/admin/useAnalysisDetail";
import { AdminPageHeader } from "@/components/admin/shared/AdminPageHeader";
import { AnalysisStatusBadge } from "@/components/admin/resume-analysis/AnalysisStatusBadge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  User,
  Folder,
  Cpu,
  DollarSign,
  Clock,
  ExternalLink,
  Code,
  FileText,
  CheckCircle2,
  Eye,
  ListChecks,
  MessageSquare,
  Target,
  Zap,
} from "lucide-react";

// ============================================================
// 유틸리티
// ============================================================

function formatDate(iso: string): string {
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

function fmtMs(ms: number | null): string {
  if (ms == null) return "–";
  return `${ms.toLocaleString("ko-KR")} ms (${(ms / 1000).toFixed(2)}s)`;
}

function fmtCost(usd: number | null): string {
  if (usd === null || usd === 0) return "–";
  return `$${usd.toFixed(6)}`;
}

// JSON 깔끔하게 포맷팅
function formatJson(json: any): string {
  try {
    if (typeof json === "string") {
      return JSON.stringify(JSON.parse(json), null, 2);
    }
    return JSON.stringify(json, null, 2);
  } catch {
    return String(json);
  }
}

type ReportObject = Record<string, any>;

function toReportObject(value: unknown): ReportObject | null {
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

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function textValue(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function calculateInsightSummary(detail: any, report: ReportObject | null) {
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
      Boolean(report?.companyInsight) || stringList(report?.strengths).length > 0,
    hasActionableFeedback:
      Array.isArray(report?.questionTabs) || stringList(report?.gaps).length > 0,
  };
}

// ============================================================
// Component
// ============================================================

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
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
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

  // 토큰 합산 계산
  const totalPromptTokens = detail.token_usages.reduce(
    (s, t) => s + t.prompt_tokens,
    0
  );
  const totalCompletionTokens = detail.token_usages.reduce(
    (s, t) => s + t.completion_tokens,
    0
  );
  const totalTokens = detail.token_usages.reduce(
    (s, t) => s + t.total_tokens,
    0
  );
  const totalCost = detail.token_usages.reduce((s, t) => s + (t.cost ?? 0), 0);
  const report = toReportObject(detail.ai_response_json);
  const insight = calculateInsightSummary(detail, report);
  const companyInsight = toReportObject(report?.companyInsight);
  const firstImpression = toReportObject(report?.firstImpression);
  const questionTabs = Array.isArray(report?.questionTabs)
    ? report.questionTabs
    : [];
  const actionPlan = Array.isArray(report?.actionPlan) ? report.actionPlan : [];
  const interviewQA = Array.isArray(report?.interviewQA) ? report.interviewQA : [];

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

      {/* 메타데이터 정보 요약 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 사용자 & 프로젝트 정보 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              대상 정보
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3.5 text-sm">
            <div className="flex items-start gap-2.5">
              <User className="size-4 text-muted-foreground mt-0.5" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">사용자</p>
                {detail.user ? (
                  <Link
                    href={`/admin/users/${detail.user.id}`}
                    className="font-medium hover:underline inline-flex items-center gap-1 text-primary"
                  >
                    {detail.user.name ?? detail.user.email}
                    <ExternalLink className="size-3" />
                  </Link>
                ) : (
                  <p className="font-medium text-muted-foreground">
                    알 수 없는 사용자
                  </p>
                )}
              </div>
            </div>

            <Separator />

            <div className="flex items-start gap-2.5">
              <Folder className="size-4 text-muted-foreground mt-0.5" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">프로젝트</p>
                {detail.project ? (
                  <>
                    <p className="font-medium truncate">
                      {detail.project.title}
                    </p>
                    {detail.project.company && (
                      <p className="text-xs text-muted-foreground">
                        기업: {detail.project.company} | 직무:{" "}
                        {detail.project.job_keyword ?? "미지정"}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="font-medium text-muted-foreground">
                    연관 프로젝트 없음
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* AI 실행 모델 요약 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              AI 모델 & 인프라
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3.5 text-sm">
            <div className="flex items-start gap-2.5">
              <Cpu className="size-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">수행 모델</p>
                <p className="font-medium">
                  {detail.model_name ?? "–"}{" "}
                  {detail.model_provider && (
                    <span className="text-xs text-muted-foreground">
                      ({detail.model_provider})
                    </span>
                  )}
                </p>
              </div>
            </div>

            <Separator />

            <div className="flex items-start gap-2.5">
              <Clock className="size-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">
                  응답 처리 시간 / 실행 시각
                </p>
                <p className="font-medium">{fmtMs(detail.response_time_ms)}</p>
                <p className="text-xs text-muted-foreground inline-flex items-center gap-1 mt-0.5">
                  <Calendar className="size-3" />
                  {formatDate(detail.created_at)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 토큰 사용량 & 비용 요약 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              자원 사용량 및 비용
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-xs text-muted-foreground">프롬프트 토큰</p>
                <p className="font-mono font-medium">
                  {totalPromptTokens.toLocaleString("ko-KR")}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">완성 토큰</p>
                <p className="font-mono font-medium">
                  {totalCompletionTokens.toLocaleString("ko-KR")}
                </p>
              </div>
            </div>

            <Separator className="my-1.5" />

            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">총 사용량</p>
                <p className="font-mono font-bold text-base text-foreground">
                  {totalTokens.toLocaleString("ko-KR")}{" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    Tokens
                  </span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">예상 비용 (USD)</p>
                <p className="font-mono font-bold text-base text-emerald-600 dark:text-emerald-500 inline-flex items-center">
                  <DollarSign className="size-3.5 -mr-0.5" />
                  {fmtCost(totalCost).replace("$", "")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

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

        {/* 1. 사용자가 실제로 받는 리포트 형태 */}
        <TabsContent value="preview" className="mt-4 space-y-4">
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Eye className="size-4 text-primary" />
                사용자 리포트 미리보기
              </CardTitle>
              <CardDescription>
                코드 형태가 아니라 사용자가 읽는 리포트 흐름으로 변환해 봅니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border bg-background p-5">
                <p className="text-xs font-semibold uppercase text-muted-foreground">
                  첫인상
                </p>
                <h3 className="mt-2 text-xl font-bold leading-snug">
                  {textValue(firstImpression?.summaryOneLiner) ??
                    "첫인상 요약이 없습니다."}
                </h3>
                {textValue(firstImpression?.persona) && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    {firstImpression?.persona}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  {stringList(firstImpression?.hashtags).map(tag => (
                    <span
                      key={tag}
                      className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Target className="size-4 text-primary" />
                      회사 맞춤 인사이트
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <p className="leading-7 text-muted-foreground">
                      {textValue(companyInsight?.summary) ??
                        "회사 인사이트 요약이 없습니다."}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {stringList(companyInsight?.talentKeywords).map(keyword => (
                        <span
                          key={keyword}
                          className="rounded-md border px-2 py-1 text-xs"
                        >
                          {keyword}
                        </span>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <MessageSquare className="size-4 text-primary" />
                      PM 코멘트
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm leading-7">
                      {textValue(report?.pmComment) ??
                        "PM 코멘트가 없습니다."}
                    </p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">강점</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {stringList(report?.strengths).length > 0 ? (
                      stringList(report?.strengths).map(item => (
                        <p key={item} className="flex gap-2 text-sm leading-6">
                          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                          <span>{item}</span>
                        </p>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        강점 항목이 없습니다.
                      </p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">보완점</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {stringList(report?.gaps).length > 0 ? (
                      stringList(report?.gaps).map(item => (
                        <p key={item} className="flex gap-2 text-sm leading-6">
                          <Zap className="mt-0.5 size-4 shrink-0 text-amber-600" />
                          <span>{item}</span>
                        </p>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        보완점 항목이 없습니다.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <ListChecks className="size-4 text-primary" />
                    문항별 리포트
                  </CardTitle>
                  <CardDescription className="text-xs">
                    프로젝트에 포함된 각 문항과 AI 피드백을 운영자가 빠르게 읽는 영역입니다.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {detail.project_analyses.map((analysis, index) => {
                    const analysisReport = toReportObject(analysis.ai_response_json);
                    const questionTab = questionTabs[index] ?? null;
                    const feedbackCards = Array.isArray(questionTab?.feedbackCards)
                      ? questionTab.feedbackCards
                      : [];
                    return (
                      <div
                        key={analysis.id}
                        className={
                          analysis.id === detail.id
                            ? "rounded-lg border border-primary/30 bg-primary/5 p-4"
                            : "rounded-lg border bg-background p-4"
                        }
                      >
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground">
                              문항 {detail.project_analyses.length - index}
                            </p>
                            <h4 className="mt-1 text-sm font-semibold leading-6">
                              {analysis.question_text || "(질문 없음)"}
                            </h4>
                          </div>
                          <AnalysisStatusBadge
                            status={analysis.status}
                            errorCode={null}
                          />
                        </div>
                        <p className="mt-3 text-sm leading-7 text-muted-foreground">
                          {textValue(questionTab?.overview) ??
                            textValue(analysisReport?.overview) ??
                            textValue(analysisReport?.feedback) ??
                            "요약 피드백이 없습니다."}
                        </p>
                        {feedbackCards.length > 0 && (
                          <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                            {feedbackCards.slice(0, 4).map((card: any, cardIndex: number) => (
                              <div
                                key={`${analysis.id}-${cardIndex}`}
                                className="rounded-md border bg-muted/20 p-3"
                              >
                                <p className="text-xs font-semibold text-muted-foreground">
                                  {card.type === "praise" ? "좋은 점" : "개선 포인트"}
                                </p>
                                <p className="mt-1 text-sm leading-6">
                                  {textValue(card.feedback) ??
                                    textValue(card.praisePoint) ??
                                    textValue(card.detailedAnalysis) ??
                                    "피드백 내용이 없습니다."}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              {(actionPlan.length > 0 || interviewQA.length > 0) && (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  {actionPlan.length > 0 && (
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm">액션 플랜</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {actionPlan.slice(0, 4).map((item: any, index: number) => (
                          <div key={`${item.title ?? "action"}-${index}`}>
                            <p className="text-sm font-semibold">
                              {item.title ?? `액션 ${index + 1}`}
                            </p>
                            <p className="mt-1 text-sm leading-6 text-muted-foreground">
                              {item.description ?? item.expectedImpact ?? "설명이 없습니다."}
                            </p>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}
                  {interviewQA.length > 0 && (
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm">예상 면접 질문</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {interviewQA.slice(0, 4).map((item: any, index: number) => (
                          <div key={`${item.question ?? "question"}-${index}`}>
                            <p className="text-sm font-semibold">
                              {item.question ?? `질문 ${index + 1}`}
                            </p>
                            <p className="mt-1 text-sm leading-6 text-muted-foreground">
                              {item.modelAnswer ?? "모범 답안이 없습니다."}
                            </p>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 2. 관리자용 운영 인사이트 */}
        <TabsContent value="insight" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold uppercase text-muted-foreground">
                  리포트 완성도
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{insight.reportSections}/8</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  주요 리포트 섹션 감지
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold uppercase text-muted-foreground">
                  프로젝트 커버리지
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">
                  {insight.successCount}/{insight.projectCount}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  성공 처리된 문항 수
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold uppercase text-muted-foreground">
                  응답 시간
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">
                  {detail.response_time_ms
                    ? `${(detail.response_time_ms / 1000).toFixed(1)}s`
                    : "–"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  모델 응답 지연
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold uppercase text-muted-foreground">
                  비용
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{fmtCost(totalCost)}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {totalTokens.toLocaleString("ko-KR")} tokens
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">품질 체크리스트</CardTitle>
              <CardDescription className="text-xs">
                운영자가 샘플링 QA를 할 때 먼저 볼 만한 신호입니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {([
                ["사용자 리포트로 렌더링 가능", insight.hasUserPreview],
                ["회사/직무 맞춤성 포함", insight.hasCompanyFit],
                ["실행 가능한 피드백 포함", insight.hasActionableFeedback],
              ] as Array<[string, boolean]>).map(([label, ok]) => (
                <div
                  key={String(label)}
                  className="rounded-lg border bg-muted/20 p-4"
                >
                  <p className="flex items-center gap-2 text-sm font-medium">
                    <CheckCircle2
                      className={
                        ok ? "size-4 text-emerald-600" : "size-4 text-muted-foreground"
                      }
                    />
                    {label}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {ok ? "확인됨" : "응답 구조에서 찾지 못함"}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">모델 실행 정보</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 text-sm md:grid-cols-3">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">모델</p>
                <p className="mt-1 font-medium">{detail.model_name ?? "–"}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Provider</p>
                <p className="mt-1 font-medium">
                  {detail.model_provider ?? "–"}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Prompt Version</p>
                <p className="mt-1 font-medium">{detail.prompt_version}</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 3. 원본 자소서 + 렌더링 피드백 */}
        <TabsContent value="source" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
            <Card className="min-h-[800px]">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">
                  자소서 문항 및 작성 본문
                </CardTitle>
                {detail.total_chars != null && (
                  <CardDescription className="text-xs">
                    글자 수: {detail.total_chars.toLocaleString("ko-KR")} 자
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <h4 className="text-xs font-bold text-muted-foreground uppercase">
                    문항 질문
                  </h4>
                  <div className="min-h-24 p-4 rounded-lg bg-muted/40 border text-sm whitespace-pre-wrap leading-relaxed">
                    {detail.question_text || "(질문 없음)"}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <h4 className="text-xs font-bold text-muted-foreground uppercase">
                    작성 본문
                  </h4>
                  <ScrollArea className="h-[540px] w-full rounded-lg border bg-muted/20 p-4">
                    <div className="text-sm whitespace-pre-wrap leading-7 font-sans">
                      {detail.input_text || "(내용 없음)"}
                    </div>
                  </ScrollArea>
                </div>
              </CardContent>
            </Card>

            <Card className="min-h-[800px]">
              <CardHeader>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-sm font-semibold">
                      사용자에게 보인 핵심 피드백
                    </CardTitle>
                    <CardDescription className="text-xs">
                      원문 옆에서 리포트 요약과 개선 포인트를 확인합니다.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border bg-muted/20 p-4">
                  <p className="text-xs font-semibold text-muted-foreground">
                    요약
                  </p>
                  <p className="mt-2 text-sm leading-7">
                    {textValue(firstImpression?.summaryOneLiner) ??
                      textValue(report?.pmComment) ??
                      "요약 피드백이 없습니다."}
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {stringList(report?.gaps).map(item => (
                    <div key={item} className="rounded-lg border p-4">
                      <p className="text-xs font-semibold text-amber-600">
                        보완 포인트
                      </p>
                      <p className="mt-2 text-sm leading-7">{item}</p>
                    </div>
                  ))}
                  {stringList(report?.strengths).map(item => (
                    <div key={item} className="rounded-lg border p-4">
                      <p className="text-xs font-semibold text-emerald-600">
                        강점
                      </p>
                      <p className="mt-2 text-sm leading-7">{item}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* 4. Prompt */}
        <TabsContent value="prompt" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">
                프롬프트 템플릿 및 실행 환경
              </CardTitle>
              <CardDescription className="text-xs">
                분석 시 사용된 시스템 지침 및 버전 관리 정보입니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-xs bg-muted/40 p-3 rounded-lg border">
                <div>
                  <span className="text-muted-foreground">프롬프트 버전:</span>{" "}
                  <span className="font-semibold">{detail.prompt_version}</span>
                </div>
                {detail.prompt_template && (
                  <>
                    <div>
                      <span className="text-muted-foreground">이름:</span>{" "}
                      <span className="font-semibold">
                        {detail.prompt_template.name}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">설정:</span>{" "}
                      <span className="font-semibold">
                        Temp {detail.prompt_template.temperature ?? "Default"} /
                        MaxToken{" "}
                        {detail.prompt_template.max_tokens ?? "Default"}
                      </span>
                    </div>
                  </>
                )}
              </div>

              <div className="space-y-1.5">
                <h4 className="text-xs font-bold text-muted-foreground uppercase inline-flex items-center gap-1">
                  <Code className="size-3.5" />
                  System Prompt
                </h4>
                <ScrollArea className="h-[250px] w-full rounded-lg border bg-muted/20 p-3.5">
                  <pre className="text-xs font-mono whitespace-pre-wrap leading-normal">
                    {detail.prompt_template?.system_prompt ||
                      "(시스템 프롬프트 없음 - 기본 내장값 사용)"}
                  </pre>
                </ScrollArea>
              </div>

              {detail.prompt_template?.user_template && (
                <div className="space-y-1.5">
                  <h4 className="text-xs font-bold text-muted-foreground uppercase inline-flex items-center gap-1">
                    <FileText className="size-3.5" />
                    User Template
                  </h4>
                  <ScrollArea className="h-[120px] w-full rounded-lg border bg-muted/20 p-3.5">
                    <pre className="text-xs font-mono whitespace-pre-wrap leading-normal">
                      {detail.prompt_template.user_template}
                    </pre>
                  </ScrollArea>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 5. Raw JSON */}
        <TabsContent value="raw" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">
                AI API 원시 JSON 응답
              </CardTitle>
              <CardDescription className="text-xs">
                LLM 모델로부터 받아온 로우(Raw) 데이터 응답 구조입니다.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {detail.ai_response_json ? (
                <ScrollArea className="h-[800px] w-full rounded-lg border bg-muted/20 p-4">
                  <pre className="text-xs font-mono whitespace-pre-wrap text-foreground">
                    {formatJson(detail.ai_response_json)}
                  </pre>
                </ScrollArea>
              ) : (
                <div className="text-center py-10 text-muted-foreground text-sm">
                  원시 응답 데이터가 없습니다.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
