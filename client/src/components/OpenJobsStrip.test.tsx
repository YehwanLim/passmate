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

  it("links up to six open postings by nearest deadline, with D-n, and the full list", () => {
    render(<OpenJobsStrip />);
    const expected = openPostings(JOB_POSTINGS, NOW).slice(0, 6);
    const links = Array.from(document.querySelectorAll("li a"));
    expect(links.map(link => link.getAttribute("href"))).toEqual(expected.map(posting => `/jobs/${posting.slug}`));
    expect(links[0].textContent).toContain(dDayLabel(expected[0].closesAt, NOW));
    expect(screen.getByText(/전체 보기/).closest("a")?.getAttribute("href")).toBe("/jobs");
  });

  it("renders nothing when every posting has closed", () => {
    vi.setSystemTime(new Date("2030-01-01T00:00:00+09:00"));
    const { container } = render(<OpenJobsStrip />);
    expect(container.innerHTML).toBe("");
  });
});
