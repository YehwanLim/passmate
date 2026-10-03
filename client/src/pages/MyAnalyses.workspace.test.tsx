// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  fetchApplication: vi.fn(),
  saveApplicationQuestions: vi.fn(),
  submitAnalysisRequest: vi.fn(),
  fetchMock: vi.fn(),
}));

vi.mock("wouter", () => ({
  useLocation: () => ["/my/p1", mocks.navigate],
  useParams: () => ({ projectId: "p1" }),
  Link: ({ children }: { children: unknown }) => children,
}));
vi.mock("@/hooks/useRequireAuth", () => ({ useRequireAuth: () => ({ user: { id: "u1" }, isLoading: false }) }));
vi.mock("@/components/SiteHeader", () => ({ default: () => null }));
vi.mock("@/lib/apiAuth", () => ({ getAuthorizationHeader: async () => ({}) }));
vi.mock("@/lib/workspace", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/workspace")>()),
  fetchApplication: mocks.fetchApplication,
  saveApplicationQuestions: mocks.saveApplicationQuestions,
}));
vi.mock("@/lib/analysisSubmit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/analysisSubmit")>()),
  submitAnalysisRequest: mocks.submitAnalysisRequest,
}));

import MyAnalyses from "./MyAnalyses";

const DETAIL = {
  id: "p1", title: "A 지원서", company_name: "한솔제지", job_role: "국내영업", created_at: "2026-10-01T00:00:00Z",
  analysis_count: 0, total_chars: 0, summary: null, deadline: "2026-10-11T14:59:00Z", posting_slug: null,
  latest_analysis_id: null,
  questions: [{ position: 1, prompt: "지원 동기", char_limit: 700, answer: "가".repeat(250) }],
  questions_updated_at: "2026-10-03T01:00:00.000Z",
};

beforeEach(() => {
  mocks.fetchApplication.mockResolvedValue(DETAIL);
  mocks.saveApplicationQuestions.mockResolvedValue({ questions_updated_at: "2026-10-03T02:00:00.000Z" });
  mocks.fetchMock.mockResolvedValue(new Response("[]", { status: 200, headers: { "content-type": "application/json" } }));
  vi.stubGlobal("fetch", mocks.fetchMock);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe("작업 화면", () => {
  it("저장된 문항과 글자 수를 보여 준다", async () => {
    render(<MyAnalyses />);
    expect(await screen.findByDisplayValue("지원 동기")).toBeTruthy();
    expect(screen.getByText(/공백 포함 250자/)).toBeTruthy();
  });

  it("진단받기는 projectId 를 붙여 분석을 접수하고 대기 화면으로 간다", async () => {
    mocks.submitAnalysisRequest.mockResolvedValue({
      kind: "accepted",
      receipt: { analysisId: "a1", analysisRequestId: "r1", projectId: "p1", status: "PENDING" },
    });
    render(<MyAnalyses />);
    fireEvent.click(await screen.findByRole("button", { name: "이 지원서로 진단받기" }));
    await waitFor(() => expect(mocks.submitAnalysisRequest).toHaveBeenCalled());
    const [endpoint, payload] = mocks.submitAnalysisRequest.mock.calls[0];
    expect(endpoint).toBe("/api/analyze");
    expect(payload).toMatchObject({
      projectId: "p1",
      company: "한솔제지",
      jobKeyword: "국내영업",
      questions: [{ question: "지원 동기", answer: "가".repeat(250) }],
    });
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith(expect.stringContaining("r1")));
  });

  it("문항이 없고 지난 진단이 있으면 그 문항으로 미리 채운다", async () => {
    mocks.fetchApplication.mockResolvedValue({ ...DETAIL, questions: [], questions_updated_at: null, latest_analysis_id: "a9" });
    mocks.fetchMock.mockImplementation(async (url: string) => {
      if (String(url).includes("/api/analysis/a9")) {
        return new Response(JSON.stringify({
          id: "a9", question_text: "[문항 1] 성장 과정", input_text: "[문항 1]\n어릴 때", status: "SUCCESS",
        }), { status: 200, headers: { "content-type": "application/json" } });
      }
      return new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
    });
    render(<MyAnalyses />);
    expect(await screen.findByDisplayValue("성장 과정")).toBeTruthy();
    expect(screen.getByText(/지난 진단의 문항을 불러왔어요/)).toBeTruthy();
  });

  it("자동 저장 대기 중에 화면을 떠나도 마지막 입력을 저장한다", async () => {
    const { unmount } = render(<MyAnalyses />);
    const answer = await screen.findByDisplayValue("가".repeat(250));
    fireEvent.change(answer, { target: { value: "나".repeat(10) } });
    expect(mocks.saveApplicationQuestions).not.toHaveBeenCalled();
    unmount();
    await waitFor(() => expect(mocks.saveApplicationQuestions).toHaveBeenCalledTimes(1));
    expect(mocks.saveApplicationQuestions).toHaveBeenCalledWith(
      "p1",
      [{ prompt: "지원 동기", charLimit: 700, answer: "나".repeat(10) }],
      "2026-10-03T01:00:00.000Z"
    );
  });

  it("불러오기 전에 떠나면 아무것도 저장하지 않는다", async () => {
    mocks.fetchApplication.mockReturnValue(new Promise(() => {}));
    const { unmount } = render(<MyAnalyses />);
    unmount();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(mocks.saveApplicationQuestions).not.toHaveBeenCalled();
  });
});
