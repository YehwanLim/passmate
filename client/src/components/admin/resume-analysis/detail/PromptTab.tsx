import { Code, FileText } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TabsContent } from "@/components/ui/tabs";
import type { AnalysisDetail } from "@/hooks/admin/useAnalysisDetail";

/** 4. Prompt */
export function PromptTab({ detail }: { detail: AnalysisDetail }) {
  return (
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
  );
}
