// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import InterviewerPresence from "./InterviewerPresence";

describe("InterviewerPresence", () => {
  afterEach(cleanup);

  it("말할 때는 테와 파형이 움직이고, 듣거나 생각할 때는 점이 깜빡인다", () => {
    const { rerender, container } = render(<InterviewerPresence activity="listening" status="듣고 있어요" photoSrc="/interview/interviewer-2.jpg" />);
    expect((container.querySelector("img") as HTMLImageElement).getAttribute("src")).toBe("/interview/interviewer-2.jpg");
    expect(container.querySelector(".interview-ring")).toBeNull();
    expect(container.querySelectorAll(".interview-dot")).toHaveLength(3);
    expect(screen.getByText(/듣고 있어요/)).toBeTruthy();

    rerender(<InterviewerPresence activity="speaking" status="말하는 중" photoSrc="/interview/interviewer-2.jpg" />);
    expect(container.querySelector(".interview-ring")).not.toBeNull();
    expect(container.querySelectorAll(".interview-wave")).toHaveLength(3);
    expect(container.querySelector(".interview-dot")).toBeNull();
    expect(screen.getByText("AI 면접관")).toBeTruthy();
  });
});
