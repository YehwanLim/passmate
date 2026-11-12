// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";

const mocks = vi.hoisted(() => ({ sendFunnelEvent: vi.fn(), fetchSalesAvailability: vi.fn() }));
vi.mock("@/lib/siteVisits", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/siteVisits")>()),
  sendFunnelEvent: mocks.sendFunnelEvent,
}));
vi.mock("@/lib/entitlements", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/entitlements")>()),
  fetchSalesAvailability: mocks.fetchSalesAvailability,
}));

import {
  INTERVIEW_LAUNCH_DELAY_MS,
  INTERVIEW_LAUNCH_ENDS_AT,
  InterviewLaunchPopup,
  isInterviewLaunchPopupDue,
  isInterviewLaunchPopupPath,
} from "./InterviewLaunchPopup";

const NOW = Date.parse("2026-11-10T12:00:00+09:00");

function availability(interview: boolean) {
  return { companyAnalysisEnabled: true, purchasable: { interview } };
}

async function renderAt(path: string) {
  const { hook } = memoryLocation({ path });
  render(
    <Router hook={hook}>
      <InterviewLaunchPopup />
    </Router>
  );
  await act(async () => {
    vi.advanceTimersByTime(INTERVIEW_LAUNCH_DELAY_MS);
  });
}

beforeEach(() => {
  vi.useFakeTimers({ now: NOW });
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
    clear: () => store.clear(),
  });
  mocks.fetchSalesAvailability.mockResolvedValue(availability(true));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("isInterviewLaunchPopupPath", () => {
  it("랜딩·마이페이지·공고·가이드에서만 띄우고 면접 화면에서는 안 띄운다", () => {
    expect(isInterviewLaunchPopupPath("/")).toBe(true);
    expect(isInterviewLaunchPopupPath("/my")).toBe(true);
    expect(isInterviewLaunchPopupPath("/my/entitlements")).toBe(true);
    expect(isInterviewLaunchPopupPath("/my/interview-practice")).toBe(false);
    expect(isInterviewLaunchPopupPath("/my/interview-practice/abc")).toBe(false);
    expect(isInterviewLaunchPopupPath("/analyze")).toBe(false);
    expect(isInterviewLaunchPopupPath("/mypage")).toBe(false);
    expect(isInterviewLaunchPopupPath("/jobs")).toBe(true);
    expect(isInterviewLaunchPopupPath("/jobs/samsung-2026")).toBe(true);
    expect(isInterviewLaunchPopupPath("/guide")).toBe(true);
    expect(isInterviewLaunchPopupPath("/guide/motivation")).toBe(true);
    expect(isInterviewLaunchPopupPath("/jobsearch")).toBe(false);
  });
});

describe("isInterviewLaunchPopupDue", () => {
  it("기념가 기간이 끝나면 안 띄운다", () => {
    expect(isInterviewLaunchPopupDue(INTERVIEW_LAUNCH_ENDS_AT - 1)).toBe(true);
    expect(isInterviewLaunchPopupDue(INTERVIEW_LAUNCH_ENDS_AT)).toBe(false);
  });
});

describe("InterviewLaunchPopup", () => {
  it("랜딩에서 5초 뒤에 뜨고 노출을 기록한다", async () => {
    const { hook } = memoryLocation({ path: "/" });
    render(
      <Router hook={hook}>
        <InterviewLaunchPopup />
      </Router>
    );
    await act(async () => {
      vi.advanceTimersByTime(INTERVIEW_LAUNCH_DELAY_MS - 1);
    });
    expect(screen.queryByText("AI 모의 면접이 새로 나왔어요")).toBeNull();
    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByText("AI 모의 면접이 새로 나왔어요")).toBeTruthy();
    expect(screen.getByText("1,990원")).toBeTruthy();
    expect(mocks.sendFunnelEvent).toHaveBeenCalledWith("content_cta_click", "interview-popup:open");
  });

  it("면접 이용권을 살 수 없으면 안 뜬다", async () => {
    mocks.fetchSalesAvailability.mockResolvedValue(availability(false));
    await renderAt("/");
    expect(screen.queryByText("AI 모의 면접이 새로 나왔어요")).toBeNull();
  });

  it("다른 화면에서는 안 뜬다", async () => {
    await renderAt("/analyze");
    expect(mocks.fetchSalesAvailability).not.toHaveBeenCalled();
    expect(screen.queryByText("AI 모의 면접이 새로 나왔어요")).toBeNull();
  });

  it("닫으면 7일 동안 안 뜨고, 7일이 지나면 다시 뜬다", async () => {
    await renderAt("/");
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    expect(screen.queryByText("AI 모의 면접이 새로 나왔어요")).toBeNull();
    expect(mocks.sendFunnelEvent).toHaveBeenCalledWith("content_cta_click", "interview-popup:close");
    expect(isInterviewLaunchPopupDue(NOW + 6 * 24 * 60 * 60 * 1000)).toBe(false);
    // 닫은 시각은 들어오고 5초 뒤
    expect(isInterviewLaunchPopupDue(NOW + INTERVIEW_LAUNCH_DELAY_MS + 7 * 24 * 60 * 60 * 1000)).toBe(true);
  });

  it("다시 보지 않기를 누르면 기간 끝까지 안 뜬다", async () => {
    await renderAt("/my");
    fireEvent.click(screen.getByRole("button", { name: "다시 보지 않기" }));
    expect(mocks.sendFunnelEvent).toHaveBeenCalledWith("content_cta_click", "interview-popup:never");
    expect(isInterviewLaunchPopupDue(INTERVIEW_LAUNCH_ENDS_AT - 1)).toBe(false);
  });

  it("면접 보러 가기는 AI 모의 면접 화면으로 간다", async () => {
    await renderAt("/my");
    const link = screen.getByRole("link", { name: "면접 보러 가기" });
    expect(link.getAttribute("href")).toBe("/my/interview-practice");
  });
});
