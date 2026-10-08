import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { BehaviorSourceRow } from "@/hooks/admin/useBehaviorData";

const num = (value: number) => value.toLocaleString("ko-KR");
const rate = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 1000) / 10}%` : "–");

/** 유입원별 방문자와, 그중 작성을 시작한 사람·기간 안에 가입한 사람. */
export function SourcesTable({ rows, periodLabel, isLoading }: { rows: BehaviorSourceRow[]; periodLabel: string; isLoading: boolean }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">어디서 왔나</CardTitle>
        <CardDescription className="text-xs">
          {periodLabel} · 고유 방문자 · utm_source 우선, 없으면 referrer 호스트 · 가입은 같은 브라우저에서 로그인한 경우만 이어 붙음
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading && rows.length === 0 ? (
          <Skeleton className="h-[160px] w-full" />
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">기간 안에 방문이 없습니다.</p>
        ) : (
          <div className="max-h-[420px] overflow-auto rounded-md border">
            <Table>
              <TableHeader className="sticky top-0 bg-card">
                <TableRow>
                  <TableHead className="text-xs">유입원</TableHead>
                  <TableHead className="text-right text-xs">방문자</TableHead>
                  <TableHead className="text-right text-xs">작성 시작</TableHead>
                  <TableHead className="text-right text-xs">가입</TableHead>
                  <TableHead className="text-right text-xs">가입 전환</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.source}>
                    <TableCell className="text-xs">{row.source}</TableCell>
                    <TableCell className="text-right text-xs tabular-nums">{num(row.visitors)}</TableCell>
                    <TableCell className="text-right text-xs tabular-nums">{num(row.formStarts)}</TableCell>
                    <TableCell className="text-right text-xs tabular-nums">{num(row.signups)}</TableCell>
                    <TableCell className="text-right text-xs tabular-nums text-muted-foreground">{rate(row.signups, row.visitors)}</TableCell>
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
