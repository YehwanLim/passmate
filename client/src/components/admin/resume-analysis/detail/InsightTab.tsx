import { CheckCircle2 } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TabsContent } from "@/components/ui/tabs";
import type { AnalysisDetail } from "@/hooks/admin/useAnalysisDetail";
import { fmtCost, type InsightSummary, type TokenTotals } from "@/pages/admin/resume-analysis/analysisDetailFormat";

/** 2. 관리자용 운영 인사이트 */
export function InsightTab({
  detail,
  insight,
  totals,
}: {
  detail: AnalysisDetail;
  insight: InsightSummary;
  totals: TokenTotals;
}) {
  return (
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
            <p className="text-2xl font-bold">{fmtCost(totals.cost)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {totals.total.toLocaleString("ko-KR")} tokens
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
  );
}
