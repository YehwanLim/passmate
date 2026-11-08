// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  auth: { isLoading: false, isAuthenticated: false },
  summary: null as null | { interviewEnabled: boolean; interviewRemaining: number; checkoutUrls?: Record<string, string | null> },
  listInterviewSessions: vi.fn(async () => []),
  listApplications: vi.fn(async () => [] as unknown[]),
  fetchApplication: vi.fn(),
}));
vi.mock("@/lib/workspace", () => ({ listApplications: mocks.listApplications, fetchApplication: mocks.fetchApplication }));
vi.mock("wouter", () => ({
  useLocation: () => ["/my/interview-practice", mocks.navigate],
  useSearch: () => "",
  Link: ({ children, href }: { children: unknown; href: string }) => <a href={href}>{children as never}</a>,
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => mocks.auth }));
vi.mock("@/hooks/useCreditSummary", () => ({ useCreditSummary: () => ({ summary: mocks.summary, failed: false }) }));
vi.mock("@/components/SiteHeader", () => ({ default: () => null }));
vi.mock("@/components/analyze/CompanyCombobox", () => ({
  default: ({ value, onChange, ariaLabel }: { value: string; onChange: (v: string) => void; ariaLabel: string }) => (
    <input aria-label={ariaLabel} value={value} onChange={(event) => onChange(event.target.value)} />
  ),
}));
vi.mock("@/components/analyze/JobRoleCombobox", () => ({
  default: ({ value, onChange, ariaLabel }: { value: string; onChange: (v: string) => void; ariaLabel: string }) => (
    <input aria-label={ariaLabel} value={value} onChange={(event) => onChange(event.target.value)} />
  ),
}));
vi.mock("@/lib/interview/interviewApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/interview/interviewApi")>()),
  listInterviewSessions: mocks.listInterviewSessions,
}));

import InterviewPracticeList from "./InterviewPracticeList";
import { directSourceFromApplication } from "@/lib/interview/directDraft";

const LETTER = "저는 동아리에서 로그 3,000건을 모아 이탈 구간을 찾았습니다. ".repeat(8);

function fill({ letter = LETTER } = {}) {
  fireEvent.change(screen.getByLabelText("회사"), { target: { value: "새벽물산" } });
  fireEvent.change(screen.getByLabelText("직무"), { target: { value: "영업 관리" } });
  fireEvent.change(screen.getByLabelText("자기소개서"), { target: { value: letter } });
}

describe("AI 모의 면접 소개 화면", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    sessionStorage.clear();
    mocks.auth = { isLoading: false, isAuthenticated: false };
    mocks.summary = null;
  });

  it("로그인 없이 소개와 입력 칸을 보여 주고, 지난 면접은 부르지 않는다", () => {
    render(<InterviewPracticeList />);
    expect(screen.getByRole("heading", { level: 1 })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "면접 시작하기" })).toBeTruthy();
    expect(screen.getByText("시작하면 로그인 화면으로 이동해요.")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "지난 면접" })).toBeNull();
    expect(mocks.listInterviewSessions).not.toHaveBeenCalled();
    expect(mocks.listApplications).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("저장한 지원서 불러오기")).toBeNull();
  });

  it("저장한 지원서를 고르면 답을 쓴 지원서만 보여 주고 회사·직무·자소서를 채운다", async () => {
    mocks.auth = { isLoading: false, isAuthenticated: true };
    mocks.listApplications.mockResolvedValue([
      { id: "p1", title: "t1", company_name: "새벽물산", job_role: "영업 관리", kind: "RESUME", answered_count: 2 },
      { id: "p2", title: "t2", company_name: "빈칸상사", job_role: "기획", kind: "RESUME", answered_count: 0 },
      { id: "p3", title: "t3", company_name: "기업리포트", job_role: "마케팅", kind: "COMPANY", answered_count: 1 },
    ]);
    mocks.fetchApplication.mockResolvedValue({
      company_name: "새벽물산",
      job_role: "영업 관리",
      questions: [
        { position: 1, prompt: "협업 경험", char_limit: null, answer: "팀에서 일정을 맞췄습니다." },
        { position: 0, prompt: "지원 동기", char_limit: null, answer: "현장 영업을 배우고 싶습니다." },
      ],
    });
    render(<InterviewPracticeList />);
    const select = (await screen.findByLabelText("저장한 지원서 불러오기")) as HTMLSelectElement;
    expect(Array.from(select.options).map((option) => option.textContent)).toEqual(["지원서를 고르면 회사·직무·자소서가 채워져요", "새벽물산 · 영업 관리"]);
    fireEvent.change(select, { target: { value: "p1" } });
    await waitFor(() => expect((screen.getByLabelText("자기소개서") as HTMLTextAreaElement).value).toContain("[문항 1] 지원 동기"));
    expect((screen.getByLabelText("회사") as HTMLInputElement).value).toBe("새벽물산");
    expect((screen.getByLabelText("직무") as HTMLInputElement).value).toBe("영업 관리");
    expect(mocks.fetchApplication).toHaveBeenCalledWith("p1");
  });

  it("지원서를 면접 입력으로 바꿀 때 빈 답은 빼고 순서대로 문항 번호를 붙이며, 쓴 답이 없으면 null", () => {
    const source = directSourceFromApplication({
      company_name: "새벽물산",
      job_role: null,
      questions: [
        { position: 0, prompt: "지원 동기", char_limit: null, answer: " 배우고 싶습니다. " },
        { position: 1, prompt: "빈 문항", char_limit: null, answer: "  " },
        { position: 2, prompt: "협업", char_limit: null, answer: "맞췄습니다." },
      ],
    });
    expect(source).toEqual({ company: "새벽물산", jobRole: "", coverLetter: "[문항 1] 지원 동기\n배우고 싶습니다.\n\n[문항 2] 협업\n맞췄습니다." });
    expect(directSourceFromApplication({ company_name: "a", job_role: "b", questions: [] })).toBeNull();
  });

  it("리포트 없이 회사·직무·자소서를 넣고 시작하면 입력을 탭에 저장하고 시작 화면으로 간다", () => {
    render(<InterviewPracticeList />);
    fill();
    fireEvent.click(screen.getByLabelText(/짧은 연습/));
    fireEvent.click(screen.getByRole("button", { name: /면접 시작하기/ }));
    expect(mocks.navigate).toHaveBeenCalledWith("/my/interview-practice/start?source=direct&mode=SHORT");
    expect(JSON.parse(sessionStorage.getItem("preview:interview-direct-draft") ?? "{}")).toMatchObject({ company: "새벽물산", jobRole: "영업 관리" });
  });

  it("자소서가 200자보다 짧으면 막고 안내한다", () => {
    render(<InterviewPracticeList />);
    fill({ letter: "짧은 자소서" });
    fireEvent.click(screen.getByRole("button", { name: /면접 시작하기/ }));
    expect(screen.getByRole("alert").textContent).toContain("200자");
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it("로그인했고 이용권이 없으면 시작 버튼을 막고 구매로 안내하며, 지난 면접을 불러온다", async () => {
    mocks.auth = { isLoading: false, isAuthenticated: true };
    mocks.summary = { interviewEnabled: true, interviewRemaining: 0, checkoutUrls: { interview: "https://x" } };
    render(<InterviewPracticeList />);
    expect((screen.getByRole("button", { name: /면접 시작하기/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("면접 이용권 구매")).toBeTruthy();
    expect(await screen.findByText("아직 본 면접이 없어요.")).toBeTruthy();
    expect(mocks.listInterviewSessions).toHaveBeenCalled();
  });
});
