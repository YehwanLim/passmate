// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ navigate: vi.fn(), createApplication: vi.fn() }));
vi.mock("wouter", () => ({ useLocation: () => ["/my", mocks.navigate], Link: ({ children }: { children: unknown }) => children }));
vi.mock("@/hooks/useRequireAuth", () => ({ useRequireAuth: () => ({ user: { id: "u1" }, isLoading: false }) }));
vi.mock("@/components/SiteHeader", () => ({ default: () => null }));
vi.mock("@/components/SubtleBackground", () => ({ default: () => null }));
vi.mock("@/components/my/ExperienceVault", () => ({ default: () => <div>경험 탭 내용</div> }));
vi.mock("@/components/my/MyCreditsPanel", () => ({ default: () => <aside>이용권 칸</aside> }));
vi.mock("@/lib/apiAuth", () => ({
  getAuthorizationHeader: async () => ({}),
  AuthenticationRequiredError: class extends Error {},
}));
vi.mock("@/lib/workspace", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/workspace")>()),
  createApplication: mocks.createApplication,
}));

import MyProjects from "./MyProjects";

const row = (id: string, deadline: string | null, extra = {}) => ({
  id, title: `${id} 지원서`, company_name: id, job_role: null, created_at: "2026-09-01T00:00:00Z",
  analysis_count: 0, total_chars: 0, summary: null, deadline, updated_at: "2026-09-01T00:00:00Z",
  draft_question_count: 3, answered_count: 1, latest_analysis_id: null, ...extra,
});

beforeEach(() => {
  // 앞 테스트가 내 경험 탭으로 바꾸며 남긴 #experiences 를 지운다.
  window.history.replaceState(null, "", "/");
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-03T03:00:00Z"));
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify([
    row("later", "2026-10-19T08:00:00Z"),
    row("soon", "2026-10-05T14:59:00Z"),
  ]), { status: 200, headers: { "content-type": "application/json" } })));
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe("내 지원서 현황판", () => {
  it("마감 임박순으로 D-day 와 작성 진행을 보여 준다", async () => {
    render(<MyProjects />);
    const cards = await screen.findAllByTestId("application-card");
    expect(within(cards[0]).getByText("soon")).toBeTruthy();
    expect(within(cards[0]).getByText("D-2")).toBeTruthy();
    expect(within(cards[0]).getByText("3문항 중 1문항 작성")).toBeTruthy();
  });

  it("새 지원서를 만들면 작업 화면으로 간다", async () => {
    mocks.createApplication.mockResolvedValue({ id: "p-new" });
    render(<MyProjects />);
    fireEvent.click(await screen.findByRole("button", { name: "새 지원서" }));
    fireEvent.change(screen.getByLabelText("회사"), { target: { value: "한솔제지" } });
    fireEvent.change(screen.getByLabelText("문항 1"), { target: { value: "지원 동기" } });
    fireEvent.click(screen.getByRole("button", { name: "만들기" }));
    await waitFor(() => expect(mocks.createApplication).toHaveBeenCalledWith(expect.objectContaining({
      company: "한솔제지",
      questions: [{ prompt: "지원 동기", charLimit: null, answer: "" }],
    })));
    expect(mocks.navigate).toHaveBeenCalledWith("/my/p-new");
  });

  it("내 경험 탭으로 바꿀 수 있다", async () => {
    render(<MyProjects />);
    fireEvent.click(await screen.findByRole("tab", { name: "내 경험" }));
    expect(screen.getByText("경험 탭 내용")).toBeTruthy();
  });

  it("이 화면에 있을 때 주소가 /my#experiences 로 바뀌면(편집기의 경험 링크 등) 탭이 바로 바뀐다", async () => {
    render(<MyProjects />);
    await screen.findByRole("tab", { name: "내 지원서", selected: true });
    act(() => window.history.pushState(null, "", "/my#experiences"));
    expect(await screen.findByText("경험 탭 내용")).toBeTruthy();
    expect(screen.getByRole("tab", { name: "내 경험" }).getAttribute("aria-selected")).toBe("true");
  });

  it("카드는 버튼 없이 통째로 열린다 — 자소서는 지원서 화면, 기업 분석은 리포트로", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify([
      row("draft", null, { question_count: 0 }),
      row("done", null, { question_count: 2, latest_analysis_id: "a1", summary: "데이터로 문제를 좁히는 기획자로 읽혀요. 다만 결과 수치가 비어 있어요.", latest_status: "SUCCESS" }),
      row("corp", null, { kind: "COMPANY", latest_analysis_id: "c1", summary: "회사 요약", latest_status: "SUCCESS" }),
    ]), { status: 200, headers: { "content-type": "application/json" } })));
    render(<MyProjects />);
    const cards = await screen.findAllByTestId("application-card");
    const draft = cards.find((card) => within(card).queryByText("draft"))!;
    expect(within(draft).getByText(/아직 진단받지 않은 지원서예요/)).toBeTruthy();
    expect(within(draft).getByText("3개 문항")).toBeTruthy();
    expect(within(draft).queryByText("0개 문항")).toBeNull();
    fireEvent.click(within(draft).getByRole("button", { name: "draft 열기" }));
    expect(mocks.navigate).toHaveBeenCalledWith("/my/draft");
    expect(screen.queryByRole("alert")).toBeNull();

    const done = cards.find((card) => within(card).queryByText("done"))!;
    // "한줄 요약" 이름표 없이 요약 전문만
    expect(within(done).queryByText("한줄 요약")).toBeNull();
    expect(within(done).getByText("데이터로 문제를 좁히는 기획자로 읽혀요. 다만 결과 수치가 비어 있어요.")).toBeTruthy();
    expect(within(done).queryByRole("button", { name: /리포트 보기|작성한 자소서 보기/ })).toBeNull();
    fireEvent.click(within(done).getByRole("button", { name: "done 열기" }));
    expect(mocks.navigate).toHaveBeenCalledWith("/my/done");

    const corp = cards.find((card) => within(card).queryByText("corp"))!;
    fireEvent.click(within(corp).getByRole("button", { name: "corp 열기" }));
    expect(mocks.navigate).toHaveBeenCalledWith("/company-report?analysisId=c1");
  });

  it("회원 탈퇴는 마이페이지에 두지 않는다(내 이용권 화면 맨 아래로 옮김)", async () => {
    render(<MyProjects />);
    await screen.findAllByTestId("application-card");
    expect(screen.queryByRole("button", { name: "회원 탈퇴" })).toBeNull();
  });

  it("어느 탭에서든 이용권 칸이 함께 보인다", async () => {
    render(<MyProjects />);
    expect(await screen.findByText("이용권 칸")).toBeTruthy();
    fireEvent.click(await screen.findByRole("tab", { name: "내 경험" }));
    expect(screen.getByText("이용권 칸")).toBeTruthy();
  });
});
