import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { FeatureUsageRow } from "@/hooks/admin/useBehaviorData";

const num = (value: number) => value.toLocaleString("ko-KR");

/** 기능별 사용 횟수·사용자 수. 분석은 성공 건, 무료 기능은 요청 수(환불되면 빠짐). */
export function FeatureUsageTable({ rows, periodLabel, isLoading }: { rows: FeatureUsageRow[]; periodLabel: string; isLoading: boolean }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">기능별 사용량</CardTitle>
        <CardDescription className="text-xs">
          {periodLabel} · 분석은 성공한 것만 · 자동 채우기·초안·공고 불러오기는 요청 수(하루 경계가 오전 9시)
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading && rows.length === 0 ? (
          <Skeleton className="h-[200px] w-full" />
        ) : (
          <div className="overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">기능</TableHead>
                  <TableHead className="text-right text-xs">사용 횟수</TableHead>
                  <TableHead className="text-right text-xs">사용자</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.key}>
                    <TableCell className="text-xs font-medium">{row.label}</TableCell>
                    <TableCell className="text-right text-xs tabular-nums">{num(row.uses)}</TableCell>
                    <TableCell className="text-right text-xs tabular-nums">{num(row.users)}</TableCell>
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
