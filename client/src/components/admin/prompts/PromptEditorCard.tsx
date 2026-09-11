import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { PromptTemplateRecord } from "@/lib/admin-prompts";
import {
  INTERPOLATION_HINT,
  formatDate,
  type PromptEditorForm,
  type PromptTypeMeta,
} from "@/pages/admin/prompts/promptDetailModel";

/** 프롬프트 에디터: 이름·시스템/유저 프롬프트·파라미터·메모 + Save Draft. */
export function PromptEditorCard({
  form,
  meta,
  activeRecord,
  canSave,
  isSaving,
  onChange,
  onSave,
}: {
  form: PromptEditorForm;
  meta: PromptTypeMeta;
  activeRecord: PromptTemplateRecord | null;
  canSave: boolean;
  isSaving: boolean;
  onChange: <K extends keyof PromptEditorForm>(field: K, value: PromptEditorForm[K]) => void;
  onSave: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Prompt Editor</CardTitle>
        <CardDescription>
          Draft 저장은 항상 새 비활성 버전을 생성합니다. Playground는 이번
          범위에서 제외했습니다.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="prompt-name">Name</Label>
            <Input
              id="prompt-name"
              value={form.name}
              onChange={event =>
                onChange("name", event.target.value)
              }
              placeholder={meta.emptyName}
            />
          </div>

          <div className="rounded-lg border bg-muted/30 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Current Live Version
            </p>
            <p className="mt-2 text-sm font-semibold text-foreground">
              {activeRecord?.version ?? "없음"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {activeRecord
                ? [
                    activeRecord.updatedBy,
                    formatDate(activeRecord.updatedAt),
                  ]
                    .filter(Boolean)
                    .join(" · ")
                : "아직 Active 버전이 없습니다."}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="system-prompt">System Prompt</Label>
          <p className="text-xs text-muted-foreground">
            {INTERPOLATION_HINT}
          </p>
          <Textarea
            id="system-prompt"
            value={form.systemPrompt}
            onChange={event =>
              onChange("systemPrompt", event.target.value)
            }
            className="min-h-[240px] font-mono text-sm"
            placeholder="System-level instructions for the selected prompt type"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="user-template">User Prompt Template</Label>
          <p className="text-xs text-muted-foreground">
            {INTERPOLATION_HINT}
          </p>
          <Textarea
            id="user-template"
            value={form.userTemplate}
            onChange={event =>
              onChange("userTemplate", event.target.value)
            }
            className="min-h-[240px] font-mono text-sm"
            placeholder="Prompt body that will receive user-facing interpolation values"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="prompt-temperature">Temperature</Label>
            <Input
              id="prompt-temperature"
              type="number"
              inputMode="decimal"
              step="0.1"
              value={form.temperature}
              onChange={event =>
                onChange("temperature", event.target.value)
              }
              placeholder="0.4"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="prompt-max-tokens">Max Tokens</Label>
            <Input
              id="prompt-max-tokens"
              type="number"
              inputMode="numeric"
              step="1"
              value={form.maxTokens}
              onChange={event =>
                onChange("maxTokens", event.target.value)
              }
              placeholder="1200"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="prompt-notes">Notes</Label>
          <Textarea
            id="prompt-notes"
            value={form.notes}
            onChange={event =>
              onChange("notes", event.target.value)
            }
            className="min-h-32"
            placeholder="운영 메모, 변경 이유, 검토 포인트 등을 남길 수 있습니다."
          />
        </div>
      </CardContent>

      <CardFooter className="flex flex-col items-start justify-between gap-3 border-t sm:flex-row sm:items-center">
        <p className="text-sm text-muted-foreground">
          Save Draft는 현재 Active를 바꾸지 않고 새 Draft만 추가합니다.
        </p>
        <Button onClick={onSave} disabled={!canSave}>
          {isSaving && <Loader2 className="size-4 animate-spin" />}
          Save Draft
        </Button>
      </CardFooter>
    </Card>
  );
}
