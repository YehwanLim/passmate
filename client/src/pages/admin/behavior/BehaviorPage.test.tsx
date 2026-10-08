// @vitest-environment jsdom

import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";

const adminApiFetch = vi.hoisted(() => vi.fn());
vi.mock("@/lib/adminApi", () => ({ adminApiFetch }));

import BehaviorPage from "./BehaviorPage";

const step = (key: string, label: string, count: number, mobile: number | null = null, desktop: number | null = null) => ({
  key, label, count, mobile, desktop,
});

describe("BehaviorPage", () => {
  afterEach(() => {
    cleanup();
    adminApiFetch.mockReset();
  });

  it("퍼널·유입원·재방문·로그인·기능별 사용량을 그리고 가장 많이 빠지는 단계를 알려 준다", async () => {
    adminApiFetch.mockResolvedValue({
      period: "7d",
      funnel: [
        step("visit", "방문", 72),
        step("analyzeView", "분석 폼 열람", 24),
        step("formStart", "작성 시작", 3, 0, 3),
        step("submit", "제출 클릭", 1, 0, 1),
        step("signup", "가입", 4),
      ],
      sources: [{ source: "threads", visitors: 20, formStarts: 2, signups: 1 }],
      retention: { visitors: 72, returningVisitors: 4, signups: 4, returningSignups: 1 },
      login: { visitors: 72, inAppVisitors: 16, inAppKinds: [{ kind: "kakaotalk", visitors: 10 }], events: { google_signin_failed: 2 } },
      features: [{ key: "resume", label: "자소서 분석", uses: 3, users: 3 }],
    });

    render(createElement(BehaviorPage));

    await waitFor(() => expect(screen.getByText("threads")).toBeTruthy());
    expect(adminApiFetch).toHaveBeenCalledWith("/api/admin/behavior?period=7d");
    expect(screen.getByText("분석 폼 열람 → 작성 시작")).toBeTruthy();
    expect(screen.getByText("늘어남")).toBeTruthy(); // 제출 1 → 가입 4
    expect(screen.getByText("5.6%")).toBeTruthy(); // 다시 온 방문자 4/72
    expect(screen.getByText("자소서 분석")).toBeTruthy();
    expect(screen.getByText("Google 로그인 실패")).toBeTruthy();
  });
});
