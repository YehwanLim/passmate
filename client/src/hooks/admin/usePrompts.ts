import { useCallback } from "react";

import { adminApiFetch } from "@/lib/adminApi";
import type { PromptType, PromptTemplateRecord } from "@/lib/admin-prompts";

interface PromptTemplateRow { id: string; prompt_type: PromptType | null; version: string; name: string; variant: string | null; system_prompt: string; user_template: string | null; model_name: string; model_provider: string; temperature: number | null; max_tokens: number | null; is_active: boolean; is_default: boolean; description: string | null; notes: string | null; updated_by: string | null; created_at: string; updated_at: string; }
export interface SavePromptDraftInput { type: PromptType; name: string; systemPrompt: string; userTemplate: string | null; temperature: number | null; maxTokens: number | null; notes: string | null; variant?: string | null; modelName?: string | null; modelProvider?: string | null; isDefault?: boolean; description?: string | null; }

function mapPromptTemplateRecord(row: PromptTemplateRow): PromptTemplateRecord {
  return { id: row.id, promptType: row.prompt_type, version: row.version, name: row.name, variant: row.variant, systemPrompt: row.system_prompt, userTemplate: row.user_template, modelName: row.model_name, modelProvider: row.model_provider, temperature: row.temperature, maxTokens: row.max_tokens, isActive: row.is_active, isDefault: row.is_default, description: row.description, notes: row.notes, updatedBy: row.updated_by, createdAt: row.created_at, updatedAt: row.updated_at };
}

export function usePrompts() {
  const loadPrompts = useCallback(async (type?: PromptType) => {
    const path = type ? `/api/admin/prompts?type=${encodeURIComponent(type)}` : "/api/admin/prompts";
    const response = await adminApiFetch<{ prompts: PromptTemplateRow[] }>(path);
    return response.prompts.map(mapPromptTemplateRecord);
  }, []);
  const saveDraft = useCallback(async (input: SavePromptDraftInput) => {
    if (!input.modelName || !input.modelProvider) throw new Error("Saving the first prompt draft requires modelName and modelProvider.");
    const response = await adminApiFetch<{ prompt: PromptTemplateRow }>("/api/admin/prompts", {
      method: "POST", body: JSON.stringify({ ...input, modelName: input.modelName, modelProvider: input.modelProvider }),
    });
    return mapPromptTemplateRecord(response.prompt);
  }, []);
  const activateVersion = useCallback(async (promptType: PromptType, activateId: string) => {
    const response = await adminApiFetch<{ prompt: PromptTemplateRow }>(`/api/admin/prompts/${encodeURIComponent(activateId)}`, {
      method: "PATCH", body: JSON.stringify({ action: "activate", promptType }),
    });
    return mapPromptTemplateRecord(response.prompt);
  }, []);
  const createRollbackDraft = useCallback(async (record: PromptTemplateRecord) => {
    if (!record.promptType) throw new Error("Rollback requires a prompt_type value on the selected prompt record.");
    return saveDraft({ type: record.promptType, name: record.name, systemPrompt: record.systemPrompt, userTemplate: record.userTemplate, modelName: record.modelName, modelProvider: record.modelProvider, temperature: record.temperature, maxTokens: record.maxTokens, isDefault: record.isDefault, description: record.description, notes: record.notes, variant: record.variant });
  }, [saveDraft]);
  return { loadPrompts, saveDraft, activateVersion, createRollbackDraft };
}
