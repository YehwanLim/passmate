export const PROMPT_TYPES = [
  "resume-analysis",
  "cover-letter",
  "summary",
  "feedback",
  "interview-questions",
] as const;

export type PromptType = (typeof PROMPT_TYPES)[number];

export interface PromptTemplateRecord {
  id: string;
  promptType: PromptType | null;
  version: string;
  name: string;
  variant: string | null;
  systemPrompt: string;
  userTemplate: string | null;
  modelName: string;
  modelProvider: string;
  temperature: number | null;
  maxTokens: number | null;
  isActive: boolean;
  isDefault: boolean;
  description: string | null;
  notes: string | null;
  updatedBy: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface MockPromptRun {
  response: string;
  responseTimeMs: number;
  totalTokens: number;
  estimatedCost: number;
}

export interface BuildDraftRecordInput {
  type: PromptType;
  versions: string[];
  name: string;
  variant?: string | null;
  systemPrompt: string;
  userTemplate: string | null;
  modelName?: string | null;
  modelProvider?: string | null;
  temperature: number | null;
  maxTokens: number | null;
  isDefault?: boolean;
  description?: string | null;
  notes: string | null;
  updatedBy: string | null;
}

export interface PromptTemplateInsertRecord {
  prompt_type: PromptType;
  version: string;
  name: string;
  variant: string | null;
  system_prompt: string;
  user_template: string | null;
  model_name?: string;
  model_provider?: string;
  temperature: number | null;
  max_tokens: number | null;
  is_active: boolean;
  is_default: boolean;
  description: string | null;
  notes: string | null;
  updated_by: string | null;
}

export function nextPromptVersion(versions: string[]): string {
  const parsed = versions
    .map((version) => /^v(\d+)\.(\d+)$/.exec(version))
    .filter((match): match is RegExpExecArray => Boolean(match))
    .map((match) => [Number(match[1]), Number(match[2])] as const)
    .sort(
      ([majorA, minorA], [majorB, minorB]) =>
        majorB - majorA || minorB - minorA,
    );

  if (!parsed[0]) {
    return "v1.0";
  }

  return `v${parsed[0][0]}.${parsed[0][1] + 1}`;
}

export function buildDraftRecord({
  type,
  versions,
  name,
  variant = null,
  systemPrompt,
  userTemplate,
  modelName,
  modelProvider,
  temperature,
  maxTokens,
  isDefault = false,
  description = null,
  notes,
  updatedBy,
}: BuildDraftRecordInput): PromptTemplateInsertRecord {
  const draft: PromptTemplateInsertRecord = {
    prompt_type: type,
    version: nextPromptVersion(versions),
    name,
    variant,
    system_prompt: systemPrompt,
    user_template: userTemplate,
    temperature,
    max_tokens: maxTokens,
    is_active: false,
    is_default: isDefault,
    description,
    notes,
    updated_by: updatedBy,
  };

  if (modelName) {
    draft.model_name = modelName;
  }

  if (modelProvider) {
    draft.model_provider = modelProvider;
  }

  return draft;
}

export function buildActivationUpdates(promptType: PromptType, activateId: string) {
  return {
    deactivate: {
      prompt_type: promptType,
      is_active: false,
    },
    activateId,
  };
}

export function createMockPromptRun(
  resume: string,
  promptName: string,
): MockPromptRun {
  const totalTokens = Math.max(180, Math.ceil(resume.trim().length / 2.8));

  return {
    response: `${promptName} mock response\n\n입력된 이력서를 바탕으로 핵심 강점과 다음 개선 우선순위를 제안합니다.`,
    responseTimeMs: 420 + (totalTokens % 280),
    totalTokens,
    estimatedCost: Number(((totalTokens / 1_000_000) * 0.4).toFixed(6)),
  };
}
