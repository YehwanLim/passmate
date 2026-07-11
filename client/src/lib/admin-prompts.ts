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
