import { CheckCircle2, Eye, ListChecks, MessageSquare, Target, Zap } from "lucide-react";

import { AnalysisStatusBadge } from "@/components/admin/resume-analysis/AnalysisStatusBadge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TabsContent } from "@/components/ui/tabs";
import type { AnalysisDetail } from "@/hooks/admin/useAnalysisDetail";
import {
  diagnosisTextList,
  stringList,
  textValue,
  toReportObject,
  type ReportObject,
} from "@/pages/admin/resume-analysis/analysisDetailFormat";

/** 1. 사용자가 실제로 받는 리포트 형태 */
export function PreviewTab({ detail, report }: { detail: AnalysisDetail; report: ReportObject | null }) {
  const companyInsight = toReportObject(report?.companyInsight);
  const firstImpression = toReportObject(report?.firstImpression);
  const questionTabs = Array.isArray(report?.questionTabs)
    ? report.questionTabs
    : [];
  const actionPlan = Array.isArray(report?.actionPlan) ? report.actionPlan : [];
  const interviewQA = Array.isArray(report?.interviewQA) ? report.interviewQA : [];

  return (
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
                {diagnosisTextList(report?.strengths).length > 0 ? (
                  diagnosisTextList(report?.strengths).map(item => (
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
                {diagnosisTextList(report?.gaps).length > 0 ? (
                  diagnosisTextList(report?.gaps).map(item => (
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
  );
}
