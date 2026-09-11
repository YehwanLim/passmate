import { Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { PromptTemplateRecord } from "@/lib/admin-prompts";
import { cn } from "@/lib/utils";
import { formatDate } from "@/pages/admin/prompts/promptDetailModel";

/** 버전 이력: Activate(운영 전환)·Rollback(에디터로 복사). */
export function VersionHistoryCard({
  records,
  rollbackRecordId,
  activatingId,
  isSaving,
  onActivate,
  onRollback,
}: {
  records: PromptTemplateRecord[];
  rollbackRecordId: string | null;
  activatingId: string | null;
  isSaving: boolean;
  onActivate: (record: PromptTemplateRecord) => void;
  onRollback: (record: PromptTemplateRecord) => void;
}) {
  return (
    <Card className="h-fit">
      <CardHeader>
        <CardTitle>Version History</CardTitle>
        <CardDescription>
          Activate는 운영 버전을 전환하고, Rollback은 선택한 버전을 에디터로
          복사합니다.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {records.length === 0 ? (
          <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
            아직 기록된 버전이 없습니다.
          </div>
        ) : (
          records.map(record => {
            const isRollbackSource = rollbackRecordId === record.id;
            const isActivating = activatingId === record.id;

            return (
              <div key={record.id} className="rounded-xl border p-4">
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-foreground">
                          {record.version}
                        </p>
                        <Badge
                          variant="outline"
                          className={cn(
                            record.isActive
                              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700"
                              : "border-amber-500/20 bg-amber-500/10 text-amber-700"
                          )}
                        >
                          {record.isActive ? "Active" : "Draft"}
                        </Badge>
                        {isRollbackSource && (
                          <Badge variant="outline">Rollback Source</Badge>
                        )}
                      </div>
                      <p className="mt-1 truncate text-sm font-medium text-foreground">
                        {record.name}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {formatDate(record.updatedAt)}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {!record.isActive && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onActivate(record)}
                          disabled={Boolean(activatingId) || isSaving}
                        >
                          {isActivating && (
                            <Loader2 className="size-4 animate-spin" />
                          )}
                          Activate
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onRollback(record)}
                        disabled={isSaving}
                      >
                        Rollback
                      </Button>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg bg-muted/30 p-3">
                      <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                        Updated By
                      </p>
                      <p className="mt-2 text-sm font-medium text-foreground">
                        {record.updatedBy ?? "미설정"}
                      </p>
                    </div>

                    <div className="rounded-lg bg-muted/30 p-3">
                      <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                        Tokens / Temp
                      </p>
                      <p className="mt-2 text-sm font-medium text-foreground">
                        {record.maxTokens ?? "Default"} /{" "}
                        {record.temperature ?? "Default"}
                      </p>
                    </div>
                  </div>

                  {(record.description || record.notes) && (
                    <div className="rounded-lg border bg-background p-3 text-sm text-muted-foreground">
                      {record.notes ?? record.description}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
