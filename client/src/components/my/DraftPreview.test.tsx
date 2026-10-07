// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DraftOk } from "@/lib/experienceDraft";
import DraftPreview from "./DraftPreview";

const draft: DraftOk = {
  kind: "ok",
  chosen: [{ experienceId: "e1", title: "카페 단골", reason: "고객 문제를 풀었다" }],
  sentences: [
    { text: "매출이 [실제 수치] 올랐습니다.", kind: "experience", sourceIds: ["e1"], unsourced: false },
    { text: "팀을 이끌었습니다.", kind: "experience", sourceIds: [], unsourced: true },
  ],
  draftText: "…",
  charCount: 30,
  replacedNumbers: 1,
  remainingToday: 1,
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("DraftPreview", () => {
  it("고른 경험·이유·빈칸·출처·근거 없는 문장 경고를 보여 준다", () => {
    render(<DraftPreview draft={draft} hasAnswer={false} onApply={() => {}} onRetry={() => {}} onClose={() => {}} />);
    expect(screen.getByText("카페 단골")).toBeTruthy();
    expect(screen.getByText("고객 문제를 풀었다")).toBeTruthy();
    expect(screen.getByText("[실제 수치]").tagName).toBe("MARK");
    expect(screen.getByText("출처: 카페 단골")).toBeTruthy();
    expect(screen.getByText(/근거를 찾지 못한/)).toBeTruthy();
    expect(screen.getByText(/노란 칸은/)).toBeTruthy();
  });

  it("오늘 한도를 다 썼으면 다시 만들기를 막는다", () => {
    render(<DraftPreview draft={draft} hasAnswer={false} canRetry={false} onApply={() => {}} onRetry={() => {}} onClose={() => {}} />);
    expect((screen.getByText("다른 경험으로 다시") as HTMLButtonElement).disabled).toBe(true);
  });

  it("답이 비어 있으면 묻지 않고 바로 채운다", () => {
    const onApply = vi.fn();
    const confirm = vi.spyOn(window, "confirm");
    render(<DraftPreview draft={draft} hasAnswer={false} onApply={onApply} onRetry={() => {}} onClose={() => {}} />);
    fireEvent.click(screen.getByText("이 초안으로 채우기"));
    expect(confirm).not.toHaveBeenCalled();
    expect(onApply).toHaveBeenCalledTimes(1);
  });

  it("답이 있으면 채우기 전에 확인을 묻고, 취소하면 채우지 않는다", () => {
    const onApply = vi.fn();
    vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    render(<DraftPreview draft={draft} hasAnswer onApply={onApply} onRetry={() => {}} onClose={() => {}} />);
    fireEvent.click(screen.getByText("이 초안으로 채우기"));
    expect(onApply).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("이 초안으로 채우기"));
    expect(onApply).toHaveBeenCalledTimes(1);
  });
});
