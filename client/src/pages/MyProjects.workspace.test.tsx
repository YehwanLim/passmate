// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ navigate: vi.fn(), createApplication: vi.fn(), listExperiences: vi.fn() }));
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
  listExperiences: mocks.listExperiences,
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
  mocks.listExperiences.mockResolvedValue([{ id: "e1" }, { id: "e2" }]);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-03T03:00:00Z"));
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify([
    row("later", "2026-10-19T08:00:00Z"),
    row("soon", "2026-10-05T14:59:00Z"),
  ]), { status: 200, headers: { "content-type": "application/json" } })));
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
const rowsOf = async () => screen.findAllByTestId("application-row");
const nameOf = (el: HTMLElement) => within(el).getAllByRole("button")[0].getAttribute("aria-label");

describe("마이페이지 · 내 지원서", () => {
  it("탭은 종류 셋(내 지원서·내 경험·내 기업)이고 숫자를 단다", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json([row("a", null), row("corp", null, { kind: "COMPANY", latest_analysis_id: "c1", latest_status: "SUCCESS" })])));
    render(<MyProjects />);
    await rowsOf();
    const tabs = screen.getAllByRole("tab").map((tab) => tab.textContent);
    expect(tabs).toEqual(["내 지원서1", "내 경험2", "내 기업1"]);
  });

  it("작성 중을 위로, 마감 가까운 순 — 상태는 '작성 중'만(문항 수·막대 없음)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json([
      row("done-soon", "2026-10-04T14:59:00Z", { latest_analysis_id: "a1", latest_status: "SUCCESS", summary: "요약 문장" }),
      row("later", "2026-10-19T08:00:00Z"),
      row("soon", "2026-10-05T14:59:00Z"),
      row("past", "2026-09-30T08:00:00Z"),
    ])));
    render(<MyProjects />);
    const rows = await rowsOf();
    expect(rows.map(nameOf)).toEqual(["soon 열기", "later 열기", "done-soon 열기", "past 열기"]);
    expect(within(rows[0]).getByText("D-2")).toBeTruthy();
    expect(within(rows[0]).getByText("작성 중")).toBeTruthy();
    expect(within(rows[0]).queryByText(/문항/)).toBeNull();
    expect(within(rows[2]).getByText("분석 완료")).toBeTruthy();
    expect(within(rows[2]).getByText("요약 문장")).toBeTruthy();
    expect(within(rows[3]).getByText("마감 지남")).toBeTruthy();
  });

  it("상태로 거른다(전체·작성 중·분석 완료)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json([
      row("draft", null),
      row("done", null, { latest_analysis_id: "a1", latest_status: "SUCCESS" }),
    ])));
    render(<MyProjects />);
    await rowsOf();
    fireEvent.click(screen.getByRole("button", { name: /^분석 완료/ }));
    expect((await rowsOf()).map(nameOf)).toEqual(["done 열기"]);
    fireEvent.click(screen.getByRole("button", { name: /^작성 중/ }));
    expect((await rowsOf()).map(nameOf)).toEqual(["draft 열기"]);
  });

  it("줄 아무 데나 누르면 지원서 화면으로 간다", async () => {
    render(<MyProjects />);
    const rows = await rowsOf();
    fireEvent.click(rows[0]);
    expect(mocks.navigate).toHaveBeenCalledWith("/my/soon");
  });

  it("새 지원서를 만들면 작업 화면으로 간다", async () => {
    mocks.createApplication.mockResolvedValue({ id: "p-new" });
    render(<MyProjects />);
    fireEvent.click(await screen.findByRole("button", { name: /새 지원서/ }));
    fireEvent.change(screen.getByLabelText("회사"), { target: { value: "한솔제지" } });
    fireEvent.change(screen.getByLabelText("문항 1"), { target: { value: "지원 동기" } });
    fireEvent.click(screen.getByRole("button", { name: "만들기" }));
    await waitFor(() => expect(mocks.createApplication).toHaveBeenCalledWith(expect.objectContaining({
      company: "한솔제지",
      questions: [{ prompt: "지원 동기", charLimit: null, answer: "" }],
    })));
    expect(mocks.navigate).toHaveBeenCalledWith("/my/p-new");
  });

  it("내 기업 탭은 기업 분석만 보여 주고, 누르면 리포트로 바로 간다", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json([
      row("draft", null),
      row("corp", null, { kind: "COMPANY", latest_analysis_id: "c1", summary: "회사 요약", latest_status: "SUCCESS" }),
    ])));
    render(<MyProjects />);
    expect((await rowsOf()).map(nameOf)).toEqual(["draft 열기"]);
    fireEvent.click(screen.getByRole("tab", { name: /^내 기업/ }));
    const rows = await screen.findAllByTestId("company-row");
    expect(rows).toHaveLength(1);
    expect(within(rows[0]).getByText("회사 요약")).toBeTruthy();
    fireEvent.click(rows[0]);
    expect(mocks.navigate).toHaveBeenCalledWith("/company-report?analysisId=c1");
    expect(window.location.hash).toBe("#company");
  });

  it("내 경험 탭으로 바꿀 수 있다", async () => {
    render(<MyProjects />);
    fireEvent.click(await screen.findByRole("tab", { name: /^내 경험/ }));
    expect(screen.getByText("경험 탭 내용")).toBeTruthy();
  });

  it("이 화면에 있을 때 주소가 /my#experiences 로 바뀌면(편집기의 경험 링크 등) 탭이 바로 바뀐다", async () => {
    render(<MyProjects />);
    await screen.findByRole("tab", { name: /^내 지원서/, selected: true });
    act(() => window.history.pushState(null, "", "/my#experiences"));
    expect(await screen.findByText("경험 탭 내용")).toBeTruthy();
    expect(screen.getByRole("tab", { name: /^내 경험/ }).getAttribute("aria-selected")).toBe("true");
  });

  it("회원 탈퇴는 마이페이지에 두지 않는다(내 이용권 화면 맨 아래로 옮김)", async () => {
    render(<MyProjects />);
    await rowsOf();
    expect(screen.queryByRole("button", { name: "회원 탈퇴" })).toBeNull();
  });

  it("어느 탭에서든 남은 이용권 한 줄이 머리말에 보인다", async () => {
    render(<MyProjects />);
    expect(await screen.findByText("이용권 칸")).toBeTruthy();
    fireEvent.click(await screen.findByRole("tab", { name: /^내 경험/ }));
    expect(screen.getByText("이용권 칸")).toBeTruthy();
  });
});
