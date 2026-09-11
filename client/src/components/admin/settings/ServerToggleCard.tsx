import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";

/** 서버에 즉시 반영되는 스위치 카드. 상태 문구·설명만 다르고 모양은 같다. */
export function ServerToggleCard({
  title,
  description,
  statusLabel,
  enabled,
  busy,
  error,
  onToggle,
}: {
  title: string;
  description: string;
  statusLabel: string;
  enabled: boolean | null;
  busy: boolean;
  error: string | null;
  onToggle: (checked: boolean) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        <CardDescription className="text-xs">{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between p-3.5 border rounded-lg">
          <div className="space-y-0.5">
            <span className="text-sm font-semibold">{statusLabel}</span>
            {error ? <p className="text-xs text-destructive">{error}</p> : null}
          </div>
          <Switch
            checked={enabled === true}
            disabled={enabled === null || busy}
            onCheckedChange={onToggle}
          />
        </div>
      </CardContent>
    </Card>
  );
}
