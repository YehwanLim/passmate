// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  params: { sessionId: "start" },
  search: "analysisId=22222222-2222-4222-8222-222222222222&mode=SHORT",
  getInterviewSession: vi.fn(),
}));
vi.mock("wouter", () => ({
  useLocation: () => ["/my/interview-practice/start", mocks.navigate],
  useParams: () => mocks.params,
  useSearch: () => mocks.search,
  Link: ({ children }: { children: unknown }) => children,
}));
vi.mock("@/hooks/useRequireAuth", () => ({ useRequireAuth: () => ({ isLoading: false, isAuthenticated: true, user: { id: "u" } }) }));
vi.mock("@/components/SiteHeader", () => ({ default: () => null }));
vi.mock("@/lib/interview/interviewApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/interview/interviewApi")>()),
  getInterviewSession: mocks.getInterviewSession,
}));

import InterviewPractice from "./InterviewPractice";

describe("AI 면접 연습 화면", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/my/interview-practice/start?analysisId=22222222-2222-4222-8222-222222222222&mode=SHORT");
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

  it("카메라·마이크를 못 쓰는 브라우저에서는 설정 화면에서 안내하고 시작 버튼을 막는다", async () => {
    vi.stubGlobal("navigator", { ...window.navigator, mediaDevices: undefined, userAgent: "Mozilla/5.0" });
    render(<InterviewPractice />);

    expect(await screen.findByText("장비를 확인해요")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain("카메라·마이크를 쓸 수 없어요");
    expect(screen.getByText("시작하기 전에 확인해 주세요")).toBeTruthy();
    expect(screen.getByText(/이용권 1회가 쓰여요/)).toBeTruthy();
    expect((screen.getByRole("button", { name: /짧은 연습 5분 시작/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(mocks.getInterviewSession).not.toHaveBeenCalled();
  });

  it("앱 안의 브라우저면 외부 브라우저로 안내한다", async () => {
    vi.stubGlobal("navigator", { ...window.navigator, mediaDevices: { getUserMedia: vi.fn() }, userAgent: "Mozilla/5.0 (iPhone) KAKAOTALK" });
    render(<InterviewPractice />);
    expect((await screen.findByRole("alert")).textContent).toContain("앱 안의 브라우저");
  });

  it("끝난 세션 주소로 들어오면 피드백과 대화 글을 보여 준다", async () => {
    mocks.params = { sessionId: "77777777-7777-4777-8777-777777777777" };
    mocks.search = "";
    mocks.getInterviewSession.mockResolvedValue({
      id: "77777777-7777-4777-8777-777777777777",
      analysisId: "a",
      mode: "FULL",
      status: "ENDED",
      company: "한빛모빌리티",
      jobRole: "서비스 기획",
      firstTokenAt: null,
      hardDeadlineAt: null,
      tokenIssueCount: 1,
      endedAt: null,
      endReason: "user-stop",
      createdAt: "2026-11-04T10:00:00.000Z",
      feedbackStatus: "SUCCEEDED",
      feedbackHadVideo: true,
      feedback: {
        summary: "경험을 순서대로 말한 점이 좋았어요.",
        answers: [{ question: "로그 분석에서 맡은 역할은?", whatWorked: "직접 모았다고 말했어요.", whatToImprove: "숫자의 출처를 이어서 말하면 어떨까요.", nextAttempt: "역할, 출처, 결과 순서로.", evidenceTurnSeqs: [1] }],
        delivery: { available: true, photoCount: 12, items: [{ category: "GAZE", observation: "12장 중 7장에서 시선이 아래를 향했어요.", suggestion: "답을 시작할 때 카메라를 봐 주세요.", supportingPhotoCount: 7 }] },
        disclaimer: "자동 받아쓰기와 사진 몇 장을 바탕으로 쓴 글이라 실제와 다를 수 있어요.",
      },
      turns: [
        { seq: 0, speaker: "INTERVIEWER", text: "로그 분석에서 맡은 역할은?", interrupted: false, partial: false, offsetMs: 0 },
        { seq: 1, speaker: "CANDIDATE", text: "제가 직접 모았습니다.", interrupted: false, partial: false, offsetMs: 4000 },
      ],
    });
    render(<InterviewPractice />);

    await waitFor(() => expect(screen.getByText("경험을 순서대로 말한 점이 좋았어요.")).toBeTruthy());
    expect(screen.getByText("한빛모빌리티 서비스 기획 · 15분")).toBeTruthy();
    expect(screen.getByText("시선")).toBeTruthy();
    expect(screen.getByText(/12장 중 7장/)).toBeTruthy();
    expect(screen.getByText("제가 직접 모았습니다.")).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/\d+점/);
    mocks.params = { sessionId: "start" };
  });
});
