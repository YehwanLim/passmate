import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { FunnelStep } from "@/hooks/admin/useBehaviorData";

export interface FunnelRow extends FunnelStep {
  /** 앞 단계 대비 남은 비율(0~100). 첫 단계나 앞 단계가 0 이면 null. */
  keptRate: number | null;
  /** 앞 단계보다 줄어든 인원(늘었으면 0). */
  dropped: number;
}

export function buildFunnelRows(steps: FunnelStep[]): FunnelRow[] {
  return steps.map((step, index) => {
    const previous = index > 0 ? steps[index - 1].count : null;
    return {
      ...step,
      keptRate: previous ? Math.round((step.count / previous) * 1000) / 10 : null,
      dropped: previous != null ? Math.max(previous - step.count, 0) : 0,
    };
  });
}

/** 가장 많이 떠난(비율 기준) 단계. 앞 단계가 0 인 곳은 제외. */
export function biggestDrop(rows: FunnelRow[]): FunnelRow | null {
  return rows.reduce<FunnelRow | null>((worst, row) => {
    if (row.keptRate == null || row.dropped === 0) return worst;
    return worst == null || row.keptRate < (worst.keptRate ?? 100) ? row : worst;
  }, null);
}

const num = (value: number | null) => (value == null ? "–" : value.toLocaleString("ko-KR"));

/** 단계를 따로 세므로 뒤 단계가 더 클 수 있다(폼을 거치지 않고 가입 등). 그때는 비율 대신 "늘어남". */
export function keptLabel(keptRate: number | null): string {
  if (keptRate == null) return "–";
  return keptRate > 100 ? "늘어남" : `${keptRate}%`;
}

export function FunnelTable({ steps, periodLabel, isLoading }: { steps: FunnelStep[]; periodLabel: string; isLoading: boolean }) {
  const rows = buildFunnelRows(steps);
  const worst = biggestDrop(rows);
  const previousLabel = (row: FunnelRow) => rows[rows.indexOf(row) - 1]?.label;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">단계별 이탈</CardTitle>
        <CardDescription className="text-xs">
          {periodLabel} · 단계마다 따로 센 고유 인원(앞 단계를 거쳤는지 따지지 않음) · 방문·폼 열람은 방문자, 가입부터는 계정 기준
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {worst && (
          <p className="text-sm">
            가장 많이 빠지는 곳: <strong>{previousLabel(worst)} → {worst.label}</strong>{" "}
            <span className="text-muted-foreground">({worst.keptRate}%만 남고 {num(worst.dropped)}명이 떠남)</span>
          </p>
        )}
        {isLoading && rows.length === 0 ? (
          <Skeleton className="h-[260px] w-full" />
        ) : (
          <div className="overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">단계</TableHead>
                  <TableHead className="text-right text-xs">인원</TableHead>
                  <TableHead className="text-right text-xs">앞 단계 대비</TableHead>
                  <TableHead className="text-right text-xs">떠난 사람</TableHead>
                  <TableHead className="text-right text-xs">폰</TableHead>
                  <TableHead className="text-right text-xs">PC</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.key} className={row === worst ? "bg-destructive/5" : undefined}>
                    <TableCell className="text-xs font-medium">{row.label}</TableCell>
                    <TableCell className="text-right text-xs tabular-nums">{num(row.count)}</TableCell>
                    <TableCell className="text-right text-xs tabular-nums">{keptLabel(row.keptRate)}</TableCell>
                    <TableCell className="text-right text-xs tabular-nums text-muted-foreground">{row.dropped ? num(row.dropped) : "–"}</TableCell>
                    <TableCell className="text-right text-xs tabular-nums text-muted-foreground">{num(row.mobile)}</TableCell>
                    <TableCell className="text-right text-xs tabular-nums text-muted-foreground">{num(row.desktop)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <p className="text-[11px] text-muted-foreground">폰·PC 는 기기를 기록하는 단계(작성 시작·제출 클릭)에만 있습니다.</p>
      </CardContent>
    </Card>
  );
}
