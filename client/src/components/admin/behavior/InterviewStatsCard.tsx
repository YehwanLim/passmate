import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { BehaviorInterviews } from "@/hooks/admin/useBehaviorData";
import { formatSeconds } from "./EngagedTimeCard";

const num = (value: number) => value.toLocaleString("ko-KR");
const rate = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : "–");

/** AI 모의 면접을 실제로 얼마나 봤는지 — 시작 누름부터 피드백까지. 운영자 면접은 서버가 뺀다. */
export function InterviewStatsCard({ data, periodLabel }: { data: BehaviorInterviews | null; periodLabel: string }) {
  const first = data?.steps[0]?.sessions ?? 0;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">AI 모의 면접</CardTitle>
        <CardDescription className="text-xs">
          {periodLabel}에 시작한 면접 · 답변 수는 받아쓰기 기준 · 환불된 면접은 '이용권 쓰고 끝냄'에서 빠짐
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!data ? (
          <Skeleton className="h-[200px] w-full" />
        ) : (
          <>
            <div className="overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">단계</TableHead>
                    <TableHead className="text-right text-xs">면접 수</TableHead>
                    <TableHead className="text-right text-xs">사람 수</TableHead>
                    <TableHead className="text-right text-xs">시작 대비</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.steps.map((row) => (
                    <TableRow key={row.key}>
                      <TableCell className="text-xs font-medium">{row.label}</TableCell>
                      <TableCell className="text-right text-xs tabular-nums">{num(row.sessions)}</TableCell>
                      <TableCell className="text-right text-xs tabular-nums">{num(row.users)}</TableCell>
                      <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
                        {rate(row.sessions, first)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <p className="text-xs text-muted-foreground">
              진행 시간 중앙값 {formatSeconds(data.medianSeconds)} · 중간에 끊김 {num(data.interrupted)} · 환불{" "}
              {num(data.refunded)} · 그중 짧은 연습(5분) {num(data.shortMode)}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
