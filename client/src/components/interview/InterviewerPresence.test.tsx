// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import InterviewerPresence from "./InterviewerPresence";

describe("InterviewerPresence", () => {
  afterEach(cleanup);

  it("말할 때는 입이 움직이고, 아닐 때는 멈춰 있다", () => {
    const { rerender } = render(<InterviewerPresence speaking={false} status="듣고 있어요" />);
    const avatar = screen.getByTestId("interviewer-avatar");
    expect(avatar.getAttribute("data-speaking")).toBe("false");
    expect(avatar.querySelector(".interview-mouth--speaking")).toBeNull();
    expect(avatar.querySelector(".interview-ring")).toBeNull();
    expect(screen.getByText("듣고 있어요")).toBeTruthy();

    rerender(<InterviewerPresence speaking status="말하는 중" />);
    expect(avatar.getAttribute("data-speaking")).toBe("true");
    expect(avatar.querySelector(".interview-mouth--speaking")).not.toBeNull();
    expect(avatar.querySelector(".interview-ring")).not.toBeNull();
    expect(screen.getByText("AI 면접관")).toBeTruthy();
  });
});
