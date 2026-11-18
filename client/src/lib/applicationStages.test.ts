import { describe, expect, it } from "vitest";
import {
  DEFAULT_STAGE_KEYS, baseStage, canInsertAfter, currentStep, insertStepAfter, isFinished,
  removeStep, resolveSteps, splitBoard, stageLabel,
} from "./applicationStages";

const custom = { key: "c_k3m9x2ab", label: "인적성" };
const withCustom = [{ key: "interest" }, { key: "writing" }, { key: "submitted" }, custom, { key: "doc_passed" }, { key: "interview" }, { key: "offer" }];

describe("applicationStages", () => {
  it("null 목록은 기본 6단계", () => {
    expect(resolveSteps(null).map((s) => s.key)).toEqual([...DEFAULT_STAGE_KEYS]);
  });

  it("이름표: 기본은 상수, 직접 단계는 label", () => {
    expect(stageLabel({ key: "doc_passed" })).toBe("서류 합격");
    expect(stageLabel(custom)).toBe("인적성");
  });

  it("현재 단계가 없거나 목록에 없으면 작성 중으로 본다", () => {
    expect(currentStep({}).key).toBe("writing");
    expect(currentStep({ stage: "c_zzzzzzzz" }).key).toBe("writing");
    expect(currentStep({ stage: "c_k3m9x2ab", stage_steps: withCustom })).toEqual(custom);
  });

  it("직접 단계의 기준은 바로 앞 기본 단계", () => {
    expect(baseStage(withCustom, "c_k3m9x2ab")).toBe("submitted");
    expect(baseStage(withCustom, "interview")).toBe("interview");
  });

  it("끼워 넣기는 고른 단계 바로 뒤, offer 뒤와 12개 넘게는 안 됨", () => {
    const next = insertStepAfter(resolveSteps(null), "doc_passed", " 과제 ", () => "c_aaaaaaaa");
    expect(next.map((s) => s.key)).toEqual(["interest", "writing", "submitted", "doc_passed", "c_aaaaaaaa", "interview", "offer"]);
    expect(next[4].label).toBe("과제");
    expect(canInsertAfter(next, "offer")).toBe(false);
    const full = [...withCustom.slice(0, 6), ...Array.from({ length: 5 }, (_, i) => ({ key: `c_bbbbbbb${i}`, label: "x" })), { key: "offer" }];
    expect(full).toHaveLength(12);
    expect(canInsertAfter(full, "interview")).toBe(false);
    expect(() => insertStepAfter(full, "interview", "y")).toThrow();
    expect(() => insertStepAfter(resolveSteps(null), "interview", "   ")).toThrow();
  });

  it("만든 키는 c_ + 8자", () => {
    const next = insertStepAfter(resolveSteps(null), "interview", "2차 면접");
    expect(next[5].key).toMatch(/^c_[a-z0-9]{8}$/);
  });

  it("지우기는 직접 단계만", () => {
    expect(removeStep(withCustom, "c_k3m9x2ab").map((s) => s.key)).toEqual([...DEFAULT_STAGE_KEYS]);
    expect(() => removeStep(withCustom, "submitted")).toThrow();
  });

  it("결과 나옴 = 최종 합격이거나 불합격, 나눌 때 순서 유지", () => {
    expect(isFinished({ stage: "offer" })).toBe(true);
    expect(isFinished({ stage: "writing", rejected: true })).toBe(true);
    const items = [{ id: "a", stage: "writing" }, { id: "b", stage: "offer" }, { id: "c", stage: "interview" }, { id: "d", rejected: true }];
    const { active, finished } = splitBoard(items);
    expect(active.map((i) => i.id)).toEqual(["a", "c"]);
    expect(finished.map((i) => i.id)).toEqual(["b", "d"]);
  });
});
