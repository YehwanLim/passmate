// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

vi.mock("wouter", () => ({
  Link: ({ href, children, className }: { href: string; children: unknown; className?: string }) => (
    <a href={href} className={className}>
      {children as never}
    </a>
  ),
}));

import { JOB_POSTINGS } from "@/constants/jobPostings";
import { dDayLabel, openPostings } from "@/lib/jobPostingDates";
import OpenJobsStrip from "./OpenJobsStrip";

const NOW = new Date("2026-10-09T15:30:00+09:00");

describe("OpenJobsStrip", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("says how many companies are open and links the nearest deadline, plus the full list", () => {
    render(<OpenJobsStrip />);
    const open = openPostings(JOB_POSTINGS, NOW);
    const companyCount = new Set(open.map(posting => posting.shortName)).size;
    expect(screen.getByText(`${companyCount}개 기업`)).toBeTruthy();
    const soonest = screen.getByText(open[0].shortName, { exact: false }).closest("a");
    expect(soonest?.getAttribute("href")).toBe(`/jobs/${open[0].slug}`);
    expect(soonest?.textContent).toContain(dDayLabel(open[0].closesAt, NOW));
    expect(screen.getByText(/공고 보기/).closest("a")?.getAttribute("href")).toBe("/jobs");
  });

  it("renders nothing when every posting has closed", () => {
    vi.setSystemTime(new Date("2030-01-01T00:00:00+09:00"));
    const { container } = render(<OpenJobsStrip />);
    expect(container.innerHTML).toBe("");
  });
});
