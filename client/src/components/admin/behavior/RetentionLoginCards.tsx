import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { BehaviorLogin, BehaviorRetention } from "@/hooks/admin/useBehaviorData";

const num = (value: number) => value.toLocaleString("ko-KR");
const rate = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 1000) / 10}%` : "–");

const LOGIN_EVENT_LABELS: Record<string, string> = {
  login_prompt_in_app: "앱 안 브라우저 안내가 뜸",
  google_button_unavailable: "Google 버튼을 못 띄움",
  google_signin_failed: "Google 로그인 실패",
  kakao_start_failed: "카카오 로그인 시작 실패",
};

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

export function RetentionLoginCards({
  retention,
  login,
  periodLabel,
}: {
  retention: BehaviorRetention | null;
  login: BehaviorLogin | null;
  periodLabel: string;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">다시 오나</CardTitle>
          <CardDescription className="text-xs">{periodLabel} · 서로 다른 날 이틀 이상 들어온 사람</CardDescription>
        </CardHeader>
        <CardContent>
          {!retention ? (
            <Skeleton className="h-[96px] w-full" />
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <Stat
                label="다시 온 방문자"
                value={rate(retention.returningVisitors, retention.visitors)}
                sub={`${num(retention.returningVisitors)} / ${num(retention.visitors)}명`}
              />
              <Stat
                label="다시 온 가입자"
                value={rate(retention.returningSignups, retention.signups)}
                sub={`기간 안 가입 ${num(retention.signups)}명 중 ${num(retention.returningSignups)}명`}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">로그인 막힘</CardTitle>
          <CardDescription className="text-xs">{periodLabel} · 카카오톡·인스타그램 같은 앱 안 브라우저는 Google 로그인이 막힘</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!login ? (
            <Skeleton className="h-[96px] w-full" />
          ) : (
            <>
              <Stat
                label="앱 안 브라우저로 들어온 방문자"
                value={rate(login.inAppVisitors, login.visitors)}
                sub={
                  login.inAppKinds.length > 0
                    ? login.inAppKinds.map((row) => `${row.kind} ${num(row.visitors)}`).join(" · ")
                    : `${num(login.inAppVisitors)}명`
                }
              />
              <ul className="space-y-1 text-xs">
                {Object.entries(login.events).map(([name, count]) => (
                  <li key={name} className="flex justify-between gap-2">
                    <span className="text-muted-foreground">{LOGIN_EVENT_LABELS[name] ?? name}</span>
                    <span className="tabular-nums">{num(count)}건</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
