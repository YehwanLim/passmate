import { useMemo } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ChartPoint, VisitorChartPoint } from "@/hooks/admin/useDashboardData";

interface DailyStatsTableProps {
  visitorChart: VisitorChartPoint[];
  signupChart: ChartPoint[];
  analysisChart: ChartPoint[];
  days: number;
  isLoading: boolean;
}

export interface DailyStatsRow {
  date: string;
  visitors: number;
  pageViews: number;
  signups: number;
  analyses: number;
}

/** 세 차트는 같은 날짜 라벨 목록을 공유하므로 날짜로 합쳐 최신순으로 늘어놓는다. */
export function buildDailyStatsRows(
  visitorChart: VisitorChartPoint[],
  signupChart: ChartPoint[],
  analysisChart: ChartPoint[],
): DailyStatsRow[] {
  const signups = new Map(signupChart.map((point) => [point.date, point.count]));
  const analyses = new Map(analysisChart.map((point) => [point.date, point.count]));
  return visitorChart
    .map((point) => ({
      date: point.date,
      visitors: point.visitors,
      pageViews: point.pageViews,
      signups: signups.get(point.date) ?? 0,
      analyses: analyses.get(point.date) ?? 0,
    }))
    .reverse();
}

/**
 * DailyStatsTable
 *
 * 차트가 놓치는 정확한 숫자를 날짜별로 보여준다. 기간 선택(7·30·90일)을 따라간다.
 */
export function DailyStatsTable({ visitorChart, signupChart, analysisChart, days, isLoading }: DailyStatsTableProps) {
  const rows = useMemo(
    () => buildDailyStatsRows(visitorChart, signupChart, analysisChart),
    [visitorChart, signupChart, analysisChart],
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">일별 집계</CardTitle>
        <CardDescription className="text-xs">최근 {days}일 · 최신순</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[220px] w-full" />
        ) : (
          <div className="max-h-[360px] overflow-auto rounded-md border">
            <Table>
              <TableHeader className="sticky top-0 bg-card">
                <TableRow>
                  <TableHead className="text-xs">날짜</TableHead>
                  <TableHead className="text-right text-xs">방문자</TableHead>
                  <TableHead className="text-right text-xs">페이지뷰</TableHead>
                  <TableHead className="text-right text-xs">가입</TableHead>
                  <TableHead className="text-right text-xs">분석</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.date}>
                    <TableCell className="text-xs tabular-nums">{row.date}</TableCell>
                    <TableCell className="text-right text-xs tabular-nums">{row.visitors.toLocaleString("ko-KR")}</TableCell>
                    <TableCell className="text-right text-xs tabular-nums text-muted-foreground">{row.pageViews.toLocaleString("ko-KR")}</TableCell>
                    <TableCell className="text-right text-xs tabular-nums">{row.signups.toLocaleString("ko-KR")}</TableCell>
                    <TableCell className="text-right text-xs tabular-nums">{row.analyses.toLocaleString("ko-KR")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
