// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import StageMenu from "./StageMenu";

afterEach(cleanup);
const project = { id: "p1", stage: "submitted", stage_steps: null, rejected: false };

describe("StageMenu", () => {
  it("배지는 현재 단계, 누르면 목록에서 골라 바로 저장", async () => {
    const onChange = vi.fn(async () => {});
    render(<StageMenu project={project} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /서류 제출/ }));
    fireEvent.click(screen.getByRole("menuitemradio", { name: "서류 합격" }));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith({ stage: "doc_passed" }));
  });

  it("단계 추가는 현재 단계 다음에 끼워 넣고 그 목록을 보낸다", async () => {
    const onChange = vi.fn(async (_patch: unknown) => {});
    render(<StageMenu project={project} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /서류 제출/ }));
    fireEvent.click(screen.getByRole("button", { name: "+ 단계 추가" }));
    fireEvent.change(screen.getByPlaceholderText("예: 과제, 1차 면접"), { target: { value: "인적성" } });
    fireEvent.click(screen.getByRole("button", { name: "넣기" }));
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    const { stageSteps } = onChange.mock.calls[0][0] as { stageSteps: Array<{ key: string; label?: string }> };
    expect(stageSteps.map((s) => s.label ?? s.key)).toEqual(["interest", "writing", "submitted", "인적성", "doc_passed", "interview", "offer"]);
  });

  it("직접 단계만 지우기 버튼이 있고, 현재 단계는 못 지운다", () => {
    const steps = [{ key: "interest" }, { key: "writing" }, { key: "submitted" }, { key: "c_k3m9x2ab", label: "인적성" }, { key: "c_aaaaaaaa", label: "과제" }, { key: "doc_passed" }, { key: "interview" }, { key: "offer" }];
    render(<StageMenu project={{ id: "p1", stage: "c_k3m9x2ab", stage_steps: steps }} onChange={vi.fn(async () => {})} />);
    fireEvent.click(screen.getByRole("button", { name: /인적성/ }));
    expect(screen.queryByRole("button", { name: "인적성 지우기" })).toBeNull();
    expect(screen.getByRole("button", { name: "과제 지우기" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "서류 합격 지우기" })).toBeNull();
  });

  it("불합격 표시는 rejected 를 뒤집고, 배지에 어디서 멈췄는지 보인다", async () => {
    const onChange = vi.fn(async () => {});
    const { rerender } = render(<StageMenu project={project} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /서류 제출/ }));
    fireEvent.click(screen.getByRole("button", { name: "불합격 표시" }));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith({ rejected: true }));
    rerender(<StageMenu project={{ ...project, rejected: true }} onChange={onChange} />);
    expect(screen.getByRole("button", { name: /서류 제출에서 불합격/ })).toBeTruthy();
  });
});
