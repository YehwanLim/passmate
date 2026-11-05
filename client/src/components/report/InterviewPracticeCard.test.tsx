// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ useCreditSummary: vi.fn() }));
vi.mock("@/hooks/useCreditSummary", () => ({ useCreditSummary: mocks.useCreditSummary }));
vi.mock("wouter", () => ({ Link: ({ href, children, className }: { href: string; children: unknown; className?: string }) => <a href={href} className={className}>{children as never}</a> }));

import InterviewPracticeCard from "./InterviewPracticeCard";

const summary = (overrides: Record<string, unknown>) => ({ interviewEnabled: true, interviewRemaining: 1, ...overrides });

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("리포트 안 AI 면접 연습 입구", () => {
  it("스위치가 꺼졌거나 요약을 못 읽으면 아무것도 그리지 않는다", () => {
    mocks.useCreditSummary.mockReturnValue({ summary: null, failed: false });
    const { container, rerender } = render(<InterviewPracticeCard analysisId="a1" />);
    expect(container.innerHTML).toBe("");
    mocks.useCreditSummary.mockReturnValue({ summary: summary({ interviewEnabled: false }), failed: false });
    rerender(<InterviewPracticeCard analysisId="a1" />);
    expect(container.innerHTML).toBe("");
  });

  it("이용권이 있으면 실전·짧은 연습 링크와 남은 횟수를, 없으면 안내만 보여 준다", () => {
    mocks.useCreditSummary.mockReturnValue({ summary: summary({ interviewRemaining: 2 }), failed: false });
    render(<InterviewPracticeCard analysisId="a1" />);
    expect(screen.getByText("이 질문들, 실제 면접처럼 답해 볼까요?")).toBeTruthy();
    expect(screen.getByRole("link", { name: /실전 15분/ }).getAttribute("href")).toBe("/my/interview-practice/start?analysisId=a1&mode=FULL");
    expect(screen.getByRole("link", { name: "짧은 연습 5분" }).getAttribute("href")).toBe("/my/interview-practice/start?analysisId=a1&mode=SHORT");
    expect(screen.getByText("이용권 2회 남음")).toBeTruthy();
    expect(screen.getByRole("link", { name: "지난 면접 보기" }).getAttribute("href")).toBe("/my/interview-practice?analysisId=a1");

    cleanup();
    mocks.useCreditSummary.mockReturnValue({ summary: summary({ interviewRemaining: 0 }), failed: false });
    render(<InterviewPracticeCard analysisId="a1" />);
    expect(screen.queryByRole("link", { name: /실전 15분/ })).toBeNull();
    expect(screen.getByText("지금은 쓸 수 있는 면접 이용권이 없어요.")).toBeTruthy();
    // 결제 URL 이 없으면 구매 버튼도 없다.
    expect(screen.queryByRole("link", { name: /면접 이용권 구매/ })).toBeNull();

    cleanup();
    mocks.useCreditSummary.mockReturnValue({
      summary: summary({ interviewRemaining: 0, checkoutUrls: { interview: "https://www.groble.im/payment/ITV" } }),
      failed: false,
    });
    render(<InterviewPracticeCard analysisId="a1" />);
    expect(screen.getByRole("link", { name: /면접 이용권 구매/ }).getAttribute("href")).toBe("/checkout?product=interview");
    // 점수·퍼센트는 어디에도 없다.
    expect(document.body.textContent).not.toMatch(/\d+점|%/);
  });
});
