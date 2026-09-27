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
import type { SourceSummaryRow } from "@/hooks/admin/useDashboardData";

interface TrafficSourcesTableProps {
  data: SourceSummaryRow[];
  days: number;
  isLoading: boolean;
}

/**
 * 유입원별 고유 방문자. 서버(lib/admin-handlers/dashboard.js summarizeSources)가 utm_source 를 우선,
 * 없으면 referrer 호스트로 묶어 준다. 스레드·블로그 링크에 붙인 utm_source 가 여기 그대로 보인다.
 */
export function TrafficSourcesTable({ data, days, isLoading }: TrafficSourcesTableProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">유입원</CardTitle>
        <CardDescription className="text-xs">
          최근 {days}일 · 고유 방문자 · utm_source 우선, 없으면 referrer 호스트
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[160px] w-full" />
        ) : data.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">기간 안에 방문이 없습니다.</p>
        ) : (
          <div className="max-h-[360px] overflow-auto rounded-md border">
            <Table>
              <TableHeader className="sticky top-0 bg-card">
                <TableRow>
                  <TableHead className="text-xs">유입원</TableHead>
                  <TableHead className="text-right text-xs">방문자</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((row) => (
                  <TableRow key={row.source}>
                    <TableCell className="text-xs">{row.source}</TableCell>
                    <TableCell className="text-right text-xs tabular-nums">{row.visitors.toLocaleString("ko-KR")}</TableCell>
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
