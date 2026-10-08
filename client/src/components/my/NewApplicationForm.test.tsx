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
  it("회사를 적은 채 칸을 벗어나거나 Enter 를 누르면 만들기를 부른다", () => {
    const { onCommit } = renderForm("CJ제일제당");
    fireEvent.blur(screen.getByLabelText("회사"));
    fireEvent.keyDown(screen.getByLabelText("회사"), { key: "Enter" });
    expect(onCommit).toHaveBeenCalledTimes(2);
  });

  it("회사가 비어 있으면 벗어나도 만들지 않는다", () => {
    const { onCommit, onInfo } = renderForm("");
    fireEvent.blur(screen.getByLabelText("회사"));
    expect(onCommit).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("직무"), { target: { value: "마케팅" } });
    expect(onInfo).toHaveBeenCalledWith({ company: "", jobKeyword: "마케팅", deadline: "" });
  });
});
