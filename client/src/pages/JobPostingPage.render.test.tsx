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

const withQuestions = JOB_POSTINGS.find(posting => JOB_POSTING_DETAILS[posting.slug].questions.length > 0)!;
const withoutQuestions = JOB_POSTINGS.find(posting => JOB_POSTING_DETAILS[posting.slug].questions.length === 0);

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

  it("shows the questions with what they ask, sets its meta and starts the three flows with the posting", () => {
    mocks.slug = withQuestions.slug;
    const detail = JOB_POSTING_DETAILS[withQuestions.slug];
    render(<JobPostingPage />);

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(withQuestions.title);
    for (const question of detail.questions) expect(screen.getByText(question.prompt, { exact: false })).toBeTruthy();
    expect(screen.getAllByText("무엇을 묻나").length).toBe(detail.questions.length);
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe(
      `https://pre-view.me/jobs/${withQuestions.slug}`
    );

    const company = encodeURIComponent(withQuestions.company);
    expect(screen.getByText("내 경험으로 초안 쓰기").closest("a")?.getAttribute("href")).toBe(`/my/new?job=${withQuestions.slug}`);
    expect(screen.getByText("다 쓴 자소서 분석하기").closest("a")?.getAttribute("href")).toBe(
      `/analyze?company=${company}&job=${withQuestions.slug}`
    );
    expect(screen.getByText("이 회사 기업 분석 보기").closest("a")?.getAttribute("href")).toBe(`/company-analysis?company=${company}`);
    expect(screen.getByText(/공식 공고 보기/).closest("a")?.getAttribute("href")).toBe(detail.source.url);
  });

  it("explains where the questions are when the posting does not publish them", () => {
    if (!withoutQuestions) return;
    mocks.slug = withoutQuestions.slug;
    render(<JobPostingPage />);
    expect(screen.getByText(/지원서 화면에서 공개돼요/)).toBeTruthy();
    expect(screen.getByText("직무별로 이렇게 써 보세요")).toBeTruthy();
  });

  it("marks a closed posting once the browser knows the time", () => {
    mocks.slug = withQuestions.slug;
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
