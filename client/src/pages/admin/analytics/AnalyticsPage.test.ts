import { describe, expect, it } from "vitest";
import {
  ANALYTICS_PERIODS,
  FUNNEL_STAGES,
  buildFunnelAnalytics,
  getFunnelAnalytics,
} from "./AnalyticsPage";

describe("AnalyticsPage funnel analytics", () => {
  it("defines the requested period selector options", () => {
    expect(ANALYTICS_PERIODS.map((period) => period.label)).toEqual([
      "Today",
      "7 Days",
      "30 Days",
    ]);
  });

  it("models the PassMate conversion funnel in order", () => {
    expect(FUNNEL_STAGES).toEqual([
      "Landing",
      "Login",
      "Resume Upload",
      "AI Analysis",
      "Payment",
      "Completed",
    ]);
  });

  it("derives users, conversion rate, and drop-off rate from real count inputs", () => {
    const analytics = buildFunnelAnalytics("7d", {
      signedUpUsers: 100,
      resumeUploadUsers: 64,
      analysisUsers: 48,
      successUsers: 25,
      avgCompletionMs: 348000,
      analyses: [
        { created_at: "2026-07-06T00:00:00.000Z", status: "SUCCESS" },
        { created_at: "2026-07-06T00:00:00.000Z", status: "FAILED" },
        { created_at: "2026-07-07T00:00:00.000Z", status: "SUCCESS" },
      ],
      now: new Date("2026-07-12T12:00:00.000Z"),
    });

    expect(analytics.kpis.overallConversion).toBe("25.0%");
    expect(analytics.kpis.avgCompletionTime).toBe("5m 48s");
    expect(analytics.kpis.topDropOff).toBe("Payment -> Completed");
    expect(analytics.funnel).toHaveLength(FUNNEL_STAGES.length);
    expect(analytics.funnel[0]).toMatchObject({
      stage: "Landing",
      users: 100,
      conversionRate: 100,
      dropOffRate: 0,
    });
    expect(analytics.funnel.at(-1)).toMatchObject({
      stage: "Completed",
      users: 25,
      conversionRate: 25,
      dropOffRate: 47.9,
    });
  });

  it("keeps the analytics page stable when the database has no rows yet", () => {
    const analytics = getFunnelAnalytics("today");

    expect(analytics.kpis.overallConversion).toBe("0.0%");
    expect(analytics.kpis.avgCompletionTime).toBe("0s");
    expect(analytics.funnel.every((step) => step.users === 0)).toBe(true);
  });
});
