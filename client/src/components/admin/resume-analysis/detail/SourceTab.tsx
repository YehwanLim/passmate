import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TabsContent } from "@/components/ui/tabs";
import type { AnalysisDetail } from "@/hooks/admin/useAnalysisDetail";
import { stringList, textValue, toReportObject, type ReportObject } from "@/pages/admin/resume-analysis/analysisDetailFormat";

/** 3. 원본 자소서 + 렌더링 피드백 */
export function SourceTab({ detail, report }: { detail: AnalysisDetail; report: ReportObject | null }) {
  const firstImpression = toReportObject(report?.firstImpression);

  return (
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
  );
}
