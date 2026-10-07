// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import ExperienceCandidateCard, { type EditableCandidate } from "./ExperienceCandidateCard";

const ITEM: EditableCandidate = {
  key: "0", selected: true, similar: false, tagText: "데이터, 실험",
  title: "로그로 찾은 이탈 원인", period: "2024.09", situation: "재방문율이 떨어졌다", action: "로그 3,000건을 모았다", result: "",
  tags: ["데이터", "실험"], quotes: ["3,000건의 로그를 직접 모아 분석했습니다."],
};

afterEach(cleanup);

describe("후보 카드", () => {
  it("빈 칸은 '직접 채워 주세요'로, 근거 원문은 아래에 보여 준다", () => {
    render(<ExperienceCandidateCard item={ITEM} onChange={() => {}} />);
    expect(screen.getByLabelText("그래서 무엇이 달라졌나요")).toHaveProperty("placeholder", "직접 채워 주세요");
    expect(screen.getByText(/3,000건의 로그를 직접 모아 분석했습니다/)).toBeTruthy();
  });

  it("체크와 입력을 고치면 바뀐 후보를 넘긴다", () => {
    const onChange = vi.fn();
    render(<ExperienceCandidateCard item={ITEM} onChange={onChange} />);
    fireEvent.click(screen.getByRole("checkbox"));
    expect(onChange).toHaveBeenLastCalledWith({ ...ITEM, selected: false });
    fireEvent.change(screen.getByLabelText("이 경험을 한 줄로 부르면"), { target: { value: "새 제목" } });
    expect(onChange).toHaveBeenLastCalledWith({ ...ITEM, title: "새 제목" });
  });

  it("비슷한 경험이 있으면 알려 준다", () => {
    render(<ExperienceCandidateCard item={{ ...ITEM, similar: true, selected: false }} onChange={() => {}} />);
    expect(screen.getByText("비슷한 경험이 이미 있어요")).toBeTruthy();
  });
});
