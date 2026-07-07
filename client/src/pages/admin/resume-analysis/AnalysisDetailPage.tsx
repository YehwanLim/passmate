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
  Bot,
  User,
  Folder,
  Cpu,
  DollarSign,
  Clock,
  ExternalLink,
  Code,
  FileText,
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
  const totalPromptTokens = detail.token_usages.reduce((s, t) => s + t.prompt_tokens, 0);
  const totalCompletionTokens = detail.token_usages.reduce((s, t) => s + t.completion_tokens, 0);
  const totalTokens = detail.token_usages.reduce((s, t) => s + t.total_tokens, 0);
  const totalCost = detail.token_usages.reduce((s, t) => s + (t.cost ?? 0), 0);

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
            <AnalysisStatusBadge status={detail.status} errorCode={detail.error_code} />
          </div>
        }
      />

      {/* 에러 상세 메시지 표시 (있을 때만) */}
      {detail.error_message && (
        <Alert variant="destructive" className="bg-destructive/5 border-destructive/20 text-destructive">
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
                  <p className="font-medium text-muted-foreground">알 수 없는 사용자</p>
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
                    <p className="font-medium truncate">{detail.project.title}</p>
                    {detail.project.company && (
                      <p className="text-xs text-muted-foreground">
                        기업: {detail.project.company} | 직무: {detail.project.job_keyword ?? "미지정"}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="font-medium text-muted-foreground">연관 프로젝트 없음</p>
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
                    <span className="text-xs text-muted-foreground">({detail.model_provider})</span>
                  )}
                </p>
              </div>
            </div>

            <Separator />

            <div className="flex items-start gap-2.5">
              <Clock className="size-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">응답 처리 시간 / 실행 시각</p>
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
                <p className="font-mono font-medium">{totalPromptTokens.toLocaleString("ko-KR")}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">완성 토큰</p>
                <p className="font-mono font-medium">{totalCompletionTokens.toLocaleString("ko-KR")}</p>
              </div>
            </div>

            <Separator className="my-1.5" />

            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">총 사용량</p>
                <p className="font-mono font-bold text-base text-foreground">
                  {totalTokens.toLocaleString("ko-KR")} <span className="text-xs font-normal text-muted-foreground">Tokens</span>
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

      {/* 탭 구조: 원본 자소서, AI 결과, Prompt, Response */}
      <Tabs defaultValue="source" className="w-full">
        <TabsList className="grid grid-cols-4 w-full md:w-[480px]">
          <TabsTrigger value="source" className="text-xs">
            원본 자소서
          </TabsTrigger>
          <TabsTrigger value="result" className="text-xs">
            AI 결과
          </TabsTrigger>
          <TabsTrigger value="prompt" className="text-xs">
            Prompt
          </TabsTrigger>
          <TabsTrigger value="response" className="text-xs">
            Response JSON
          </TabsTrigger>
        </TabsList>

        {/* 1. 원본 자소서 */}
        <TabsContent value="source" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">입력 정보 및 자기소개서 본문</CardTitle>
              {detail.total_chars != null && (
                <CardDescription className="text-xs">
                  글자 수: {detail.total_chars.toLocaleString("ko-KR")} 자
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <h4 className="text-xs font-bold text-muted-foreground uppercase">문항 질문</h4>
                <div className="p-3.5 rounded-lg bg-muted/40 border text-sm whitespace-pre-wrap leading-relaxed">
                  {detail.question_text || "(질문 없음)"}
                </div>
              </div>

              <div className="space-y-1.5">
                <h4 className="text-xs font-bold text-muted-foreground uppercase">작성 본문</h4>
                <div className="p-3.5 rounded-lg bg-muted/40 border text-sm whitespace-pre-wrap leading-relaxed font-sans">
                  {detail.input_text || "(내용 없음)"}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 2. AI 결과 */}
        <TabsContent value="result" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold">AI 평가 분석 결과</CardTitle>
                  <CardDescription className="text-xs">
                    정량적/정성적 점수와 결과 요약입니다.
                  </CardDescription>
                </div>
                {detail.ai_score != null && (
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground leading-none mb-1">AI 점수</p>
                    <p className="text-3xl font-extrabold text-primary tabular-nums">
                      {detail.ai_score.toFixed(0)}
                    </p>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {detail.ai_response_json ? (
                <ScrollArea className="h-[450px] w-full rounded-lg border bg-muted/20 p-4">
                  <pre className="text-xs font-mono whitespace-pre-wrap">
                    {formatJson(detail.ai_response_json)}
                  </pre>
                </ScrollArea>
              ) : (
                <div className="text-center py-10 text-muted-foreground text-sm">
                  {detail.status === "FAILED" ? "분석이 실패하여 결과가 존재하지 않습니다." : "결과 데이터가 존재하지 않습니다."}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 3. Prompt */}
        <TabsContent value="prompt" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">프롬프트 템플릿 및 실행 환경</CardTitle>
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
                      <span className="font-semibold">{detail.prompt_template.name}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">설정:</span>{" "}
                      <span className="font-semibold">
                        Temp {detail.prompt_template.temperature ?? "Default"} / MaxToken {detail.prompt_template.max_tokens ?? "Default"}
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
                    {detail.prompt_template?.system_prompt || "(시스템 프롬프트 없음 - 기본 내장값 사용)"}
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

        {/* 4. Response JSON */}
        <TabsContent value="response" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">AI API 원시 JSON 응답</CardTitle>
              <CardDescription className="text-xs">
                LLM 모델로부터 받아온 로우(Raw) 데이터 응답 구조입니다.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {detail.ai_response_json ? (
                <ScrollArea className="h-[450px] w-full rounded-lg border bg-muted/20 p-4">
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
