import {
  PROMPT_TYPES,
  type PromptTemplateRecord,
  type PromptType,
} from "@/lib/admin-prompts";
import { formatDate as formatKoDate } from "@/lib/formatDate";

// 프롬프트 상세 화면의 순수 모델. 화면 상태와 무관한 변환·검증만 둔다.

export interface PromptEditorForm {
  name: string;
  systemPrompt: string;
  userTemplate: string;
  temperature: string;
  maxTokens: string;
  notes: string;
}

export interface PromptTypeMeta {
  label: string;
  description: string;
  emptyName: string;
}

export const PROMPT_TYPE_META: Record<PromptType, PromptTypeMeta> = {
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

export const INTERPOLATION_HINT =
  "Available interpolation examples: {{resume}}, {{jobDescription}}, {{companyName}}, {{jobTitle}}";

export function isPromptType(value: string): value is PromptType {
  return PROMPT_TYPES.includes(value as PromptType);
}

/** 프롬프트 목록·상세·버전 카드가 같은 "업데이트 없음" 폴백을 쓴다. */
export function formatDate(value: string | Date | null | undefined) {
  return formatKoDate(value, "md-hm", "업데이트 없음");
}

export function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export function normalizeOptionalText(value: string) {
  return value.trim() ? value : null;
}

export function parseOptionalNumber(
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
