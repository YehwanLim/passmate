// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const mocks = vi.hoisted(() => ({ requestJobPosting: vi.fn() }));

vi.mock("@/lib/jobPosting", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/jobPosting")>()),
  requestJobPosting: mocks.requestJobPosting,
}));

import { JOB_POSTINGS } from "@/constants/jobPostings";
import { JOB_POSTING_DETAILS, postingTextOf } from "@/constants/jobPostingDetails";
import { openPostings } from "@/lib/jobPostingDates";
import JobPostingSection, { matchesCompany } from "./JobPostingSection";

const NOW = new Date("2026-10-09T15:30:00+09:00");

describe("JobPostingSection — 접수 중인 공고 탭", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    mocks.requestJobPosting.mockReset();
    mocks.requestJobPosting.mockResolvedValue({ kind: "network_error" });
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("lists open postings, reports the pick and reads the picked posting as text", async () => {
    const onPickListed = vi.fn();
    render(
      <JobPostingSection value={null} onChange={vi.fn()} isAuthenticated onRequireLogin={vi.fn()} onPickListed={onPickListed} />
    );
    fireEvent.click(screen.getByRole("tab", { name: "접수 중인 공고" }));

    const open = openPostings(JOB_POSTINGS, NOW);
    expect(screen.getAllByRole("radio")).toHaveLength(open.length);
    const target = open[0];
    fireEvent.click(screen.getByRole("radio", { name: new RegExp(target.title) }));
    expect(onPickListed).toHaveBeenCalledWith(target, JOB_POSTING_DETAILS[target.slug]);

    fireEvent.click(screen.getByRole("button", { name: "공고 불러오기" }));
    await waitFor(() => expect(mocks.requestJobPosting).toHaveBeenCalledTimes(1));
    expect(mocks.requestJobPosting).toHaveBeenCalledWith({ text: postingTextOf(target, JOB_POSTING_DETAILS[target.slug]) });
  });

  it("opens on the posting passed from its page, even after it closed", () => {
    const closed = JOB_POSTINGS.find(posting => new Date(posting.closesAt) <= NOW);
    if (!closed) return;
    render(
      <JobPostingSection value={null} onChange={vi.fn()} isAuthenticated onRequireLogin={vi.fn()} initialListedSlug={closed.slug} />
    );
    expect(screen.getByRole("tab", { name: "접수 중인 공고" }).getAttribute("aria-selected")).toBe("true");
    expect((screen.getByRole("radio", { name: new RegExp(closed.title) }) as HTMLInputElement).checked).toBe(true);
  });

  it("sends a guest to login instead of reading the posting", () => {
    const onRequireLogin = vi.fn();
    render(<JobPostingSection value={null} onChange={vi.fn()} isAuthenticated={false} onRequireLogin={onRequireLogin} />);
    fireEvent.click(screen.getByRole("tab", { name: "접수 중인 공고" }));
    fireEvent.click(screen.getAllByRole("radio")[0]);
    fireEvent.click(screen.getByRole("button", { name: "공고 불러오기" }));
    expect(onRequireLogin).toHaveBeenCalled();
    expect(mocks.requestJobPosting).not.toHaveBeenCalled();
  });

  it("shows only open postings similar to the typed company", () => {
    const { rerender } = render(
      <JobPostingSection value={null} onChange={vi.fn()} isAuthenticated onRequireLogin={vi.fn()} company="" />
    );
    expect(screen.queryByRole("tab", { name: "접수 중인 공고" })).toBeNull();

    const open = openPostings(JOB_POSTINGS, NOW);
    const target = open[0];
    rerender(
      <JobPostingSection value={null} onChange={vi.fn()} isAuthenticated onRequireLogin={vi.fn()} company={target.company} />
    );
    fireEvent.click(screen.getByRole("tab", { name: "접수 중인 공고" }));
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(open.filter(posting => matchesCompany(posting, target.company)).length);
    expect(screen.getByRole("radio", { name: new RegExp(target.title) })).toBeTruthy();

    // 회사를 바꿔 비슷한 공고가 없어지면 탭이 사라지고 링크 칸으로 돌아간다
    rerender(
      <JobPostingSection value={null} onChange={vi.fn()} isAuthenticated onRequireLogin={vi.fn()} company="없는회사이름" />
    );
    expect(screen.queryByRole("tab", { name: "접수 중인 공고" })).toBeNull();
    expect(screen.getByRole("tab", { name: "링크" }).getAttribute("aria-selected")).toBe("true");
  });

  it("matches company names loosely", () => {
    const cj = JOB_POSTINGS.find(posting => posting.company === "CJ그룹");
    if (!cj) return;
    expect(matchesCompany(cj, "CJ제일제당")).toBe(true);
    expect(matchesCompany(cj, "cj 그룹")).toBe(true);
    expect(matchesCompany(cj, "올리브영")).toBe(true);
    expect(matchesCompany(cj, "삼성전자")).toBe(false);
    expect(matchesCompany(cj, "C")).toBe(false);
  });

  it("keeps the how-to copy behind the help button", () => {
    render(<JobPostingSection value={null} onChange={vi.fn()} isAuthenticated onRequireLogin={vi.fn()} company="" />);
    expect(screen.queryByText(/지원하려는 공고를 넣으면/)).toBeNull();
    expect(screen.queryByText(/링크로 열리지 않는 사이트/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "채용공고 넣는 법" }));
    expect(screen.getByText(/지원하려는 공고를 넣으면/)).toBeTruthy();
    expect(screen.getByText(/링크로 열리지 않는 사이트/)).toBeTruthy();
  });

  it("hides the tab when nothing is open and no posting was passed", () => {
    vi.setSystemTime(new Date("2030-01-01T00:00:00+09:00"));
    render(<JobPostingSection value={null} onChange={vi.fn()} isAuthenticated onRequireLogin={vi.fn()} />);
    expect(screen.queryByRole("tab", { name: "접수 중인 공고" })).toBeNull();
  });
});
