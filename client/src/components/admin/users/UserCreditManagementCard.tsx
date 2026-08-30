import { useCallback, useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Coins } from "lucide-react";
import {
  fetchUserCredits,
  grantUserCredits,
  type AdminCreditGrantRecord,
  type UserCreditSummary,
} from "@/lib/admin-credits";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("ko-KR", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

export function UserCreditManagementCard({ userId }: { userId: string }) {
  const [summary, setSummary] = useState<UserCreditSummary | null>(null);
  const [grants, setGrants] = useState<AdminCreditGrantRecord[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [credits, setCredits] = useState("3");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await fetchUserCredits(userId);
      setSummary(data.summary);
      setGrants(data.grants);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "크레딧 정보를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleGrant = async () => {
    const amount = Number(credits);
    if (!Number.isInteger(amount) || amount < 1 || amount > 10000) {
      setSubmitError("지급 횟수는 1~10,000 사이의 정수여야 합니다.");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    setSubmitted(false);
    try {
      await grantUserCredits({ userId, credits: amount, note });
      setSubmitted(true);
      setNote("");
      await load();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "크레딧 지급에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Coins className="size-4" />
            분석 크레딧 관리
          </CardTitle>
          {summary && (
            <Badge variant="outline" className="text-[10px]">
              잔여 {summary.remaining}회
            </Badge>
          )}
        </div>
        <CardDescription className="text-xs">
          보너스 크레딧은 판매 상태와 무관하게 바로 사용할 수 있습니다 (베타 테스터·제휴 지급용).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <Skeleton className="h-16 w-full" />
        ) : loadError ? (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription>{loadError}</AlertDescription>
          </Alert>
        ) : summary ? (
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-md border p-2">
              <p className="text-lg font-semibold">{summary.freeRemaining}</p>
              <p className="text-xs text-muted-foreground">무료 잔여</p>
            </div>
            <div className="rounded-md border p-2">
              <p className="text-lg font-semibold">{summary.bonusRemaining}</p>
              <p className="text-xs text-muted-foreground">보너스 잔여</p>
            </div>
            <div className="rounded-md border p-2">
              <p className="text-lg font-semibold">{summary.premiumRemaining}</p>
              <p className="text-xs text-muted-foreground">
                프리미엄 잔여{summary.premiumEnabled ? "" : " (판매 OFF)"}
              </p>
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap items-end gap-2">
          <div className="w-24">
            <label className="mb-1 block text-xs text-muted-foreground" htmlFor="admin-credit-amount">
              지급 횟수
            </label>
            <Input
              id="admin-credit-amount"
              inputMode="numeric"
              value={credits}
              onChange={(event) => setCredits(event.target.value)}
              disabled={submitting}
            />
          </div>
          <div className="min-w-40 flex-1">
            <label className="mb-1 block text-xs text-muted-foreground" htmlFor="admin-credit-note">
              메모 (선택)
            </label>
            <Input
              id="admin-credit-note"
              placeholder="예: 베타 테스터 지급"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              disabled={submitting}
            />
          </div>
          <Button onClick={() => void handleGrant()} disabled={submitting || loading}>
            {submitting ? "지급 중.." : "크레딧 지급"}
          </Button>
        </div>
        {submitError && (
          <p className="text-xs text-destructive">{submitError}</p>
        )}
        {submitted && !submitError && (
          <p className="text-xs text-emerald-600">지급이 완료되었습니다.</p>
        )}

        {grants.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">지급 이력</p>
            <ul className="space-y-1">
              {grants.slice(0, 10).map((grant) => (
                <li key={grant.id} className="flex items-baseline justify-between gap-2 text-xs">
                  <span>
                    +{grant.credits_granted}회
                    {grant.note ? ` · ${grant.note}` : ""}
                  </span>
                  <span className="shrink-0 text-muted-foreground">
                    {formatDateTime(grant.created_at)} · {grant.granted_by_email}
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
