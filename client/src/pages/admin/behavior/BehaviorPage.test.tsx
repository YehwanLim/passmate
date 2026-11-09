// @vitest-environment jsdom

import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

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
      engagedTime: {
        visitors: 72,
        measured: 40,
        medianSeconds: 84,
        averageSeconds: 130,
        buckets: [{ label: "10초 미만", count: 10 }, { label: "1~3분", count: 30 }],
      },
      login: { visitors: 72, inAppVisitors: 16, inAppKinds: [{ kind: "kakaotalk", visitors: 10 }], events: { google_signin_failed: 2 } },
      features: [{ key: "resume", label: "자소서 분석", uses: 3, users: 3 }],
      interviews: {
        steps: [
          { key: "created", label: "시작 누름", sessions: 8, users: 5 },
          { key: "answered", label: "한 번 이상 답함", sessions: 3, users: 2 },
        ],
        interrupted: 1,
        refunded: 4,
        shortMode: 1,
        medianSeconds: 540,
      },
    });

    render(createElement(BehaviorPage));

    await waitFor(() => expect(screen.getByText("threads")).toBeTruthy());
    expect(adminApiFetch).toHaveBeenCalledWith("/api/admin/behavior?period=7d");
    expect(screen.getByText("분석 폼 열람 → 작성 시작")).toBeTruthy();
    expect(screen.getByText("늘어남")).toBeTruthy(); // 제출 1 → 가입 4
    expect(screen.getByText("5.6%")).toBeTruthy(); // 다시 온 방문자 4/72
    expect(screen.getByText("자소서 분석")).toBeTruthy();
    expect(screen.getByText("Google 로그인 실패")).toBeTruthy();
    expect(screen.getByText("1분 24초")).toBeTruthy(); // 체류 시간 중앙값
    expect(screen.getByText("시간을 잰 방문 40 / 전체 72")).toBeTruthy();
    expect(screen.getByText("75%")).toBeTruthy(); // 1~3분 30/40
    expect(screen.getByText("한 번 이상 답함")).toBeTruthy();
    expect(screen.getByText("38%")).toBeTruthy(); // 면접 답함 3/8
    expect(screen.getByText(/진행 시간 중앙값 9분/)).toBeTruthy();
  });

  it("날짜 지정을 누르면 오늘 하루를 custom 으로 요청하고, 기간 버튼을 누르면 돌아간다", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-09T14:00:00.000Z")); // 11-09 23시 KST
    adminApiFetch.mockResolvedValue({});
    render(createElement(BehaviorPage));

    fireEvent.click(screen.getByText("날짜 지정"));
    await waitFor(() =>
      expect(adminApiFetch).toHaveBeenLastCalledWith("/api/admin/behavior?period=custom&from=2026-11-09&to=2026-11-09"),
    );

    fireEvent.click(screen.getByLabelText("이전 기간"));
    await waitFor(() =>
      expect(adminApiFetch).toHaveBeenLastCalledWith("/api/admin/behavior?period=custom&from=2026-11-08&to=2026-11-08"),
    );

    fireEvent.change(screen.getByLabelText("시작 날짜"), { target: { value: "2026-11-01" } });
    await waitFor(() =>
      expect(adminApiFetch).toHaveBeenLastCalledWith("/api/admin/behavior?period=custom&from=2026-11-01&to=2026-11-08"),
    );

    fireEvent.click(screen.getByText("최근 30일"));
    await waitFor(() => expect(adminApiFetch).toHaveBeenLastCalledWith("/api/admin/behavior?period=30d"));
    vi.useRealTimers();
  });
});
