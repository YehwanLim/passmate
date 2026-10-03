// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  fetchApplication: vi.fn(),
  saveApplicationQuestions: vi.fn(),
  updateApplicationMeta: vi.fn(),
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
  updateApplicationMeta: mocks.updateApplicationMeta,
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

// 이 테스트 환경의 jsdom 에는 localStorage 가 없어 메모리 저장소로 대신한다.
function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() { return data.size; },
    key: (index: number) => Array.from(data.keys())[index] ?? null,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, String(value)); },
    removeItem: (key: string) => { data.delete(key); },
    clear: () => data.clear(),
  };
}

beforeEach(() => {
  vi.stubGlobal("localStorage", memoryStorage());
  mocks.fetchApplication.mockResolvedValue(DETAIL);
  mocks.saveApplicationQuestions.mockResolvedValue({ questions_updated_at: "2026-10-03T02:00:00.000Z" });
  mocks.fetchMock.mockResolvedValue(new Response("[]", { status: 200, headers: { "content-type": "application/json" } }));
  vi.stubGlobal("fetch", mocks.fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

const BACKUP_KEY = "passmate_workspace_draft_p1";
const readBackup = () => {
  const raw = window.localStorage.getItem(BACKUP_KEY);
  return raw ? JSON.parse(raw) : null;
};

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

  function mockLegacyProject() {
    mocks.fetchApplication.mockResolvedValue({ ...DETAIL, questions: [], questions_updated_at: null, latest_analysis_id: "a9" });
    mocks.fetchMock.mockImplementation(async (url: string) => {
      if (String(url).includes("/api/analysis/a9")) {
        return new Response(JSON.stringify({
          id: "a9", question_text: "[문항 1] 성장 과정", input_text: "[문항 1]\n어릴 때", status: "SUCCESS",
        }), { status: 200, headers: { "content-type": "application/json" } });
      }
      return new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
    });
  }

  it("문항이 없고 지난 진단이 있으면 그 문항으로 미리 채운다", async () => {
    mockLegacyProject();
    render(<MyAnalyses />);
    expect(await screen.findByDisplayValue("성장 과정")).toBeTruthy();
    expect(screen.getByText("지난 진단의 문항을 불러왔어요. 고치면 이 지원서에 저장돼요.")).toBeTruthy();
  });

  it("미리 채운 지원서는 고치기 전에는 저장하지 않는다", async () => {
    mockLegacyProject();
    const { unmount } = render(<MyAnalyses />);
    await screen.findByDisplayValue("성장 과정");
    unmount();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(mocks.saveApplicationQuestions).not.toHaveBeenCalled();
  });

  it("미리 채운 지원서를 고치면 한 번 저장한다", async () => {
    mockLegacyProject();
    const { unmount } = render(<MyAnalyses />);
    fireEvent.change(await screen.findByDisplayValue("어릴 때"), { target: { value: "어릴 때부터" } });
    unmount();
    await waitFor(() => expect(mocks.saveApplicationQuestions).toHaveBeenCalledTimes(1));
    expect(mocks.saveApplicationQuestions).toHaveBeenCalledWith(
      "p1",
      [{ prompt: "성장 과정", charLimit: null, answer: "어릴 때부터" }],
      null
    );
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

  it("지난 진단 목록을 못 불러오면 비어 있다고 하지 않고 오류를 알린다", async () => {
    mocks.fetchMock.mockResolvedValue(new Response("{}", { status: 500, headers: { "content-type": "application/json" } }));
    render(<MyAnalyses />);
    expect(await screen.findByText(/지난 진단을 불러오지 못했어요/)).toBeTruthy();
    expect(screen.queryByText(/아직 진단받은 적이 없어요/)).toBeNull();
  });

  it("글자 수 제한에 범위 밖 값을 넣으면 제한 없음으로 저장한다", async () => {
    render(<MyAnalyses />);
    const limit = await screen.findByLabelText("글자 수 제한");
    fireEvent.change(limit, { target: { value: "10001" } });
    await waitFor(() => expect((limit as HTMLInputElement).value).toBe(""));
    fireEvent.change(limit, { target: { value: "800" } });
    expect((limit as HTMLInputElement).value).toBe("800");
  });

  it("불러오기 전에 떠나면 아무것도 저장하지 않는다", async () => {
    mocks.fetchApplication.mockReturnValue(new Promise(() => {}));
    const { unmount } = render(<MyAnalyses />);
    unmount();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(mocks.saveApplicationQuestions).not.toHaveBeenCalled();
  });

  describe("이 기기 임시 보관", () => {
    it("저장하지 못하면 이 기기에 보관하고 다시 저장으로 저장되면 지운다", async () => {
      mocks.saveApplicationQuestions.mockRejectedValue(new Error("network"));
      render(<MyAnalyses />);
      fireEvent.change(await screen.findByDisplayValue("가".repeat(250)), { target: { value: "나".repeat(10) } });
      expect(readBackup()).toEqual([{ prompt: "지원 동기", charLimit: 700, answer: "나".repeat(10) }]);

      const retry = await screen.findByRole("button", { name: "다시 저장" }, { timeout: 3000 });
      expect(readBackup()).toEqual([{ prompt: "지원 동기", charLimit: 700, answer: "나".repeat(10) }]);

      mocks.saveApplicationQuestions.mockResolvedValue({ questions_updated_at: "2026-10-03T02:00:00.000Z" });
      fireEvent.click(retry);
      await waitFor(() => expect(screen.getByText("저장됨")).toBeTruthy());
      expect(mocks.saveApplicationQuestions).toHaveBeenCalledTimes(2);
      expect(readBackup()).toBeNull();
    });

    it("충돌이면 새로고침하라고만 하지 않고 이 창의 내용을 이 기기에 보관한다", async () => {
      const { WorkspaceApiError } = await import("@/lib/workspace");
      mocks.saveApplicationQuestions.mockRejectedValue(new WorkspaceApiError("STALE_DRAFT", 409));
      render(<MyAnalyses />);
      fireEvent.change(await screen.findByDisplayValue("가".repeat(250)), { target: { value: "다".repeat(5) } });
      expect(await screen.findByText(/이 창의 내용은 이 기기에 보관했어요/, undefined, { timeout: 3000 })).toBeTruthy();
      expect(readBackup()).toEqual([{ prompt: "지원 동기", charLimit: 700, answer: "다".repeat(5) }]);
    });

    it("서버 내용과 다른 보관본이 있으면 불러올 수 있다", async () => {
      window.localStorage.setItem(BACKUP_KEY, JSON.stringify([{ prompt: "지원 동기", charLimit: 700, answer: "보관한 답변" }]));
      render(<MyAnalyses />);
      fireEvent.click(await screen.findByRole("button", { name: "이 기기에 남은 내용 불러오기" }));
      expect(await screen.findByDisplayValue("보관한 답변")).toBeTruthy();
      expect(screen.queryByRole("button", { name: "이 기기에 남은 내용 불러오기" })).toBeNull();
      await waitFor(() => expect(mocks.saveApplicationQuestions).toHaveBeenCalledWith(
        "p1",
        [{ prompt: "지원 동기", charLimit: 700, answer: "보관한 답변" }],
        "2026-10-03T01:00:00.000Z"
      ), { timeout: 3000 });
      await waitFor(() => expect(readBackup()).toBeNull());
    });

    it("보관본을 닫으면 지우고, 고치기 전에는 보관본을 건드리지 않는다", async () => {
      const stored = [{ prompt: "지원 동기", charLimit: 700, answer: "보관한 답변" }];
      window.localStorage.setItem(BACKUP_KEY, JSON.stringify(stored));
      render(<MyAnalyses />);
      await screen.findByRole("button", { name: "이 기기에 남은 내용 불러오기" });
      expect(readBackup()).toEqual(stored);
      fireEvent.click(screen.getByRole("button", { name: "보관본 지우기" }));
      expect(readBackup()).toBeNull();
      expect(screen.queryByRole("button", { name: "이 기기에 남은 내용 불러오기" })).toBeNull();
      expect(screen.getByDisplayValue("가".repeat(250))).toBeTruthy();
    });

    it("서버 내용과 같은 보관본은 안내 없이 지운다", async () => {
      window.localStorage.setItem(BACKUP_KEY, JSON.stringify([{ prompt: "지원 동기", charLimit: 700, answer: "가".repeat(250) }]));
      render(<MyAnalyses />);
      await screen.findByDisplayValue("가".repeat(250));
      expect(screen.queryByRole("button", { name: "이 기기에 남은 내용 불러오기" })).toBeNull();
      await waitFor(() => expect(readBackup()).toBeNull());
    });

    it("브라우저 저장소를 못 써도 화면과 자동 저장은 동작한다", async () => {
      const denied = () => { throw new Error("denied"); };
      vi.stubGlobal("localStorage", { ...memoryStorage(), getItem: denied, setItem: denied, removeItem: denied });
      const { unmount } = render(<MyAnalyses />);
      fireEvent.change(await screen.findByDisplayValue("가".repeat(250)), { target: { value: "라" } });
      unmount();
      await waitFor(() => expect(mocks.saveApplicationQuestions).toHaveBeenCalledTimes(1));
    });
  });

  describe("회사·직무·마감 수정", () => {
    afterEach(() => vi.useRealTimers());

    it("마감일을 고치면 KST 23:59 로 보내고 머리말 D-day 를 바꾼다", async () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-10-03T03:00:00Z"));
      mocks.updateApplicationMeta.mockResolvedValue({
        id: "p1", title: "한솔제지 · 국내영업", company_name: "한솔제지", job_role: "국내영업", deadline: "2026-10-20T14:59:00.000Z",
      });
      render(<MyAnalyses />);
      expect(await screen.findByText("D-8")).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "수정" }));
      const deadline = screen.getByLabelText("마감일") as HTMLInputElement;
      expect(deadline.value).toBe("2026-10-11");
      fireEvent.change(deadline, { target: { value: "2026-10-20" } });
      fireEvent.click(screen.getByRole("button", { name: "저장" }));
      await waitFor(() => expect(mocks.updateApplicationMeta).toHaveBeenCalledWith("p1", {
        company: "한솔제지", jobKeyword: "국내영업", deadline: "2026-10-20T23:59:00+09:00",
      }));
      expect(await screen.findByText("D-17")).toBeTruthy();
      expect(screen.queryByLabelText("마감일")).toBeNull();
    });

    it("마감일을 비우면 null 로 보내고, 회사가 비면 보내지 않는다", async () => {
      mocks.updateApplicationMeta.mockResolvedValue({
        id: "p1", title: "한솔제지 · 국내영업", company_name: "한솔제지", job_role: "국내영업", deadline: null,
      });
      render(<MyAnalyses />);
      fireEvent.click(await screen.findByRole("button", { name: "수정" }));
      fireEvent.change(screen.getByLabelText("회사"), { target: { value: "  " } });
      fireEvent.click(screen.getByRole("button", { name: "저장" }));
      expect(await screen.findByText("회사 이름을 적어 주세요.")).toBeTruthy();
      expect(mocks.updateApplicationMeta).not.toHaveBeenCalled();

      fireEvent.change(screen.getByLabelText("회사"), { target: { value: "한솔제지" } });
      fireEvent.change(screen.getByLabelText("마감일"), { target: { value: "" } });
      fireEvent.click(screen.getByRole("button", { name: "저장" }));
      await waitFor(() => expect(mocks.updateApplicationMeta).toHaveBeenCalledWith("p1", {
        company: "한솔제지", jobKeyword: "국내영업", deadline: null,
      }));
      expect(await screen.findByText("마감 미정")).toBeTruthy();
    });

    it("저장에 실패하면 폼을 둔 채 오류를 알린다", async () => {
      mocks.updateApplicationMeta.mockRejectedValue(new Error("network"));
      render(<MyAnalyses />);
      fireEvent.click(await screen.findByRole("button", { name: "수정" }));
      fireEvent.change(screen.getByLabelText("직무"), { target: { value: "해외영업" } });
      fireEvent.click(screen.getByRole("button", { name: "저장" }));
      expect(await screen.findByText("저장하지 못했어요. 잠시 후 다시 시도해 주세요.")).toBeTruthy();
      expect(screen.getByLabelText("직무")).toBeTruthy();
      expect(screen.queryByText("해외영업")).toBeNull();
    });
  });
});
