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
import type { LoginHealth, SourceSummaryRow } from "@/hooks/admin/useDashboardData";

interface TrafficSourcesTableProps {
  data: SourceSummaryRow[];
  days: number;
  isLoading: boolean;
  /** 아직 응답이 없으면 null. 표 아래 한 줄로만 보여 준다. */
  loginHealth: LoginHealth | null;
}

/**
 * 유입원별 고유 방문자. 서버(lib/admin-handlers/dashboard.js summarizeSources)가 utm_source 를 우선,
 * 없으면 referrer 호스트로 묶어 준다. 스레드·블로그 링크에 붙인 utm_source 가 여기 그대로 보인다.
 */
export function TrafficSourcesTable({ data, days, isLoading, loginHealth }: TrafficSourcesTableProps) {
  const googleErrors = loginHealth
    ? loginHealth.events.google_button_unavailable + loginHealth.events.google_signin_failed
    : 0;
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
        {!isLoading && loginHealth && (
          // 인앱 브라우저(카카오톡·인스타그램 등)는 Google 로그인이 막힌다. 그 상태로 로그인 화면까지 온 사람 수와 오류 건수.
          <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
            인앱 브라우저 방문자 {loginHealth.inAppVisitors.toLocaleString("ko-KR")}명 · 로그인 화면 노출{" "}
            {loginHealth.events.login_prompt_in_app.toLocaleString("ko-KR")} · Google 오류 {googleErrors.toLocaleString("ko-KR")} · 카카오 오류{" "}
            {loginHealth.events.kakao_start_failed.toLocaleString("ko-KR")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
