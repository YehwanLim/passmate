import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  History,
  Loader2,
  RotateCcw,
} from "lucide-react";
import { Link, useLocation } from "wouter";

import { AdminPageHeader } from "@/components/admin/shared/AdminPageHeader";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { usePrompts } from "@/hooks/admin/usePrompts";
import {
  PROMPT_TYPES,
  type PromptTemplateRecord,
  type PromptType,
} from "@/lib/admin-prompts";
import { cn } from "@/lib/utils";

interface PromptEditorForm {
  name: string;
  systemPrompt: string;
  userTemplate: string;
  temperature: string;
  maxTokens: string;
  notes: string;
}

const PROMPT_TYPE_META: Record<
  PromptType,
  {
    label: string;
    description: string;
    emptyName: string;
  }
> = {
  "resume-analysis": {
    label: "Resume Analysis",
    description: "이력서 분석용 핵심 프롬프트를 관리합니다.",
    emptyName: "Resume Analysis Prompt",
  },
  "cover-letter": {
    label: "Cover Letter",
    description: "자기소개서 초안과 첨삭 흐름에 사용하는 프롬프트입니다.",
    emptyName: "Cover Letter Prompt",
  },
  summary: {
    label: "Summary",
    description: "지원자 정보 요약과 핵심 포인트 정리에 사용합니다.",
    emptyName: "Summary Prompt",
  },
  feedback: {
    label: "Feedback",
    description: "AI 피드백 문구와 개선 제안을 생성하는 프롬프트입니다.",
    emptyName: "Feedback Prompt",
  },
  "interview-questions": {
    label: "Interview Questions",
    description: "맞춤형 면접 질문 생성에 사용하는 프롬프트입니다.",
    emptyName: "Interview Questions Prompt",
  },
};

const INTERPOLATION_HINT =
  "Available interpolation examples: {{resume}}, {{jobDescription}}, {{companyName}}, {{jobTitle}}";

function isPromptType(value: string): value is PromptType {
  return PROMPT_TYPES.includes(value as PromptType);
}

function formatDate(value: string | Date | null | undefined) {
  if (!value) return "업데이트 없음";

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "업데이트 없음";

  return date.toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function normalizeOptionalText(value: string) {
  return value.trim() ? value : null;
}

function parseOptionalNumber(
  value: string,
  fieldLabel: string,
  integerOnly = false
) {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const parsed = Number(trimmed);
  if (Number.isNaN(parsed)) {
    throw new Error(`${fieldLabel} must be a valid number.`);
  }

  if (integerOnly && !Number.isInteger(parsed)) {
    throw new Error(`${fieldLabel} must be a whole number.`);
  }

  return parsed;
}

export function getPrimaryPromptRecord(records: PromptTemplateRecord[]) {
  return records.find(record => record.isActive) ?? records[0] ?? null;
}

export function createEditorFormFromRecord(
  record: PromptTemplateRecord | null,
  fallbackName: string
): PromptEditorForm {
  return {
    name: record?.name ?? fallbackName,
    systemPrompt: record?.systemPrompt ?? "",
    userTemplate: record?.userTemplate ?? "",
    temperature: record?.temperature == null ? "" : String(record.temperature),
    maxTokens: record?.maxTokens == null ? "" : String(record.maxTokens),
    notes: record?.notes ?? "",
  };
}

export function insertPromptDraftRecord(
  records: PromptTemplateRecord[],
  draft: PromptTemplateRecord
) {
  return [draft, ...records.filter(record => record.id !== draft.id)];
}

export function markActivePromptRecord(
  records: PromptTemplateRecord[],
  activeId: string
) {
  return records.map(record => ({
    ...record,
    isActive: record.id === activeId,
  }));
}

function PromptDetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-44" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(340px,0.85fr)]">
        <Skeleton className="h-[720px] rounded-xl" />
        <Skeleton className="h-[720px] rounded-xl" />
      </div>
    </div>
  );
}

export default function PromptDetailPage() {
  const [location] = useLocation();
  const promptType = useMemo(() => {
    const value = location.split("/").filter(Boolean).at(-1) ?? "";
    return isPromptType(value) ? value : null;
  }, [location]);

  const meta = promptType ? PROMPT_TYPE_META[promptType] : null;
  const { loadPrompts, saveDraft, activateVersion } = usePrompts();

  const [records, setRecords] = useState<PromptTemplateRecord[]>([]);
  const [editorForm, setEditorForm] = useState<PromptEditorForm>(() =>
    createEditorFormFromRecord(null, "Prompt")
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [rollbackRecordId, setRollbackRecordId] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    async function fetchPromptHistory() {
      if (!promptType || !meta) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setLoadError(null);

        const nextRecords = await loadPrompts(promptType);
        if (!isActive) return;

        setRecords(nextRecords);
        setEditorForm(
          createEditorFormFromRecord(
            getPrimaryPromptRecord(nextRecords),
            meta.emptyName
          )
        );
        setRollbackRecordId(null);
      } catch (error) {
        if (!isActive) return;
        setLoadError(
          getErrorMessage(error, "프롬프트 상세 정보를 불러오지 못했습니다.")
        );
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void fetchPromptHistory();

    return () => {
      isActive = false;
    };
  }, [loadPrompts, meta, promptType]);

  const activeRecord = records.find(record => record.isActive) ?? null;
  const rollbackRecord =
    records.find(record => record.id === rollbackRecordId) ?? null;
  const hasExistingVersions = records.length > 0;
  const canSaveDraft = Boolean(
    promptType &&
      hasExistingVersions &&
      editorForm.name.trim() &&
      editorForm.systemPrompt.trim() &&
      !isSaving
  );

  function updateEditorField<K extends keyof PromptEditorForm>(
    field: K,
    value: PromptEditorForm[K]
  ) {
    setEditorForm(current => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSaveDraft() {
    if (!promptType || !meta || !canSaveDraft) return;

    try {
      setIsSaving(true);
      setSaveError(null);
      setSaveMessage(null);
      setActionError(null);
      setActionMessage(null);

      const savedDraft = await saveDraft({
        type: promptType,
        name: editorForm.name.trim(),
        systemPrompt: editorForm.systemPrompt,
        userTemplate: normalizeOptionalText(editorForm.userTemplate),
        temperature: parseOptionalNumber(editorForm.temperature, "Temperature"),
        maxTokens: parseOptionalNumber(
          editorForm.maxTokens,
          "Max Tokens",
          true
        ),
        notes: normalizeOptionalText(editorForm.notes),
      });

      setRecords(current => insertPromptDraftRecord(current, savedDraft));
      setEditorForm(createEditorFormFromRecord(savedDraft, meta.emptyName));
      setRollbackRecordId(null);
      setSaveMessage(
        `${savedDraft.version} Draft가 저장되었습니다. 활성화 전까지 운영 버전은 변경되지 않습니다.`
      );
    } catch (error) {
      setSaveError(getErrorMessage(error, "Draft 저장에 실패했습니다."));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleActivate(record: PromptTemplateRecord) {
    if (!promptType) return;

    try {
      setActivatingId(record.id);
      setActionError(null);
      setActionMessage(null);
      setSaveError(null);

      await activateVersion(promptType, record.id);
      setRecords(current => markActivePromptRecord(current, record.id));
      setActionMessage(`${record.version} 버전이 Active로 전환되었습니다.`);
    } catch (error) {
      setActionError(getErrorMessage(error, "버전 활성화에 실패했습니다."));
    } finally {
      setActivatingId(null);
    }
  }

  function handleRollback(record: PromptTemplateRecord) {
    if (!meta) return;

    setEditorForm(createEditorFormFromRecord(record, meta.emptyName));
    setRollbackRecordId(record.id);
    setSaveError(null);
    setSaveMessage(null);
    setActionError(null);
    setActionMessage(null);
  }

  if (!promptType || !meta) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" className="gap-1.5 -ml-2" asChild>
          <Link href="/admin/prompts">
            <ArrowLeft className="size-4" />
            프롬프트 목록
          </Link>
        </Button>

        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>
            지원하지 않는 프롬프트 타입입니다.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-8 w-28" />
        <PromptDetailSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" className="gap-1.5 -ml-2" asChild>
        <Link href="/admin/prompts">
          <ArrowLeft className="size-4" />
          프롬프트 목록
        </Link>
      </Button>

      <AdminPageHeader
        title={meta.label}
        description={meta.description}
        actions={
          <>
            <Badge variant="outline">{records.length} versions</Badge>
            <Badge
              variant="outline"
              className={cn(
                activeRecord
                  ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700"
                  : "border-border bg-muted text-muted-foreground"
              )}
            >
              {activeRecord ? `Active ${activeRecord.version}` : "No Active"}
            </Badge>
          </>
        }
      />

      {loadError && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      )}

      {!loadError && !hasExistingVersions && (
        <Alert>
          <History className="size-4" />
          <AlertDescription>
            아직 저장된 버전이 없습니다. 이 화면은 기존 버전의 모델 설정을
            이어받아 Draft를 저장하므로, 첫 버전 생성은 별도 시드 작업이
            필요합니다.
          </AlertDescription>
        </Alert>
      )}

      {rollbackRecord && (
        <Alert>
          <RotateCcw className="size-4" />
          <AlertDescription>
            {rollbackRecord.version} 내용을 에디터에 불러왔습니다. 저장하면 새
            Draft가 생성되며 자동으로 Active 전환되지는 않습니다.
          </AlertDescription>
        </Alert>
      )}

      {saveMessage && (
        <Alert>
          <CheckCircle2 className="size-4" />
          <AlertDescription>{saveMessage}</AlertDescription>
        </Alert>
      )}

      {actionMessage && (
        <Alert>
          <CheckCircle2 className="size-4" />
          <AlertDescription>{actionMessage}</AlertDescription>
        </Alert>
      )}

      {saveError && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>{saveError}</AlertDescription>
        </Alert>
      )}

      {actionError && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(340px,0.85fr)]">
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
                  value={editorForm.name}
                  onChange={event =>
                    updateEditorField("name", event.target.value)
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
                value={editorForm.systemPrompt}
                onChange={event =>
                  updateEditorField("systemPrompt", event.target.value)
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
                value={editorForm.userTemplate}
                onChange={event =>
                  updateEditorField("userTemplate", event.target.value)
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
                  value={editorForm.temperature}
                  onChange={event =>
                    updateEditorField("temperature", event.target.value)
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
                  value={editorForm.maxTokens}
                  onChange={event =>
                    updateEditorField("maxTokens", event.target.value)
                  }
                  placeholder="1200"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="prompt-notes">Notes</Label>
              <Textarea
                id="prompt-notes"
                value={editorForm.notes}
                onChange={event =>
                  updateEditorField("notes", event.target.value)
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
            <Button onClick={handleSaveDraft} disabled={!canSaveDraft}>
              {isSaving && <Loader2 className="size-4 animate-spin" />}
              Save Draft
            </Button>
          </CardFooter>
        </Card>

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
                              onClick={() => handleActivate(record)}
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
                            onClick={() => handleRollback(record)}
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
      </div>
    </div>
  );
}
