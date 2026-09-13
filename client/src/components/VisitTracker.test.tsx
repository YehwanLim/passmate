// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  location: "/",
  sendVisit: vi.fn(),
  trackPageView: vi.fn(),
}));

vi.mock("wouter", () => ({ useLocation: () => [mocks.location, vi.fn()] }));
vi.mock("@/lib/siteVisits", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/siteVisits")>()),
  sendVisit: mocks.sendVisit,
}));
vi.mock("@/lib/analytics", () => ({ trackPageView: mocks.trackPageView }));

import { pageViewPath, resetVisitTrackerForTests, VisitTracker } from "./VisitTracker";

describe("VisitTracker", () => {
  beforeEach(() => {
    resetVisitTrackerForTests();
    mocks.location = "/";
    mocks.sendVisit.mockReset().mockResolvedValue(true);
    mocks.trackPageView.mockReset();
    window.history.replaceState({}, "", "/");
  });
  afterEach(() => cleanup());

  it("pings once per path even when the tree remounts (hydration recovery)", () => {
    const first = render(<VisitTracker enabled />);
    first.unmount();
    render(<VisitTracker enabled />);
    render(<VisitTracker enabled />);

    expect(mocks.sendVisit).toHaveBeenCalledTimes(1);
    expect(mocks.sendVisit).toHaveBeenCalledWith("/");
  });

  it("pings again when the path changes", () => {
    const view = render(<VisitTracker enabled />);
    mocks.location = "/login";
    view.rerender(<VisitTracker enabled />);

    expect(mocks.sendVisit.mock.calls.map(([path]) => path)).toEqual(["/", "/login"]);
  });

  it("leaves the first page_view to gtag config and sends one for each later route", () => {
    const view = render(<VisitTracker enabled />);
    expect(mocks.trackPageView).not.toHaveBeenCalled();

    mocks.location = "/login";
    view.rerender(<VisitTracker enabled />);
    view.unmount();
    render(<VisitTracker enabled />);

    expect(mocks.trackPageView).toHaveBeenCalledTimes(1);
    expect(mocks.trackPageView).toHaveBeenCalledWith("/login");
  });

  it("keeps only the public sample flag from the query, never a real report id", () => {
    expect(pageViewPath("/report-new", "?sample=1")).toBe("/report-new?sample=1");
    expect(pageViewPath("/company-report", "?sample=1&utm_source=threads")).toBe("/company-report?sample=1");
    expect(pageViewPath("/report-new", "?analysisId=analysis-1")).toBe("/report-new");
    expect(pageViewPath("/analyze", "")).toBe("/analyze");
  });

  it("reports the landing-to-sample move as the sample page, apart from a real report", () => {
    const view = render(<VisitTracker enabled />);

    // wouter 의 location 은 pathname 뿐이라 쿼리는 주소창에서 읽는다.
    window.history.replaceState({}, "", "/report-new?sample=1");
    mocks.location = "/report-new";
    view.rerender(<VisitTracker enabled />);

    // 예시 리포트의 CTA 로 분석 폼에 갔다가, 분석을 마치고 실제 리포트로 들어온 흐름.
    window.history.replaceState({}, "", "/analyze");
    mocks.location = "/analyze";
    view.rerender(<VisitTracker enabled />);
    window.history.replaceState({}, "", "/report-new?analysisId=analysis-1");
    mocks.location = "/report-new";
    view.rerender(<VisitTracker enabled />);

    expect(mocks.trackPageView.mock.calls.map(([path]) => path)).toEqual([
      "/report-new?sample=1",
      "/analyze",
      "/report-new",
    ]);
  });

  it("does nothing when disabled or on admin paths", () => {
    render(<VisitTracker enabled={false} />);
    mocks.location = "/admin/dashboard";
    render(<VisitTracker enabled />);

    expect(mocks.sendVisit).not.toHaveBeenCalled();
    expect(mocks.trackPageView).not.toHaveBeenCalled();
  });
});
