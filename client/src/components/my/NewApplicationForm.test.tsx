// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/analyze/JobPostingSection", () => ({ default: () => <div>공고 칸</div> }));

import NewApplicationForm from "./NewApplicationForm";

afterEach(() => { cleanup(); vi.clearAllMocks(); });

const renderForm = (company = "") => {
  const onCommit = vi.fn();
  const onInfo = vi.fn();
  render(
    <NewApplicationForm
      posting={null}
      onPosting={vi.fn()}
      info={{ company, jobKeyword: "", deadline: "" }}
      onInfo={onInfo}
      onCommit={onCommit}
      onRequireLogin={vi.fn()}
      error={null}
      busy={false}
    />,
  );
  return { onCommit, onInfo };
};

describe("새 지원서 오른쪽 칸", () => {
  it("회사를 적고 벗어나거나 Enter·목록 선택만으로는 만들지 않고, '지원서 만들기'를 눌러야 만든다", () => {
    const { onCommit } = renderForm("CJ제일제당");
    fireEvent.blur(screen.getByLabelText("회사"));
    fireEvent.keyDown(screen.getByLabelText("회사"), { key: "Enter" });
    expect(onCommit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "지원서 만들기" }));
    expect(onCommit).toHaveBeenCalledWith({ company: "CJ제일제당", jobKeyword: "", deadline: "" });
  });

  it("회사가 비어 있으면 만들기 버튼이 꺼져 있다", () => {
    const { onCommit, onInfo } = renderForm("");
    const submit = screen.getByRole("button", { name: "지원서 만들기" }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    fireEvent.click(submit);
    expect(onCommit).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("직무"), { target: { value: "마케팅" } });
    expect(onInfo).toHaveBeenCalledWith({ company: "", jobKeyword: "마케팅", deadline: "" });
  });

  it("회사·직무는 자소서 분석처럼 아래에 자동완성 목록이 뜨고, 고르면 칸만 채운다", () => {
    const { onCommit, onInfo } = renderForm("CJ제일");
    fireEvent.focus(screen.getByLabelText("회사"));
    fireEvent.click(screen.getByRole("button", { name: "CJ제일제당" }));
    expect(onInfo).toHaveBeenCalledWith({ company: "CJ제일제당", jobKeyword: "", deadline: "" });
    expect(onCommit).not.toHaveBeenCalled();

    fireEvent.focus(screen.getByLabelText("직무"));
    expect(screen.getAllByRole("button").some((b) => b.textContent?.includes("마케팅"))).toBe(true);
  });
});
