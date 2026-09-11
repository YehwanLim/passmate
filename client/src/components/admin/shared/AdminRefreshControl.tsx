import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function formatRefreshLabel(date: Date): string {
  return `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")} 갱신`;
}

/** "HH:MM 갱신" 표시 + 새로고침 버튼. 헤더의 actions 슬롯 안 flex 행에 넣는다. */
export function AdminRefreshControl({
  lastRefreshed,
  isLoading,
  onRefresh,
  id,
  buttonClassName,
}: {
  lastRefreshed: Date | null;
  isLoading: boolean;
  onRefresh: () => void;
  id?: string;
  buttonClassName?: string;
}) {
  return (
    <>
      {lastRefreshed && (
        <span className="text-xs text-muted-foreground hidden sm:block">
          {formatRefreshLabel(lastRefreshed)}
        </span>
      )}
      <Button
        variant="outline"
        size="sm"
        onClick={onRefresh}
        disabled={isLoading}
        className={cn("gap-1.5", buttonClassName)}
        id={id}
      >
        <RefreshCw className={cn("size-3.5", isLoading && "animate-spin")} />
        새로고침
      </Button>
    </>
  );
}
