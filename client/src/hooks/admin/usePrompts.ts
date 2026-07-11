import { useCallback } from "react";

import {
  buildActivationUpdates,
  buildDraftRecord,
  type PromptType,
  type PromptTemplateRecord,
} from "@/lib/admin-prompts";
import { supabase } from "@/lib/supabase";

const PROMPT_TEMPLATE_SELECT = `
  id,
  prompt_type,
  version,
  name,
  variant,
  system_prompt,
  user_template,
  model_name,
  model_provider,
  temperature,
  max_tokens,
  is_active,
  is_default,
  description,
  notes,
  updated_by,
  created_at,
  updated_at
`;

interface PromptTemplateRow {
  id: string;
  prompt_type: PromptType | null;
  version: string;
  name: string;
  variant: string | null;
  system_prompt: string;
  user_template: string | null;
  model_name: string;
  model_provider: string;
  temperature: number | null;
  max_tokens: number | null;
  is_active: boolean;
  is_default: boolean;
  description: string | null;
  notes: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

interface ExistingPromptDraftRow {
  version: string;
  variant: string | null;
  model_name: string;
  model_provider: string;
  is_default: boolean;
  description: string | null;
}

export interface SavePromptDraftInput {
  type: PromptType;
  name: string;
  systemPrompt: string;
  userTemplate: string | null;
  temperature: number | null;
  maxTokens: number | null;
  notes: string | null;
  variant?: string | null;
  modelName?: string | null;
  modelProvider?: string | null;
  isDefault?: boolean;
  description?: string | null;
}

function mapPromptTemplateRecord(row: PromptTemplateRow): PromptTemplateRecord {
  return {
    id: row.id,
    promptType: row.prompt_type,
    version: row.version,
    name: row.name,
    variant: row.variant,
    systemPrompt: row.system_prompt,
    userTemplate: row.user_template,
    modelName: row.model_name,
    modelProvider: row.model_provider,
    temperature: row.temperature,
    maxTokens: row.max_tokens,
    isActive: row.is_active,
    isDefault: row.is_default,
    description: row.description,
    notes: row.notes,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getUpdatedBy() {
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    throw error;
  }

  return data.user?.email ?? data.user?.id ?? null;
}

async function getExistingPromptDrafts(type: PromptType) {
  const { data, error } = await supabase
    .from("prompt_templates")
    .select("version, variant, model_name, model_provider, is_default, description")
    .eq("prompt_type", type)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as ExistingPromptDraftRow[];
}

export function usePrompts() {
  const loadPrompts = useCallback(async (type?: PromptType) => {
    let query = supabase
      .from("prompt_templates")
      .select(PROMPT_TEMPLATE_SELECT)
      .order("created_at", { ascending: false });

    if (type) {
      query = query.eq("prompt_type", type);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return ((data ?? []) as PromptTemplateRow[]).map(mapPromptTemplateRecord);
  }, []);

  const saveDraft = useCallback(async (input: SavePromptDraftInput) => {
    const [updatedBy, existingDrafts] = await Promise.all([
      getUpdatedBy(),
      getExistingPromptDrafts(input.type),
    ]);
    const latestDraft = existingDrafts[0];

    const draft = buildDraftRecord({
      type: input.type,
      versions: existingDrafts.map((record) => record.version),
      name: input.name,
      variant: input.variant ?? latestDraft?.variant ?? null,
      systemPrompt: input.systemPrompt,
      userTemplate: input.userTemplate,
      modelName: input.modelName ?? latestDraft?.model_name ?? null,
      modelProvider: input.modelProvider ?? latestDraft?.model_provider ?? null,
      temperature: input.temperature,
      maxTokens: input.maxTokens,
      isDefault: input.isDefault ?? latestDraft?.is_default ?? false,
      description: input.description ?? latestDraft?.description ?? null,
      notes: input.notes,
      updatedBy,
    });

    if (!draft.model_name || !draft.model_provider) {
      throw new Error(
        "Saving the first prompt draft requires modelName and modelProvider.",
      );
    }

    const { data, error } = await supabase
      .from("prompt_templates")
      .insert(draft)
      .select(PROMPT_TEMPLATE_SELECT)
      .single();

    if (error) {
      throw error;
    }

    return mapPromptTemplateRecord(data as PromptTemplateRow);
  }, []);

  const activateVersion = useCallback(
    async (promptType: PromptType, activateId: string) => {
      const activationUpdates = buildActivationUpdates(promptType, activateId);

      const { error: deactivateError } = await supabase
        .from("prompt_templates")
        .update({ is_active: activationUpdates.deactivate.is_active })
        .eq("prompt_type", activationUpdates.deactivate.prompt_type);

      if (deactivateError) {
        throw deactivateError;
      }

      const { data, error } = await supabase
        .from("prompt_templates")
        .update({ is_active: true })
        .eq("prompt_type", promptType)
        .eq("id", activationUpdates.activateId)
        .select(PROMPT_TEMPLATE_SELECT)
        .single();

      if (error) {
        throw error;
      }

      return mapPromptTemplateRecord(data as PromptTemplateRow);
    },
    [],
  );

  const createRollbackDraft = useCallback(
    async (record: PromptTemplateRecord) => {
      if (!record.promptType) {
        throw new Error(
          "Rollback requires a prompt_type value on the selected prompt record.",
        );
      }

      return saveDraft({
        type: record.promptType,
        name: record.name,
        systemPrompt: record.systemPrompt,
        userTemplate: record.userTemplate,
        modelName: record.modelName,
        modelProvider: record.modelProvider,
        temperature: record.temperature,
        maxTokens: record.maxTokens,
        isDefault: record.isDefault,
        description: record.description,
        notes: record.notes,
        variant: record.variant,
      });
    },
    [saveDraft],
  );

  return {
    loadPrompts,
    saveDraft,
    activateVersion,
    createRollbackDraft,
  };
}
