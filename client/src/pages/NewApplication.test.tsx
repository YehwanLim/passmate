// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  createApplication: vi.fn(),
  updateApplicationMeta: vi.fn(),
  fetchApplication: vi.fn(),
  saveApplicationQuestions: vi.fn(),
}));
vi.mock("wouter", () => ({ useLocation: () => ["/my/new", mocks.navigate], Link: ({ children }: { children: unknown }) => children }));
vi.mock("@/hooks/useRequireAuth", () => ({ useRequireAuth: () => ({ user: { id: "u1" }, isLoading: false }) }));
vi.mock("@/components/SiteHeader", () => ({ default: () => null }));
vi.mock("@/lib/workspace", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/workspace")>()),
  createApplication: mocks.createApplication,
  updateApplicationMeta: mocks.updateApplicationMeta,
  fetchApplication: mocks.fetchApplication,
  saveApplicationQuestions: mocks.saveApplicationQuestions,
}));
// 공고 읽기는 서버를 부르니, 누르면 정리된 공고를 넘겨주는 버튼으로 바꿔 둔다.
vi.mock("@/components/analyze/JobPostingSection", () => ({
  default: ({ onChange }: { onChange: (record: unknown) => void }) => (
    <button
      type="button"
      onClick={() => onChange({ id: "jp-1", sourceUrl: "https://example.com/job", summary: { title: "", company: "CJ제일제당", role: "브랜드 마케팅", responsibilities: [], requirements: [], preferred: [], keywords: [] } })}
    >
      공고 읽기(테스트)
    </button>
  ),
}));

import NewApplication from "./NewApplication";

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("새 지원서 편집기", () => {
  it("빈 편집기로 열리고, 회사·직무·마감을 다 적은 뒤 '지원서 만들기'를 눌러야 만들어 작성 화면으로 바꿔 끼운다", async () => {
    mocks.createApplication.mockResolvedValue({ id: "p-new" });
    render(<NewApplication />);
    fireEvent.change(screen.getByLabelText("문항 원문"), { target: { value: "지원 동기" } });
    fireEvent.change(screen.getByLabelText("답변"), { target: { value: "데이터로 일하고 싶습니다." } });
    fireEvent.change(screen.getByLabelText("회사"), { target: { value: "한솔제지" } });
    fireEvent.blur(screen.getByLabelText("회사"));
    fireEvent.change(screen.getByLabelText("직무"), { target: { value: "국내영업" } });
    expect(mocks.createApplication).not.toHaveBeenCalled();
    fireEvent.click(screen.getAllByRole("button", { name: "지원서 만들기" })[0]);
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith("/my/p-new", { replace: true }));
    expect(mocks.createApplication).toHaveBeenCalledWith(expect.objectContaining({
      company: "한솔제지",
      jobKeyword: "국내영업",
      questions: [{ prompt: "지원 동기", charLimit: null, answer: "데이터로 일하고 싶습니다." }],
    }));
    expect(mocks.saveApplicationQuestions).not.toHaveBeenCalled();
  });

  it("공고를 읽으면 회사·직무만 채우고, 만들 때 공고를 지원서에 붙인다", async () => {
    mocks.createApplication.mockResolvedValue({ id: "p2" });
    mocks.updateApplicationMeta.mockResolvedValue({});
    render(<NewApplication />);
    fireEvent.click(screen.getByRole("button", { name: "공고 읽기(테스트)" }));
    expect((screen.getByLabelText("회사") as HTMLInputElement).value).toBe("CJ제일제당");
    expect(mocks.createApplication).not.toHaveBeenCalled();
    fireEvent.click(screen.getAllByRole("button", { name: "지원서 만들기" })[0]);
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith("/my/p2", { replace: true }));
    expect(mocks.createApplication).toHaveBeenCalledWith(expect.objectContaining({ company: "CJ제일제당", jobKeyword: "브랜드 마케팅" }));
    expect(mocks.updateApplicationMeta).toHaveBeenCalledWith("p2", { jobPostingId: "jp-1" });
  });

  it("만드는 사이에 친 글은 넘어가기 전에 한 번 더 저장한다", async () => {
    let resolveCreate: (value: { id: string }) => void = () => undefined;
    mocks.createApplication.mockImplementation(() => new Promise((resolve) => { resolveCreate = resolve; }));
    mocks.fetchApplication.mockResolvedValue({ questions_updated_at: "2026-10-08T00:00:00.000Z" });
    mocks.saveApplicationQuestions.mockResolvedValue({ questions_updated_at: "2026-10-08T00:00:01.000Z" });
    render(<NewApplication />);
    fireEvent.change(screen.getByLabelText("회사"), { target: { value: "한솔제지" } });
    fireEvent.click(screen.getAllByRole("button", { name: "지원서 만들기" })[0]);
    fireEvent.change(screen.getByLabelText("답변"), { target: { value: "만드는 중에 쓴 글" } });
    resolveCreate({ id: "p3" });
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith("/my/p3", { replace: true }));
    expect(mocks.saveApplicationQuestions).toHaveBeenCalledWith(
      "p3",
      [{ prompt: "", charLimit: null, answer: "만드는 중에 쓴 글" }],
      "2026-10-08T00:00:00.000Z",
    );
  });

  it("회사 없이 초안 쓰기를 누르면 회사부터 적으라고 알린다", async () => {
    render(<NewApplication />);
    fireEvent.change(screen.getByLabelText("문항 원문"), { target: { value: "지원 동기" } });
    fireEvent.click(screen.getByRole("button", { name: /내 경험으로 초안 쓰기/ }));
    expect(await screen.findByText("회사를 적고 지원서를 먼저 만들어 주세요. 만든 뒤에 초안을 쓸 수 있어요.")).toBeTruthy();
    expect(mocks.createApplication).not.toHaveBeenCalled();
  });

  it("만들지 못하면 안내하고 그대로 둔다", async () => {
    mocks.createApplication.mockRejectedValue(new Error("boom"));
    render(<NewApplication />);
    fireEvent.change(screen.getByLabelText("회사"), { target: { value: "한솔제지" } });
    fireEvent.click(screen.getAllByRole("button", { name: "지원서 만들기" })[0]);
    expect(await screen.findByText("지원서를 만들지 못했어요. 잠시 후 다시 시도해 주세요.")).toBeTruthy();
    expect(mocks.navigate).not.toHaveBeenCalled();
  });
});

describe("채용 공고에서 넘어온 새 지원서(?job=)", () => {
  afterEach(() => window.history.replaceState(null, "", "/"));

  it("공고의 회사·마감일·공개 문항을 채운 채로 열고, 그대로 만들 수 있다", async () => {
    window.history.replaceState(null, "", "/my/new?job=shinsegae-2027");
    mocks.createApplication.mockResolvedValue({ id: "p-job" });
    render(<NewApplication />);
    expect((screen.getByLabelText("회사") as HTMLInputElement).value).toBe("신세계그룹");
    fireEvent.click(screen.getAllByRole("button", { name: "지원서 만들기" })[0]);
    await waitFor(() => expect(mocks.createApplication).toHaveBeenCalled());
    const sent = mocks.createApplication.mock.calls[0][0];
    expect(sent.company).toBe("신세계그룹");
    expect(sent.deadline).toBe("2026-10-12T23:59:00+09:00");
    expect(sent.questions).toHaveLength(3);
    expect(sent.questions[0]).toEqual(expect.objectContaining({ charLimit: 1000, answer: "" }));
  });
});
