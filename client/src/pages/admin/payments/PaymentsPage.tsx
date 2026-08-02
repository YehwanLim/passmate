import { useCallback, useEffect, useState } from "react";
import { AlertCircle, CreditCard } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/shared/AdminPageHeader";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  fetchPremiumSalesSettings,
  type PremiumSalesSettings,
  updatePremiumSalesEnabled,
} from "@/lib/admin-entitlements";

function errorMessage(cause: unknown, fallback: string) {
  return cause instanceof Error && cause.message ? cause.message : fallback;
}

export default function PaymentsPage() {
  const [settings, setSettings] = useState<PremiumSalesSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmDisableOpen, setConfirmDisableOpen] = useState(false);

  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      setSettings(await fetchPremiumSalesSettings());
    } catch (cause) {
      setError(errorMessage(cause, "결제 판매 상태를 불러오지 못했습니다."));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const saveSalesState = async (premiumEnabled: boolean) => {
    setIsSaving(true);
    setError(null);

    try {
      setSettings(await updatePremiumSalesEnabled(premiumEnabled));
    } catch (cause) {
      setError(errorMessage(cause, "결제 판매 상태를 변경하지 못했습니다."));
    } finally {
      setIsSaving(false);
    }
  };

  const handleSalesChange = (premiumEnabled: boolean) => {
    if (premiumEnabled) {
      void saveSalesState(true);
      return;
    }

    setConfirmDisableOpen(true);
  };

  const confirmDisableSales = () => {
    setConfirmDisableOpen(false);
    void saveSalesState(false);
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Payments"
        description="프리미엄 이용권 판매 상태를 관리합니다."
      />

      {error && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>결제 판매 상태를 확인하지 못했습니다.</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-4">
            <span>{error}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void loadSettings()}
              disabled={isLoading || isSaving}
            >
              다시 시도
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard className="size-4" />
            프리미엄 이용권 판매
          </CardTitle>
          <CardDescription>
            신규 Groble 결제 시작 여부를 서버 설정으로 제어합니다.
          </CardDescription>
          {settings && (
            <CardAction>
              <Badge variant={settings.premiumEnabled ? "default" : "secondary"}>
                {settings.premiumEnabled ? "판매 중" : "판매 중지"}
              </Badge>
            </CardAction>
          )}
        </CardHeader>
        <CardContent>
          {isLoading && <Skeleton className="h-20 w-full" />}

          {!isLoading && settings && (
            <div className="flex items-center justify-between gap-6 rounded-lg border p-4">
              <div className="space-y-1">
                <p className="text-sm font-medium">신규 프리미엄 결제 판매</p>
                <p className="text-xs text-muted-foreground">
                  판매를 중지하면 새 결제만 차단됩니다. 이미 지급된 이용권은 유지됩니다.
                </p>
              </div>
              <Switch
                id="premium-sales-toggle"
                aria-label="프리미엄 결제 판매"
                checked={settings.premiumEnabled}
                disabled={isSaving}
                onCheckedChange={handleSalesChange}
              />
            </div>
          )}

          {!isLoading && !settings && (
            <p className="text-sm text-muted-foreground">
              판매 상태를 불러온 뒤 변경할 수 있습니다.
            </p>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={confirmDisableOpen} onOpenChange={setConfirmDisableOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>결제 판매를 중지할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              중지 후에는 새 프리미엄 결제를 시작할 수 없습니다. 이미 지급된 이용권과
              진행 중인 정상 결제 웹훅은 영향을 받지 않습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDisableSales}>
              판매 중지
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
