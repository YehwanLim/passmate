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
import JobPostingSection from "./JobPostingSection";

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

  it("hides the tab when nothing is open and no posting was passed", () => {
    vi.setSystemTime(new Date("2030-01-01T00:00:00+09:00"));
    render(<JobPostingSection value={null} onChange={vi.fn()} isAuthenticated onRequireLogin={vi.fn()} />);
    expect(screen.queryByRole("tab", { name: "접수 중인 공고" })).toBeNull();
  });
});
