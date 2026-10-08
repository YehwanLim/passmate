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
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  AiCostChartPoint,
  ChartPoint,
  PaymentChartPoint,
  VisitorChartPoint,
} from "@/hooks/admin/useDashboardData";
import { estimateRevenue, formatKrw } from "@/lib/pricing";

interface DailyStatsTableProps {
  visitorChart: VisitorChartPoint[];
  signupChart: ChartPoint[];
  analysisChart: ChartPoint[];
  paymentChart: PaymentChartPoint[];
  aiCostChart: AiCostChartPoint[];
  /** 표 머리에 붙일 기간 버튼 */
  actions?: React.ReactNode;
  periodLabel: string;
  monthly: boolean;
  isLoading: boolean;
}

export interface DailyStatsRow {
  date: string;
  visitors: number;
  pageViews: number;
  signups: number;
  analyses: number;
  payments: number;
  revenue: number;
  aiCost: number;
}

/** 다섯 시계열은 같은 칸(날짜·월) 목록을 공유하므로 칸으로 합쳐 최신순으로 늘어놓는다. */
export function buildDailyStatsRows(
  visitorChart: VisitorChartPoint[],
  signupChart: ChartPoint[],
  analysisChart: ChartPoint[],
  paymentChart: PaymentChartPoint[] = [],
  aiCostChart: AiCostChartPoint[] = [],
): DailyStatsRow[] {
  const signups = new Map(signupChart.map((point) => [point.date, point.count]));
  const analyses = new Map(analysisChart.map((point) => [point.date, point.count]));
  const payments = new Map(paymentChart.map((point) => [point.date, point]));
  const costs = new Map(aiCostChart.map((point) => [point.date, point.cost]));
  return visitorChart
    .map((point) => {
      const payment = payments.get(point.date);
      return {
        date: point.date,
        visitors: point.visitors,
        pageViews: point.pageViews,
        signups: signups.get(point.date) ?? 0,
        analyses: analyses.get(point.date) ?? 0,
        payments: payment?.count ?? 0,
        revenue: payment ? estimateRevenue(payment.byProduct) : 0,
        aiCost: costs.get(point.date) ?? 0,
      };
    })
    .reverse();
}

/** 합계 행. 방문자는 칸별 고유 방문자의 단순 합이라 기간 전체의 고유 방문자보다 클 수 있다. */
export function sumDailyStatsRows(rows: DailyStatsRow[]): Omit<DailyStatsRow, "date"> {
  return rows.reduce(
    (total, row) => ({
      visitors: total.visitors + row.visitors,
      pageViews: total.pageViews + row.pageViews,
      signups: total.signups + row.signups,
      analyses: total.analyses + row.analyses,
      payments: total.payments + row.payments,
      revenue: total.revenue + row.revenue,
      aiCost: total.aiCost + row.aiCost,
    }),
    { visitors: 0, pageViews: 0, signups: 0, analyses: 0, payments: 0, revenue: 0, aiCost: 0 },
  );
}

const num = (value: number) => value.toLocaleString("ko-KR");
const usd = (value: number) => `$${value.toFixed(2)}`;

/**
 * DailyStatsTable
 *
 * 홈의 기간별 표. 기간 버튼(최근 7일·지난주·최근 30일·월별)을 따라 칸이 하루 또는 한 달이 된다.
 */
export function DailyStatsTable({
  visitorChart,
  signupChart,
  analysisChart,
  paymentChart,
  aiCostChart,
  actions,
  periodLabel,
  monthly,
  isLoading,
}: DailyStatsTableProps) {
  const rows = useMemo(
    () => buildDailyStatsRows(visitorChart, signupChart, analysisChart, paymentChart, aiCostChart),
    [visitorChart, signupChart, analysisChart, paymentChart, aiCostChart],
  );
  const total = useMemo(() => sumDailyStatsRows(rows), [rows]);

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 pb-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="text-sm font-semibold">{monthly ? "월별 집계" : "일별 집계"}</CardTitle>
          <CardDescription className="text-xs">
            {periodLabel} · 최신순 · 매출은 현재 판매가로 계산한 추정치
          </CardDescription>
        </div>
        {actions}
      </CardHeader>
      <CardContent>
        {isLoading && rows.length === 0 ? (
          <Skeleton className="h-[220px] w-full" />
        ) : (
          <div className="max-h-[480px] overflow-auto rounded-md border">
            <Table>
              <TableHeader className="sticky top-0 bg-card">
                <TableRow>
                  <TableHead className="text-xs">{monthly ? "월" : "날짜"}</TableHead>
                  <TableHead className="text-right text-xs">방문자</TableHead>
                  <TableHead className="text-right text-xs">페이지뷰</TableHead>
                  <TableHead className="text-right text-xs">가입</TableHead>
                  <TableHead className="text-right text-xs">분석</TableHead>
                  <TableHead className="text-right text-xs">결제</TableHead>
                  <TableHead className="text-right text-xs">추정 매출</TableHead>
                  <TableHead className="text-right text-xs">AI 비용</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.date}>
                    <TableCell className="text-xs tabular-nums">{row.date}</TableCell>
                    <TableCell className="text-right text-xs tabular-nums">{num(row.visitors)}</TableCell>
                    <TableCell className="text-right text-xs tabular-nums text-muted-foreground">{num(row.pageViews)}</TableCell>
                    <TableCell className="text-right text-xs tabular-nums">{num(row.signups)}</TableCell>
                    <TableCell className="text-right text-xs tabular-nums">{num(row.analyses)}</TableCell>
                    <TableCell className="text-right text-xs tabular-nums">{num(row.payments)}</TableCell>
                    <TableCell className="text-right text-xs tabular-nums">{formatKrw(row.revenue)}</TableCell>
                    <TableCell className="text-right text-xs tabular-nums text-muted-foreground">{usd(row.aiCost)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter className="sticky bottom-0 bg-muted">
                <TableRow>
                  <TableCell className="text-xs font-semibold">합계</TableCell>
                  <TableCell className="text-right text-xs font-semibold tabular-nums">
                    {num(total.visitors)}
                    <span className="block text-[10px] font-normal text-muted-foreground">칸별 합</span>
                  </TableCell>
                  <TableCell className="text-right text-xs tabular-nums text-muted-foreground">{num(total.pageViews)}</TableCell>
                  <TableCell className="text-right text-xs font-semibold tabular-nums">{num(total.signups)}</TableCell>
                  <TableCell className="text-right text-xs font-semibold tabular-nums">{num(total.analyses)}</TableCell>
                  <TableCell className="text-right text-xs font-semibold tabular-nums">{num(total.payments)}</TableCell>
                  <TableCell className="text-right text-xs font-semibold tabular-nums">{formatKrw(total.revenue)}</TableCell>
                  <TableCell className="text-right text-xs tabular-nums text-muted-foreground">{usd(total.aiCost)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
