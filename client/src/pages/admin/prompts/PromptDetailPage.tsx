import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, History, RotateCcw } from "lucide-react";
import { Link, useLocation } from "wouter";

import { PromptEditorCard } from "@/components/admin/prompts/PromptEditorCard";
import { VersionHistoryCard } from "@/components/admin/prompts/VersionHistoryCard";
import { AdminErrorAlert } from "@/components/admin/shared/AdminErrorAlert";
import { AdminPageHeader } from "@/components/admin/shared/AdminPageHeader";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { usePrompts } from "@/hooks/admin/usePrompts";
import type { PromptTemplateRecord } from "@/lib/admin-prompts";
import { cn } from "@/lib/utils";
import {
  PROMPT_TYPE_META,
  createEditorFormFromRecord,
  getErrorMessage,
  getPrimaryPromptRecord,
  insertPromptDraftRecord,
  isPromptType,
  markActivePromptRecord,
  normalizeOptionalText,
  parseOptionalNumber,
  type PromptEditorForm,
} from "./promptDetailModel";

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

        <AdminErrorAlert message="지원하지 않는 프롬프트 타입입니다." />
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

      <AdminErrorAlert message={loadError} />

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

      <AdminErrorAlert message={saveError} />
      <AdminErrorAlert message={actionError} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(340px,0.85fr)]">
        <PromptEditorCard
          form={editorForm}
          meta={meta}
          activeRecord={activeRecord}
          canSave={canSaveDraft}
          isSaving={isSaving}
          onChange={updateEditorField}
          onSave={() => void handleSaveDraft()}
        />

        <VersionHistoryCard
          records={records}
          rollbackRecordId={rollbackRecordId}
          activatingId={activatingId}
          isSaving={isSaving}
          onActivate={(record) => void handleActivate(record)}
          onRollback={handleRollback}
        />
      </div>
    </div>
  );
}
