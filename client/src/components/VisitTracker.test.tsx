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

import { resetVisitTrackerForTests, VisitTracker } from "./VisitTracker";

describe("VisitTracker", () => {
  beforeEach(() => {
    resetVisitTrackerForTests();
    mocks.location = "/";
    mocks.sendVisit.mockReset().mockResolvedValue(true);
    mocks.trackPageView.mockReset();
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

  it("does nothing when disabled or on admin paths", () => {
    render(<VisitTracker enabled={false} />);
    mocks.location = "/admin/dashboard";
    render(<VisitTracker enabled />);

    expect(mocks.sendVisit).not.toHaveBeenCalled();
    expect(mocks.trackPageView).not.toHaveBeenCalled();
  });
});
