// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";

const mocks = vi.hoisted(() => ({ slug: "", sendFunnelEvent: vi.fn() }));

vi.mock("wouter", () => ({
  useParams: () => ({ slug: mocks.slug }),
  useLocation: () => ["/jobs/x", vi.fn()],
  Link: ({ href, children, className, onClick }: { href: string; children: unknown; className?: string; onClick?: () => void }) => (
    <a
      href={href}
      className={className}
      onClick={event => {
        event.preventDefault();
        onClick?.();
      }}
    >
      {children as never}
    </a>
  ),
}));
vi.mock("@/components/AuthButton", () => ({ default: () => null }));
vi.mock("@/lib/siteVisits", async importOriginal => ({
  ...(await importOriginal<typeof import("@/lib/siteVisits")>()),
  sendFunnelEvent: mocks.sendFunnelEvent,
}));

import { JOB_POSTINGS } from "@/constants/jobPostings";
import { JOB_POSTING_DETAILS } from "@/constants/jobPostingDetails";
import { openPostings } from "@/lib/jobPostingDates";
import { similarOpenPostings } from "@/lib/similarJobPostings";
import JobPostingPage from "./JobPostingPage";

const posting = JOB_POSTINGS[0];
const NEXT_HEADING = "지금 지원할 수 있는 비슷한 공고";
// 첫 공고(CJ, 09-30 마감)는 닫혀 있고 다른 공고는 열려 있는 시각(beforeEach 와 같다).
const NOW = new Date("2026-10-09T15:30:00+09:00");

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

  it("under a closed posting, links up to three open similar postings and the full list, without itself", () => {
    mocks.slug = posting.slug;
    mocks.sendFunnelEvent.mockClear();
    const expected = similarOpenPostings(posting, JOB_POSTINGS, NOW);
    expect(expected.length, "이 시각엔 접수 중 공고가 있어야 한다").toBeGreaterThan(0);
    render(<JobPostingPage />);

    const section = screen.getByRole("heading", { name: NEXT_HEADING }).closest("section") as HTMLElement;
    const rows = within(section).getAllByRole("listitem");
    expect(rows.length).toBeLessThanOrEqual(3);
    expect(rows.map(row => row.querySelector("a")?.getAttribute("href"))).toEqual(expected.map(item => `/jobs/${item.slug}`));
    expect(rows.some(row => row.querySelector("a")?.getAttribute("href") === `/jobs/${posting.slug}`)).toBe(false);
    expect(rows[0].textContent).toContain(expected[0].title);
    expect(rows[0].textContent).toContain(expected[0].roles);
    expect(rows[0].textContent).toMatch(/D-\d+|오늘 마감/);
    expect(within(section).getByText(/접수 중인 공고 전체 보기/).closest("a")?.getAttribute("href")).toBe("/jobs");

    fireEvent.click(rows[0].querySelector("a")!);
    expect(mocks.sendFunnelEvent).toHaveBeenCalledWith("content_cta_click", `closed-job-next:${posting.slug}`);
    // 마감 안내 문구는 그대로 있다.
    expect(screen.getByText(/마감된 공고예요/)).toBeTruthy();
  });

  it("does not show the next postings on an open posting", () => {
    const open = openPostings(JOB_POSTINGS, NOW)[0];
    mocks.slug = open.slug;
    render(<JobPostingPage />);
    expect(screen.queryByText(/마감된 공고예요/)).toBeNull();
    expect(screen.queryByRole("heading", { name: NEXT_HEADING })).toBeNull();
  });

  it("hides the whole block when no posting is open", () => {
    mocks.slug = posting.slug;
    vi.setSystemTime(new Date("2030-01-01T00:00:00+09:00"));
    render(<JobPostingPage />);
    expect(screen.getByText(/마감된 공고예요/)).toBeTruthy();
    expect(screen.queryByRole("heading", { name: NEXT_HEADING })).toBeNull();
    expect(screen.queryByText(/접수 중인 공고 전체 보기/)).toBeNull();
  });

  it("keeps the next postings out of the prerendered HTML and the hydration pass", async () => {
    mocks.slug = posting.slug;
    const html = renderToString(<JobPostingPage />);
    expect(html).toContain(posting.title);
    expect(html).not.toContain(NEXT_HEADING);
    expect(html).not.toContain("마감된 공고예요");

    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.appendChild(container);
    const recoverable = vi.fn();
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    let root: ReturnType<typeof hydrateRoot> | undefined;
    await act(async () => {
      root = hydrateRoot(container, <JobPostingPage />, { onRecoverableError: recoverable });
    });
    expect(recoverable).not.toHaveBeenCalled();
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
    // 하이드레이션이 끝난 뒤 브라우저 시각으로 다시 그리면 나타난다.
    expect(within(container).getByRole("heading", { name: NEXT_HEADING })).toBeTruthy();
    act(() => root?.unmount());
    container.remove();
  });

  it("falls back to 404 for an unknown slug", () => {
    mocks.slug = "no-such-posting";
    render(<JobPostingPage />);
    expect(screen.getByText("Page Not Found")).toBeTruthy();
    expect(document.querySelector('meta[name="robots"]')?.getAttribute("content")).toBe("noindex, nofollow");
  });
});
