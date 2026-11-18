import { APPLICATION_BOARD_COPY } from "@/copy/applicationBoardCopy";

/**
 * 지원 현황판 단계 계산(11-15). 서버 규칙(lib/application-drafts.js normalizeStageSteps)과 같다:
 * 기본 6단계는 고정·순서 유지, 직접 단계(c_ + 8자)만 끼워 넣고 지운다, 최대 12개, 마지막은 offer.
 * 설계: docs/superpowers/specs/2026-11-15-공고-담기-지원현황-design.md
 */
export const DEFAULT_STAGE_KEYS = ["interest", "writing", "submitted", "doc_passed", "interview", "offer"] as const;
export type DefaultStageKey = (typeof DEFAULT_STAGE_KEYS)[number];
export type StageStep = { key: string; label?: string };
export type StageFields = { stage?: string; stage_steps?: StageStep[] | null; rejected?: boolean };

const MAX_STEPS = 12;
const MAX_LABEL = 20;

export function isDefaultStage(key: string): key is DefaultStageKey {
  return (DEFAULT_STAGE_KEYS as readonly string[]).includes(key);
}

export function resolveSteps(steps?: StageStep[] | null): StageStep[] {
  return Array.isArray(steps) && steps.length > 0 ? steps : DEFAULT_STAGE_KEYS.map((key) => ({ key }));
}

export function stageLabel(step: StageStep): string {
  return isDefaultStage(step.key) ? APPLICATION_BOARD_COPY.stages[step.key] : step.label ?? step.key;
}

export function currentStep(p: StageFields): StageStep {
  const steps = resolveSteps(p.stage_steps);
  return steps.find((step) => step.key === (p.stage ?? "writing")) ?? { key: "writing" };
}

/** 직접 단계는 바로 앞의 기본 단계와 같은 할 일을 보여 준다. */
export function baseStage(steps: StageStep[], key: string): DefaultStageKey {
  if (isDefaultStage(key)) return key;
  const index = steps.findIndex((step) => step.key === key);
  for (let i = index - 1; i >= 0; i -= 1) {
    const candidate = steps[i].key;
    if (isDefaultStage(candidate)) return candidate;
  }
  return "writing";
}

export function canInsertAfter(steps: StageStep[], afterKey: string): boolean {
  return afterKey !== "offer" && steps.length < MAX_STEPS && steps.some((step) => step.key === afterKey);
}

function randomStageKey(): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return `c_${Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("")}`;
}

export function insertStepAfter(
  steps: StageStep[],
  afterKey: string,
  label: string,
  makeKey: () => string = randomStageKey,
): StageStep[] {
  const trimmed = label.trim();
  if (!canInsertAfter(steps, afterKey) || trimmed.length === 0 || trimmed.length > MAX_LABEL) {
    throw new Error("cannot insert stage");
  }
  const index = steps.findIndex((step) => step.key === afterKey);
  return [...steps.slice(0, index + 1), { key: makeKey(), label: trimmed }, ...steps.slice(index + 1)];
}

export function removeStep(steps: StageStep[], key: string): StageStep[] {
  if (isDefaultStage(key)) throw new Error("cannot remove default stage");
  return steps.filter((step) => step.key !== key);
}

export function isFinished(p: StageFields): boolean {
  return Boolean(p.rejected) || p.stage === "offer";
}

/** 진행 중 / 결과 나옴으로 나눈다. 순서는 부모가 정한 것(sortApplications)을 그대로 둔다. */
export function splitBoard<T extends StageFields>(items: T[]): { active: T[]; finished: T[] } {
  return { active: items.filter((p) => !isFinished(p)), finished: items.filter(isFinished) };
}
