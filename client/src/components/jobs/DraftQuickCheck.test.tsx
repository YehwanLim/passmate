// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const mocks = vi.hoisted(() => ({ navigate: vi.fn(), sendFunnelEvent: vi.fn(async (_event: string, _where?: string) => true) }));

vi.mock("wouter", () => ({ useLocation: () => ["/jobs/x", mocks.navigate] }));
vi.mock("@/lib/siteVisits", () => ({ sendFunnelEvent: mocks.sendFunnelEvent }));

import { ANALYZE_DRAFT_KEY, takeAnalyzeDraft } from "@/lib/analyzeDraft";
import { DraftQuickCheck } from "./DraftQuickCheck";

const listing = { slug: "acme-2026", company: "에이크미" } as Parameters<typeof DraftQuickCheck>[0]["listing"];
const TEXT = "저는 어릴 때부터 사람을 좋아했습니다. 그래서 열심히 일했고 손님들이 좋아했습니다. 앞으로도 최선을 다하겠습니다.";

describe("DraftQuickCheck", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    vi.clearAllMocks();
  });
  afterEach(cleanup);

  it("처음부터 열린 칸에 예시를 보여주고, 글을 넣어 점검하면 예시 대신 결과가 나오며 서버로는 클릭 기록만 간다", () => {
    render(<DraftQuickCheck listing={listing} />);
    expect(screen.getByRole("heading", { name: /에이크미 자소서, 내기 전에 30초만 점검해 보세요/ })).toBeTruthy();
    expect(screen.getByRole("list", { name: "점검 예시" })).toBeTruthy();

    const check = screen.getByRole("button", { name: "점검하기" });
    expect((check as HTMLButtonElement).disabled).toBe(true);

    fireEvent.focus(screen.getByLabelText("자소서 문단"));
    fireEvent.change(screen.getByLabelText("자소서 문단"), { target: { value: TEXT } });
    fireEvent.click(check);
    expect(screen.queryByRole("list", { name: "점검 예시" })).toBeNull();

    const results = screen.getByRole("list", { name: "점검 결과" });
    expect(results.textContent).toContain("어릴 때부터");
    expect(results.textContent).toContain("열심히");
    expect(mocks.sendFunnelEvent.mock.calls.map(call => call[1])).toEqual([
      "job-check:focus:acme-2026",
      "job-check:run:acme-2026",
    ]);
    // 글 내용은 어떤 기록에도 실리지 않는다.
    expect(JSON.stringify(mocks.sendFunnelEvent.mock.calls)).not.toContain("어릴");
  });

  it("글을 고치면 지난 결과를 지운다", () => {
    render(<DraftQuickCheck listing={listing} />);
    fireEvent.change(screen.getByLabelText("자소서 문단"), { target: { value: TEXT } });
    fireEvent.click(screen.getByRole("button", { name: "점검하기" }));
    fireEvent.change(screen.getByLabelText("자소서 문단"), { target: { value: `${TEXT} 더` } });
    expect(screen.queryByRole("list", { name: "점검 결과" })).toBeNull();
  });

  it("이 글로 분석하기는 회사·글을 분석 폼 초안으로 넘기고 공고는 주소로 넘긴다", () => {
    render(<DraftQuickCheck listing={listing} />);
    fireEvent.change(screen.getByLabelText("자소서 문단"), { target: { value: `  ${TEXT}  ` } });
    fireEvent.click(screen.getByRole("button", { name: "점검하기" }));
    fireEvent.click(screen.getByRole("button", { name: "이 글로 분석하기" }));

    expect(mocks.navigate).toHaveBeenCalledWith("/analyze?job=acme-2026");
    expect(window.sessionStorage.getItem(ANALYZE_DRAFT_KEY)).not.toBeNull();
    const draft = takeAnalyzeDraft();
    expect(draft).toEqual(expect.objectContaining({ company: "에이크미", jobPosting: null }));
    expect(draft?.questions).toEqual([expect.objectContaining({ question: "", answer: TEXT })]);
  });
});
