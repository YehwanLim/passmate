import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TabsContent } from "@/components/ui/tabs";
import type { AnalysisDetail } from "@/hooks/admin/useAnalysisDetail";
import { formatJson } from "@/pages/admin/resume-analysis/analysisDetailFormat";

/** 5. Raw JSON */
export function RawTab({ detail }: { detail: AnalysisDetail }) {
  return (
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
  );
}
