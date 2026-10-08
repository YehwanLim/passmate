// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

const mocks = vi.hoisted(() => ({ slug: "" }));

vi.mock("wouter", () => ({
  useParams: () => ({ slug: mocks.slug }),
  useLocation: () => ["/jobs/x", vi.fn()],
  Link: ({ href, children, className }: { href: string; children: unknown; className?: string }) => (
    <a href={href} className={className}>
      {children as never}
    </a>
  ),
}));
vi.mock("@/components/AuthButton", () => ({ default: () => null }));

import { JOB_POSTINGS } from "@/constants/jobPostings";
import { JOB_POSTING_DETAILS } from "@/constants/jobPostingDetails";
import JobPostingPage from "./JobPostingPage";

const posting = JOB_POSTINGS[0];

describe("JobPostingPage", () => {
  beforeEach(() => {
    document.head.innerHTML = "<title>shell</title>";
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-09T15:30:00+09:00"));
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("shows the facts and the official link without questions, sets its meta and starts the three flows with the posting", () => {
    mocks.slug = posting.slug;
    const detail = JOB_POSTING_DETAILS[posting.slug];
    render(<JobPostingPage />);

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(posting.title);
    for (const fact of detail.facts) expect(screen.getByText(fact.label)).toBeTruthy();
    expect(screen.queryByText("자소서 문항")).toBeNull();
    expect(screen.queryByText("무엇을 묻나")).toBeNull();
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe(
      `https://pre-view.me/jobs/${posting.slug}`
    );

    const company = encodeURIComponent(posting.company);
    expect(screen.getByText("내 경험으로 초안 쓰기").closest("a")?.getAttribute("href")).toBe(`/my/new?job=${posting.slug}`);
    expect(screen.getByText("자소서 분석하기").closest("a")?.getAttribute("href")).toBe(
      `/analyze?company=${company}&job=${posting.slug}`
    );
    expect(screen.getByText("기업 분석하기").closest("a")?.getAttribute("href")).toBe(
      `/company-analysis?company=${company}&job=${posting.slug}`
    );
    expect(screen.getByText(/공식 공고 보기/).closest("a")?.getAttribute("href")).toBe(detail.source.url);
  });

  it("shows the selection process as numbered steps and listed facts one per line", () => {
    mocks.slug = posting.slug;
    const detail = JOB_POSTING_DETAILS[posting.slug];
    render(<JobPostingPage />);
    expect(screen.getByRole("heading", { name: "전형 절차" })).toBeTruthy();
    for (const track of detail.process) for (const step of track.steps) expect(screen.getByText(step)).toBeTruthy();
    const listed = detail.facts.find(fact => typeof fact.value !== "string");
    expect(listed, "공고마다 목록으로 보이는 칸이 하나는 있다").toBeTruthy();
    const items = (listed!.value as readonly string[]).length;
    expect(document.querySelectorAll("dd ul li").length).toBeGreaterThanOrEqual(items);
  });

  it("splits 지원 자격 into lines and links 접수처 to the site you apply on", () => {
    mocks.slug = posting.slug;
    const detail = JOB_POSTING_DETAILS[posting.slug];
    render(<JobPostingPage />);
    const apply = detail.facts.find(fact => fact.label === "접수처");
    expect(apply?.href, "접수처에는 지원하는 사이트 주소가 있다").toMatch(/^https:\/\//);
    const link = Array.from(document.querySelectorAll("dd a")).find(a => a.getAttribute("href") === apply?.href);
    expect(link?.getAttribute("target")).toBe("_blank");

    const qualification = detail.facts.find(fact => fact.label === "지원 자격");
    const lines = typeof qualification?.value === "string" ? qualification.value.split(" · ") : [];
    for (const line of lines) expect(screen.getByText(line, { exact: false }).closest("li"), line).toBeTruthy();
  });

  it("marks a closed posting once the browser knows the time", () => {
    mocks.slug = posting.slug;
    vi.setSystemTime(new Date("2030-01-01T00:00:00+09:00"));
    render(<JobPostingPage />);
    expect(screen.getByText(/마감된 공고예요/)).toBeTruthy();
  });

  it("falls back to 404 for an unknown slug", () => {
    mocks.slug = "no-such-posting";
    render(<JobPostingPage />);
    expect(screen.getByText("Page Not Found")).toBeTruthy();
    expect(document.querySelector('meta[name="robots"]')?.getAttribute("content")).toBe("noindex, nofollow");
  });
});
