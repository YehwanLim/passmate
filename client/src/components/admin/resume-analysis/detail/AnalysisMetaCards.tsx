import { Link } from "wouter";
import { Calendar, Clock, Cpu, DollarSign, ExternalLink, Folder, User } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { AnalysisDetail } from "@/hooks/admin/useAnalysisDetail";
import { fmtCost, fmtMs, formatDate, type TokenTotals } from "@/pages/admin/resume-analysis/analysisDetailFormat";

/** 상세 상단 3열: 대상 정보 · AI 모델 & 인프라 · 자원 사용량 및 비용. */
export function AnalysisMetaCards({ detail, totals }: { detail: AnalysisDetail; totals: TokenTotals }) {
  return (
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
                {totals.prompt.toLocaleString("ko-KR")}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">완성 토큰</p>
              <p className="font-mono font-medium">
                {totals.completion.toLocaleString("ko-KR")}
              </p>
            </div>
          </div>

          <Separator className="my-1.5" />

          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">총 사용량</p>
              <p className="font-mono font-bold text-base text-foreground">
                {totals.total.toLocaleString("ko-KR")}{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  Tokens
                </span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">예상 비용 (USD)</p>
              <p className="font-mono font-bold text-base text-emerald-600 dark:text-emerald-500 inline-flex items-center">
                <DollarSign className="size-3.5 -mr-0.5" />
                {fmtCost(totals.cost).replace("$", "")}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
