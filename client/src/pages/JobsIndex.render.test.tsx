// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";

vi.mock("wouter", () => ({
  useLocation: () => ["/jobs", vi.fn()],
  Link: ({ href, children, className }: { href: string; children: unknown; className?: string }) => (
    <a href={href} className={className}>
      {children as never}
    </a>
  ),
}));
// 전역 헤더(SiteHeader)의 로그인 버튼은 AuthProvider 가 필요하다. 이 테스트는 목록만 본다.
vi.mock("@/components/AuthButton", () => ({ default: () => null }));

import { JOB_POSTINGS } from "@/constants/jobPostings";
import { closedPostings, dDayLabel, openPostings } from "@/lib/jobPostingDates";
import JobsIndex from "./JobsIndex";

// 신세계(10-12 18:00 마감)가 열려 있고, 그보다 앞서 마감된 공고가 있으면 마감 표로 가는 시각.
const NOW = new Date("2026-10-09T15:30:00+09:00");

describe("JobsIndex", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("links every posting to its own page", () => {
    render(<JobsIndex />);
    for (const posting of JOB_POSTINGS) {
      const link = screen.getByText(posting.title).closest("a");
      expect(link?.getAttribute("href"), posting.slug).toBe(`/jobs/${posting.slug}`);
      expect(link?.textContent, posting.slug).toContain(posting.roles);
    }
  });

  it("puts open postings first with D-n and closed ones under their own heading", () => {
    render(<JobsIndex />);
    const open = openPostings(JOB_POSTINGS, NOW);
    const closed = closedPostings(JOB_POSTINGS, NOW);
    expect(open.length).toBeGreaterThan(0);
    const firstOpen = screen.getByText(open[0].title).closest("a") as HTMLElement;
    expect(within(firstOpen).getByText(dDayLabel(open[0].closesAt, NOW))).toBeTruthy();

    const closedSection = document.getElementById("closed-jobs")?.closest("section");
    if (closed.length === 0) {
      expect(closedSection).toBeFalsy();
      return;
    }
    expect(closedSection).toBeTruthy();
    for (const posting of closed) expect(within(closedSection as HTMLElement).getByText(posting.title)).toBeTruthy();
    for (const posting of open) expect(within(closedSection as HTMLElement).queryByText(posting.title)).toBeNull();
  });

  it("says so when nothing is open", () => {
    vi.setSystemTime(new Date("2030-01-01T00:00:00+09:00"));
    render(<JobsIndex />);
    expect(screen.getByText(/지금 접수 중인 공고가 없어요/)).toBeTruthy();
  });
});
