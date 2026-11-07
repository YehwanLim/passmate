import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { BehaviorEngagedTime } from "@/hooks/admin/useBehaviorData";

const num = (value: number) => value.toLocaleString("ko-KR");

export function formatSeconds(seconds: number | null): string {
  if (seconds === null) return "–";
  if (seconds < 60) return `${seconds}초`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest > 0 ? `${minutes}분 ${rest}초` : `${minutes}분`;
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      <p className="text-[11px] text-muted-foreground">{sub}</p>
    </div>
  );
}

export function EngagedTimeCard({ data, periodLabel }: { data: BehaviorEngagedTime | null; periodLabel: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">얼마나 머무나</CardTitle>
        <CardDescription className="text-xs">
          {periodLabel} · 방문 1회(탭 하나)에서 화면을 실제로 보고 있던 시간
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!data ? (
          <Skeleton className="h-[96px] w-full" />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid grid-cols-2 gap-4">
              <Stat
                label="보통(중앙값)"
                value={formatSeconds(data.medianSeconds)}
                sub={`시간을 잰 방문 ${num(data.measured)} / 전체 ${num(data.visitors)}`}
              />
              <Stat label="평균" value={formatSeconds(data.averageSeconds)} sub="오래 머문 소수에 끌려 올라감" />
            </div>
            <ul className="space-y-1 text-xs">
              {data.buckets.map((bucket) => (
                <li key={bucket.label} className="flex justify-between gap-2">
                  <span className="text-muted-foreground">{bucket.label}</span>
                  <span className="tabular-nums">
                    {num(bucket.count)}회
                    {data.measured > 0 && (
                      <span className="ml-1.5 text-muted-foreground">
                        {Math.round((bucket.count / data.measured) * 100)}%
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
