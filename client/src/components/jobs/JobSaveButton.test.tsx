// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: { isAuthenticated: false, isLoading: false },
  saveJobPosting: vi.fn(async () => ({ id: "p1" })),
  listApplications: vi.fn(async () => [] as Array<{ posting_slug?: string | null }>),
  sendFunnelEvent: vi.fn(),
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => mocks.auth }));
vi.mock("@/lib/workspace", () => ({ saveJobPosting: mocks.saveJobPosting, listApplications: mocks.listApplications }));
vi.mock("@/lib/siteVisits", () => ({ sendFunnelEvent: mocks.sendFunnelEvent }));
vi.mock("wouter", () => ({ Link: ({ children, href }: { children: unknown; href: string }) => <a href={href}>{children as never}</a> }));
vi.mock("@/components/analyze/AnalyzeLoginModal", () => ({
  default: ({ open, onClose }: { open: boolean; onClose: () => void }) => (open ? <div role="dialog"><button onClick={onClose}>닫기</button></div> : null),
}));

import JobSaveButton from "./JobSaveButton";

const listing = { slug: "hyundai-2026h2", company: "현대자동차", closesAt: "2026-11-20T17:00:00+09:00" } as never;

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mocks.auth = { isAuthenticated: false, isLoading: false };
  mocks.listApplications.mockResolvedValue([]);
  window.history.replaceState(null, "", "/");
});

describe("JobSaveButton", () => {
  it("로그인 상태면 바로 담고 '담음'으로 바뀐다", async () => {
    mocks.auth = { isAuthenticated: true, isLoading: false };
    render(<JobSaveButton listing={listing} />);
    fireEvent.click(screen.getByRole("button", { name: "☆ 담기" }));
    await screen.findByRole("link", { name: /담음/ });
    expect(mocks.saveJobPosting).toHaveBeenCalledWith({ postingSlug: "hyundai-2026h2", company: "현대자동차", deadline: "2026-11-20T17:00:00+09:00" });
    expect(mocks.sendFunnelEvent).toHaveBeenCalledWith("content_cta_click", "job-save:hyundai-2026h2");
  });

  it("이미 담은 공고는 처음부터 '담음'", async () => {
    mocks.auth = { isAuthenticated: true, isLoading: false };
    mocks.listApplications.mockResolvedValue([{ posting_slug: "hyundai-2026h2" }]);
    render(<JobSaveButton listing={listing} />);
    expect(await screen.findByRole("link", { name: /담음/ })).toBeTruthy();
  });

  it("비로그인이면 로그인 창을 띄우고, 로그인이 끝나면 한 번만 자동으로 담는다", async () => {
    const { rerender } = render(<JobSaveButton listing={listing} />);
    fireEvent.click(screen.getByRole("button", { name: "☆ 담기" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(mocks.saveJobPosting).not.toHaveBeenCalled();
    mocks.auth = { isAuthenticated: true, isLoading: false };
    await act(async () => { rerender(<JobSaveButton listing={listing} />); });
    await waitFor(() => expect(mocks.saveJobPosting).toHaveBeenCalledTimes(1));
  });

  it("로그인 창을 닫으면 로그인해도 담지 않는다", async () => {
    const { rerender } = render(<JobSaveButton listing={listing} />);
    fireEvent.click(screen.getByRole("button", { name: "☆ 담기" }));
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    mocks.auth = { isAuthenticated: true, isLoading: false };
    await act(async () => { rerender(<JobSaveButton listing={listing} />); });
    expect(mocks.saveJobPosting).not.toHaveBeenCalled();
  });

  it("카카오 로그인에서 ?save=1 로 돌아오면 자동으로 담고 주소에서 지운다", async () => {
    window.history.replaceState(null, "", "/jobs/hyundai-2026h2?save=1");
    mocks.auth = { isAuthenticated: true, isLoading: false };
    render(<JobSaveButton listing={listing} />);
    await waitFor(() => expect(mocks.saveJobPosting).toHaveBeenCalledTimes(1));
    expect(window.location.search).toBe("");
  });

  it("실패하면 다시 누를 수 있게 안내한다", async () => {
    mocks.auth = { isAuthenticated: true, isLoading: false };
    mocks.saveJobPosting.mockRejectedValueOnce(new Error("x"));
    render(<JobSaveButton listing={listing} />);
    fireEvent.click(screen.getByRole("button", { name: "☆ 담기" }));
    expect(await screen.findByText("담지 못했어요. 다시 눌러 주세요")).toBeTruthy();
    expect(screen.getByRole("button", { name: "☆ 담기" })).toBeTruthy();
  });
});
