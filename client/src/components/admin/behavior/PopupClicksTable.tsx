import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { PopupClickRow } from "@/hooks/admin/useBehaviorData";

const num = (value: number) => value.toLocaleString("ko-KR");
const rate = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 1000) / 10}%` : "–");

/** 팝업마다 뜬 사람 중 버튼을 누른 비율. 출시 팝업과 관리자 공지 팝업을 같이 보여 준다. */
export function PopupClicksTable({ rows, periodLabel }: { rows: PopupClickRow[] | null; periodLabel: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">팝업 클릭률</CardTitle>
        <CardDescription className="text-xs">
          {periodLabel} · 사람 수(방문 탭 기준) · 클릭률 = 버튼 누름 ÷ 뜸 · 공지 팝업은 11-09부터 기록
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!rows ? (
          <Skeleton className="h-[120px] w-full" />
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">이 기간에 뜬 팝업이 없어요.</p>
        ) : (
          <div className="overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">팝업</TableHead>
                  <TableHead className="text-right text-xs">뜸</TableHead>
                  <TableHead className="text-right text-xs">버튼 누름</TableHead>
                  <TableHead className="text-right text-xs">클릭률</TableHead>
                  <TableHead className="text-right text-xs">닫음</TableHead>
                  <TableHead className="text-right text-xs">다시 안 보기</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.key}>
                    <TableCell className="text-xs font-medium">
                      {row.label}
                      {row.kind === "notice" && <span className="ml-1.5 text-muted-foreground">공지</span>}
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums">{num(row.shown)}</TableCell>
                    <TableCell className="text-right text-xs tabular-nums">{num(row.clicked)}</TableCell>
                    <TableCell className="text-right text-xs font-semibold tabular-nums">{rate(row.clicked, row.shown)}</TableCell>
                    <TableCell className="text-right text-xs tabular-nums text-muted-foreground">{num(row.closed)}</TableCell>
                    <TableCell className="text-right text-xs tabular-nums text-muted-foreground">{num(row.hidden)}</TableCell>
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
