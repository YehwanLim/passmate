// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import InterviewCall from "./InterviewCall";

const base = {
  photoSrc: "/interview/interviewer-2.jpg",
  videoRef: createRef<HTMLVideoElement | null>(),
  cameraOn: true,
  micLevel: 0.05,
  candidateSpeaking: true,
  elapsedMs: 72_000,
  totalMinutes: 5,
  reconnects: 0,
  ending: false,
  onEnd: vi.fn(),
  subtitle: { speaker: "INTERVIEWER" as const, text: "1분 정도 자기소개 부탁드립니다.", draft: false },
};

describe("InterviewCall", () => {
  afterEach(cleanup);

  it("듣는 중에는 점이 깜빡이고 내 목소리 막대가 차며, 시간·자막·끝내기가 보인다", () => {
    const { container } = render(<InterviewCall {...base} activity="listening" />);
    expect(container.querySelectorAll(".interview-dot")).toHaveLength(3);
    expect(container.querySelector(".interview-ring")).toBeNull();
    expect(container.querySelector(".interview-portrait--speaking")).toBeNull();
    expect(screen.getByText(/듣고 있어요/)).toBeTruthy();
    expect(screen.getByRole("meter", { name: "내 목소리 크기" }).getAttribute("aria-valuenow")).toBe("30");
    expect(screen.getByText("1:12 / 5:00")).toBeTruthy();
    expect(screen.getByText("1분 정도 자기소개 부탁드립니다.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "면접 끝내기" }));
    expect(base.onEnd).toHaveBeenCalledTimes(1);
  });

  it("말할 때는 사진이 당겨지고 테·파형이 움직이며, 정리 중이면 끝내기가 잠긴다", () => {
    const { container } = render(<InterviewCall {...base} activity="speaking" ending />);
    expect(container.querySelector(".interview-portrait--speaking")).not.toBeNull();
    expect(container.querySelector(".interview-ring")).not.toBeNull();
    expect(container.querySelectorAll(".interview-wave")).toHaveLength(3);
    expect(container.querySelector(".interview-dot")).toBeNull();
    expect((screen.getByRole("button", { name: "정리 중" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
